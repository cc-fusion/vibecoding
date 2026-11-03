/*******************************************************************************
  WebAssembly port of the taichi_mpm FULL solver (MLS-MPM + CPIC)
    "A Moving Least Squares Material Point Method with Displacement
     Discontinuity and Two-Way Rigid Body Coupling" (SIGGRAPH 2018)
  Original: Copyright (c) The Taichi MPM Authors (2018- ), MIT License.

  Files ported into this header:
    mpm_fwd.h, kernel.h, particles.h/.cpp, boundary_particle.h,
    particle_allocator.h, articulation.h/.cpp, rigid_body_solver.h (+ libccd
    MPR), taichi/dynamics/rigid_body.h/.cpp, mpm.h, mpm.cpp, transfer.cpp,
    rigid_transfer.cpp, mpm_rigid_body.cpp

  Porting notes:
    * SPGrid (virtual-memory sparse grid) is replaced by a block-sparse dense
      allocation with page maps (active / fat / rigid) and block-major particle
      sorting (radix sort instead of tbb::parallel_sort).
    * TBB parallel loops run serially (no shared-memory threads in the page).
    * SSE kernels are replaced by scalar code that clang auto-vectorizes
      (wasm SIMD128); the "optimized" block paths keep the same structure:
      non-rigid blocks skip all CPIC compatibility checks.
    * Python scripted functions are imported from JavaScript.
*******************************************************************************/
#pragma once

#include <new>
#include <time.h>
#include "taichi_lite.h"

#ifdef __wasm__
extern "C" __attribute__((import_module("env"), import_name("script_eval"))) void
tc_script_eval(int id, float t, float *out);
#else
extern "C" void tc_script_eval(int id, float t, float *out);
#endif

TC_NAMESPACE_BEGIN

inline double now_ms() {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec * 1e3 + ts.tv_nsec * 1e-6;
}

template <typename T>
TC_FORCE_INLINE T determinant(const MatrixND<4, T> &m) {
  T det = 0;
  for (int j = 0; j < 4; j++) {
    MatrixND<3, T> minor;
    for (int r = 1; r < 4; r++) {
      int cc = 0;
      for (int c = 0; c < 4; c++) {
        if (c == j)
          continue;
        minor[r - 1][cc++] = m[r][c];
      }
    }
    det += ((j % 2) ? -1 : 1) * m[0][j] * determinant(minor);
  }
  return det;
}

inline uint32 pack_color(const Vector3 &c, real a = 1.0f) {
  auto ch = [](real v) { return (uint32)clamp((int)std::lround(v * 255.0f), 0, 255); };
  return ch(c[0]) | (ch(c[1]) << 8) | (ch(c[2]) << 16) | (ch(a) << 24);
}
inline uint32 colormap(real t) {
  // perceptual-ish ramp: deep blue -> cyan -> yellow -> red
  static const real stops[5][3] = {{0.08f, 0.12f, 0.45f}, {0.0f, 0.6f, 0.9f},
                                   {0.3f, 0.9f, 0.5f},    {1.0f, 0.85f, 0.2f},
                                   {0.95f, 0.25f, 0.15f}};
  t = clamp(t, 0.0f, 1.0f) * 4.0f;
  int i = std::min((int)t, 3);
  real f = t - i;
  Vector3 c;
  for (int k = 0; k < 3; k++)
    c[k] = stops[i][k] * (1 - f) + stops[i + 1][k] * f;
  return pack_color(c);
}

// ============================================================================
// mpm_fwd.h
// ============================================================================
constexpr int mpm_kernel_order = 2;
constexpr bool mpm_use_weighted_reconstruction = true;
constexpr int cdf_kernel_order_rasterize = 2;
constexpr int cdf_kernel_order_gather = 2;
constexpr bool cdf_use_negative = true;
constexpr uint64 state_mask = 0xAAAAAAAAAAAAAAAAull;

template <int dim>
TC_FORCE_INLINE VectorND<dim, real> friction_project(const VectorND<dim, real> &velocity,
                                                     const VectorND<dim, real> &base_velocity,
                                                     const VectorND<dim, real> &normal,
                                                     real friction) {
  using Vector = VectorND<dim, real>;
  auto relative_vel = velocity - base_velocity;
  if (friction == -1)
    return base_velocity;
  bool slip = friction <= -2;
  if (slip)
    friction = -friction - 2;
  real normal_norm = dot(normal, relative_vel);
  Vector tangential_relative_vel = relative_vel - normal_norm * normal;
  real tangential_norm = length(tangential_relative_vel);
  real tangential_scale =
      std::max(tangential_norm + std::min(normal_norm, 0.0f) * friction, 0.0f) /
      std::max(1e-30f, tangential_norm);
  Vector projected_relative_vel = tangential_scale * tangential_relative_vel +
                                  std::max(0.0f, normal_norm * real(!slip)) * normal;
  return projected_relative_vel + base_velocity;
}

template <int dim>
constexpr int get_particle_size_upper_bound() {
  return dim == 2 ? 192 : 320;
}

template <int dim>
struct GridState {
  VectorND<dim + 1, real> velocity_and_mass;
  float32 distance;
  uint32 states;
  uint32 particle_count;
  uint32 padding_[dim == 2 ? 2 : 1];

  static constexpr int max_num_rigid_bodies = 12;
  static constexpr int total_bits = 32;
  static constexpr uint32 tag_bits = max_num_rigid_bodies * 2;
  static constexpr uint32 id_bits = total_bits - tag_bits;
  static constexpr uint32 tag_mask = (1u << tag_bits) - 1;
  static constexpr uint32 id_mask = ((1u << id_bits) - 1u) << tag_bits;

  TC_FORCE_INLINE int get_rigid_body_id() const { return (int)(states >> tag_bits) - 1; }
  TC_FORCE_INLINE void set_rigid_body_id(int id) {
    states = (states & ~id_mask) | ((uint32)(id + 1) << tag_bits);
  }
  TC_FORCE_INLINE float32 get_distance() const { return distance; }
  TC_FORCE_INLINE void set_distance(float32 d) { distance = d; }
  TC_FORCE_INLINE uint64 get_states() const { return states & tag_mask; }
  TC_FORCE_INLINE void set_states(uint32 s) { states = (states & ~tag_mask) | s; }
};
static_assert(sizeof(GridState<2>) == 32, "GridState<2> size must be 32 (POT)");
static_assert(sizeof(GridState<3>) == 32, "GridState<3> size must be 32 (POT)");

template <int dim>
constexpr float64 mpm_reconstruction_guard() {
  return dim == 2 ? 3e-3 : 1e-4;
}

// ============================================================================
// kernel.h  (quadratic B-spline, order 2)
// ============================================================================
template <int dim, int order>
struct MPMKernel;

template <int dim>
struct MPMKernel<dim, 2> {
  using Vector = VectorND<dim, real>;
  using VectorP = VectorND<dim + 1, real>;
  using VectorI = VectorND<dim, int>;
  static constexpr int kernel_size = 3;
  real w[dim][3];
  real dw[dim][3];
  real inv_delta_x;

  TC_FORCE_INLINE MPMKernel(const Vector &pos, real inv_delta_x) : inv_delta_x(inv_delta_x) {
    for (int k = 0; k < dim; k++) {
      real p = pos[k] - 0.5f;
      real f = p - std::floor(p);
      real t0 = f + 0.5f, t1 = f - 0.5f, t2 = f - 1.5f;
      w[k][0] = 0.5f * t0 * t0 - 1.5f * t0 + 1.125f;
      w[k][1] = -t1 * t1 + 0.75f;
      w[k][2] = 0.5f * t2 * t2 + 1.5f * t2 + 1.125f;
      dw[k][0] = t0 - 1.5f;
      dw[k][1] = -2.0f * t1;
      dw[k][2] = t2 + 1.5f;
    }
  }
  TC_FORCE_INLINE static int get_stencil_start(real x) { return int(x - 0.5f); }
  TC_FORCE_INLINE VectorP get_dw_w(const VectorI &k) const {
    VectorP ret;
    real wp = 1;
    for (int i = 0; i < dim; i++)
      wp *= w[i][k[i]];
    for (int j = 0; j < dim; j++) {
      real r = dw[j][k[j]] * inv_delta_x;
      for (int i = 0; i < dim; i++)
        if (i != j)
          r *= w[i][k[i]];
      ret[j] = r;
    }
    ret[dim] = wp;
    return ret;
  }
  TC_FORCE_INLINE real get_w(const VectorI &k) const {
    real wp = 1;
    for (int i = 0; i < dim; i++)
      wp *= w[i][k[i]];
    return wp;
  }
  static constexpr real inv_D() { return 6.0f - 2.0f; }
};

// ============================================================================
// Rigid body (taichi/dynamics/rigid_body.h + rigid_body.cpp)
// ============================================================================
template <int dim>
struct RigidBody {
  using Vector = VectorND<dim, real>;
  using Vectori = VectorND<dim, int>;
  using Matrix = MatrixND<dim, real>;
  using MatrixP = MatrixND<dim + 1, real>;
  using InertiaType = std::conditional_t<dim == 2, real, Matrix>;
  using RotationValueType = std::conditional_t<dim == 2, real, Vector3>;
  using PositionFunctionType = std::function<Vector(real)>;
  using RotationFunctionType = std::function<RotationValueType(real)>;
  using ElementType = Element<dim>;
  using MeshType = ElementMesh<dim>;

  bool codimensional;
  real frictions[2], restitution;
  MatrixP mesh_to_centroid;
  real mass, inv_mass;
  InertiaType inertia, inv_inertia;
  Vector position, velocity, tmp_velocity;
  real linear_damping, angular_damping;
  Vector3 color;
  AngularVelocity<dim> angular_velocity, tmp_angular_velocity;
  Rotation<dim> rotation;
  int id = 0;
  Vector rotation_axis;
  std::unique_ptr<MeshType> mesh;
  int pos_func_id = -1, rot_func_id = -1;
  PositionFunctionType pos_func;
  RotationFunctionType rot_func;

  RigidBody() {
    codimensional = false;
    mass = 0;
    inv_mass = 0;
    inertia = InertiaType(0.0f);
    inv_inertia = InertiaType(0.0f);
    frictions[0] = frictions[1] = 0;
    restitution = 0;
    linear_damping = 0;
    angular_damping = 0;
    color = Vector3(0.5f);
    mesh_to_centroid = MatrixP(1.0f);
  }

  void set_as_background() {
    set_infinity_inertia();
    set_infinity_mass();
    pos_func = [](real) { return Vector(0.0f); };
    rot_func = [](real) { return RotationValueType(0.0f); };
  }
  void apply_impulse(Vector impulse, Vector orig) {
    velocity += impulse * get_inv_mass();
    apply_torque(cross(orig - position, impulse));
  }
  void apply_torque(const typename AngularVelocity<dim>::ValueType &torque) {
    angular_velocity += get_transformed_inversed_inertia() * torque;
  }
  InertiaType get_transformed_inertia() const {
    if constexpr (dim == 2) {
      return inertia;
    } else {
      Matrix r = rotation.get_rotation_matrix();
      return r * inertia * transposed(r);
    }
  }
  InertiaType get_transformed_inversed_inertia() const {
    if constexpr (dim == 2) {
      return inv_inertia;
    } else {
      Matrix r = rotation.get_rotation_matrix();
      return r * inv_inertia * transposed(r);
    }
  }
  void apply_tmp_impulse(Vector impulse, Vector orig) {
    tmp_velocity += impulse * get_inv_mass();
    auto torque = cross(orig - position, impulse);
    tmp_angular_velocity += get_transformed_inversed_inertia() * torque;
  }
  void apply_position_impulse(Vector impulse, Vector orig) {
    position += impulse * get_inv_mass();
    auto torque = cross(orig - position, impulse);
    rotation.apply_angular_velocity(AngularVelocity<dim>(get_transformed_inversed_inertia() * torque), 1);
  }
  void advance(real t, real dt) {
    if (pos_func) {
      position = pos_func(t);
      real d = 1e-4f;
      velocity = (pos_func(t + d) - pos_func(t - d)) * (1.0f / (2.0f * d));
      if (velocity.abs_max() > 50.0f) {
        TC_WARN("Position not differentiable at time %f", t);
        velocity = Vector(0.0f);
      }
    } else {
      velocity *= std::exp(-linear_damping * dt);
      position += velocity * dt;
    }
    if (rot_func) {
      if constexpr (dim == 3) {
        auto rot_quat = [&](real t) {
          Vector3 r = rot_func(t) * (pi / 180.0f);
          return euler_zyx(r);
        };
        rotation.value = rot_quat(t);
        real d = 1e-3f;
        real angle;
        Vector3 axis;
        (rot_quat(t + d) * rot_quat(t - d).inverse()).to_angle_axis(angle, axis);
        angle *= (0.5f / d);
        if (std::fabs(angle) > 100.0f) {
          TC_WARN("Rotation not differentiable at time %f", t);
          angular_velocity.value = Vector3(0.0f);
        } else {
          angular_velocity.value = axis * angle;
        }
      } else {
        auto rot_angle = [&](real t) { return radians(rot_func(t)); };
        rotation.value = rot_angle(t);
        real d = 1e-4f;
        real rot = 0.5f * (rot_angle(t + d) - rot_angle(t - d)) / d;
        if (std::fabs(rot) > 1000.0f) {
          TC_WARN("Rotation not differentiable at time %f", t);
          angular_velocity.value = 0;
        } else {
          angular_velocity.value = rot;
        }
      }
    } else {
      angular_velocity.value = angular_velocity.value * std::exp(-angular_damping * dt);
      rotation.apply_angular_velocity(angular_velocity, dt);
    }
  }
  Vector get_velocity_from_offset(const Vector &offset) const {
    return angular_velocity.cross(offset) + velocity;
  }
  Vector get_velocity_at(const Vector &p) const { return get_velocity_from_offset(p - position); }
  Vector get_momemtum() const { return mass * velocity; }
  void reset_tmp_velocity() {
    tmp_angular_velocity = AngularVelocity<dim>();
    tmp_velocity = Vector(0.0f);
  }
  void apply_tmp_velocity() {
    angular_velocity += tmp_angular_velocity;
    velocity += tmp_velocity;
  }
  typename AngularVelocity<dim>::ValueType get_angular_momemtum() const {
    return inertia * angular_velocity.value;
  }
  MatrixP get_centroid_to_world() const {
    MatrixP trans(rotation.get_rotation_matrix());
    trans[dim][dim] = 1;
    for (int k = 0; k < dim; k++)
      trans[dim][k] = position[k];
    return trans;
  }
  MatrixP get_mesh_to_world() const { return get_centroid_to_world() * mesh_to_centroid; }
  void enforce_velocity_parallel_to(Vector direction) {
    direction = normalized(direction);
    velocity = dot(velocity, direction) * direction;
  }
  void enforce_velocity_perpendicular_to(Vector direction) {
    direction = normalized(direction);
    velocity = velocity - dot(velocity, direction) * direction;
  }
  void enforce_angular_velocity_parallel_to(Vector direction) {
    if constexpr (dim == 3) {
      direction = normalized(direction);
      angular_velocity.value = dot(angular_velocity.value, direction) * direction;
    }
  }
  real get_impulse_contribution(Vector r, Vector n) const {
    if constexpr (dim == 2) {
      return inv_mass + sqr(cross(r, n)) * inv_inertia;
    } else {
      real ret = inv_mass;
      Matrix inversed_inertia = get_transformed_inversed_inertia();
      Matrix rn = cross_product_matrix(r);
      inversed_inertia = transposed(rn) * inversed_inertia * rn;
      ret += dot(n, inversed_inertia * n);
      return ret;
    }
  }
  real get_mass() const { return mass; }
  real get_inv_mass() const { return inv_mass; }
  void set_mass(real m) {
    TC_ASSERT(std::isnormal(m));
    mass = m;
    inv_mass = 1.0f / m;
  }
  void set_infinity_mass() {
    mass = 1e30f;
    inv_mass = 0.0f;
  }
  void set_inertia(const InertiaType &in) {
    inertia = in;
    if constexpr (dim == 2) {
      inv_inertia = 1.0f / in;
    } else {
      inv_inertia = inversed(in.template cast<float64>()).template cast<real>();
    }
  }
  void set_infinity_inertia() {
    inertia = InertiaType(1e17f);
    inv_inertia = InertiaType(0.0f);
  }

