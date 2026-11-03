#include <emscripten.h>
#include <fstream>
#include <random>
#include <stdexcept>
#include <json.hpp>
#include <taichi/visual/texture.h>
#include "mpm.h"
#include "boundary_particle.h"

using namespace taichi;
namespace {
std::unique_ptr<MPM<2>> solver2;
std::unique_ptr<MPM<3>> solver3;
std::vector<float> frame;
std::string last_error;
std::string last_result;
using Json = nlohmann::json;
int dimension = 3;
int material_id = 0;
int scene_id = 0;
float stiffness = 50000;
float friction_angle = 30;
const char *materials[] = {"sand", "snow", "jelly", "water", "von_mises", "visco", "elastic", "linear"};
std::mt19937 rng(2018);
float random01() { return std::generate_canonical<float, 24>(rng); }

Config material_config(int id) {
  Config c;
  const float nu = 0.25f;
  c.set("E", stiffness).set("youngs_modulus", stiffness).set("nu", nu)
    .set("poisson_ratio", nu).set("mu_0", stiffness / (2 * (1 + nu)))
    .set("lambda_0", stiffness * nu / ((1 + nu) * (1 - 2 * nu)))
    .set("friction_angle", friction_angle).set("k", stiffness)
    .set("type", std::string(materials[id])).set("density", 400.f);
  return c;
}

template <int D> void add_particle(MPM<D> &s, VectorND<D, real> p,
                                   VectorND<D, real> v, int mat, float volume) {
  auto allocation = s.allocator.allocate_particle(materials[mat]);
  auto *particle = allocation.second;
  particle->initialize(material_config(mat));
  particle->pos = p;
  particle->vol = volume;
  particle->set_mass(400.f * volume);
  particle->set_velocity(v);
  particle->debug = float(mat);
  particle->sticky = false;
  s.particles.push_back(allocation.first);
}

template <int D> void add_rigid(MPM<D> &s, bool cutting) {
  using V = VectorND<D, real>;
  Config c;
  c.set("type", "rigid").set("codimensional", cutting)
    .set("initial_position", V(Vector3(.50f, .50f, .50f)))
    .set("density", 200.f).set("friction", 0.25f)
    .set("scale", V(Vector3(cutting ? .48f : .16f, cutting ? .012f : .16f, cutting ? .48f : .16f)));
  if constexpr (D == 3) {
    std::ofstream out("/body.obj");
    out << "v -0.5 -0.5 -0.5\nv 0.5 -0.5 -0.5\nv 0.5 0.5 -0.5\nv -0.5 0.5 -0.5\n"
           "v -0.5 -0.5 0.5\nv 0.5 -0.5 0.5\nv 0.5 0.5 0.5\nv -0.5 0.5 0.5\n"
           "f 1 3 2\nf 1 4 3\nf 5 6 7\nf 5 7 8\nf 1 2 6\nf 1 6 5\n"
           "f 4 8 7\nf 4 7 3\nf 1 5 8\nf 1 8 4\nf 2 3 7\nf 2 7 6\n";
    out.close();
    c.set("mesh_fn", "/body.obj");
  } else {
    c.set("segment_mesh", "4 -0.5 -0.5 0.5 -0.5 0.5 -0.5 0.5 0.5 0.5 0.5 -0.5 0.5 -0.5 0.5 -0.5 -0.5");
  }
  s.add_rigid_particle(c);
  auto &r = *s.rigids.back();
  r.id = int(s.rigids.size()) - 1;
  if (cutting) {
    r.set_infinity_mass();
    r.set_infinity_inertia();
    r.pos_func = [](float t) { return V(Vector3(.50f, .70f - std::min(t * .35f, .4f), .50f)); };
    if constexpr (D == 3) r.rot_func = [](float) { return Vector3(0.f, 0.f, 22.f); };
    else r.rot_func = [](float) { return 22.f; };
  }
}

template <int D> void initialize(MPM<D> &s, int res, int count, float gravity, float dt, const Config *extra = nullptr) {
  using V = VectorND<D, real>;
  using VI = VectorND<D, int>;
  s.delta_x = 1.f / res;
  s.rigids.clear();
  Config config;
  config.set("res", VI(res)).set("delta_x", s.delta_x).set("num_threads", 1)
    .set("base_delta_t", dt).set("gravity", V::axis(1) * gravity)
    .set("optimized", true).set("particle_gravity", true)
    .set("clean_boundary", true).set("reorder_interval", 0)
    .set("rigid_body_levelset_collision", true).set("articulation_iterations", 10);
  if (extra) for (const auto &key : extra->get_keys()) config.set(key, extra->get_string(key));
  s.initialize(config);
  s.rigids[0]->id = 0;
  auto levelset = std::make_shared<LevelSet<D>>(VI(res + 1), V(0.f));
  float bound = std::max(.13f, 8.f / res);
  for (auto &index : levelset->get_region()) {
    V p = index.get_pos() / float(res);
    float phi = std::min(p[1] - bound, 1.f - bound - p[1]);
    for (int a = 0; a < D; ++a) if (a != 1) phi = std::min(phi, std::min(p[a] - bound, 1.f - bound - p[a]));
    levelset->set(index, phi * res);
  }
  levelset->friction = .45f;
  s.levelset.levelset0 = levelset;
  s.levelset.levelset1 = levelset;
  s.levelset.t0 = 0;
  s.levelset.t1 = 1;
  rng.seed(2018);
  const float volume = (D == 3 ? .045f : .15f) / std::max(1, count);
  int added = 0;
  while (added < count) {
    Vector3 p(.17f + .66f * random01(), bound + .012f + .63f * random01(), .17f + .66f * random01());
    Vector3 velocity(0.f);
    if constexpr (D == 2) p.z = .5f;
    bool inside = false;
    if (scene_id == 0) {
      float r = std::sqrt(sqr(p.x - .47f - .12f * (p.y - .2f)) + sqr(p.z - .5f));
      inside = (r < .165f && p.y < .72f) || (r < .30f - (p.y - bound) * 1.5f && p.y < bound + .13f);
    } else if (scene_id == 1) {
      inside = length(p - Vector3(.5f, .62f, .5f)) < .205f;
      velocity.x = .25f;
    } else if (scene_id == 2) {
      inside = p.x < .45f && p.y < .72f && std::abs(p.z - .5f) < .25f;
    } else if (scene_id == 3) {
      inside = std::abs(p.x - .5f) < .19f && p.y > .30f && p.y < .68f && std::abs(p.z - .5f) < .19f;
    } else {
      inside = p.y < bound + .22f && std::abs(p.x - .5f) < .28f && std::abs(p.z - .5f) < .28f;
    }
    if (!inside) continue;
    add_particle(s, V(p), V(velocity), material_id, volume);
    ++added;
  }
  if (scene_id == 3 || scene_id == 4) add_rigid(s, scene_id == 3);
}

template <int D> int read_frame(MPM<D> &s) {
  frame.clear();
  frame.reserve(s.particles.size() * 8);
  for (auto index : s.particles) {
    auto &p = *s.allocator[index];
    auto v = p.get_velocity();
    frame.insert(frame.end(), {p.pos[0], p.pos[1], D == 3 ? p.pos[2] : .5f,
      v[0], v[1], D == 3 ? v[2] : 0.f, p.is_rigid() ? 8.f : p.debug, float(p.id)});
  }
  return int(s.particles.size());
}

template <int D> void impulse(MPM<D> &s, float x, float y, float z, float radius, float strength) {
  using V = VectorND<D, real>;
  V center(Vector3(x, y, z));
  for (auto index : s.particles) {
    auto &p = *s.allocator[index];
    if (p.is_rigid()) continue;
    V delta = p.pos - center;
    float distance = length(delta);
    if (distance < radius) {
      V force = delta / (distance + .02f) + V::axis(1) * .5f;
      p.set_velocity(p.get_velocity() + force * (1.f - distance / radius) * strength);
    }
  }
}

Config config_from_json(const Json &j) {
  if (!j.is_object()) throw std::runtime_error("Configuration must be a JSON object.");
  Config config;
  for (auto i = j.begin(); i != j.end(); ++i)
    config.set(i.key(), i.value().is_string() ? i.value().get<std::string>() : i.value().dump());
  return config;
}

class BrowserDensity final : public Texture {
 public:
  Vector3 lower, upper, center;
  real radius, ppc;
  bool sphere;
  explicit BrowserDensity(const Config &c) {
    lower = c.get("lower", Vector3(.35f));
    upper = c.get("upper", Vector3(.65f));
    center = c.get("center", Vector3(.5f));
    radius = c.get("radius", .15f);
    ppc = clamp(c.get("ppc", 4.f), .1f, 32.f);
    sphere = c.get("shape", "box") == "sphere";
  }
  Vector4 sample(const Vector3 &p) const override {
    bool inside = sphere ? length(p - center) <= radius : (lower <= p && p <= upper);
    return Vector4(inside ? ppc : 0.f);
  }
};

template <int D> std::string add_json(MPM<D> &s, Config config) {
  std::string type = config.get<std::string>("type");
  bool valid = type == "rigid";
  for (auto name : materials) valid = valid || type == name;
  if (!valid) throw std::runtime_error("Unknown material type.");
  if (type == "rigid" && s.rigids.size() >= 12) throw std::runtime_error("CPIC supports at most 11 user rigid bodies.");
  size_t old_count = s.particles.size();
  std::shared_ptr<Texture> texture;
  if (type != "rigid" && !config.get("point_cloud", false)) {
    texture = std::make_shared<BrowserDensity>(config);
    int id = AssetManager::insert_asset(texture);
    config.set("density_tex", id);
    if (!config.has_key("pd")) config.set("pd", false);
    if (!config.has_key("pd_periodic")) config.set("pd_periodic", false);
  }
  std::string result = s.add_particles(config);
  if (type == "rigid") s.rigids.back()->id = int(s.rigids.size()) - 1;
  for (size_t i = old_count; i < s.particles.size(); ++i) {
    auto *p = s.allocator[s.particles[i]];
    for (int mat = 0; mat < 8; ++mat) if (type == materials[mat]) p->debug = float(mat);
  }
  return result;
}

template <int D> void set_config(MPM<D> &s, const Config &config) {
  if (config.has_key("res") || config.has_key("delta_x"))
    throw std::runtime_error("Grid geometry changes require mpm_initialize_json.");
  for (const auto &key : config.get_keys()) s.config_backup.set(key, config.get_string(key));
  s.gravity = config.get("gravity", s.gravity);
  s.base_delta_t = config.get("base_delta_t", s.base_delta_t);
  s.rpic_damping = config.get("rpic_damping", s.rpic_damping);
  s.apic_damping = config.get("apic_damping", s.apic_damping);
  s.particle_gravity = config.get("particle_gravity", s.particle_gravity);
  s.apic = config.get("apic", s.apic);
  s.penalty = config.get("penalty", s.penalty);
  s.pushing_force = config.get("pushing_force", s.pushing_force);
}

template <int D> void set_levelset(MPM<D> &s, const Json &spec) {
  using V = VectorND<D, real>;
  using VI = VectorND<D, int>;
  auto ls = std::make_shared<LevelSet<D>>(s.res + VI(1), V(0.f));
  for (const auto &shape : spec.at("shapes")) {
    auto c = config_from_json(shape);
    auto type = c.get<std::string>("type");
    if (type == "plane") ls->add_plane(c.get<V>("normal"), c.get<real>("d") * s.inv_delta_x);
    else if (type == "sphere") ls->add_sphere(c.get<V>("center") * s.inv_delta_x, c.get<real>("radius") * s.inv_delta_x, c.get("inside_out", false));
    else throw std::runtime_error("Level-set shapes support plane and sphere.");
  }
  ls->friction = spec.value("friction", .4f);
  s.levelset.levelset0 = ls;
  s.levelset.levelset1 = ls;
}
}