  // rigid_body.cpp
  Vector initialize_mass_and_inertia(real density) {
    Vector center_of_mass(0.0f);
    real volume = 0.0f;
    InertiaType in(0.0f);
    const auto &elements = mesh->elements;
    int n = (int)elements.size();
    if constexpr (dim == 2) {
      if (codimensional) {
        for (int i = 0; i < n; i++) {
          Vector a = elements[i].v[0], b = elements[i].v[1];
          real l = length(a - b);
          volume += l;
          center_of_mass += l * (a + b) * 0.5f;
        }
        center_of_mass /= volume;
        for (int i = 0; i < n; i++) {
          // exact form of the "slices" integration of |x - c|^2 along a segment
          Vector a = elements[i].v[0] - center_of_mass, e = elements[i].v[1] - elements[i].v[0];
          in += length(e) * (a.length2() + dot(a, e) + e.length2() / 3.0f);
        }
      } else {
        for (int i = 0; i < n; i++) {
          Vector a = elements[i].v[0], b = elements[i].v[1];
          real area = 0.5f * (a[0] * b[1] - a[1] * b[0]);
          volume += area;
          center_of_mass += area * (a + b) * (1.0f / 3.0f);
        }
        center_of_mass /= volume;
        for (int i = 0; i < n; i++) {
          Vector ac = elements[i].v[0] - center_of_mass;
          Vector ba = elements[i].v[1] - elements[i].v[0];
          in += (ac[0] * ba[1] - ba[0] * ac[1]) *
                (3 * sqr(ac[0]) + 3 * sqr(ac[1]) + sqr(ba[0]) + sqr(ba[1]) +
                 3 * ac[0] * ba[0] + 3 * ac[1] * ba[1]);
        }
        in = in * (1.0f / 12);
      }
      TC_ASSERT_INFO(in >= 0, "Rigid body inertia cannot be negative. (Make sure vertices are counter-clockwise)");
    } else {
      if (codimensional) {
        for (int i = 0; i < n; ++i) {
          const auto &t = elements[i];
          real a = length(cross(t.v[1] - t.v[0], t.v[2] - t.v[0])) * 0.5f;
          volume += a;
          center_of_mass += (t.v[0] + t.v[1] + t.v[2]) * (a / 3.0f);
        }
        center_of_mass /= volume;
        for (int i = 0; i < n; i++) {
          const auto &t = elements[i];
          Vector r = (t.v[0] + t.v[1] + t.v[2]) * (1.0f / 3.0f) - center_of_mass;
          real a = length(cross(t.v[1] - t.v[0], t.v[2] - t.v[0])) * 0.5f;
          in += (Matrix(dot(r, r)) - Matrix::outer_product(r, r)) * a;
        }
      } else {
        for (int i = 0; i < n; ++i) {
          const auto &t = elements[i];
          Matrix vol_mat(t.v[0], t.v[1], t.v[2]);
          real local_volume = determinant(vol_mat) / 6;
          volume += local_volume;
          center_of_mass += (t.v[0] + t.v[1] + t.v[2]) * (local_volume / 4.0f);
        }
        center_of_mass /= volume;
        // tetrahedron (origin = COM) covariance -> inertia tensor
        Matrix C(0.0f);
        for (int i = 0; i < n; i++) {
          Vector a = elements[i].v[0] - center_of_mass, b = elements[i].v[1] - center_of_mass,
                 c = elements[i].v[2] - center_of_mass;
          real det = determinant(Matrix(a, b, c));
          Vector s = a + b + c;
          C += (Matrix::outer_product(a, a) + Matrix::outer_product(b, b) +
                Matrix::outer_product(c, c) + Matrix::outer_product(s, s)) *
               (det / 120.0f);
        }
        in = Matrix(C.trace()) - C;
      }
    }
    set_inertia(in * density);
    set_mass(volume * density);
    TC_ASSERT_INFO(mass > 0, "Rigid body mass cannot be negative. (Make sure vertices are counter-clockwise)");
    return center_of_mass;
  }
};

// ============================================================================
// particles.h / particles.cpp
// ============================================================================
enum MaterialId : uint8 {
  MAT_NONE = 0, MAT_SNOW, MAT_JELLY, MAT_SAND, MAT_WATER, MAT_VON_MISES,
  MAT_ELASTIC, MAT_LINEAR, MAT_VISCO, MAT_RIGID
};

inline Vector3 default_material_color(int m) {
  static const real c[10][3] = {{0.8f, 0.8f, 0.8f}, {0.92f, 0.95f, 1.0f}, {0.95f, 0.45f, 0.55f},
                                {0.93f, 0.76f, 0.45f}, {0.25f, 0.55f, 0.95f}, {0.65f, 0.85f, 0.35f},
                                {0.98f, 0.62f, 0.25f}, {0.7f, 0.5f, 0.95f},  {0.4f, 0.85f, 0.8f},
                                {0.9f, 0.9f, 0.9f}};
  return Vector3(c[m][0], c[m][1], c[m][2]);
}

template <int dim>
class MPMParticle {
 public:
  using Vector = VectorND<dim, real>;
  using VectorP = VectorND<dim + 1, real>;
  using Matrix = MatrixND<dim, real>;

 private:
  VectorP v_and_m;

 public:
  Vector pos;
  Matrix dg_e;
  Matrix apic_b;
  Vector boundary_normal;
  real boundary_distance;
  real vol;
  bool near_boundary_;
  bool sticky;
  bool is_rigid_;
  uint8 material;  // [port] visualization only
  uint32 states;
  int32 id;
  real debug;
  uint32 color;  // [port] visualization only (RGBA8)

  TC_FORCE_INLINE bool is_rigid() const { return is_rigid_; }
  TC_FORCE_INLINE real get_mass() const { return v_and_m[dim]; }
  TC_FORCE_INLINE void set_mass(real mass) { v_and_m[dim] = mass; }
  TC_FORCE_INLINE Vector get_velocity() const { return Vector(v_and_m); }
  TC_FORCE_INLINE void set_velocity(const Vector &v) { v_and_m = VectorP(v, v_and_m[dim]); }

  MPMParticle() {
    dg_e = Matrix(1.0f);
    apic_b = Matrix(0.0f);
    v_and_m = VectorP(0.0f);
    vol = 1.0f;
    states = 0;
    boundary_normal = Vector(0.0f);
    boundary_distance = 0.0f;
    near_boundary_ = false;
    sticky = false;
    id = 0;
    is_rigid_ = false;
    material = MAT_NONE;
    debug = 0;
    color = 0xffffffffu;
  }
  bool near_boundary() const { return near_boundary_; }
  uint32 get_state(int i) const { return (states >> (i * 2)) % 4; }
  void set_state(int i, int state) { states = states ^ ((state ^ get_state(i)) << (i * 2)); }
  virtual real get_allowed_dt(const real &dx) const = 0;
  virtual void initialize(const Config &config) {
    if (config.has_key("compressibility"))
      TC_ERROR("'compressibility' is deprecated. Use 'initial_dg' instead");
    dg_e = Matrix(config.get("initial_dg", 1.0f));
    color = pack_color(config.get("color", default_material_color(material)));
  }
  virtual real potential_energy() const { return 0; }
  virtual Matrix first_piola_kirchhoff() { return Matrix(0.0f); }
  virtual Matrix calculate_force() { return Matrix(0.0f); }
  virtual int plasticity(const Matrix &cdg) { return 0; }
  virtual ~MPMParticle() {}
  virtual real get_stiffness() const { return 0; }
  virtual void set_mu_to_zero() {}
  virtual void set_lambda_and_mu_to_zero() {}
  // [port] scalar used by the "plasticity" visualization mode
  virtual real get_plastic_measure() const { return determinant(dg_e); }
};

template <int dim>
class ViscoParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Vector = typename Base::Vector;
  using Matrix = typename Base::Matrix;
  real visco_tau, visco_nu, visco_kappa, lambda_0, mu_0, dt;
  ViscoParticle() { this->material = MAT_VISCO; }
  void initialize(const Config &config) override {
    Base::initialize(config);
    real E = config.get("youngs_modulus", 4e4f);
    real nu = config.get("poisson_ratio", 0.4f);
    lambda_0 = E * nu / ((1.0f + nu) * (1.0f - 2.0f * nu));
    mu_0 = E / (2.0f * (1.0f + nu));
    visco_tau = config.get("tau", 1000.0f);
    visco_nu = config.get("nu", 10000.0f);
    visco_kappa = config.get("kappa", 0.0f);
    dt = config.get("base_delta_t", 1e-4f);
  }
  Matrix first_piola_kirchhoff() override {
    real j_e = determinant(this->dg_e);
    Matrix r, s;
    polar_decomp(this->dg_e, r, s);
    return 2 * mu_0 * (this->dg_e - r) + lambda_0 * (j_e - 1) * j_e * inverse(transpose(this->dg_e));
  }
  Matrix calculate_force() override {
    return -this->vol * first_piola_kirchhoff() * transpose(this->dg_e);
  }
  Matrix approximate_exponent(real dt, const Matrix &m) {
    Matrix s = m * dt;
    Matrix r = (s * 0.5f + Matrix(1.0f)) * s + Matrix(1.0f);
    if (determinant(r) > 0.0f)
      return r;
    Matrix tmp = approximate_exponent(dt / 2, m);
    return tmp * tmp;
  }
  int plasticity(const Matrix &cdg) override {
    Matrix dg_e_hat = approximate_exponent(dt, (cdg - Matrix(1.0f)) * (1.0f / dt)) * this->dg_e;
    Matrix svd_u, sig, svd_v;
    svd(dg_e_hat, svd_u, sig, svd_v);
    real pnorm = first_piola_kirchhoff().frobenius_norm();
    real gamma = 0.0f;
    if (pnorm > 1e-5f)
      gamma = clamp(dt * visco_nu * (pnorm - visco_tau) / pnorm, 0.0f, 1.0f);
    real scale = 1.0f;
    if (std::fabs(determinant(sig)) > 1e-5f)
      scale = 1.0f / std::pow(determinant(sig), 1.0f / real(dim));
    Matrix middle(0.0f), middle_inv(0.0f);
    for (int d = 0; d < dim; ++d)
      middle[d][d] = std::pow(sig[d][d] * scale, gamma);
    for (int d = 0; d < dim; ++d)
      middle_inv[d][d] = std::fabs(middle[d][d]) > 1e-5f ? 1.0f / middle[d][d] : 1.0f;
    this->dg_e = svd_u * sig * middle_inv * transpose(svd_v);
    svd(this->dg_e, svd_u, sig, svd_v);
    for (int d = 0; d < dim; ++d)
      sig[d][d] = clamp(sig[d][d], 0.1f, 10.0f);
    this->dg_e = svd_u * sig * transpose(svd_v);
    visco_tau += visco_kappa * gamma * pnorm;
    return 0;
  }
  real get_allowed_dt(const real &dx) const override { return dx; }
};

template <int dim>
class SnowParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Vector = typename Base::Vector;
  using Matrix = typename Base::Matrix;
  real Jp, hardening, mu_0, lambda_0, theta_c, theta_s, min_Jp, max_Jp;
  SnowParticle() { this->material = MAT_SNOW; }
  void initialize(const Config &config) override {
    Base::initialize(config);
    hardening = config.get("hardening", 10.0f);
    real E = config.get("youngs_modulus", 1.4e5f);
    real nu = config.get("poisson_ratio", 0.2f);
    lambda_0 = config.get("lambda_0", E * nu / ((1.0f + nu) * (1.0f - 2.0f * nu)));
    mu_0 = config.get("mu_0", E / (2.0f * (1.0f + nu)));
    theta_c = config.get("theta_c", 2.5e-2f);
    theta_s = config.get("theta_s", 7.5e-3f);
    min_Jp = config.get("min_Jp", 0.6f);
    max_Jp = config.get("max_Jp", 20.0f);
    Jp = config.get("Jp", 1.0f);
  }
  std::pair<real, real> get_lame_parameters() const {
    real e = std::exp(hardening * (1.0f - Jp));
    return {mu_0 * e, lambda_0 * e};
  }
  Matrix first_piola_kirchhoff() override {
    real j_e = determinant(this->dg_e);
    auto lame = get_lame_parameters();
    real mu = lame.first, lambda = lame.second;
    Matrix r, s;
    polar_decomp(this->dg_e, r, s);
    return 2 * mu * (this->dg_e - r) + lambda * (j_e - 1) * j_e * inverse(transpose(this->dg_e));
  }
  Matrix calculate_force() override {
    return -this->vol * first_piola_kirchhoff() * transpose(this->dg_e);
  }
  int plasticity(const Matrix &cdg) override {
    this->dg_e = cdg * this->dg_e;
    real dg_e_det_orig = 1.0f, dg_e_det = 1.0f;
    Matrix svd_u, sig, svd_v;
    svd(this->dg_e, svd_u, sig, svd_v);
    for (int i = 0; i < dim; i++) {
      dg_e_det_orig *= sig[i][i];
      sig[i][i] = clamp(sig[i][i], 1.0f - theta_c, 1.0f + theta_s);
      dg_e_det *= sig[i][i];
    }
    this->dg_e = svd_u * sig * transposed(svd_v);
    real Jp_new = Jp * dg_e_det_orig / dg_e_det;
    if (!(Jp_new <= max_Jp))
      Jp_new = max_Jp;
    if (!(Jp_new >= min_Jp))
      Jp_new = min_Jp;
    Jp = Jp_new;
    return 0;
  }
  real get_allowed_dt(const real &dx) const override {
    real J = determinant(this->dg_e) * Jp;
    real rho = this->get_mass() / this->vol / J;
    auto lame = get_lame_parameters();
    real c = std::sqrt((lame.second + 2.0f * lame.first) / rho);
    return dx / (c + this->get_velocity().length());
  }
  real get_stiffness() const override {
    auto lame = get_lame_parameters();
    return this->vol * (lame.first + 2 * lame.second);
  }
  real get_plastic_measure() const override { return Jp; }
};

template <int dim>
class LinearParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Matrix = typename Base::Matrix;
  real E, nu, mu, lambda;
  LinearParticle() { this->material = MAT_LINEAR; }
  void initialize(const Config &config) override {
    Base::initialize(config);
    E = config.get("E", 1e5f);
    nu = config.get("nu", 0.3f);
    mu = E / (2 * (1 + nu));
    lambda = E * nu / ((1 + nu) * (1 - 2 * nu));
  }
  real potential_energy() const override {
    auto e = 0.5f * (this->dg_e + transposed(this->dg_e)) - Matrix(1.0f);
    return this->vol * (mu * e.frobenius_norm2() + 0.5f * lambda * sqr(e.trace()));
  }
  Matrix first_piola_kirchhoff() override {
    return mu * (this->dg_e + transposed(this->dg_e) - Matrix(2.0f)) +
           Matrix(lambda * (this->dg_e.trace() - dim));
  }
  Matrix calculate_force() override {
    return -this->vol * first_piola_kirchhoff() * transpose(this->dg_e);
  }
  int plasticity(const Matrix &cdg) override {
    this->dg_e = cdg * this->dg_e;
    return 0;
  }
  real get_allowed_dt(const real &dx) const override { return 0.0f; }
  void set_mu_to_zero() override { mu = 0; }
  void set_lambda_and_mu_to_zero() override { mu = lambda = 0; }
};

template <int dim>
class JellyParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Matrix = typename Base::Matrix;
  real E, nu, mu, lambda;
  JellyParticle() { this->material = MAT_JELLY; }
  void initialize(const Config &config) override {
    Base::initialize(config);
    E = config.get("E", 1e5f);
    nu = config.get("nu", 0.3f);
    mu = E / (2 * (1 + nu));
    lambda = E * nu / ((1 + nu) * (1 - 2 * nu));
  }
  Matrix first_piola_kirchhoff() override {
    real j = determinant(this->dg_e);
    Matrix r, s;
    polar_decomp(this->dg_e, r, s);
    return 2 * mu * (this->dg_e - r) + lambda * (j - 1) * j * inverse(transpose(this->dg_e));
  }
  real potential_energy() const override {
    real J = determinant(this->dg_e);
    Matrix r, s;
    polar_decomp(this->dg_e, r, s);
    return (mu * (this->dg_e - r).frobenius_norm2() + 0.5f * lambda * sqr(J - 1.0f)) * this->vol;
  }
  Matrix calculate_force() override {
    return -this->vol * first_piola_kirchhoff() * transpose(this->dg_e);
  }
  int plasticity(const Matrix &cdg) override {
    this->dg_e = cdg * this->dg_e;
    return 0;
  }
  real get_allowed_dt(const real &dx) const override { return 0.0f; }
  void set_mu_to_zero() override { mu = 0; }
  void set_lambda_and_mu_to_zero() override { mu = lambda = 0; }
};

template <int dim>
class WaterParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Matrix = typename Base::Matrix;
  real k = 10000.f;
  real gamma = 7.f;
  real j;
  WaterParticle() { this->material = MAT_WATER; }
  void initialize(const Config &config) override {
    Base::initialize(config);
    k = config.get("k", k);
    gamma = config.get("gamma", gamma);
    j = 1.f;
  }
  Matrix calculate_force() override {
    real p = k * (std::pow(j, -gamma) - 1.f);
    Matrix sigma = -p * Matrix(1.f);
    return -this->vol * j * sigma;
  }
  int plasticity(const Matrix &cdg) override {
    j *= cdg.diag().sum() - (dim - 1);
    const real threshold = 0.1f;
    if (j < threshold)
      j = threshold;  // (original logs a message here)
    return bool(int(j > 1));
  }
  real get_allowed_dt(const real &dx) const override {
    real c = std::sqrt(k * gamma / std::pow(j, gamma - 1));
    return dx / (c + this->get_velocity().length());
  }
  real get_plastic_measure() const override { return j; }
};

template <int dim>
class SandParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Vector = typename Base::Vector;
  using Matrix = typename Base::Matrix;
  real lambda_0 = 204057.0f, mu_0 = 136038.0f;
  real friction_angle = 30.0f;
  real alpha = 1.0f;
  real cohesion = 0.0f;
  real logJp = 0.0f;
  real beta = 1.0f;
  SandParticle() { this->material = MAT_SAND; }
  void initialize(const Config &config) override {
    Base::initialize(config);
    lambda_0 = config.get("lambda_0", lambda_0);
    mu_0 = config.get("mu_0", mu_0);
    friction_angle = config.get("friction_angle", 30.0f);
    real sin_phi = std::sin(friction_angle / 180.0f * real(3.141592653));
    alpha = std::sqrt(2.0f / 3.0f) * 2.0f * sin_phi / (3.0f - sin_phi);
    cohesion = config.get("cohesion", 0.0f);
    logJp = 0.0f;
    beta = config.get("beta", 1.0f);
  }
  void project(Matrix sigma, real alpha, Matrix &sigma_out) {
    const real d = dim;
    Vector epsilon_diag;
    for (int i = 0; i < dim; i++)
      epsilon_diag[i] = std::log(std::max(std::fabs(sigma[i][i]), 1e-4f)) - cohesion;
    Matrix epsilon(epsilon_diag);
    real tr = epsilon.diag().sum() + logJp;
    Matrix epsilon_hat = epsilon - (tr) / d * Matrix(1.0f);
    real epsilon_hat_for = epsilon_hat.diag().length();
    auto expf_ = [](real x) { return std::exp(x); };
    if (tr >= 0.0f) {
      sigma_out = Matrix(std::exp(cohesion));
      logJp = beta * epsilon.diag().sum() + logJp;
    } else {
      logJp = 0;
      real delta_gamma = epsilon_hat_for + (d * lambda_0 + 2 * mu_0) / (2 * mu_0) * tr * alpha;
      if (delta_gamma <= 0) {
        Matrix h = epsilon + Matrix(cohesion);
        sigma_out = Matrix(h.diag().map(expf_));
      } else {
        Matrix h = epsilon - delta_gamma / epsilon_hat_for * epsilon_hat + Matrix(cohesion);
        sigma_out = Matrix(h.diag().map(expf_));
      }
    }
  }
  Matrix calculate_force() override {
    Matrix u, v, sig, dg = this->dg_e;
    svd(this->dg_e, u, sig, v);
    Matrix log_sig(sig.diag().map([](real x) { return std::log(x); }));
    Matrix inv_sig(Vector(1.0f) / sig.diag());
    Matrix center = 2.0f * mu_0 * inv_sig * log_sig + lambda_0 * (log_sig.diag().sum()) * inv_sig;
    return -this->vol * (u * center * transpose(v)) * transpose(dg);
  }
  int plasticity(const Matrix &cdg) override {
    this->dg_e = cdg * this->dg_e;
    Matrix u, v, sig;
    svd(this->dg_e, u, sig, v);
    Matrix t(1.0f);
    project(sig, alpha, t);
    this->dg_e = u * t * transposed(v);
    return 0;
  }
  real get_allowed_dt(const real &dx) const override { return dx; }
  real get_plastic_measure() const override { return std::exp(logJp); }
};

template <int dim>
class VonMisesParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Vector = typename Base::Vector;
  using Matrix = typename Base::Matrix;
  real lambda_0, mu_0, yield_stress;
  VonMisesParticle() { this->material = MAT_VON_MISES; }
  void initialize(const Config &config) override {
    Base::initialize(config);
    real youngs_modulus = config.get("youngs_modulus", 5e3f);
    real poisson_ratio = config.get("poisson_ratio", 0.4f);
    lambda_0 = youngs_modulus * poisson_ratio / ((1.0f + poisson_ratio) * (1.0f - 2.0f * poisson_ratio));
    mu_0 = youngs_modulus / (2.0f * (1.0f + poisson_ratio));
    yield_stress = config.get("yield_stress", 1.0f);
  }
  Matrix calculate_force() override {
    Matrix u, v, sig, dg = this->dg_e;
    svd(this->dg_e, u, sig, v);
    Matrix log_sig(sig.diag().map([](real x) { return std::log(x); }));
    Matrix inv_sig(Vector(1.0f) / sig.diag());
    Matrix center = 2.0f * mu_0 * inv_sig * log_sig + lambda_0 * (log_sig.diag().sum()) * inv_sig;
    return -this->vol * (u * center * transpose(v)) * transpose(dg);
  }
  int plasticity(const Matrix &cdg) override {
    this->dg_e = cdg * this->dg_e;
    Matrix U, V, sigma;
    svd(this->dg_e, U, sigma, V);
    Matrix epsilon(sigma.diag().map([](real x) { return std::log(x); }));
    real trace_epsilon = epsilon.trace();
    Matrix epsilon_hat = epsilon - (trace_epsilon / (real)dim) * Matrix(1.0f);
    real epsilon_hat_norm = epsilon_hat.frobenius_norm2();
    real delta_gamma = epsilon_hat_norm - yield_stress / (2.0f * mu_0);
    if (delta_gamma <= 0)
      return 0;
    Matrix H = epsilon - (delta_gamma / epsilon_hat_norm) * epsilon_hat;
    Matrix exp_H(H.diag().map([](real x) { return std::exp(x); }));
    this->dg_e = U * exp_H * transposed(V);
    return 1;
  }
  real get_allowed_dt(const real &dx) const override { return dx; }
};

template <int dim>
class ElasticParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Vector = typename Base::Vector;
  using Matrix = typename Base::Matrix;
  real lambda_0, mu_0, E, nu;
  ElasticParticle() { this->material = MAT_ELASTIC; }
  void initialize(const Config &config) override {
    Base::initialize(config);
    E = config.get("E", 5e3f);
    nu = config.get("nu", 0.4f);
    lambda_0 = E * nu / ((1.0f + nu) * (1.0f - 2.0f * nu));
    mu_0 = E / (2.0f * (1.0f + nu));
  }
  real potential_energy() const override {
    Matrix u, v, sig;
    svd(this->dg_e, u, sig, v);
    Vector log_sigma = sig.diag().abs().map([](real x) { return std::log(x); });
    return (mu_0 * log_sigma.length2() + 0.5f * lambda_0 * sqr(log_sigma.sum())) * this->vol;
  }
  Matrix calculate_force() override {
    Matrix u, v, sig, dg = this->dg_e;
    svd(this->dg_e, u, sig, v);
    Matrix log_sig(sig.diag().map([](real x) { return std::log(x); }));
    Matrix inv_sig(Vector(1.0f) / sig.diag());
    Matrix center = 2.0f * mu_0 * inv_sig * log_sig + lambda_0 * (log_sig.diag().sum()) * inv_sig;
    return -this->vol * (u * center * transpose(v)) * transpose(dg);
  }
  int plasticity(const Matrix &cdg) override {
    this->dg_e = cdg * this->dg_e;
    return 0;
  }
  real get_allowed_dt(const real &dx) const override { return dx; }
};

// ============================================================================
// boundary_particle.h
// ============================================================================
template <int dim>
class RigidBoundaryParticle : public MPMParticle<dim> {
 public:
  using Base = MPMParticle<dim>;
  using Vector = typename Base::Vector;
  using Matrix = typename Base::Matrix;
  using ElementType = typename RigidBody<dim>::ElementType;
  RigidBody<dim> *rigid = nullptr;
  ElementType untransformed_element;
  Vector offset;
  Vector original_normal;
  RigidBoundaryParticle() {
    this->is_rigid_ = true;
    this->material = MAT_RIGID;
  }
  void initialize(const Config &config) override {
    Base::initialize(config);
    rigid = config.get_ptr<RigidBody<dim>>("rigid");
    offset = config.get<Vector>("offset");
    original_normal = config.get<Vector>("normal");
  }
  void align_with_rigid_body() {
    this->pos = get_anchor_point();
    this->set_velocity(rigid->velocity + rigid->angular_velocity.cross(rigid->rotation.rotate(offset)));
  }
  Vector get_normal() const { return rigid->rotation.rotate(original_normal); }
  real get_allowed_dt(const real &dx) const override { return 0.0f; }
  Vector get_anchor_point() const { return transform<dim>(rigid->get_centroid_to_world(), offset); }
  ElementType get_world_space_element() const {
    return untransformed_element.get_transformed(rigid->get_mesh_to_world());
  }
};

template <int dim>
MPMParticle<dim> *create_particle_inplace(const std::string &type, void *mem) {
#define TC_PARTICLE_CASE(name, cls)                                                     \
  if (type == name) {                                                                   \
    static_assert(sizeof(cls<dim>) <= get_particle_size_upper_bound<dim>(),             \
                  "MPM particle exceeds the allocator slot size");                      \
    return new (mem) cls<dim>();                                                        \
  }
  TC_PARTICLE_CASE("snow", SnowParticle)
  TC_PARTICLE_CASE("jelly", JellyParticle)
  TC_PARTICLE_CASE("sand", SandParticle)
  TC_PARTICLE_CASE("water", WaterParticle)
  TC_PARTICLE_CASE("von_mises", VonMisesParticle)
  TC_PARTICLE_CASE("elastic", ElasticParticle)
  TC_PARTICLE_CASE("linear", LinearParticle)
  TC_PARTICLE_CASE("visco", ViscoParticle)
  TC_PARTICLE_CASE("rigid_boundary", RigidBoundaryParticle)
#undef TC_PARTICLE_CASE
  TC_ERROR("Unknown particle type '%s'", type.c_str());
  return nullptr;
}

// ============================================================================
// particle_allocator.h
// ============================================================================
template <int dim>
struct ParticleAllocator {
  static constexpr int slot_size = get_particle_size_upper_bound<dim>();
  struct alignas(16) Slot {
    unsigned char data[slot_size];
  };
  std::vector<Slot> pool, pool_;
  std::pair<uint32, MPMParticle<dim> *> allocate_particle(const std::string &type) {
    uint32 id = (uint32)pool.size();
    pool.emplace_back();
    MPMParticle<dim> *p = create_particle_inplace<dim>(type, pool[id].data);
    return {id, p};
  }
  TC_FORCE_INLINE MPMParticle<dim> *operator[](uint32 i) {
    return reinterpret_cast<MPMParticle<dim> *>(pool[i].data);
  }
  void gc(size_t n) { pool.resize(n); }
};

// ============================================================================
// rigid_body_solver.h  (libccd MPR re-implemented in double precision)
// ============================================================================
template <int dim>
class Collision {
 public:
  using Vector = VectorND<dim, real>;
  RigidBody<dim> *objects[2];
  Vector normal;
  Vector p;
  real depth;
  Collision(RigidBody<dim> *a, RigidBody<dim> *b, real depth, Vector normal, Vector p)
      : normal(normal), p(p), depth(depth) {
    objects[0] = a;
    objects[1] = b;
  }
  void project_velocity() {
    real friction = std::sqrt(objects[0]->frictions[0] * objects[1]->frictions[0]);
    real cRestitution = std::sqrt(objects[0]->restitution * objects[1]->restitution);
    Vector v10 = objects[1]->get_velocity_at(p) - objects[0]->get_velocity_at(p);
    Vector r0 = p - objects[0]->position, r1 = p - objects[1]->position;
    real v0 = -dot(normal, v10);
    real J = ((1 + cRestitution) * v0) /
             (objects[0]->get_impulse_contribution(r0, normal) +
              objects[1]->get_impulse_contribution(r1, normal));
    if (J < 0)
      return;
    Vector impulse = J * normal;
    objects[0]->apply_impulse(-impulse, p);
    objects[1]->apply_impulse(impulse, p);
    v10 = objects[1]->get_velocity_at(p) - objects[0]->get_velocity_at(p);
    Vector tao = v10 - normal * dot(normal, v10);
    if (tao.abs_max() > 1e-7f) {
      tao = normalized(tao);
      real j = -dot(v10, tao) / (objects[0]->get_impulse_contribution(r0, tao) +
                                 objects[1]->get_impulse_contribution(r1, tao));
      j = std::max(std::min(j, friction * J), -friction * J);
      Vector fImpulse = j * tao;
      objects[0]->apply_impulse(-fImpulse, p);
      objects[1]->apply_impulse(fImpulse, p);
    }
  }
  void project_position(real dt, real penalty) {
    Vector r0 = p - objects[0]->position, r1 = p - objects[1]->position;
    real J = penalty * dt * depth /
             (objects[0]->get_impulse_contribution(r0, normal) +
              objects[1]->get_impulse_contribution(r1, normal));
    if (J < 0)
      return;
    Vector impulse = J * normal;
    objects[0]->apply_impulse(-impulse, p);
    objects[1]->apply_impulse(impulse, p);
  }
};

namespace ccd {
struct V3 {
  double x = 0, y = 0, z = 0;
  V3() {}
  V3(double x, double y, double z) : x(x), y(y), z(z) {}
  V3 operator+(const V3 &o) const { return V3(x + o.x, y + o.y, z + o.z); }
  V3 operator-(const V3 &o) const { return V3(x - o.x, y - o.y, z - o.z); }
  V3 operator*(double s) const { return V3(x * s, y * s, z * s); }
  double dot(const V3 &o) const { return x * o.x + y * o.y + z * o.z; }
  V3 cross(const V3 &o) const { return V3(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x); }
  double len2() const { return dot(*this); }
  V3 normalized() const {
    double l = std::sqrt(len2());
    return l > 0 ? (*this) * (1.0 / l) : *this;
  }
};
constexpr double EPS = 2.220446049250313e-16;
inline bool is_zero(double v) { return std::fabs(v) < EPS; }
inline bool eq(double a, double b) {
  double ab = std::fabs(a - b);
  if (ab < EPS)
    return true;
  double fa = std::fabs(a), fb = std::fabs(b);
  return fb > fa ? ab < EPS * fb : ab < EPS * fa;
}
inline bool veq(const V3 &a, const V3 &b) { return eq(a.x, b.x) && eq(a.y, b.y) && eq(a.z, b.z); }
struct Support {
  V3 v, v1, v2;
};
// Squared distance between point P and triangle ABC, closest point -> witness
inline double point_tri_dist2(const V3 &P, const V3 &A, const V3 &B, const V3 &C, V3 &w) {
  V3 ab = B - A, ac = C - A, ap = P - A;
  double d1 = ab.dot(ap), d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) { w = A; return (P - w).len2(); }
  V3 bp = P - B;
  double d3 = ab.dot(bp), d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) { w = B; return (P - w).len2(); }
  double vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { w = A + ab * (d1 / (d1 - d3)); return (P - w).len2(); }
  V3 cp = P - C;
  double d5 = ab.dot(cp), d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) { w = C; return (P - w).len2(); }
  double vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { w = A + ac * (d2 / (d2 - d6)); return (P - w).len2(); }
  double va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    w = B + (C - B) * ((d4 - d3) / ((d4 - d3) + (d5 - d6)));
    return (P - w).len2();
  }
  double denom = 1.0 / (va + vb + vc);
  w = A + ab * (vb * denom) + ac * (vc * denom);
  return (P - w).len2();
}

template <typename S1, typename S2>
class MPR {
  const S1 &s1;
  const S2 &s2;
  V3 c1, c2;
  double tolerance;
  Support p[4];
  int size = 0;
  int max_iterations = 1000;