extern "C" {
EMSCRIPTEN_KEEPALIVE const char *mpm_error() { return last_error.c_str(); }
EMSCRIPTEN_KEEPALIVE int mpm_init(int dim, int scene, int material, int res, int count, float gravity, float E, float friction, float dt) {
  try {
    if ((dim != 2 && dim != 3) || res < 32 || res > 96 || count < 1 || count > 60000 || material < 0 || material > 7 || scene < 0 || scene > 4)
      throw std::runtime_error("Scene settings are outside supported browser limits.");
    dimension = dim; scene_id = scene; material_id = material;
    stiffness = clamp(E, 1000.f, 200000.f); friction_angle = clamp(friction, 5.f, 55.f);
    solver2.reset(); solver3.reset(); frame.clear(); last_error.clear();
    if (dim == 3) { solver3 = std::make_unique<MPM<3>>(); initialize(*solver3, res, count, gravity, dt); }
    else { solver2 = std::make_unique<MPM<2>>(); initialize(*solver2, res, count, gravity, dt); }
    return 1;
  } catch (const std::exception &e) { last_error = e.what(); return 0; }
}
EMSCRIPTEN_KEEPALIVE int mpm_step(int steps) {
  try {
    for (int i = 0; i < std::min(steps, 200); ++i) {
      if (solver3) solver3->substep(); else if (solver2) solver2->substep();
    }
    return 1;
  } catch (const std::exception &e) { last_error = e.what(); return 0; }
}
EMSCRIPTEN_KEEPALIVE int mpm_count() { return solver3 ? read_frame(*solver3) : solver2 ? read_frame(*solver2) : 0; }
EMSCRIPTEN_KEEPALIVE float *mpm_data() { return frame.data(); }
EMSCRIPTEN_KEEPALIVE float mpm_time() { return solver3 ? solver3->get_current_time() : solver2 ? solver2->get_current_time() : 0; }
EMSCRIPTEN_KEEPALIVE int mpm_substeps() { return solver3 ? solver3->substep_counter : solver2 ? solver2->substep_counter : 0; }
EMSCRIPTEN_KEEPALIVE int mpm_grid_blocks() { return solver3 ? solver3->fat_page_map->Get_Blocks().second : solver2 ? solver2->fat_page_map->Get_Blocks().second : 0; }
EMSCRIPTEN_KEEPALIVE void mpm_impulse(float x, float y, float z, float radius, float strength) {
  if (solver3) impulse(*solver3, x, y, z, radius, strength);
  if (solver2) impulse(*solver2, x, y, z, radius, strength);
}
EMSCRIPTEN_KEEPALIVE void mpm_gravity(float g) {
  if (solver3) solver3->gravity.y = g;
  if (solver2) solver2->gravity.y = g;
}
EMSCRIPTEN_KEEPALIVE int mpm_save() {
  try {
    Config c; c.set("action", "save").set("file_name", "/snapshot.tcb");
    if (solver3) solver3->general_action(c); else if (solver2) solver2->general_action(c);
    return 1;
  } catch (const std::exception &e) { last_error = e.what(); return 0; }
}

// General-purpose bindings preserve upstream configuration and factory APIs.
EMSCRIPTEN_KEEPALIVE int mpm_initialize_json(int dim, const char *json) {
  try {
    if (dim != 2 && dim != 3) throw std::runtime_error("Dimension must be 2 or 3.");
    auto j = Json::parse(json);
    auto c = config_from_json(j);
    if (!j.at("res").is_array() || j.at("res").size() != size_t(dim))
      throw std::runtime_error("Resolution must match the requested dimension.");
    int res = j.at("res").at(0).get<int>();
    if (res < 32 || res > 96) throw std::runtime_error("Browser grid resolution must be between 32 and 96.");
    for (const auto &n : j.at("res")) if (n.get<int>() != res) throw std::runtime_error("The browser bridge uses a cubic grid.");
    dimension = dim; scene_id = -1;
    solver2.reset(); solver3.reset(); frame.clear(); last_error.clear();
    if (dim == 3) { solver3 = std::make_unique<MPM<3>>(); initialize(*solver3, res, 0, -9.8f, .0002f, &c); }
    else { solver2 = std::make_unique<MPM<2>>(); initialize(*solver2, res, 0, -9.8f, .0002f, &c); }
    return 1;
  } catch (const std::exception &e) { last_error = e.what(); return 0; }
}
EMSCRIPTEN_KEEPALIVE const char *mpm_add_json(const char *json) {
  try {
    auto c = config_from_json(Json::parse(json));
    if (solver3) last_result = add_json(*solver3, c);
    else if (solver2) last_result = add_json(*solver2, c);
    else throw std::runtime_error("Initialize the solver first.");
    return last_result.c_str();
  } catch (const std::exception &e) { last_error = e.what(); return nullptr; }
}
EMSCRIPTEN_KEEPALIVE const char *mpm_action_json(const char *json) {
  try {
    auto c = config_from_json(Json::parse(json));
    const int rigid_count = solver3 ? solver3->rigids.size() : solver2 ? solver2->rigids.size() : 0;
    for (auto key : {"obj0", "obj1"}) if (c.has_key(key) && (c.get<int>(key) < 0 || c.get<int>(key) >= rigid_count))
      throw std::runtime_error("Articulation body index is out of range.");
    if (solver3) last_result = solver3->general_action(c);
    else if (solver2) last_result = solver2->general_action(c);
    else throw std::runtime_error("Initialize the solver first.");
    return last_result.c_str();
  } catch (const std::exception &e) { last_error = e.what(); return nullptr; }
}
EMSCRIPTEN_KEEPALIVE int mpm_config_json(const char *json) {
  try {
    auto c = config_from_json(Json::parse(json));
    if (solver3) set_config(*solver3, c); else if (solver2) set_config(*solver2, c);
    else throw std::runtime_error("Initialize the solver first.");
    return 1;
  } catch (const std::exception &e) { last_error = e.what(); return 0; }
}
EMSCRIPTEN_KEEPALIVE int mpm_levelset_json(const char *json) {
  try {
    auto j = Json::parse(json);
    if (solver3) set_levelset(*solver3, j); else if (solver2) set_levelset(*solver2, j);
    else throw std::runtime_error("Initialize the solver first.");
    return 1;
  } catch (const std::exception &e) { last_error = e.what(); return 0; }
}
}