  Support support(const V3 &dir) const {
    Support s;
    s.v1 = s1(dir);
    s.v2 = s2(dir * -1.0);
    s.v = s.v1 - s.v2;
    return s;
  }
  V3 portal_dir() const { return (p[2].v - p[1].v).cross(p[3].v - p[1].v).normalized(); }
  bool encapsules_origin(const V3 &dir) const {
    double d = dir.dot(p[1].v);
    return is_zero(d) || d > 0;
  }
  bool reach_tolerance(const Support &v4, const V3 &dir) const {
    double dv1 = p[1].v.dot(dir), dv2 = p[2].v.dot(dir), dv3 = p[3].v.dot(dir), dv4 = v4.v.dot(dir);
    double d = std::min(dv4 - dv1, std::min(dv4 - dv2, dv4 - dv3));
    return eq(d, tolerance) || d < tolerance;
  }
  bool can_encapsule_origin(const Support &v4, const V3 &dir) const {
    double d = v4.v.dot(dir);
    return is_zero(d) || d > 0;
  }
  void expand(const Support &v4) {
    V3 v4v0 = v4.v.cross(p[0].v);
    double d = p[1].v.dot(v4v0);
    if (d > 0) {
      d = p[2].v.dot(v4v0);
      if (d > 0) p[1] = v4; else p[3] = v4;
    } else {
      d = p[3].v.dot(v4v0);
      if (d > 0) p[2] = v4; else p[1] = v4;
    }
  }
  int discover() {
    p[0].v1 = c1;
    p[0].v2 = c2;
    p[0].v = c1 - c2;
    size = 1;
    if (veq(p[0].v, V3()))
      p[0].v = p[0].v + V3(EPS * 10, 0, 0);
    V3 dir = (p[0].v * -1.0).normalized();
    p[1] = support(dir);
    size = 2;
    double d = p[1].v.dot(dir);
    if (is_zero(d) || d < 0)
      return -1;
    dir = p[0].v.cross(p[1].v);
    if (is_zero(dir.len2())) {
      if (veq(p[1].v, V3()))
        return 1;
      return 2;
    }
    dir = dir.normalized();
    p[2] = support(dir);
    d = p[2].v.dot(dir);
    if (is_zero(d) || d < 0)
      return -1;
    size = 3;
    dir = (p[1].v - p[0].v).cross(p[2].v - p[0].v).normalized();
    if (dir.dot(p[0].v) > 0) {
      std::swap(p[1], p[2]);
      dir = dir * -1.0;
    }
    int guard = 0;
    while (size < 4) {
      if (++guard > max_iterations)
        return -1;
      p[3] = support(dir);
      d = p[3].v.dot(dir);
      if (is_zero(d) || d < 0)
        return -1;
      bool cont = false;
      V3 va = p[1].v.cross(p[3].v);
      d = va.dot(p[0].v);
      if (d < 0 && !is_zero(d)) {
        p[2] = p[3];
        cont = true;
      }
      if (!cont) {
        va = p[3].v.cross(p[2].v);
        d = va.dot(p[0].v);
        if (d < 0 && !is_zero(d)) {
          p[1] = p[3];
          cont = true;
        }
      }
      if (cont)
        dir = (p[1].v - p[0].v).cross(p[2].v - p[0].v).normalized();
      else
        size = 4;
    }
    return 0;
  }
  int refine() {
    for (int it = 0; it < max_iterations; it++) {
      V3 dir = portal_dir();
      if (encapsules_origin(dir))
        return 0;
      Support v4 = support(dir);
      if (!can_encapsule_origin(v4, dir) || reach_tolerance(v4, dir))
        return -1;
      expand(v4);
    }
    return -1;
  }
  void find_pos(V3 &pos) const {
    V3 dir = portal_dir();
    double b[4];
    b[0] = p[1].v.cross(p[2].v).dot(p[3].v);
    b[1] = p[3].v.cross(p[2].v).dot(p[0].v);
    b[2] = p[0].v.cross(p[1].v).dot(p[3].v);
    b[3] = p[2].v.cross(p[1].v).dot(p[0].v);
    double sum = b[0] + b[1] + b[2] + b[3];
    if (is_zero(sum) || sum < 0) {
      b[0] = 0;
      b[1] = p[2].v.cross(p[3].v).dot(dir);
      b[2] = p[3].v.cross(p[1].v).dot(dir);
      b[3] = p[1].v.cross(p[2].v).dot(dir);
      sum = b[1] + b[2] + b[3];
    }
    double inv = 1.0 / sum;
    V3 q1, q2;
    for (int i = 0; i < 4; i++) {
      q1 = q1 + p[i].v1 * b[i];
      q2 = q2 + p[i].v2 * b[i];
    }
    pos = (q1 * inv + q2 * inv) * 0.5;
  }

 public:
  MPR(const S1 &s1, const S2 &s2, V3 c1, V3 c2, double tol)
      : s1(s1), s2(s2), c1(c1), c2(c2), tolerance(tol) {}
  // returns 0 on intersection (libccd semantics)
  int penetration(double &depth, V3 &dir, V3 &pos) {
    int res = discover();
    if (res < 0)
      return -1;
    if (res == 1) {
      depth = 0;
      dir = V3();
      pos = (p[1].v1 + p[1].v2) * 0.5;
      return 0;
    }
    if (res == 2) {
      pos = (p[1].v1 + p[1].v2) * 0.5;
      dir = p[1].v;
      depth = std::sqrt(dir.len2());
      dir = dir.normalized();
      return 0;
    }
    if (refine() < 0)
      return -1;
    for (int it = 0;; it++) {
      V3 d = portal_dir();
      Support v4 = support(d);
      if (reach_tolerance(v4, d) || it > max_iterations) {
        V3 w;
        depth = std::sqrt(point_tri_dist2(V3(), p[1].v, p[2].v, p[3].v, w));
        dir = is_zero(depth) ? V3() : w.normalized();
        find_pos(pos);
        return 0;
      }
      expand(v4);
    }
  }
};
}  // namespace ccd

template <int dim>
class RigidSolver {
  using Vector = VectorND<dim, real>;
  using RigidsVector = std::vector<std::unique_ptr<RigidBody<dim>>>;
  using CollisionsVector = std::vector<Collision<dim>>;

 public:
  void detect_rigid_collision(RigidsVector &rigids, CollisionsVector &collisions) {
    if constexpr (dim == 2) {
      TC_NOT_IMPLEMENTED
    } else {
      int n = (int)rigids.size();
      // cache world-space hull vertices once per detection pass
      std::vector<std::vector<ccd::V3>> verts(n);
      for (int i = 1; i < n; i++) {
        auto m = rigids[i]->get_mesh_to_world();
        for (auto &e : rigids[i]->mesh->elements)
          for (int k = 0; k < 3; k++) {
            Vector3 p = transform<3>(m, e.v[k]);
            verts[i].push_back(ccd::V3(p[0], p[1], p[2]));
          }
      }
      for (int i = 1; i < n; i++) {
        for (int j = 1; j < i; j++) {
          if (rigids[i]->pos_func && rigids[i]->rot_func && rigids[j]->pos_func && rigids[j]->rot_func)
            continue;
          if (verts[i].empty() || verts[j].empty())
            continue;
          auto sup = [](const std::vector<ccd::V3> &vs) {
            return [&vs](const ccd::V3 &dir) {
              double best = -1e300;
              ccd::V3 r;
              for (auto &v : vs) {
                double d = v.dot(dir);
                if (d > best) {
                  best = d;
                  r = v;
                }
              }
              return r;
            };
          };
          auto s1 = sup(verts[i]);
          auto s2 = sup(verts[j]);
          Vector3 pi = rigids[i]->position, pj = rigids[j]->position;
          ccd::MPR<decltype(s1), decltype(s2)> mpr(s1, s2, ccd::V3(pi[0], pi[1], pi[2]),
                                                   ccd::V3(pj[0], pj[1], pj[2]), 0.0001);
          double depth;
          ccd::V3 dir, pos;
          if (mpr.penetration(depth, dir, pos) == 0) {
            collisions.emplace_back(rigids[i].get(), rigids[j].get(), (real)depth,
                                    Vector3((real)dir.x, (real)dir.y, (real)dir.z),
                                    Vector3((real)pos.x, (real)pos.y, (real)pos.z));
          }
        }
      }
    }
  }
};

// ============================================================================
// articulation.h / articulation.cpp
// ============================================================================
template <int dim>
class Articulation {
 public:
  using RigidBodyType = RigidBody<dim>;
  RigidBodyType *obj[2] = {nullptr, nullptr};
  virtual ~Articulation() {}
  virtual void initialize(const Config &config) {}
  virtual void apply(real delta_t) const {}
  virtual void project() const {}
  virtual void penalize(real delta_t) const {}
  virtual void update_parameters(real, real, real) {}
};

template <int dim>
class RotationArticulation : public Articulation<dim> {
 public:
  using typename Articulation<dim>::RigidBodyType;
  void initialize(const Config &config) override {
    this->obj[0] = config.get_ptr<RigidBodyType>("obj0");
    this->obj[1] = config.get_ptr<RigidBodyType>("obj1");
  }
  void project() const override {
    auto total_angular_momemtum = this->obj[0]->get_angular_momemtum() + this->obj[1]->get_angular_momemtum();
    auto total_inertia = this->obj[0]->get_transformed_inertia() + this->obj[1]->get_transformed_inertia();
    auto angular_velocity = inversed(total_inertia) * total_angular_momemtum;
    this->obj[0]->angular_velocity.value = angular_velocity;
    this->obj[1]->angular_velocity.value = angular_velocity;
  }
};

template <int dim>
class FrozenArticulation : public Articulation<dim> {
 public:
  using typename Articulation<dim>::RigidBodyType;
  void initialize(const Config &config) override {
    this->obj[0] = config.get_ptr<RigidBodyType>("obj0");
    this->obj[1] = config.get_ptr<RigidBodyType>("obj1");
  }
  void project() const override {
    if constexpr (dim == 2) {
      TC_NOT_IMPLEMENTED;
    } else {
      auto av = this->obj[0]->angular_velocity.value;
      av[0] = 0;
      av[1] = 0;
      this->obj[0]->angular_velocity.value = av;
      auto v = this->obj[0]->velocity;
      v[2] = 0;
      this->obj[0]->velocity = v;
    }
  }
};

template <int dim>
class DistanceArticulation : public Articulation<dim> {
 public:
  using typename Articulation<dim>::RigidBodyType;
  using Vector = VectorND<dim, real>;
  Vector offsets[2];
  real target_distance = 0;
  real penalty = 0;
  void initialize(const Config &config) override {
    this->obj[0] = config.get_ptr<RigidBodyType>("obj0");
    this->obj[1] = config.get_ptr<RigidBodyType>("obj1");
    if (this->obj[1]->id == 0)
      TC_ASSERT_INFO(config.has_key("offset1"),
                     "When linking to the background rigid body, Distance Articulation must have offset1");
    for (int i = 0; i < 2; i++) {
      char key[16];
      snprintf(key, sizeof(key), "offset%d", i);
      offsets[i] = config.get<Vector>(key, Vector(0.0f));
      offsets[i] = transform<dim>(inversed(this->obj[i]->get_centroid_to_world()), offsets[i], 0.0f);
    }
    Vector p0 = transform<dim>(this->obj[0]->get_centroid_to_world(), offsets[0]);
    Vector p1 = transform<dim>(this->obj[1]->get_centroid_to_world(), offsets[1]);
    real initial_distance = (p0 - p1).length();
    target_distance = config.get("target_distance", initial_distance);
    penalty = config.get("penalty", 1e3f);
  }
  void penalize(real delta_t) const override {
    Vector p0 = transform<dim>(this->obj[0]->get_centroid_to_world(), offsets[0]);
    Vector p1 = transform<dim>(this->obj[1]->get_centroid_to_world(), offsets[1]);
    Vector n = p0 - p1;
    real current_distance = n.length();
    if (current_distance < 1e-10f)
      return;
    n = normalized(n);
    real j = -delta_t * penalty * (target_distance - current_distance);
    this->obj[0]->apply_impulse(-j * n, p0);
    this->obj[1]->apply_impulse(j * n, p1);
  }
  void project() const override {
    Vector p0 = transform<dim>(this->obj[0]->get_centroid_to_world(), offsets[0]);
    Vector p1 = transform<dim>(this->obj[1]->get_centroid_to_world(), offsets[1]);
    Vector n = p0 - p1;
    real current_distance = n.length();
    if (current_distance < 1e-10f)
      return;
    n = normalized(n);
    Vector v01 = this->obj[0]->get_velocity_at(p0) - this->obj[1]->get_velocity_at(p1);
    real j = dot(n, v01) / (this->obj[0]->get_impulse_contribution(p0 - this->obj[0]->position, n) +
                            this->obj[1]->get_impulse_contribution(p1 - this->obj[1]->position, n));
    this->obj[0]->apply_impulse(-j * n, p0);
    this->obj[1]->apply_impulse(j * n, p1);
  }
};

template <int dim>
class AxialRotationArticulation : public Articulation<dim> {
 public:
  using typename Articulation<dim>::RigidBodyType;
  using Vector = VectorND<dim, real>;
  DistanceArticulation<dim> distance_articulations[2];
  Vector3 axis;
  void initialize(const Config &config) override {
    this->obj[0] = config.get_ptr<RigidBodyType>("obj0");
    this->obj[1] = config.get_ptr<RigidBodyType>("obj1");
    Vector offset0 = config.get("offset0", Vector(0.0f));
    if constexpr (dim == 3) {
      Vector3 input_axis = normalized(config.get<Vector3>("axis"));
      axis = transform<3>(inversed(this->obj[1]->get_centroid_to_world()), input_axis, 0.0f);
    }
    Vector offset = this->obj[0]->position + offset0 - this->obj[1]->position;
    for (int i = 0; i < 2; i++) {
      Config c = config;
      c.set("penalty", config.get("penalty", 1e3f));
      if constexpr (dim == 3) {
        Vector3 input_axis = normalized(config.get<Vector3>("axis"));
        Vector axial_offset = input_axis * config.get("axis_length", 0.1f);
        if (i == 1)
          axial_offset = -axial_offset;
        c.set("offset0", offset0 + axial_offset).set("offset1", offset + axial_offset).set("target_distance", 0.0f);
      } else {
        c.set("offset0", offset0).set("offset1", offset).set("target_distance", 0.0f);
      }
      distance_articulations[i].initialize(c);
    }
  }
  void project() const override {
    distance_articulations[0].project();
    distance_articulations[1].project();
  }
  void penalize(real delta_t) const override {
    distance_articulations[0].penalize(delta_t);
    distance_articulations[1].penalize(delta_t);
  }
};

template <int dim>
class MotorArticulation : public Articulation<dim> {
 public:
  using typename Articulation<dim>::RigidBodyType;
  using TorqueType = typename AngularVelocity<dim>::ValueType;
  real power = 0;
  AxialRotationArticulation<dim> axial_rotation_articulation;
  void initialize(const Config &config) override {
    this->obj[0] = config.get_ptr<RigidBodyType>("obj0");
    this->obj[1] = config.get_ptr<RigidBodyType>("obj1");
    axial_rotation_articulation.initialize(config);
    power = config.get("power", 0.0f);
  }
  void apply(real delta_t) const override {
    TorqueType torque;
    if constexpr (dim == 2) {
      torque = power * delta_t;
    } else {
      Vector3 transformed_axis = transform<3>(this->obj[1]->get_centroid_to_world(), axial_rotation_articulation.axis, 0.0f);
      torque = transformed_axis * (power * delta_t);
    }
    this->obj[0]->apply_torque(torque);
    this->obj[1]->apply_torque(-torque);
  }
  void project() const override { axial_rotation_articulation.project(); }
  void penalize(real delta_t) const override { axial_rotation_articulation.penalize(delta_t); }
};

template <int dim>
class StepperArticulation : public Articulation<dim> {
 public:
  using typename Articulation<dim>::RigidBodyType;
  using TorqueType = typename AngularVelocity<dim>::ValueType;
  real angular_velocity = 0;
  bool is_left = false;
  AxialRotationArticulation<dim> axial_rotation_articulation;
  void initialize(const Config &config) override {
    this->obj[0] = config.get_ptr<RigidBodyType>("obj0");
    this->obj[1] = config.get_ptr<RigidBodyType>("obj1");
    axial_rotation_articulation.initialize(config);
    is_left = config.get("is_left", false);
    angular_velocity = config.get("angular_velocity", 0.0f);
  }
  void apply(real delta_t) const override { axial_rotation_articulation.apply(delta_t); }
  void project() const override {
    axial_rotation_articulation.project();
    if constexpr (dim == 2) {
      TC_NOT_IMPLEMENTED;
    } else {
      auto current_vel = this->obj[0]->angular_velocity.value - this->obj[1]->angular_velocity.value;
      Vector3 axis = normalized(transform<3>(this->obj[1]->get_centroid_to_world(), axial_rotation_articulation.axis, 0.0f));
      real correction = angular_velocity - dot(current_vel, axis);
      TorqueType torque = inversed(this->obj[0]->get_transformed_inversed_inertia() +
                                   this->obj[1]->get_transformed_inversed_inertia()) *
                          (axis * correction);
      this->obj[0]->apply_torque(torque);
      this->obj[1]->apply_torque(-torque);
    }
  }
  void penalize(real delta_t) const override { axial_rotation_articulation.penalize(delta_t); }
};

template <int dim>
std::unique_ptr<Articulation<dim>> create_articulation(const std::string &type, const Config &config) {
  std::unique_ptr<Articulation<dim>> a;
  if (type == "rotation")
    a = std::make_unique<RotationArticulation<dim>>();
  else if (type == "frozen")
    a = std::make_unique<FrozenArticulation<dim>>();
  else if (type == "distance")
    a = std::make_unique<DistanceArticulation<dim>>();
  else if (type == "axial_rotation")
    a = std::make_unique<AxialRotationArticulation<dim>>();
  else if (type == "motor")
    a = std::make_unique<MotorArticulation<dim>>();
  else if (type == "stepper")
    a = std::make_unique<StepperArticulation<dim>>();
  else
    TC_ERROR("Unknown articulation type '%s'", type.c_str());
  a->initialize(config);
  return a;
}

// ============================================================================
// Sparse grid page map (replacement for SPGrid_Page_Map)
// ============================================================================
struct PageMap {
  std::vector<uint8> flags;
  std::vector<uint32> touched;
  std::vector<uint32> blocks;
  void resize(size_t n) {
    flags.assign(n, 0);
    touched.clear();
    blocks.clear();
  }
  void Clear() {
    for (auto b : touched)
      flags[b] = 0;
    touched.clear();
    blocks.clear();
  }
  TC_FORCE_INLINE void Set_Page(uint32 b) {
    if (!flags[b]) {
      flags[b] = 1;
      touched.push_back(b);
    }
  }
  TC_FORCE_INLINE bool Test_Page(uint32 b) const { return flags[b] != 0; }
  void Update_Block_Offsets() {
    blocks = touched;
    std::sort(blocks.begin(), blocks.end());
  }
};

// ============================================================================
// Simulation interface used by the C API
// ============================================================================
class SimulationBase {
 public:
  virtual ~SimulationBase() {}
  virtual int get_dim() const = 0;
  virtual void initialize(const Config &config) = 0;
  virtual std::string add_particles(const Config &config) = 0;
  virtual std::string general_action(const Config &config) = 0;
  virtual void step(real dt) = 0;
  virtual void begin_step(real dt) = 0;
  virtual int advance(int max_substeps) = 0;
  virtual real get_current_time() const = 0;
  virtual int export_particles(int mode, std::vector<float> &out) = 0;
  virtual void export_rigids(std::vector<float> &out) = 0;
  virtual void export_levelset(std::vector<float> &out, int &nx, int &ny) = 0;
  virtual void export_blocks(std::vector<float> &out) = 0;
  virtual void export_stats(std::vector<double> &out) = 0;
};

enum ProfileStage {
  P_SORT = 0, P_RIGIDIFY, P_ARTICULATE, P_RASTER_RIGID, P_GATHER_CDF, P_P2G,
  P_GRID, P_BOUNDARY, P_G2P, P_CLEAN, P_ADVECT_RIGID, P_NUM
};

// ============================================================================
// mpm.h / mpm.cpp / transfer.cpp / rigid_transfer.cpp / mpm_rigid_body.cpp
// ============================================================================
template <int dim>
class MPM : public SimulationBase {
 public:
  using Vector = VectorND<dim, real>;
  using VectorP = VectorND<dim + 1, real>;
  using VectorI = VectorND<dim, int>;
  using Vectori = VectorI;
  using Matrix = MatrixND<dim, real>;
  using MatrixP = MatrixND<dim + 1, real>;
  using Kernel = MPMKernel<dim, mpm_kernel_order>;
  using Particle = MPMParticle<dim>;
  using ParticlePtr = uint32;
  using AffinityType = uint32;

  static constexpr int block_bits_1d = dim == 2 ? 3 : 2;  // 8x8 / 4x4x4 blocks
  static constexpr int block_size_1d = 1 << block_bits_1d;
  static constexpr int block_bits = block_bits_1d * dim;
  static constexpr int elements_per_block = 1 << block_bits;

  // ---- solver state (names follow the original) ----
  real penalty = 0;
  VectorI res;
  Vector gravity;
  bool apic = true;
  real delta_x = 0, inv_delta_x = 0;
  real affine_damping = 0;
  real base_delta_t = 1e-4f;
  real cfl = 1;
  real request_t = 0.0f;
  real pushing_force = 0;
  real rpic_damping = 0, apic_damping = 0;
  bool particle_gravity = true;
  uint32 frame_count = 0;
  int reorder_interval = 1000;
  int substep_counter = 0;
  int step_counter = 0;
  uint64 update_counter = 0;
  uint64 cutting_counter = 0;
  uint64 plasticity_counter = 0;
  Config config_backup;
  real current_t = 0;
  DynamicLevelSet<dim> levelset;
  bool has_levelset = false;
  bool has_deleted = false;
  real last_rigid_block_fraction = 0;

  std::vector<ParticlePtr> particles, particles_;
  std::vector<uint64> particle_sorter, sorter_tmp;
  struct BlockMeta {
    uint32 particle_offset;
    uint32 flags;
  };
  std::vector<BlockMeta> block_meta;
  std::vector<std::unique_ptr<RigidBody<dim>>> rigids;
  std::vector<std::unique_ptr<Articulation<dim>>> articulations;
  std::vector<std::shared_ptr<LevelSet<dim>>> levelsets;
  ParticleAllocator<dim> allocator;

  // ---- sparse grid ----
  VectorI nblocks, grid_dims;
  int stride[dim];
  int total_blocks = 0;
  std::vector<GridState<dim>> grid_data;
  PageMap page_map, rigid_page_map, fat_page_map;
  std::vector<VectorI> kernel_offsets;  // [0, 3)^dim
  std::vector<VectorI> neighbor_offsets;  // [-1, 1]^dim

  // ---- profiling ----
  double prof[P_NUM] = {0};
  int prof_substeps = 0;
  double prof_wall = 0;

  int get_dim() const override { return dim; }
  real get_current_time() const override { return current_t; }

  MPM() {
    int n = 1;
    for (int k = 0; k < dim; k++)
      n *= 3;
    for (int l = 0; l < n; l++) {
      VectorI o, nb;
      int t = l;
      for (int k = dim - 1; k >= 0; k--) {
        o[k] = t % 3;
        nb[k] = t % 3 - 1;
        t /= 3;
      }
      kernel_offsets.push_back(o);
      neighbor_offsets.push_back(nb);
    }
  }

  // ------------------------------------------------------------------ grid
  TC_FORCE_INLINE int grid_index(const VectorI &i) const {
    int idx = 0;
    for (int k = 0; k < dim; k++)
      idx += i[k] * stride[k];
    return idx;
  }
  TC_FORCE_INLINE GridState<dim> &get_grid(const VectorI &i) { return grid_data[grid_index(i)]; }
  TC_FORCE_INLINE const GridState<dim> &get_grid(const VectorI &i) const { return grid_data[grid_index(i)]; }
  TC_FORCE_INLINE real &grid_mass(const VectorI &ind) { return get_grid(ind).velocity_and_mass[dim]; }
  TC_FORCE_INLINE Vector grid_velocity(const VectorI &ind) const { return Vector(get_grid(ind).velocity_and_mass); }
  TC_FORCE_INLINE uint32 block_id_of(const VectorI &i) const {
    uint32 b = 0;
    for (int k = 0; k < dim; k++)
      b = b * nblocks[k] + (uint32)(i[k] >> block_bits_1d);
    return b;
  }
  TC_FORCE_INLINE uint32 element_index(const VectorI &i) const {
    uint32 local = 0;
    for (int k = 0; k < dim; k++)
      local = (local << block_bits_1d) | (uint32)(i[k] & (block_size_1d - 1));
    return (block_id_of(i) << block_bits) | local;
  }
  VectorI block_coord(uint32 b) const {
    VectorI c;
    for (int k = dim - 1; k >= 0; k--) {
      c[k] = (int)(b % (uint32)nblocks[k]);
      b /= (uint32)nblocks[k];
    }
    return c;
  }
  VectorI grid_block_size() const { return VectorI(block_size_1d); }
  template <typename F>
  TC_FORCE_INLINE void for_each_node_in_block(uint32 b, const F &f) {
    VectorI base = block_coord(b) * block_size_1d;
    if constexpr (dim == 2) {
      for (int i = 0; i < block_size_1d; i++) {
        int row = (base[0] + i) * stride[0] + base[1];
        for (int j = 0; j < block_size_1d; j++)
          f(VectorI(base[0] + i, base[1] + j), grid_data[row + j]);
      }
    } else {
      for (int i = 0; i < block_size_1d; i++)
        for (int j = 0; j < block_size_1d; j++) {
          int row = (base[0] + i) * stride[0] + (base[1] + j) * stride[1] + base[2];
          for (int k = 0; k < block_size_1d; k++)
            f(VectorI(base[0] + i, base[1] + j, base[2] + k), grid_data[row + k]);
        }
    }
  }
  void reset_block(uint32 b) {
    VectorI base = block_coord(b) * block_size_1d;
    if constexpr (dim == 2) {
      for (int i = 0; i < block_size_1d; i++)
        std::memset((void *)&grid_data[(base[0] + i) * stride[0] + base[1]], 0, sizeof(GridState<dim>) * block_size_1d);
    } else {
      for (int i = 0; i < block_size_1d; i++)
        for (int j = 0; j < block_size_1d; j++)
          std::memset((void *)&grid_data[(base[0] + i) * stride[0] + (base[1] + j) * stride[1] + base[2]], 0,
                      sizeof(GridState<dim>) * block_size_1d);
    }
  }
  template <typename T>
  void parallel_for_each_active_grid(const T &target, bool fat = true) {
    const auto &blocks = fat ? fat_page_map.blocks : page_map.blocks;
    for (auto b : blocks)
      for_each_node_in_block(b, [&](const VectorI &, GridState<dim> &g) { target(g); });
  }
  template <typename T>
  void parallel_for_each_particle(const T &target) {
    for (auto p : particles)
      target(*allocator[p]);
  }
  bool has_rigid_body() const { return rigids.size() > 1; }
  TC_FORCE_INLINE VectorI get_grid_base_pos(const Vector &pos) const {
    VectorI r;
    for (int i = 0; i < dim; i++)
      r[i] = Kernel::get_stencil_start(pos[i]);
    return r;
  }
  bool near_boundary(const Particle &p) const {
    Vector pos = p.pos * inv_delta_x;
    real bound = 7.0f;
    if (pos.min() < bound || (pos - res.template cast<real>()).max() > -bound)
      return true;
    return false;
  }
  RigidBody<dim> *get_rigid_body_ptr(int id) {
    if (id == -1)
      return nullptr;
    return rigids[id].get();
  }
  Matrix damp_affine_momemtum(const Matrix &b) {
    if (rpic_damping == 0 && apic_damping == 0)
      return b;
    auto b_sym = 0.5f * (b + b.transposed());
    auto b_skew = b - b_sym;
    return (1 - rpic_damping) * b_sym + (1 - apic_damping) * b_skew;
  }

  // ------------------------------------------------------------ initialize
  void initialize(const Config &config) override {
    config_backup = config;
    res = config.get<VectorI>("res");
    apic_damping = config.get("apic_damping", 0.0f);
    rpic_damping = config.get("rpic_damping", 0.0f);
    penalty = config.get("penalty", 0.0f);
    delta_x = config.get("delta_x", 1.0f / res[0]);
    inv_delta_x = 1.0f / delta_x;
    gravity = config.get("gravity", Vector::axis(1) * (-10.0f));
    apic = config.get("apic", true);
    pushing_force = config.get("pushing_force", 20000.0f);
    TC_ASSERT_INFO(!config.has_key("delta_t"), "Please use 'base_delta_t' instead of 'delta_t'");
    base_delta_t = config.get("base_delta_t", 1e-4f);
    base_delta_t *= config.get("dt_multiplier", 1.0f);
    reorder_interval = config.get("reorder_interval", 1000);
    cfl = config.get("cfl", 1.0f);
    particle_gravity = config.get("particle_gravity", true);
    affine_damping = config.get("affine_damping", 0.0f);

    size_t nodes = 1;
    total_blocks = 1;
    for (int k = 0; k < dim; k++) {
      nblocks[k] = (res[k] + 1 + block_size_1d - 1) / block_size_1d + 1;
      grid_dims[k] = nblocks[k] * block_size_1d;
      nodes *= (size_t)grid_dims[k];
      total_blocks *= nblocks[k];
    }
    stride[dim - 1] = 1;
    for (int k = dim - 2; k >= 0; k--)
      stride[k] = stride[k + 1] * grid_dims[k + 1];
    grid_data.assign(nodes, GridState<dim>());
    std::memset((void *)grid_data.data(), 0, nodes * sizeof(GridState<dim>));
    page_map.resize(total_blocks);
    rigid_page_map.resize(total_blocks);
    fat_page_map.resize(total_blocks);
    TC_INFO("MPM<%d>: res=%d grid nodes=%d (%d blocks of %d), %.1f MB", dim, res[0], (int)nodes,
            total_blocks, elements_per_block, nodes * sizeof(GridState<dim>) / 1048576.0);

    rigids.clear();
    rigids.emplace_back(std::make_unique<RigidBody<dim>>());
    rigids.back()->id = 0;
    rigids.back()->set_as_background();
  }

  // ---------------------------------------------------------- add particles
  std::string add_particles(const Config &config) override {
    if (config.get_string("type") == "rigid") {
      add_rigid_particle(config);
      return std::to_string((int)rigids.size() - 1);
    }
    int added = 0, ignored = 0;
    std::string type = config.get_string("type");
    real density = config.get("density", 400.0f);
    Vector initial_velocity = config.get("initial_velocity", Vector(0.0f));
    auto create_particle = [&](const Vector &coord, real maximum) {
      auto alloc = allocator.allocate_particle(type);
      Particle *p = alloc.second;
      p->initialize(config);
      p->pos = coord;
      if (near_boundary(*p)) {
        ignored++;
        return;
      }
      p->vol = pow<dim>(delta_x) / maximum;
      p->set_mass(p->vol * density);
      p->set_velocity(initial_velocity);
      particles.push_back(alloc.first);
      added++;
    };
    auto density_texture = get_texture(config.get<int>("density_tex"));
    auto to3 = [](const Vector &v) {
      Vector3 r(0.5f);
      for (int k = 0; k < dim; k++)
        r[k] = v[k];
      return r;
    };
    real maximum = 0.0f;
    {
      size_t total = 1;
      for (int k = 0; k < dim; k++)
        total *= res[k];
      for (size_t l = 0; l < total; l++) {
        VectorI i;
        size_t t = l;
        for (int k = dim - 1; k >= 0; k--) {
          i[k] = int(t % res[k]);
          t /= res[k];
        }
        Vector coord = (i.template cast<real>() + Vector(0.5f)) * delta_x;
        maximum = std::max(maximum, density_texture->sample(to3(coord)));
      }
    }
    if (maximum <= 0)
      return "0";
    if (config.get("pd", true)) {
      PoissonDiskSampler<dim> sampler;
      std::vector<Vector> samples;
      if (config.get("pd_source", false)) {
        Vector sample_offset = initial_velocity * current_t;
        real delta_t = config.get("delta_t", 1e-3f);
        Vector sample_advection = initial_velocity * delta_t + 0.5f * gravity * (delta_t + base_delta_t) * delta_t;
        sampler.sample_from_source(*density_texture, res, delta_x, sample_offset, sample_advection, samples);
      } else {
        sampler.sample_from_periodic_data(*density_texture, res, delta_x, samples);
      }
      bool only_one = config.get("only_one", false);
      for (auto &coord : samples) {
        create_particle(coord, maximum);
        if (only_one)
          break;
      }
    } else {
      size_t total = 1;
      for (int k = 0; k < dim; k++)
        total *= res[k];
      for (size_t l = 0; l < total; l++) {
        VectorI i;
        size_t t = l;
        for (int k = dim - 1; k >= 0; k--) {
          i[k] = int(t % res[k]);
          t /= res[k];
        }
        for (int s = 0; s < maximum; s++) {
          Vector r;
          for (int k = 0; k < dim; k++)
            r[k] = rand();
          Vector coord = (i.template cast<real>() + r) * delta_x;
          if (rand() > density_texture->sample(to3(coord)) / maximum)
            continue;
          create_particle(coord, maximum);
        }
      }
    }
    if (ignored && !config.get("pd_source", false))
      TC_WARN("%d particles out of box or near boundary. Ignored.", ignored);
    return std::to_string(added);
  }

  // -------------------------------------------------------- rigid bodies
  std::function<Vector(real)> make_position_script(int id) {
    return [id](real t) {
      float out[3] = {0, 0, 0};
      tc_script_eval(id, t, out);
      Vector v;
      for (int k = 0; k < dim; k++)
        v[k] = out[k];
      return v;
    };
  }
  typename RigidBody<dim>::RotationFunctionType make_rotation_script(int id) {
    return [id](real t) {
      float out[3] = {0, 0, 0};
      tc_script_eval(id, t, out);
      if constexpr (dim == 2)
        return (real)out[0];
      else
        return Vector3(out[0], out[1], out[2]);
    };
  }
  void check_scripting_parameters(const Config &config) {
    TC_ASSERT_INFO(!config.has_key("scripted"), "'scripted' is deprecated. Please remove.");
    TC_ASSERT_INFO(!config.has_key("position"), "Use 'initial_position' instead of 'position'.");
    TC_ASSERT_INFO(!config.has_key("rotation"), "Use 'initial_rotation' instead of 'rotation'.");
    if (config.has_key("scripted_position")) {
      TC_ASSERT_INFO(!config.has_key("initial_position"), "scripted_position and initial_position cannot coexist.");
      TC_ASSERT_INFO(!config.has_key("initial_velocity"), "scripted_position and initial_velocity cannot coexist.");
    } else {
      TC_ASSERT_INFO(config.has_key("initial_position"),
                     "Please specify one (and only one) of 'scripted_position' and 'initial_position'.");
    }
    if (config.has_key("scripted_rotation")) {
      TC_ASSERT_INFO(!config.has_key("initial_rotation"), "scripted_rotation and initial_rotation cannot coexist!");
      TC_ASSERT_INFO(!config.has_key("initial_angular_velocity"),
                     "scripted_rotation and initial_angular_velocity cannot coexist!");
    }
    if (config.has_key("friction")) {
      TC_ASSERT_INFO(!config.has_key("friction0") && !config.has_key("friction1"),
                     "friction and friction0/1 cannot coexist!");
    }
    if (config.has_key("friction0") != config.has_key("friction1"))
      TC_ERROR("friction0 and friction1 must be specified simultaneuously.");
  }
  std::unique_ptr<RigidBody<dim>> create_rigid_body(const Config &config) {
    auto rigid_ptr = std::make_unique<RigidBody<dim>>();
    auto &rigid = *rigid_ptr;
    rigid.id = (int)rigids.size();
    if (rigid.id >= GridState<dim>::max_num_rigid_bodies)
      TC_ERROR("At most %d rigid bodies (including the background) are supported by CPIC state bits",
               GridState<dim>::max_num_rigid_bodies);
    rigid.velocity = config.get("initial_velocity", Vector(0.0f));
    rigid.angular_velocity.value = config.get(
        "initial_angular_velocity", typename AngularVelocity<dim>::ValueType(0.0f));
    check_scripting_parameters(config);
    if (config.has_key("friction")) {
      rigid.frictions[0] = rigid.frictions[1] = config.get("friction", 0.0f);
    } else {
      rigid.frictions[0] = config.get("friction0", 0.0f);
      rigid.frictions[1] = config.get("friction1", 0.0f);
    }
    rigid.restitution = config.get("restitution", 0.0f);
    rigid.codimensional = config.get<bool>("codimensional");
    rigid.color = config.get("color", Vector3(0.5f));
    rigid.linear_damping = config.get("linear_damping", 0.0f);
    rigid.angular_damping = config.get("angular_damping", 0.0f);
    if (config.has_key("scripted_position")) {
      rigid.pos_func_id = config.get<int>("scripted_position");
      rigid.pos_func = make_position_script(rigid.pos_func_id);
    }
    if (config.has_key("scripted_rotation")) {
      rigid.rot_func_id = config.get<int>("scripted_rotation");
      rigid.rot_func = make_rotation_script(rigid.rot_func_id);
    }
    Vector initial_position;
    if (rigid.pos_func)
      initial_position = rigid.pos_func(current_t);
    else
      initial_position = config.get<Vector>("initial_position");
    rigid.position = initial_position;
    if constexpr (dim == 2) {
      real angle = rigid.rot_func ? rigid.rot_func(current_t) : config.get("initial_rotation", 0.0f);
      rigid.rotation = Rotation<2>(radians(angle));
    } else {
      Vector3 euler = rigid.rot_func ? rigid.rot_func(current_t) : config.get("initial_rotation", Vector3(0.0f));
      rigid.rotation.value = euler_xyz(euler * (pi / 180.0f));
      rigid.rotation_axis = config.get("rotation_axis", Vector(0.0f));
    }
    return rigid_ptr;
  }

  void add_rigid_particle(const Config &config) {
    auto rigid_ptr = create_rigid_body(config);
    auto &rigid = *rigid_ptr;
    Config config_new = config;
    config_new.set("rigid", &rigid);
    real density = config.get<bool>("codimensional") ? config.get("density", 40.0f) : config.get("density", 400.0f);
    std::vector<ParticlePtr> added_particles;
    auto add_boundary_particle = [&](Vector position, Vector normal, const Element<dim> *untransformed) {
      config_new.set("normal", normal).set("rigid", &rigid).set("offset", position - rigid.position);
      auto alloc = allocator.allocate_particle("rigid_boundary");
      auto *p = static_cast<RigidBoundaryParticle<dim> *>(alloc.second);
      p->pos = position;
      p->initialize(config_new);
      p->color = pack_color(rigid.color);
      p->untransformed_element = *untransformed;
      added_particles.push_back(alloc.first);
    };
    rigid.mesh = std::make_unique<ElementMesh<dim>>();
    rigid.mesh->initialize(config);
    Vector scale = config.get("scale", Vector(1.0f));
    Vector initial_position = rigid.position;
    auto &elements = rigid.mesh->elements;
    TC_ASSERT_INFO(!elements.empty(), "Rigid body mesh has no elements");
    for (auto &elem : elements)
      for (int k = 0; k < dim; k++)
        elem.v[k] = scale * elem.v[k];
    Vector center_of_mass = rigid.initialize_mass_and_inertia(density);
    if (!config.get("recenter", true)) {
      TC_ASSERT(rigid.pos_func);
      TC_ASSERT(rigid.rot_func);
      center_of_mass = Vector(0.0f);
    }
    if (rigid.pos_func)
      rigid.set_infinity_mass();
    if (rigid.rot_func)
      rigid.set_infinity_inertia();
    for (auto &elem : elements)
      for (int k = 0; k < dim; k++)
        elem.v[k] = elem.v[k] - center_of_mass;
    rigid.position = Vector(0.0f);
    if constexpr (dim == 2) {
      for (auto &elem : elements) {
        Vector a = elem.v[0], b = elem.v[1];
        int n_samples = std::max((int)std::ceil((a - b).length() * inv_delta_x), 2);
        for (int j = 0; j < n_samples; j++)
          add_boundary_particle(lerp((0.5f + j) / n_samples, a, b), elem.get_normal(), &elem);
      }
    } else {
      for (auto &elem : elements) {
        std::vector<Vector> positions;
        Vector x_n = normalize(elem.v[1] - elem.v[0]);
        Vector y_n = normalize(elem.v[2] - elem.v[0]);
        real x_length = length(elem.v[1] - elem.v[0]);
        real y_length = length(elem.v[2] - elem.v[0]);
        for (real _x = std::min(x_length / 3.0f, delta_x / 2.0f); _x < x_length + delta_x; _x += delta_x)
          for (real _y = std::min(y_length / 3.0f, delta_x / 2.0f); _y < y_length + delta_x; _y += delta_x) {
            real x = (_x < x_length) ? _x : _x - delta_x / 2.0f;
            real y = (_y < y_length) ? _y : _y - delta_x / 2.0f;
            if (x / x_length + y / y_length > 1.0f - eps)
              continue;
            positions.push_back(elem.v[0] + x_n * x + y_n * y);
          }
        for (auto &position : positions)
          add_boundary_particle(position, elem.get_normal(), &elem);
      }
    }
    rigid.position = initial_position;
    int skipped = 0;
    for (auto &p_i : added_particles) {
      auto p = static_cast<RigidBoundaryParticle<dim> *>(allocator[p_i]);
      p->rigid = &rigid;
      p->align_with_rigid_body();
      if (near_boundary(*p)) {
        skipped++;
        continue;
      }
      particles.push_back(p_i);
    }
    if (skipped)
      TC_WARN("%d rigid boundary particles close to the domain boundary were skipped", skipped);
    TC_INFO("Rigid body #%d: %d elements, mass %.4g, %d boundary particles", rigid.id,
            (int)elements.size(), rigid.mass, (int)added_particles.size() - skipped);
    rigids.push_back(std::move(rigid_ptr));
  }

  void advect_rigid_bodies(real dt) {
    for (auto &r : rigids) {
      auto &rigid = *r;
      if (rigid.rotation_axis.abs_max() > 0.1f)
        rigid.enforce_angular_velocity_parallel_to(rigid.rotation_axis);
      rigid.advance(current_t, dt);
      rigid.apply_impulse(gravity * rigid.get_mass() * dt, rigid.position);
      if (rigid.rotation_axis.abs_max() > 0.1f)
        rigid.enforce_angular_velocity_parallel_to(rigid.rotation_axis);
    }
    parallel_for_each_particle([](Particle &p_) {
      if (p_.is_rigid())
        static_cast<RigidBoundaryParticle<dim> *>(&p_)->align_with_rigid_body();
    });
  }

  void rigidify(real dt) {
    if (!config_backup.get("rigid_body_collision", true))
      return;
    std::vector<Collision<dim>> collisions;
    if constexpr (dim == 3) {
      RigidSolver<dim> rigid_solver;
      rigid_solver.detect_rigid_collision(rigids, collisions);
    }
    if (collisions.empty())
      return;
    int iterations = config_backup.get("rigid_body_iterations", 5);
    real rigid_penalty = config_backup.get("rigid_penalty", 1e3f);
    bool position_iterations = config_backup.get("rigid_body_position_iterations", true);
    for (int i = 0; i < iterations; i++) {
      if (position_iterations)
        for (auto &col : collisions)
          col.project_position(dt, rigid_penalty);
      for (auto &col : collisions)
        col.project_velocity();
    }
    for (int i = 0; i < iterations; i++)
      for (auto &col : collisions)
        col.project_velocity();
  }

  void articulate(real delta_t) {
    int articulation_iterations = config_backup.get("articulation_iterations", 100);
    for (auto &art : articulations)
      art->apply(delta_t);
    for (int i = 0; i < articulation_iterations; i++)
      for (auto &art : articulations)
        art->project();
    for (auto &art : articulations)
      art->penalize(delta_t);
  }

  void rigid_body_levelset_collision(real t, real delta_t) {
    if (!has_levelset)
      return;
    for (auto &p_i : particles) {
      auto &p = *allocator[p_i];
      if (!p.is_rigid())
        continue;
      Vector pos = p.pos * inv_delta_x;
      real phi = levelset.sample(pos, t);
      if (phi >= 0)
        continue;
      Vector gradient = levelset.get_spatial_gradient(pos, t);
      RigidBody<dim> *r = static_cast<RigidBoundaryParticle<dim> *>(&p)->rigid;
      real friction = r->frictions[0];
      real cRestitution = r->restitution;
      Vector v10 = r->get_velocity_at(p.pos);
      Vector r0 = p.pos - r->position;
      real v0 = dot(gradient, v10);
      real J = -((1 + cRestitution) * v0) / r->get_impulse_contribution(r0, gradient);
      if (J < 0)
        continue;
      r->apply_impulse(J * gradient, p.pos);
      v10 = r->get_velocity_at(p.pos);
      Vector tao = v10 - gradient * dot(gradient, v10);
      if (tao.abs_max() > 1e-7f) {
        tao = normalized(tao);
        real j = -dot(v10, tao) / (r->get_impulse_contribution(r0, tao));
        j = clamp(j, friction * -J, friction * J);
        r->apply_impulse(j * tao, p.pos);
      }
    }
  }

  // ----------------------------------------------------- particle sorting
  void radix_sort_keys(int n) {
    uint32 max_key = 0;
    for (int i = 0; i < n; i++)
      max_key = std::max(max_key, (uint32)(particle_sorter[i] >> 32));
    int bits = 0;
    while (bits < 32 && (max_key >> bits))
      bits++;
    sorter_tmp.resize(n);
    uint64 *src = particle_sorter.data(), *dst = sorter_tmp.data();
    for (int shift = 0; shift < bits; shift += 8) {
      uint32 count[257];
      std::memset(count, 0, sizeof(count));
      for (int i = 0; i < n; i++)
        count[((src[i] >> (32 + shift)) & 255) + 1]++;
      for (int k = 0; k < 256; k++)
        count[k + 1] += count[k];
      for (int i = 0; i < n; i++)
        dst[count[(src[i] >> (32 + shift)) & 255]++] = src[i];
      std::swap(src, dst);
    }
    if (src != particle_sorter.data())
      std::memcpy(particle_sorter.data(), src, sizeof(uint64) * n);
  }

  void sort_allocator() {
    std::swap(allocator.pool_, allocator.pool);
    if (allocator.pool.size() < allocator.pool_.size())
      allocator.pool.resize(allocator.pool_.size());
    for (uint32 i = 0; i < particles.size(); i++) {
      uint32 j = particles[i];
      allocator.pool[i] = allocator.pool_[j];
      particles[i] = i;
    }
    allocator.gc(particles.size());
  }

  void sort_particles_and_populate_grid() {
    int n = (int)particles.size();
    if ((int)particle_sorter.size() < n)
      particle_sorter.resize(n);
    for (int i = 0; i < n; i++) {
      uint32 elem = element_index(get_grid_base_pos(allocator[particles[i]]->pos * inv_delta_x));
      particle_sorter[i] = ((uint64)elem << 32) | (uint64)i;
    }
    radix_sort_keys(n);
    std::swap(particles, particles_);
    particles.resize(particles_.size());
    for (int i = 0; i < n; i++)
      particles[i] = particles_[particle_sorter[i] & 0xffffffffull];
    if (reorder_interval > 0 && substep_counter % reorder_interval == 0)
      sort_allocator();

    page_map.Clear();
    for (int i = 0; i < n; i++)
      page_map.Set_Page((uint32)(particle_sorter[i] >> (32 + block_bits)));
    page_map.Update_Block_Offsets();

    fat_page_map.Clear();
    for (auto b : page_map.blocks) {
      VectorI c = block_coord(b);
      for (auto &o : neighbor_offsets) {
        VectorI nb = c + o;
        bool ok = true;
        for (int k = 0; k < dim; k++)
          ok = ok && nb[k] >= 0 && nb[k] < nblocks[k];
        if (!ok)
          continue;
        uint32 id = 0;
        for (int k = 0; k < dim; k++)
          id = id * nblocks[k] + nb[k];
        fat_page_map.Set_Page(id);
      }
    }
    fat_page_map.Update_Block_Offsets();
    for (auto b : fat_page_map.blocks)
      reset_block(b);

    block_meta.clear();
    uint64 last = ~0ull;
    for (int i = 0; i < n; i++) {
      uint64 blk = particle_sorter[i] >> (32 + block_bits);
      if (blk != last)
        block_meta.push_back({(uint32)i, 0});
      last = blk;
    }
    block_meta.push_back({(uint32)n, 0});
    TC_ASSERT(block_meta.size() == page_map.blocks.size() + 1);
    if (has_rigid_body())
      update_rigid_page_map();
    else
      rigid_page_map.Clear();
  }

  void update_rigid_page_map() {
    rigid_page_map.Clear();
    const auto &blocks = page_map.blocks;
    for (int b = 0; b < (int)blocks.size(); b++) {
      bool has_rigid = false;
      for (uint32 k = block_meta[b].particle_offset; k < block_meta[b + 1].particle_offset && !has_rigid; k++)
        has_rigid = allocator[particles[k]]->is_rigid();
      if (!has_rigid)
        continue;
      VectorI c = block_coord(blocks[b]);
      for (auto &o : neighbor_offsets) {
        VectorI nb = c + o;
        bool ok = true;
        for (int k = 0; k < dim; k++)
          ok = ok && nb[k] >= 0 && nb[k] < nblocks[k];
        if (!ok)
          continue;
        uint32 id = 0;
        for (int k = 0; k < dim; k++)
          id = id * nblocks[k] + nb[k];
        rigid_page_map.Set_Page(id);
      }
    }
    rigid_page_map.Update_Block_Offsets();
    if (!fat_page_map.blocks.empty())
      last_rigid_block_fraction = (real)rigid_page_map.blocks.size() / fat_page_map.blocks.size();
  }

  // ---------------------------------------------- rigid_transfer.cpp (CPIC)
  void rasterize_rigid_boundary() {
    parallel_for_each_particle([&](Particle &p_) {
      if (!p_.is_rigid())
        return;
      auto *p = static_cast<RigidBoundaryParticle<dim> *>(&p_);
      VectorI grid_base_pos = get_grid_base_pos(p->pos * inv_delta_x);
      auto elem = p->get_world_space_element();
      Matrix world_to_elem = world_to_element(elem);
      Vector p0 = elem.v[0];
      int rid = p->rigid->id;
      for (auto &ind : kernel_offsets) {
        VectorI i = ind + grid_base_pos;
        Vector grid_pos = i.template cast<real>() * delta_x;
        Vector coord = world_to_elem * (grid_pos - p0);
        bool negative = coord[dim - 1] < 0;
        real dist_triangle = std::fabs(coord[dim - 1]);
        bool in_range;
        if constexpr (dim == 2)
          in_range = -0.02f <= coord[0] && coord[0] <= 1.02f;
        else
          in_range = 0 <= coord[0] && 0 <= coord[1] && coord[0] + coord[1] <= 1;
        if (!in_range)
          continue;
        dist_triangle *= inv_delta_x;
        GridState<dim> &g = get_grid(i);
        if (g.get_rigid_body_id() == -1 || dist_triangle < g.get_distance()) {
          g.set_distance(dist_triangle);
          g.set_rigid_body_id(rid);
        }
        g.set_states((uint32)g.get_states() | ((2u + (uint32)negative) << (rid * 2)));
      }
    });
    parallel_for_each_active_grid([&](GridState<dim> &g) { g.set_distance(g.get_distance() * delta_x); });
    if constexpr (dim == 2) {
      int expand = config_backup.get("cdf_expand", 0);
      if (expand > 0) {
        std::vector<uint32> tmp((res[0] + 1) * (res[1] + 1), 0);
        auto at = [&](int x, int y) -> uint32 & { return tmp[x * (res[1] + 1) + y]; };
        for (int e = 0; e < expand; e++) {
          for (int k = 0; k < dim; k++) {
            VectorI lo = VectorI::axis(k), hi = res - VectorI::axis(k);
            for (int x = lo[0]; x < hi[0]; x++)
              for (int y = lo[1]; y < hi[1]; y++)
                at(x, y) = get_grid(VectorI(x, y)).states;
            for (int x = lo[0]; x < hi[0]; x++)
              for (int y = lo[1]; y < hi[1]; y++) {
                for (int s = -1; s <= 1; s += 2) {
                  VectorI nb = VectorI(x, y) + VectorI::axis(k) * s;
                  uint32 nei_state = get_grid(nb).states;
                  uint32 state = at(x, y);
                  uint32 states_to_add = ((nei_state & ~state) & (uint32)state_mask) & GridState<dim>::tag_mask;
                  at(x, y) = state | (nei_state & (states_to_add | (states_to_add >> 1)));
                }
              }
            for (int x = lo[0]; x < hi[0]; x++)
              for (int y = lo[1]; y < hi[1]; y++)
                get_grid(VectorI(x, y)).states = at(x, y);
          }
        }
      }
    }
  }

  void gather_cdf() {
    using CDFPrecision = float32;
    using VectorPd = VectorND<dim + 1, CDFPrecision>;
    using MatrixPd = MatrixND<dim + 1, CDFPrecision>;
    using Vectord = VectorND<dim, CDFPrecision>;
    parallel_for_each_particle([&](Particle &p) {
      p.sticky = false;
      if (p.is_rigid())
        return;
      p.boundary_distance = 0;
      p.boundary_normal = Vector(0.0f);
      p.near_boundary_ = false;
      Vector pos = p.pos * inv_delta_x;
      if (!rigid_page_map.Test_Page(block_id_of(pos.template cast<int>())))
        return;
      AffinityType &particle_states = p.states;
      VectorI grid_base_pos = get_grid_base_pos(pos);
      Kernel kernel(pos, inv_delta_x);
      AffinityType all_boundaries = 0;
      for (auto &ind : kernel_offsets)
        all_boundaries |= (AffinityType)(get_grid(ind + grid_base_pos).get_states() & state_mask);
      particle_states &= (all_boundaries + (all_boundaries >> 1));
      AffinityType all_states_to_add = all_boundaries & (~particle_states);
      while (all_states_to_add != 0) {
        AffinityType state_to_add = (all_states_to_add & (0u - all_states_to_add));
        all_states_to_add ^= state_to_add;
        CDFPrecision weighted_distances[2] = {0, 0};
        for (auto &ind : kernel_offsets) {
          VectorI i = ind + grid_base_pos;
          GridState<dim> &g = get_grid(i);
          uint64 grid_state = g.get_states();
          if (g.get_rigid_body_id() == -1)
            continue;
          CDFPrecision d = g.get_distance() * inv_delta_x;
          CDFPrecision weight = mpm_use_weighted_reconstruction ? kernel.get_w(ind) : 1.0f;
          if (grid_state & state_to_add) {
            int sign = (int)((grid_state & (state_to_add >> 1)) != 0);
            weighted_distances[sign] += d * weight;
          }
        }
        if (weighted_distances[0] + weighted_distances[1] > 1e-7f) {
          p.states |= (state_to_add | ((state_to_add >> 1) * int(weighted_distances[0] < weighted_distances[1])));
          cutting_counter++;
        }
      }
      if (particle_states != 0) {
        MatrixPd XtX(0.0f);
        VectorPd XtY(0.0f);
        for (auto &ind : kernel_offsets) {
          VectorI i = ind + grid_base_pos;
          Vectord dpos = pos - i.template cast<real>();
          GridState<dim> &g = get_grid(i);
          if (g.get_rigid_body_id() == -1)
            continue;
          uint64 grid_state = g.get_states();
          uint64 mask = (grid_state & particle_states & state_mask) >> 1;
          CDFPrecision d = g.get_distance() * inv_delta_x;
          VectorPd xp(-dpos, 1.0f);
          CDFPrecision weight = mpm_use_weighted_reconstruction ? kernel.get_w(ind) : 1.0f;
          if (grid_state != 0) {
            if ((grid_state & mask) == (particle_states & mask)) {
              XtX += MatrixPd::outer_product(xp, xp) * weight;
              XtY += VectorPd(-d * dpos, d) * weight;
            } else if (cdf_use_negative) {
              uint64 diff = ((grid_state & mask) ^ (particle_states & mask));
              if (diff > 0 && 0 == (diff & (diff - 1))) {
                XtX += MatrixPd::outer_product(xp, xp) * weight;
                XtY += VectorPd(d * dpos, -d) * weight;
              }
            }
          }
        }
        if (std::fabs(determinant(XtX)) > mpm_reconstruction_guard<dim>()) {
          VectorP r = inversed(XtX) * XtY;
          p.near_boundary_ = true;
          p.boundary_distance = r[dim] * delta_x;
          p.debug = length2(Vector(r));
          if (length2(Vector(r)) > 1e-4f)
            p.boundary_normal = normalized(Vector(r));
          else
            p.boundary_normal = Vector(0.0f);
        } else {
          p.boundary_distance = 0;
          p.boundary_normal = Vector(0.0f);
        }
      }
    });
  }

  // ------------------------------------------------------- transfer.cpp
  // P2G for one particle with CPIC compatibility checks (MPM::rasterize body)
  TC_FORCE_INLINE void rasterize_particle_cpic(Particle &p, real delta_t, bool with_force) {
    if (p.is_rigid())
      return;
    if (particle_gravity)
      p.set_velocity(p.get_velocity() + gravity * delta_t);
    const Vector pos = p.pos * inv_delta_x;
    const Vector v = p.get_velocity();
    const real mass = p.get_mass();
    const Matrix apic_b_inv_d_mass = p.apic_b * (Kernel::inv_D() * mass);
    const Vector mass_v = mass * v;
    Matrix delta_t_tmp_force(0.0f);
    if (with_force)
      delta_t_tmp_force = p.calculate_force() * delta_t;
    VectorI grid_base_pos = get_grid_base_pos(pos);
    Kernel kernel(pos, inv_delta_x);
    const uint64 particle_state = p.states;
    // MLS-MPM: (apic_b * D^-1 * m) dpos - dt * F_tmp * dpos * 4 / dx  merged into one affine matrix
    const Matrix affine = apic_b_inv_d_mass - delta_t_tmp_force * (4.0f * inv_delta_x);
    for (auto &ind : kernel_offsets) {
      VectorI i = ind + grid_base_pos;
      GridState<dim> &g = get_grid(i);
      uint64 grid_state = g.get_states();
      uint64 mask = (grid_state & particle_state & state_mask) >> 1;
      if ((grid_state & mask) != (particle_state & mask)) {
        RigidBody<dim> *r = get_rigid_body_ptr(g.get_rigid_body_id());
        if (r == nullptr)
          continue;
        VectorP dw_w = kernel.get_dw_w(ind);
        Vector grid_pos = i.template cast<real>() * delta_x;
        Vector rigid_v = r->get_velocity_at(grid_pos);
        Vector velocity_change =
            v - friction_project(v, rigid_v, p.boundary_normal, r->frictions[(particle_state >> (2 * r->id)) % 2]);
        Vector impulse = mass * dw_w[dim] * velocity_change + delta_t_tmp_force * Vector(dw_w);
        r->apply_tmp_impulse(impulse, grid_pos);
        continue;
      }
      const real weight = kernel.get_w(ind);
      const Vector dpos = pos - i.template cast<real>();
      g.velocity_and_mass += weight * VectorP(mass_v + affine * dpos, mass);
    }
  }

  // P2G without CPIC checks (block_op_normal in the optimized 3D path)
  TC_FORCE_INLINE void rasterize_particle_fast(Particle &p, real delta_t) {
    if (particle_gravity)
      p.set_velocity(p.get_velocity() + gravity * delta_t);
    const Vector pos = p.pos * inv_delta_x;
    VectorI base;
    Vector fx;
    real w[dim][3];
    for (int k = 0; k < dim; k++) {
      base[k] = int(pos[k] - 0.5f);
      fx[k] = pos[k] - base[k];
      w[k][0] = 0.5f * sqr(1.5f - fx[k]);
      w[k][1] = 0.75f - sqr(fx[k] - 1.0f);
      w[k][2] = 0.5f * sqr(fx[k] - 0.5f);
    }
    const real mass = p.get_mass();
    const Vector mass_v = mass * p.get_velocity();
    const Matrix affine = p.apic_b * (Kernel::inv_D() * mass) + p.calculate_force() * (-4.0f * inv_delta_x * delta_t);
    const Vector mv0 = mass_v + affine * fx;  // momentum contribution at node offset 0
    GridState<dim> *g0 = &grid_data[grid_index(base)];
    if constexpr (dim == 2) {
      for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
          const real weight = w[0][i] * w[1][j];
          const Vector mv = mv0 - affine[0] * (real)i - affine[1] * (real)j;
          auto &vm = g0[i * stride[0] + j].velocity_and_mass;
          vm[0] += weight * mv[0];
          vm[1] += weight * mv[1];
          vm[2] += weight * mass;
        }
      }
    } else {
      for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
          const real wij = w[0][i] * w[1][j];
          const Vector mvij = mv0 - affine[0] * (real)i - affine[1] * (real)j;
          GridState<dim> *row = g0 + i * stride[0] + j * stride[1];
          for (int k = 0; k < 3; k++) {
            const real weight = wij * w[2][k];
            const Vector mv = mvij - affine[2] * (real)k;
            auto &vm = row[k].velocity_and_mass;
            vm[0] += weight * mv[0];
            vm[1] += weight * mv[1];
            vm[2] += weight * mv[2];
            vm[3] += weight * mass;
          }
        }
      }
    }
  }

  void rasterize(real delta_t, bool with_force = true) {
    for (auto &r : rigids)
      r->reset_tmp_velocity();
    parallel_for_each_particle([&](Particle &p) { rasterize_particle_cpic(p, delta_t, with_force); });
    for (auto &r : rigids)
      r->apply_tmp_velocity();
  }

  void rasterize_optimized(real delta_t) {
    for (auto &r : rigids)
      r->reset_tmp_velocity();
    const auto &blocks = page_map.blocks;
    const bool use_rigid = has_rigid_body();
    for (int b = 0; b < (int)blocks.size(); b++) {
      uint32 begin = block_meta[b].particle_offset, end = block_meta[b + 1].particle_offset;
      if (use_rigid && rigid_page_map.Test_Page(blocks[b])) {
        for (uint32 i = begin; i < end; i++)
          rasterize_particle_cpic(*allocator[particles[i]], delta_t, true);
      } else {
        for (uint32 i = begin; i < end; i++)
          rasterize_particle_fast(*allocator[particles[i]], delta_t);
      }
    }
    for (auto &r : rigids)
      r->apply_tmp_velocity();
  }

  // G2P for one particle with CPIC (MPM::resample body)
  TC_FORCE_INLINE void resample_particle_cpic(Particle &p) {
    if (p.is_rigid())
      return;
    real delta_t = base_delta_t;
    Vector v(0.0f);
    Matrix b(0.0f);
    Vector pos = p.pos * inv_delta_x;
    VectorI grid_base_pos = get_grid_base_pos(pos);
    Kernel kernel(pos, inv_delta_x);
    int rigid_id = -1;
    const uint64 particle_state = p.states;
    for (auto &ind : kernel_offsets) {
      VectorI i = ind + grid_base_pos;
      Vector grid_pos = i.template cast<real>() * delta_x;
      GridState<dim> &g = get_grid(i);
      Vector grid_vel = Vector(g.velocity_and_mass);
      Vector dpos = pos - i.template cast<real>();
      real weight = kernel.get_w(ind);
      uint64 grid_state = g.get_states();
      uint64 mask = (grid_state & particle_state & state_mask) >> 1;
      if ((grid_state & mask) != (particle_state & mask)) {
        Vector fake_v = p.get_velocity();
        RigidBody<dim> *r = get_rigid_body_ptr(g.get_rigid_body_id());
        Vector v_g(0.0f);
        real friction = 0.0f;
        if (r != nullptr) {
          v_g = r->get_velocity_at(grid_pos);
          rigid_id = g.get_rigid_body_id();
          friction = r->frictions[(particle_state >> (2 * r->id)) % 2];
        }
        if (p.near_boundary()) {
          if (p.sticky)
            friction = -1;
          fake_v = friction_project(p.get_velocity(), v_g, p.boundary_normal, friction) +
                   p.boundary_normal * (delta_t * delta_x * pushing_force);
        }
        grid_vel = fake_v;
      }
      v += weight * grid_vel;
      b += Matrix::outer_product(weight * grid_vel, dpos);
    }
    if (p.near_boundary())
      p.apic_b = Matrix(0.0f);
    else
      p.apic_b = damp_affine_momemtum(b);
    p.set_velocity(v);
    Matrix cdg = Matrix(1.0f) + delta_t * (b * (-4 * inv_delta_x));
    plasticity_counter += p.plasticity(cdg);
    p.pos += delta_t * p.get_velocity();
    p.pos = (p.pos * inv_delta_x).clamp(Vector(0.0f), res.template cast<real>() - Vector(eps)) * delta_x;
    if (p.near_boundary()) {
      if ((p.boundary_distance) < -0.05f * delta_x && (p.boundary_distance) > -delta_x * 0.3f) {
        Vector delta_velocity = p.boundary_distance * p.boundary_normal * penalty;
        p.set_velocity(p.get_velocity() - delta_velocity);
        if (rigid_id != -1)
          get_rigid_body_ptr(rigid_id)->apply_tmp_impulse(delta_velocity * p.get_mass(), p.pos);
      }
    }
  }

  // G2P without CPIC checks
  TC_FORCE_INLINE void resample_particle_fast(Particle &p) {
    const real delta_t = base_delta_t;
    const Vector pos = p.pos * inv_delta_x;
    VectorI base;
    Vector fx;
    real w[dim][3];
    for (int k = 0; k < dim; k++) {
      base[k] = int(pos[k] - 0.5f);
      fx[k] = pos[k] - base[k];
      w[k][0] = 0.5f * sqr(1.5f - fx[k]);
      w[k][1] = 0.75f - sqr(fx[k] - 1.0f);
      w[k][2] = 0.5f * sqr(fx[k] - 0.5f);
    }
    Vector v(0.0f);
    Matrix b(0.0f);
    const GridState<dim> *g0 = &grid_data[grid_index(base)];
    if constexpr (dim == 2) {
      for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
          const real weight = w[0][i] * w[1][j];
          const auto &vm = g0[i * stride[0] + j].velocity_and_mass;
          const Vector wv(vm[0] * weight, vm[1] * weight);
          v += wv;
          b[0] += wv * (fx[0] - i);
          b[1] += wv * (fx[1] - j);
        }
      }
    } else {
      for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
          const real wij = w[0][i] * w[1][j];
          const GridState<dim> *row = g0 + i * stride[0] + j * stride[1];
          for (int k = 0; k < 3; k++) {
            const real weight = wij * w[2][k];
            const auto &vm = row[k].velocity_and_mass;
            const Vector wv(vm[0] * weight, vm[1] * weight, vm[2] * weight);
            v += wv;
            b[0] += wv * (fx[0] - i);
            b[1] += wv * (fx[1] - j);
            b[2] += wv * (fx[2] - k);
          }
        }
      }
    }
    p.apic_b = damp_affine_momemtum(b);
    p.set_velocity(v);
    Matrix cdg = Matrix(1.0f) + b * (-4.0f * inv_delta_x * delta_t);
    plasticity_counter += p.plasticity(cdg);
    p.pos += delta_t * v;
    p.pos = (p.pos * inv_delta_x).clamp(Vector(0.0f), res.template cast<real>() - Vector(eps)) * delta_x;
  }

  void resample() {
    for (auto &r : rigids)
      r->reset_tmp_velocity();
    parallel_for_each_particle([&](Particle &p) { resample_particle_cpic(p); });
    for (auto &r : rigids)
      r->apply_tmp_velocity();
  }

  void resample_optimized() {
    for (auto &r : rigids)
      r->reset_tmp_velocity();
    const auto &blocks = page_map.blocks;
    const bool use_rigid = has_rigid_body();
    for (int b = 0; b < (int)blocks.size(); b++) {
      uint32 begin = block_meta[b].particle_offset, end = block_meta[b + 1].particle_offset;
      if (use_rigid && rigid_page_map.Test_Page(blocks[b])) {
        for (uint32 i = begin; i < end; i++)
          resample_particle_cpic(*allocator[particles[i]]);
      } else {
        for (uint32 i = begin; i < end; i++)
          resample_particle_fast(*allocator[particles[i]]);
      }
    }
    for (auto &r : rigids)
      r->apply_tmp_velocity();
  }

  // ----------------------------------------------------- grid operations
  void normalize_grid_and_apply_external_force(Vector velocity_increment_) {
    VectorP velocity_increment(velocity_increment_, 0.0f);
    parallel_for_each_active_grid([&](GridState<dim> &g) {
      real mass = g.velocity_and_mass[dim];
      if (mass > 0) {
        real inv_mass = 1.0f / mass;
        VectorP alpha(Vector(inv_mass), 1.0f);
        g.velocity_and_mass = g.velocity_and_mass * alpha + velocity_increment;
      }
    });
  }

  void apply_grid_boundary_conditions(const DynamicLevelSet<dim> &levelset, real t) {
    if (!has_levelset)
      return;
    int grid_block_size_max = block_size_1d;
    for (auto b : fat_page_map.blocks) {
      VectorI block_base_coord = block_coord(b) * block_size_1d;
      Vector center = (block_base_coord + VectorI(block_size_1d / 2)).template cast<real>();
      if (levelset.inside(center) && std::fabs(levelset.sample(center, t)) >= (real)grid_block_size_max)
        continue;
      for_each_node_in_block(b, [&](const VectorI &ind, GridState<dim> &g) {
        if (g.velocity_and_mass[dim] == 0.0f)
          return;
        Vector pos = ind.template cast<real>();
        real phi = levelset.sample(pos, t);
        if (phi < -3 || 0 < phi)
          return;
        Vector n = levelset.get_spatial_gradient(pos, t);
        Vector boundary_velocity = -levelset.get_temporal_derivative(pos, t) * n * delta_x;
        real mu = levelset.levelset0->friction;
        Vector v = friction_project(Vector(g.velocity_and_mass), boundary_velocity, n, mu);
        g.velocity_and_mass = VectorP(v, g.velocity_and_mass[dim]);
      });
    }
  }

  void apply_dirichlet_boundary_conditions() {
    if constexpr (dim == 2) {
      real distance = config_backup.get("dirichlet_boundary_radius", 0.0f);
      real distance_l = config_backup.get("dirichlet_distance_left", distance);
      real distance_r = config_backup.get("dirichlet_distance_right", distance);
      real velocity = config_backup.get("dirichlet_boundary_velocity", 0.0f);
      Vector vl(0.0f), vr(0.0f);
      vl[0] = config_backup.get("dirichlet_boundary_left", velocity);
      vr[0] = config_backup.get("dirichlet_boundary_right", velocity);
      parallel_for_each_active_grid_with_index([&](const VectorI &ind, GridState<dim> &g) {
        Vector pos = ind.template cast<real>() * delta_x;
        if (pos[0] < distance_l)
          g.velocity_and_mass = VectorP(vl, g.velocity_and_mass[dim]);
        else if (pos[0] > 1.0f - distance_r)
          g.velocity_and_mass = VectorP(vr, g.velocity_and_mass[dim]);
      });
    } else {
      parallel_for_each_active_grid_with_index([&](const VectorI &ind, GridState<dim> &g) {
        Vector pos = ind.template cast<real>() * delta_x;
        if (pos[1] > 0.525f)
          g.velocity_and_mass = VectorP(Vector(0.0f), g.velocity_and_mass[dim]);
      });
    }
  }
  template <typename T>
  void parallel_for_each_active_grid_with_index(const T &target) {
    for (auto b : fat_page_map.blocks)
      for_each_node_in_block(b, target);
  }

  void particle_collision_resolution(real t) {
    if (!has_levelset)
      return;
    parallel_for_each_particle([&](Particle &p) {
      Vector pos = p.pos * inv_delta_x;
      real phi = levelset.sample(pos, t);
      if (phi < 0) {
        Vector gradient = levelset.get_spatial_gradient(pos, t);
        p.pos -= gradient * phi * delta_x;
        p.set_velocity(p.get_velocity() - dot(gradient, p.get_velocity()) * gradient);
      }
    });
  }

  void clear_boundary_particles() {
    std::vector<ParticlePtr> particles_new;
    particles_new.reserve(particles.size());
    int remove_particles = config_backup.get("remove_particles", 0);
    real remove_height = config_backup.get("remove_height", 0.02f);
    for (auto p_i : particles) {
      auto p = allocator[p_i];
      if (near_boundary(*p) || p->pos.abnormal() || p->get_velocity().abnormal())
        continue;
      if (remove_particles && !has_deleted && current_t >= 0.1f) {
        real h = remove_height;
        if (p->pos[0] >= 0.45f && p->pos[1] >= 0.6f - 0.5f * h && p->pos[1] <= 0.6f + 0.5f * h) {
          if (remove_particles == 1)
            continue;
          else if (remove_particles == 2)
            p->set_mu_to_zero();
          else if (remove_particles == 3)
            p->set_lambda_and_mu_to_zero();
        }
      }
      particles_new.push_back(p_i);
    }
    if (remove_particles && !has_deleted && current_t >= 0.1f)
      has_deleted = true;
    int deleted = (int)particles.size() - (int)particles_new.size();
    if (deleted != 0 && config_backup.get("warn_particle_deletion", false))
      TC_WARN("%d boundary (or abnormal) particles deleted. %d particles remained", deleted, (int)particles_new.size());
    particles.swap(particles_new);
  }

  // ------------------------------------------------------------ stepping
  void step(real dt) override {
    if (dt < 0) {
      substep();
      request_t = current_t;
    } else {
      request_t += dt;
      while (current_t + base_delta_t < request_t) {
        update_counter += particles.size();
        substep();
      }
    }
    step_counter += 1;
  }
  void begin_step(real dt) override { request_t += dt; }
  int advance(int max_substeps) override {
    int count = 0;
    while (current_t + base_delta_t < request_t && count < max_substeps) {
      update_counter += particles.size();
      substep();
      count++;
    }
    if (current_t + base_delta_t < request_t)
      return 0;
    step_counter += 1;
    return 1;
  }

#define MPM_PROFILE(id, stmt)        \
  {                                  \
    double t0_ = now_ms();           \
    stmt;                            \
    prof[id] += now_ms() - t0_;      \
  }

  void substep() {
    double wall0 = now_ms();
    cutting_counter = 0;
    plasticity_counter = 0;
    const real delta_t = base_delta_t;
    MPM_PROFILE(P_SORT, sort_particles_and_populate_grid());
    if (has_rigid_body()) {
      int coupling_iterations = config_backup.get("coupling_iterations", 1);
      for (int i = 0; i < coupling_iterations; i++) {
        MPM_PROFILE(P_RIGIDIFY, rigidify(delta_t));
        MPM_PROFILE(P_ARTICULATE, articulate(delta_t));
        MPM_PROFILE(P_RASTER_RIGID, rasterize_rigid_boundary());
      }
      MPM_PROFILE(P_GATHER_CDF, gather_cdf());
    }
    if (config_backup.get("optimized", true)) {
      MPM_PROFILE(P_P2G, rasterize_optimized(delta_t));
    } else {
      MPM_PROFILE(P_P2G, rasterize(delta_t));
    }
    Vector gravity_velocity_increment = gravity * delta_t;
    if (particle_gravity)
      gravity_velocity_increment = Vector(0.0f);
    MPM_PROFILE(P_GRID, normalize_grid_and_apply_external_force(gravity_velocity_increment));
    MPM_PROFILE(P_BOUNDARY, {
      if (config_backup.get("rigid_body_levelset_collision", false))
        rigid_body_levelset_collision(current_t, delta_t);
      apply_grid_boundary_conditions(levelset, current_t);
      if (config_backup.get("dirichlet_boundary_radius", 0.0f) > 0.0f)
        apply_dirichlet_boundary_conditions();
    });
    if (config_backup.get("optimized", true)) {
      MPM_PROFILE(P_G2P, resample_optimized());
    } else {
      MPM_PROFILE(P_G2P, resample());
    }
    MPM_PROFILE(P_CLEAN, {
      if (config_backup.get("clean_boundary", true))
        clear_boundary_particles();
      if (config_backup.get("particle_collision", false))
        particle_collision_resolution(current_t);
    });
    if (has_rigid_body()) {
      MPM_PROFILE(P_ADVECT_RIGID, advect_rigid_bodies(delta_t));
    }
    current_t += delta_t;
    substep_counter += 1;
    prof_substeps += 1;
    prof_wall += now_ms() - wall0;
  }

  // ------------------------------------------------------- general_action
  std::string general_action(const Config &config) override {
    std::string action = config.get_string("action");
    if (action == "add_articulation") {
      Config new_config = config;
      new_config.set("obj0", rigids[config.get<int>("obj0")].get());
      if (config.has_key("obj1"))
        new_config.set("obj1", rigids[config.get<int>("obj1")].get());
      else
        new_config.set("obj1", rigids[0].get());
      articulations.push_back(create_articulation<dim>(config.get_string("type"), new_config));
    } else if (action == "create_levelset") {
      auto ls = std::make_shared<LevelSet<dim>>();
      ls->initialize(res + VectorI(1));
      levelsets.push_back(ls);
      return std::to_string((int)levelsets.size() - 1);
    } else if (action == "levelset_op") {
      // all lengths are given in world units and converted to grid units
      auto &ls = levelsets.at(config.get<int>("id"));
      std::string op = config.get_string("op");
      bool inside_out = config.get("inside_out", false);
      if (op == "add_plane") {
        ls->add_plane(config.get<Vector>("normal"), config.get("d", 0.0f) * inv_delta_x);
      } else if (op == "add_sphere") {
        ls->add_sphere(config.get<Vector>("center") * inv_delta_x, config.get("radius", 0.1f) * inv_delta_x, inside_out);
      } else if (op == "add_box" || op == "add_cuboid") {
        ls->add_box(config.get<Vector>("lower") * inv_delta_x, config.get<Vector>("upper") * inv_delta_x, inside_out);
      } else if (op == "add_cylinder") {
        ls->add_cylinder(config.get<Vector>("center") * inv_delta_x, config.get("radius", 0.1f) * inv_delta_x, inside_out);
      } else if (op == "add_polygon") {
        auto nums = config_detail::parse_numbers(config.get_string("points"));
        std::vector<Vector> poly;
        for (size_t i = 0; i + dim <= nums.size(); i += dim) {
          Vector v;
          for (int k = 0; k < dim; k++)
            v[k] = (real)nums[i + k] * inv_delta_x;
          poly.push_back(v);
        }
        ls->add_polygon(poly, inside_out);
      } else if (op == "global_increase") {
        ls->global_increase(config.get("delta", 0.0f) * inv_delta_x);
      } else if (op == "set_friction") {
        ls->friction = config.get("friction", 1.0f);
      } else {
        TC_ERROR("Unknown levelset op '%s'", op.c_str());
      }
    } else if (action == "set_levelset") {
      auto ls0 = levelsets.at(config.get<int>("id"));
      auto ls1 = config.has_key("id1") ? levelsets.at(config.get<int>("id1")) : ls0;
      levelset.initialize(config.get("t0", 0.0f), config.get("t1", 1.0f), ls0, ls1);
      has_levelset = true;
    } else if (action == "delete_particles_inside_level_set") {
      if (!has_levelset)
        return "0";
      std::vector<ParticlePtr> particles_new;
      int deleted = 0;
      for (auto p_i : particles) {
        auto p = allocator[p_i];
        if (levelset.sample(p->pos * inv_delta_x, current_t) < 0) {
          deleted++;
          continue;
        }
        particles_new.push_back(p_i);
      }
      particles = particles_new;
      return std::to_string(deleted);
    } else if (action == "calculate_energy") {
      double kinetic = 0, potential = 0;
      parallel_for_each_particle([&](Particle &p) {
        if (p.is_rigid())
          return;
        kinetic += 0.5 * p.get_mass() * p.get_velocity().length2();
        potential += p.potential_energy() - p.get_mass() * dot(gravity, p.pos);
      });
      char buf[64];
      snprintf(buf, sizeof(buf), "%.9g", kinetic + potential);
      return buf;
    } else if (action == "set_config") {
      // [port] update runtime options (e.g. penalty, pushing_force)
      if (config.has_key("penalty"))
        penalty = config.get<real>("penalty");
      if (config.has_key("pushing_force"))
        pushing_force = config.get<real>("pushing_force");
      if (config.has_key("gravity"))
        gravity = config.get<Vector>("gravity");
    } else {
      TC_ERROR("Unknown action: %s", action.c_str());
    }
    return "";
  }

  // ------------------------------------------------------------ exports
  uint32 particle_color(Particle &p, int mode) const {
    switch (mode) {
      case 1:
        return colormap(p.get_velocity().length() * 0.35f);
      case 2: {  // CPIC affinity / side of the nearest rigid boundary
        for (int id = 1; id < GridState<dim>::max_num_rigid_bodies; id++) {
          if ((p.states >> (2 * id + 1)) & 1) {
            bool side = (p.states >> (2 * id)) & 1;
            if (p.near_boundary_)
              return side ? pack_color(Vector3(1.0f, 0.42f, 0.1f)) : pack_color(Vector3(0.1f, 0.75f, 1.0f));
            return side ? pack_color(Vector3(0.62f, 0.35f, 0.2f)) : pack_color(Vector3(0.2f, 0.45f, 0.62f));
          }
        }
        return pack_color(Vector3(0.38f, 0.4f, 0.45f));
      }
      case 3:
        return pack_color(default_material_color(p.material));
      case 4: {
        real m = p.get_plastic_measure();
        return colormap(0.5f + 2.5f * (m - 1.0f));
      }
      default:
        return p.color;
    }
  }

  int export_particles(int mode, std::vector<float> &out) override {
    out.resize(particles.size() * 4);
    int count = 0;
    for (auto p_i : particles) {
      Particle &p = *allocator[p_i];
      if (p.is_rigid())
        continue;
      float *o = out.data() + count * 4;
      o[0] = p.pos[0];
      o[1] = p.pos[1];
      o[2] = dim == 3 ? p.pos[dim - 1] : 0.0f;
      uint32 c = particle_color(p, mode);
      std::memcpy((void *)(o + 3), &c, 4);  // byte copy: never canonicalize NaN patterns
      count++;
    }
    out.resize(count * 4);
    return count;
  }

  void export_rigids(std::vector<float> &out) override {
    out.clear();
    out.push_back((float)(rigids.size() - 1));
    for (size_t i = 1; i < rigids.size(); i++) {
      auto &r = *rigids[i];
      auto m = r.get_mesh_to_world();
      out.push_back((float)i);
      out.push_back((float)r.mesh->elements.size());
      uint32 c = pack_color(r.color, 0.0f) & 0x00ffffffu;  // alpha 0 keeps the float finite
      float fc;
      std::memcpy(&fc, &c, 4);
      out.push_back(fc);
      out.push_back(r.codimensional ? 1.0f : 0.0f);
      for (auto &e : r.mesh->elements)
        for (int k = 0; k < dim; k++) {
          Vector p = transform<dim>(m, e.v[k]);
          for (int j = 0; j < dim; j++)
            out.push_back(p[j]);
        }
    }
  }

  void export_levelset(std::vector<float> &out, int &nx, int &ny) override {
    out.clear();
    nx = ny = 0;
    if (!has_levelset)
      return;
    if constexpr (dim == 2) {
      nx = res[0] + 1;
      ny = res[1] + 1;
      out.resize((size_t)nx * ny);
      for (int x = 0; x < nx; x++)
        for (int y = 0; y < ny; y++)
          out[(size_t)y * nx + x] = levelset.sample(Vector((real)x, (real)y), current_t);
    } else {
      // y = const slices are not useful in 3D; export the level set on a
      // coarse 3D lattice (nx = ny = n, n^3 values, x-fastest)
      int n = 32;
      nx = ny = n;
      out.resize((size_t)n * n * n);
      for (int z = 0; z < n; z++)
        for (int y = 0; y < n; y++)
          for (int x = 0; x < n; x++) {
            Vector3 pp((x + 0.5f) / n * res[0], (y + 0.5f) / n * res[1], (z + 0.5f) / n * res[dim - 1]);
            Vector q;
            for (int k = 0; k < dim; k++)
              q[k] = pp[k];
            out[((size_t)z * n + y) * n + x] = levelset.sample(q, current_t) * delta_x;
          }
    }
  }

  void export_blocks(std::vector<float> &out) override {
    out.clear();
    for (auto b : page_map.blocks) {
      VectorI c = block_coord(b) * block_size_1d;
      for (int k = 0; k < dim; k++)
        out.push_back(c[k] * delta_x);
      out.push_back(rigid_page_map.Test_Page(b) ? 1.0f : 0.0f);
    }
  }

  void export_stats(std::vector<double> &out) override {
    out.clear();
    int rigid_particles = 0, near_boundary_particles = 0;
    for (auto p_i : particles) {
      auto p = allocator[p_i];
      rigid_particles += p->is_rigid();
      near_boundary_particles += p->near_boundary_;
    }
    out.push_back(current_t);                                // 0
    out.push_back(substep_counter);                          // 1
    out.push_back((double)particles.size() - rigid_particles);  // 2
    out.push_back(rigid_particles);                          // 3
    out.push_back(page_map.blocks.size());                   // 4
    out.push_back(fat_page_map.blocks.size());               // 5
    out.push_back(rigid_page_map.blocks.size());             // 6
    out.push_back((double)cutting_counter);                  // 7
    out.push_back((double)plasticity_counter);               // 8
    out.push_back(base_delta_t);                             // 9
    out.push_back((double)rigids.size() - 1);                // 10
    out.push_back(total_blocks);                             // 11
    out.push_back(near_boundary_particles);                  // 12
    out.push_back(allocator.pool.size());                    // 13
    out.push_back(block_size_1d);                            // 14
    out.push_back(prof_substeps);                            // 15
    out.push_back(prof_wall);                                // 16
    for (int i = 0; i < P_NUM; i++)                          // 17..
      out.push_back(prof[i]);
    for (int i = 0; i < P_NUM; i++)
      prof[i] = 0;
    prof_substeps = 0;
    prof_wall = 0;
  }
};

TC_NAMESPACE_END
