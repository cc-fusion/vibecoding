/*******************************************************************************
  taichi_lite.h

  A compact re-implementation of the subset of the legacy Taichi library
  (github.com/taichi-dev/taichi, "legacy" branch) that the taichi_mpm full
  solver depends on:  VectorND / MatrixND, SVD & polar decomposition,
  Rotation / AngularVelocity, Element meshes, Config, LevelSet /
  DynamicLevelSet, procedural Textures and the Poisson-disk sampler.

  Ported to plain C++17 so it can be compiled to WebAssembly (wasm32-wasi).
*******************************************************************************/
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

#define TC_NAMESPACE_BEGIN namespace taichi {
#define TC_NAMESPACE_END }
#define TC_FORCE_INLINE inline __attribute__((always_inline))

TC_NAMESPACE_BEGIN

using real = float;
using float32 = float;
using float64 = double;
using int32 = int32_t;
using int64 = int64_t;
using uint8 = uint8_t;
using uint16 = uint16_t;
using uint32 = uint32_t;
using uint64 = uint64_t;

constexpr real pi = 3.14159265358979323846f;
constexpr real eps = 1e-6f;

constexpr real operator"" _f(long double v) { return real(v); }
constexpr real operator"" _f(unsigned long long v) { return real(v); }
constexpr float64 operator"" _f64(long double v) { return float64(v); }
constexpr float64 operator"" _f64(unsigned long long v) { return float64(v); }

// ----------------------------------------------------------------------------
// Logging (goes to stderr -> WASI fd_write -> JS console / UI log)
// ----------------------------------------------------------------------------
inline void tc_log(int level, const char *fmt, ...)
    __attribute__((format(printf, 2, 3)));
inline void tc_log(int level, const char *fmt, ...) {
  char buf[2048];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  static const char *prefix[] = {"[info] ", "[warn] ", "[error] "};
  fprintf(stderr, "%s%s\n", prefix[level], buf);
  fflush(stderr);
}
#define TC_INFO(...) ::taichi::tc_log(0, __VA_ARGS__)
#define TC_WARN(...) ::taichi::tc_log(1, __VA_ARGS__)
#define TC_ERROR(...)                \
  do {                               \
    ::taichi::tc_log(2, __VA_ARGS__); \
    abort();                         \
  } while (0)
#define TC_ASSERT(x)                                                       \
  do {                                                                     \
    if (!(x))                                                              \
      TC_ERROR("Assertion failed: %s (%s:%d)", #x, __FILE__, __LINE__);    \
  } while (0)
#define TC_ASSERT_INFO(x, msg) \
  do {                         \
    if (!(x))                  \
      TC_ERROR("%s", msg);     \
  } while (0)
#define TC_NOT_IMPLEMENTED TC_ERROR("Not implemented (%s:%d)", __FILE__, __LINE__);

// ----------------------------------------------------------------------------
// Scalar helpers
// ----------------------------------------------------------------------------
template <typename T>
TC_FORCE_INLINE T sqr(const T &a) {
  return a * a;
}
template <int n, typename T>
TC_FORCE_INLINE T pow(T a) {
  T r(1);
  for (int i = 0; i < n; i++)
    r *= a;
  return r;
}
template <typename T>
TC_FORCE_INLINE T clamp(T a, T lo, T hi) {
  return a < lo ? lo : (a > hi ? hi : a);
}
template <typename T>
TC_FORCE_INLINE T lerp(real t, const T &a, const T &b) {
  return a * (1 - t) + b * t;
}
TC_FORCE_INLINE real radians(real deg) {
  return deg * (pi / 180.0f);
}
TC_FORCE_INLINE real degrees(real rad) {
  return rad * (180.0f / pi);
}
TC_FORCE_INLINE real inversed(real x) {
  return 1.0f / x;
}

struct RNG {
  uint64 s = 0x9E3779B97F4A7C15ull;
  explicit RNG(uint64 seed = 1) { reseed(seed); }
  void reseed(uint64 seed) { s = seed * 0x9E3779B97F4A7C15ull + 0x632BE59BD9B4E019ull; if (!s) s = 1; }
  TC_FORCE_INLINE uint64 next() {
    s ^= s << 13;
    s ^= s >> 7;
    s ^= s << 17;
    return s;
  }
  TC_FORCE_INLINE real uniform() { return real(next() >> 40) * (1.0f / 16777216.0f); }
};
inline RNG &global_rng() {
  static RNG rng(12345);
  return rng;
}
// Taichi's rand(): uniform real in [0, 1)
TC_FORCE_INLINE real rand() {
  return global_rng().uniform();
}

// ----------------------------------------------------------------------------
// VectorND
// ----------------------------------------------------------------------------
template <int dim, typename T = real>
struct VectorND {
  T d[dim];

  TC_FORCE_INLINE VectorND() {
    for (int i = 0; i < dim; i++)
      d[i] = T(0);
  }
  TC_FORCE_INLINE explicit VectorND(T v) {
    for (int i = 0; i < dim; i++)
      d[i] = v;
  }
  TC_FORCE_INLINE VectorND(T x, T y) {
    static_assert(dim == 2, "VectorND(x, y) requires dim == 2");
    d[0] = x;
    d[1] = y;
  }
  TC_FORCE_INLINE VectorND(T x, T y, T z) {
    static_assert(dim == 3, "VectorND(x, y, z) requires dim == 3");
    d[0] = x;
    d[1] = y;
    d[2] = z;
  }
  TC_FORCE_INLINE VectorND(T x, T y, T z, T w) {
    static_assert(dim == 4, "VectorND(x, y, z, w) requires dim == 4");
    d[0] = x;
    d[1] = y;
    d[2] = z;
    d[3] = w;
  }
  TC_FORCE_INLINE VectorND(const VectorND<dim - 1, T> &v, T last) {
    for (int i = 0; i < dim - 1; i++)
      d[i] = v.d[i];
    d[dim - 1] = last;
  }
  template <int dim2, typename std::enable_if<dim2 != dim, int>::type = 0>
  TC_FORCE_INLINE explicit VectorND(const VectorND<dim2, T> &o) {
    constexpr int m = dim < dim2 ? dim : dim2;
    for (int i = 0; i < m; i++)
      d[i] = o.d[i];
    for (int i = m; i < dim; i++)
      d[i] = T(0);
  }
  template <typename F,
            typename std::enable_if<std::is_invocable<F, int>::value, int>::type = 0>
  TC_FORCE_INLINE explicit VectorND(const F &f) {
    for (int i = 0; i < dim; i++)
      d[i] = f(i);
  }

  TC_FORCE_INLINE T &operator[](int i) { return d[i]; }
  TC_FORCE_INLINE const T &operator[](int i) const { return d[i]; }

#define TC_VEC_BINOP(op)                                               \
  TC_FORCE_INLINE VectorND operator op(const VectorND &o) const {     \
    VectorND r;                                                        \
    for (int i = 0; i < dim; i++)                                      \
      r.d[i] = d[i] op o.d[i];                                         \
    return r;                                                          \
  }                                                                    \
  TC_FORCE_INLINE VectorND &operator op##=(const VectorND &o) {       \
    for (int i = 0; i < dim; i++)                                      \
      d[i] op## = o.d[i];                                              \
    return *this;                                                      \
  }
  TC_VEC_BINOP(+)
  TC_VEC_BINOP(-)
  TC_VEC_BINOP(*)
  TC_VEC_BINOP(/)
#undef TC_VEC_BINOP

  TC_FORCE_INLINE VectorND operator*(T s) const {
    VectorND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = d[i] * s;
    return r;
  }
  TC_FORCE_INLINE VectorND operator/(T s) const {
    VectorND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = d[i] / s;
    return r;
  }
  TC_FORCE_INLINE VectorND &operator*=(T s) {
    for (int i = 0; i < dim; i++)
      d[i] *= s;
    return *this;
  }
  TC_FORCE_INLINE VectorND &operator/=(T s) {
    for (int i = 0; i < dim; i++)
      d[i] /= s;
    return *this;
  }
  TC_FORCE_INLINE VectorND operator-() const {
    VectorND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = -d[i];
    return r;
  }
  TC_FORCE_INLINE bool operator==(const VectorND &o) const {
    for (int i = 0; i < dim; i++)
      if (d[i] != o.d[i])
        return false;
    return true;
  }
  TC_FORCE_INLINE bool operator!=(const VectorND &o) const { return !(*this == o); }

  TC_FORCE_INLINE T dot(const VectorND &o) const {
    T s = 0;
    for (int i = 0; i < dim; i++)
      s += d[i] * o.d[i];
    return s;
  }
  TC_FORCE_INLINE T length2() const { return dot(*this); }
  TC_FORCE_INLINE T length() const { return std::sqrt(length2()); }
  TC_FORCE_INLINE T sum() const {
    T s = 0;
    for (int i = 0; i < dim; i++)
      s += d[i];
    return s;
  }
  TC_FORCE_INLINE T min() const {
    T s = d[0];
    for (int i = 1; i < dim; i++)
      s = d[i] < s ? d[i] : s;
    return s;
  }
  TC_FORCE_INLINE T max() const {
    T s = d[0];
    for (int i = 1; i < dim; i++)
      s = d[i] > s ? d[i] : s;
    return s;
  }
  TC_FORCE_INLINE VectorND abs() const {
    VectorND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = d[i] < 0 ? -d[i] : d[i];
    return r;
  }
  TC_FORCE_INLINE T abs_max() const { return abs().max(); }
  TC_FORCE_INLINE bool abnormal() const {
    for (int i = 0; i < dim; i++)
      if (!std::isfinite((double)d[i]))
        return true;
    return false;
  }
  template <typename F>
  TC_FORCE_INLINE VectorND map(const F &f) const {
    VectorND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = f(d[i]);
    return r;
  }
  TC_FORCE_INLINE VectorND clamp(const VectorND &lo, const VectorND &hi) const {
    VectorND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = taichi::clamp(d[i], lo.d[i], hi.d[i]);
    return r;
  }
  TC_FORCE_INLINE static VectorND axis(int i) {
    VectorND r;
    r.d[i] = T(1);
    return r;
  }
  template <typename T2>
  TC_FORCE_INLINE VectorND<dim, T2> cast() const {
    VectorND<dim, T2> r;
    for (int i = 0; i < dim; i++)
      r.d[i] = T2(d[i]);
    return r;
  }
};

template <int dim, typename T, typename S,
          typename std::enable_if<std::is_arithmetic<S>::value, int>::type = 0>
TC_FORCE_INLINE VectorND<dim, T> operator*(S s, const VectorND<dim, T> &v) {
  return v * T(s);
}

using Vector2 = VectorND<2, real>;
using Vector3 = VectorND<3, real>;
using Vector4 = VectorND<4, real>;
using Vector2i = VectorND<2, int>;
using Vector3i = VectorND<3, int>;
using Vector4i = VectorND<4, int>;

template <int dim, typename T>
TC_FORCE_INLINE T dot(const VectorND<dim, T> &a, const VectorND<dim, T> &b) {
  return a.dot(b);
}
template <int dim, typename T>
TC_FORCE_INLINE T length(const VectorND<dim, T> &a) {
  return a.length();
}
template <int dim, typename T>
TC_FORCE_INLINE T length2(const VectorND<dim, T> &a) {
  return a.length2();
}
template <int dim, typename T>
TC_FORCE_INLINE VectorND<dim, T> normalized(const VectorND<dim, T> &a) {
  return a * (T(1) / a.length());
}
template <int dim, typename T>
TC_FORCE_INLINE VectorND<dim, T> normalize(const VectorND<dim, T> &a) {
  return normalized(a);
}
template <typename T>
TC_FORCE_INLINE T cross(const VectorND<2, T> &a, const VectorND<2, T> &b) {
  return a[0] * b[1] - a[1] * b[0];
}
template <typename T>
TC_FORCE_INLINE VectorND<3, T> cross(const VectorND<3, T> &a, const VectorND<3, T> &b) {
  return VectorND<3, T>(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                        a[0] * b[1] - a[1] * b[0]);
}
template <int dim, typename T>
TC_FORCE_INLINE VectorND<dim, T> min(const VectorND<dim, T> &a, const VectorND<dim, T> &b) {
  VectorND<dim, T> r;
  for (int i = 0; i < dim; i++)
    r[i] = a[i] < b[i] ? a[i] : b[i];
  return r;
}
template <int dim, typename T>
TC_FORCE_INLINE VectorND<dim, T> max(const VectorND<dim, T> &a, const VectorND<dim, T> &b) {
  VectorND<dim, T> r;
  for (int i = 0; i < dim; i++)
    r[i] = a[i] > b[i] ? a[i] : b[i];
  return r;
}
template <int dim>
TC_FORCE_INLINE VectorND<dim, real> fract(const VectorND<dim, real> &a) {
  VectorND<dim, real> r;
  for (int i = 0; i < dim; i++)
    r[i] = a[i] - std::floor(a[i]);
  return r;
}

// ----------------------------------------------------------------------------
// MatrixND (column major: m[i][j] is row j, column i, as in Taichi)
// ----------------------------------------------------------------------------
template <int dim, typename T = real>
struct MatrixND {
  using Vec = VectorND<dim, T>;
  Vec d[dim];

  TC_FORCE_INLINE MatrixND() {}
  TC_FORCE_INLINE explicit MatrixND(T v) {
    for (int i = 0; i < dim; i++)
      d[i][i] = v;
  }
  TC_FORCE_INLINE explicit MatrixND(const Vec &diag) {
    for (int i = 0; i < dim; i++)
      d[i][i] = diag[i];
  }
  TC_FORCE_INLINE MatrixND(const Vec &c0, const Vec &c1) {
    static_assert(dim == 2, "requires dim == 2");
    d[0] = c0;
    d[1] = c1;
  }
  TC_FORCE_INLINE MatrixND(const Vec &c0, const Vec &c1, const Vec &c2) {
    static_assert(dim == 3, "requires dim == 3");
    d[0] = c0;
    d[1] = c1;
    d[2] = c2;
  }
  template <int dim2, typename std::enable_if<dim2 != dim, int>::type = 0>
  TC_FORCE_INLINE explicit MatrixND(const MatrixND<dim2, T> &o) {
    constexpr int m = dim < dim2 ? dim : dim2;
    for (int i = 0; i < m; i++)
      for (int j = 0; j < m; j++)
        d[i][j] = o.d[i][j];
  }
  template <typename T2>
  TC_FORCE_INLINE MatrixND<dim, T2> cast() const {
    MatrixND<dim, T2> r;
    for (int i = 0; i < dim; i++)
      r.d[i] = d[i].template cast<T2>();
    return r;
  }

  TC_FORCE_INLINE Vec &operator[](int i) { return d[i]; }
  TC_FORCE_INLINE const Vec &operator[](int i) const { return d[i]; }

  TC_FORCE_INLINE Vec operator*(const Vec &v) const {
    Vec r = d[0] * v[0];
    for (int i = 1; i < dim; i++)
      r += d[i] * v[i];
    return r;
  }
  TC_FORCE_INLINE MatrixND operator*(const MatrixND &o) const {
    MatrixND r;
    for (int j = 0; j < dim; j++)
      r.d[j] = (*this) * o.d[j];
    return r;
  }
  TC_FORCE_INLINE MatrixND operator*(T s) const {
    MatrixND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = d[i] * s;
    return r;
  }
  TC_FORCE_INLINE MatrixND operator/(T s) const { return (*this) * (T(1) / s); }
  TC_FORCE_INLINE MatrixND operator+(const MatrixND &o) const {
    MatrixND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = d[i] + o.d[i];
    return r;
  }
  TC_FORCE_INLINE MatrixND operator-(const MatrixND &o) const {
    MatrixND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = d[i] - o.d[i];
    return r;
  }
  TC_FORCE_INLINE MatrixND operator-() const {
    MatrixND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = -d[i];
    return r;
  }
  TC_FORCE_INLINE MatrixND &operator+=(const MatrixND &o) {
    for (int i = 0; i < dim; i++)
      d[i] += o.d[i];
    return *this;
  }
  TC_FORCE_INLINE MatrixND &operator-=(const MatrixND &o) {
    for (int i = 0; i < dim; i++)
      d[i] -= o.d[i];
    return *this;
  }
  TC_FORCE_INLINE MatrixND &operator*=(T s) {
    for (int i = 0; i < dim; i++)
      d[i] *= s;
    return *this;
  }
  TC_FORCE_INLINE MatrixND transposed() const {
    MatrixND r;
    for (int i = 0; i < dim; i++)
      for (int j = 0; j < dim; j++)
        r.d[i][j] = d[j][i];
    return r;
  }
  TC_FORCE_INLINE T frobenius_norm2() const {
    T s = 0;
    for (int i = 0; i < dim; i++)
      s += d[i].length2();
    return s;
  }
  TC_FORCE_INLINE T frobenius_norm() const { return std::sqrt(frobenius_norm2()); }
  TC_FORCE_INLINE T trace() const {
    T s = 0;
    for (int i = 0; i < dim; i++)
      s += d[i][i];
    return s;
  }
  TC_FORCE_INLINE Vec diag() const {
    Vec r;
    for (int i = 0; i < dim; i++)
      r[i] = d[i][i];
    return r;
  }
  TC_FORCE_INLINE MatrixND elementwise_product(const MatrixND &o) const {
    MatrixND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = d[i] * o.d[i];
    return r;
  }
  TC_FORCE_INLINE T sum() const {
    T s = 0;
    for (int i = 0; i < dim; i++)
      s += d[i].sum();
    return s;
  }
  TC_FORCE_INLINE bool abnormal() const {
    for (int i = 0; i < dim; i++)
      if (d[i].abnormal())
        return true;
    return false;
  }
  TC_FORCE_INLINE static MatrixND outer_product(const Vec &a, const Vec &b) {
    MatrixND r;
    for (int i = 0; i < dim; i++)
      r.d[i] = a * b[i];
    return r;
  }
};

template <int dim, typename T, typename S,
          typename std::enable_if<std::is_arithmetic<S>::value, int>::type = 0>
TC_FORCE_INLINE MatrixND<dim, T> operator*(S s, const MatrixND<dim, T> &m) {
  return m * T(s);
}

using Matrix2 = MatrixND<2, real>;
using Matrix3 = MatrixND<3, real>;
using Matrix4 = MatrixND<4, real>;

template <int dim, typename T>
TC_FORCE_INLINE MatrixND<dim, T> transposed(const MatrixND<dim, T> &m) {
  return m.transposed();
}
template <int dim, typename T>
TC_FORCE_INLINE MatrixND<dim, T> transpose(const MatrixND<dim, T> &m) {
  return m.transposed();
}
template <typename T>
TC_FORCE_INLINE T determinant(const MatrixND<2, T> &m) {
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}
template <typename T>
TC_FORCE_INLINE T determinant(const MatrixND<3, T> &m) {
  return m[0][0] * (m[1][1] * m[2][2] - m[2][1] * m[1][2]) -
         m[1][0] * (m[0][1] * m[2][2] - m[2][1] * m[0][2]) +
         m[2][0] * (m[0][1] * m[1][2] - m[1][1] * m[0][2]);
}
template <int dim, typename T>
inline MatrixND<dim, T> inversed(const MatrixND<dim, T> &m) {
  // Generic Gauss-Jordan elimination (used for 4x4 homogeneous transforms)
  double a[dim][2 * dim];
  for (int r = 0; r < dim; r++)
    for (int c = 0; c < dim; c++) {
      a[r][c] = m[c][r];
      a[r][dim + c] = (r == c) ? 1.0 : 0.0;
    }
  for (int c = 0; c < dim; c++) {
    int piv = c;
    for (int r = c + 1; r < dim; r++)
      if (std::fabs(a[r][c]) > std::fabs(a[piv][c]))
        piv = r;
    if (piv != c)
      for (int k = 0; k < 2 * dim; k++)
        std::swap(a[c][k], a[piv][k]);
    double inv = 1.0 / a[c][c];
    for (int k = 0; k < 2 * dim; k++)
      a[c][k] *= inv;
    for (int r = 0; r < dim; r++) {
      if (r == c)
        continue;
      double f = a[r][c];
      if (f != 0)
        for (int k = 0; k < 2 * dim; k++)
          a[r][k] -= f * a[c][k];
    }
  }
  MatrixND<dim, T> res;
  for (int r = 0; r < dim; r++)
    for (int c = 0; c < dim; c++)
      res[c][r] = T(a[r][dim + c]);
  return res;
}
template <typename T>
TC_FORCE_INLINE MatrixND<2, T> inversed(const MatrixND<2, T> &m) {
  T inv_det = T(1) / determinant(m);
  MatrixND<2, T> r;
  r[0][0] = m[1][1] * inv_det;
  r[1][1] = m[0][0] * inv_det;
  r[0][1] = -m[0][1] * inv_det;
  r[1][0] = -m[1][0] * inv_det;
  return r;
}
template <typename T>
TC_FORCE_INLINE MatrixND<3, T> inversed(const MatrixND<3, T> &m) {
  T inv_det = T(1) / determinant(m);
  MatrixND<3, T> r;
  r[0][0] = (m[1][1] * m[2][2] - m[2][1] * m[1][2]) * inv_det;
  r[0][1] = (m[2][1] * m[0][2] - m[0][1] * m[2][2]) * inv_det;
  r[0][2] = (m[0][1] * m[1][2] - m[1][1] * m[0][2]) * inv_det;
  r[1][0] = (m[2][0] * m[1][2] - m[1][0] * m[2][2]) * inv_det;
  r[1][1] = (m[0][0] * m[2][2] - m[2][0] * m[0][2]) * inv_det;
  r[1][2] = (m[1][0] * m[0][2] - m[0][0] * m[1][2]) * inv_det;
  r[2][0] = (m[1][0] * m[2][1] - m[2][0] * m[1][1]) * inv_det;
  r[2][1] = (m[2][0] * m[0][1] - m[0][0] * m[2][1]) * inv_det;
  r[2][2] = (m[0][0] * m[1][1] - m[1][0] * m[0][1]) * inv_det;
  return r;
}
template <int dim, typename T>
TC_FORCE_INLINE MatrixND<dim, T> inverse(const MatrixND<dim, T> &m) {
  return inversed(m);
}

// Homogeneous transform: (M * (v, w)).xyz
template <int dim>
TC_FORCE_INLINE VectorND<dim, real> transform(const MatrixND<dim + 1, real> &m,
                                              const VectorND<dim, real> &v,
                                              real w = 1.0f) {
  return VectorND<dim, real>(m * VectorND<dim + 1, real>(v, w));
}

TC_FORCE_INLINE Matrix3 cross_product_matrix(const Vector3 &a) {
  return Matrix3(Vector3(0, a[2], -a[1]), Vector3(-a[2], 0, a[0]),
                 Vector3(a[1], -a[0], 0));
}

// ----------------------------------------------------------------------------
// SVD & polar decomposition
// ----------------------------------------------------------------------------
inline void polar_decomp(const Matrix2 &A, Matrix2 &R, Matrix2 &S) {
  real x = A[0][0] + A[1][1];
  real y = A[0][1] - A[1][0];
  real n2 = x * x + y * y;
  real c = 1, s = 0;
  if (n2 > 1e-30f) {
    real inv = 1.0f / std::sqrt(n2);
    c = x * inv;
    s = y * inv;
  }
  R = Matrix2(Vector2(c, s), Vector2(-s, c));
  S = transposed(R) * A;
}

// A = U sig V^T, U and V are rotations; sig may contain a negative entry
inline void svd(const Matrix2 &A, Matrix2 &U, Matrix2 &sig, Matrix2 &V) {
  Matrix2 R, S;
  polar_decomp(A, R, S);
  real s00 = S[0][0], s11 = S[1][1], s01 = 0.5f * (S[1][0] + S[0][1]);
  real theta = 0.5f * std::atan2(2.0f * s01, s00 - s11);
  real c = std::cos(theta), s = std::sin(theta);
  V = Matrix2(Vector2(c, s), Vector2(-s, c));
  real l1 = c * c * s00 + 2 * c * s * s01 + s * s * s11;
  real l2 = s * s * s00 - 2 * c * s * s01 + c * c * s11;
  sig = Matrix2(Vector2(l1, l2));
  U = R * V;
}

namespace svd3_detail {
// Implementation of "Computing the Singular Value Decomposition of 3x3
// matrices with minimal branching and elementary floating point operations"
// (McAdams, Selle, Tamstorf, Teran, Sifakis 2011) - the same algorithm used by
// Taichi's sifakis_svd.h.
constexpr float four_gamma_squared = 5.828427124746190f;  // sqrt(8) + 3
constexpr float cstar = 0.923879532511287f;               // cos(pi / 8)
constexpr float sstar = 0.382683432365090f;               // sin(pi / 8)
constexpr float epsilon = 1e-6f;

TC_FORCE_INLINE void cond_swap(bool c, float &x, float &y) {
  float z = x;
  x = c ? y : x;
  y = c ? z : y;
}
TC_FORCE_INLINE void cond_neg_swap(bool c, float &x, float &y) {
  float z = -x;
  x = c ? y : x;
  y = c ? z : y;
}
TC_FORCE_INLINE void approximate_givens(float a11, float a12, float a22, float &ch, float &sh) {
  ch = 2 * (a11 - a22);
  sh = a12;
  bool b = four_gamma_squared * sh * sh < ch * ch;
  float w = 1.0f / std::sqrt(ch * ch + sh * sh);
  ch = b ? w * ch : cstar;
  sh = b ? w * sh : sstar;
}
TC_FORCE_INLINE void jacobi_conjugation(int x, int y, int z, float &s11, float &s21,
                                        float &s22, float &s31, float &s32,
                                        float &s33, float *qV) {
  float ch, sh;
  approximate_givens(s11, s21, s22, ch, sh);
  float scale = ch * ch + sh * sh;
  float a = (ch * ch - sh * sh) / scale;
  float b = (2 * sh * ch) / scale;
  float _s11 = s11, _s21 = s21, _s22 = s22, _s31 = s31, _s32 = s32, _s33 = s33;
  s11 = a * (a * _s11 + b * _s21) + b * (a * _s21 + b * _s22);
  s21 = a * (-b * _s11 + a * _s21) + b * (-b * _s21 + a * _s22);
  s22 = -b * (-b * _s11 + a * _s21) + a * (-b * _s21 + a * _s22);
  s31 = a * _s31 + b * _s32;
  s32 = -b * _s31 + a * _s32;
  s33 = _s33;
  float tmp[3] = {qV[0] * sh, qV[1] * sh, qV[2] * sh};
  sh *= qV[3];
  qV[0] *= ch;
  qV[1] *= ch;
  qV[2] *= ch;
  qV[3] *= ch;
  qV[z] += sh;
  qV[3] -= tmp[z];
  qV[x] += tmp[y];
  qV[y] -= tmp[x];
  _s11 = s22;
  _s21 = s32;
  _s22 = s33;
  _s31 = s21;
  _s32 = s31;
  _s33 = s11;
  s11 = _s11;
  s21 = _s21;
  s22 = _s22;
  s31 = _s31;
  s32 = _s32;
  s33 = _s33;
}
TC_FORCE_INLINE void qr_givens(float a1, float a2, float &ch, float &sh) {
  float rho = std::sqrt(a1 * a1 + a2 * a2);
  sh = rho > epsilon ? a2 : 0;
  ch = std::fabs(a1) + std::max(rho, epsilon);
  bool b = a1 < 0;
  cond_swap(b, sh, ch);
  float w = 1.0f / std::sqrt(ch * ch + sh * sh);
  ch *= w;
  sh *= w;
}
}  // namespace svd3_detail

inline void svd(const Matrix3 &A, Matrix3 &U, Matrix3 &sig, Matrix3 &V) {
  using namespace svd3_detail;
  // row-major names aRC = A(R, C) = A[C][R]
  float a11 = A[0][0], a12 = A[1][0], a13 = A[2][0];
  float a21 = A[0][1], a22 = A[1][1], a23 = A[2][1];
  float a31 = A[0][2], a32 = A[1][2], a33 = A[2][2];
  // normal equations A^T A (symmetric, lower triangle)
  float s11 = a11 * a11 + a21 * a21 + a31 * a31;
  float s21 = a12 * a11 + a22 * a21 + a32 * a31;
  float s22 = a12 * a12 + a22 * a22 + a32 * a32;
  float s31 = a13 * a11 + a23 * a21 + a33 * a31;
  float s32 = a13 * a12 + a23 * a22 + a33 * a32;
  float s33 = a13 * a13 + a23 * a23 + a33 * a33;
  float qV[4] = {0, 0, 0, 1};
  // 4 sweeps as in the original; 2 extra sweeps only if not yet converged
  // (reaches ~1e-6 relative accuracy for all inputs)
  for (int i = 0; i < 6; i++) {
    if (i == 4) {
      float off = s21 * s21 + s31 * s31 + s32 * s32;
      float dg = s11 * s11 + s22 * s22 + s33 * s33;
      if (off <= 1e-11f * dg)
        break;
    }
    jacobi_conjugation(0, 1, 2, s11, s21, s22, s31, s32, s33, qV);
    jacobi_conjugation(1, 2, 0, s11, s21, s22, s31, s32, s33, qV);
    jacobi_conjugation(2, 0, 1, s11, s21, s22, s31, s32, s33, qV);
  }
  {
    float n = 1.0f / std::sqrt(qV[0] * qV[0] + qV[1] * qV[1] + qV[2] * qV[2] + qV[3] * qV[3]);
    for (int i = 0; i < 4; i++)
      qV[i] *= n;
  }
  float x = qV[0], y = qV[1], z = qV[2], w = qV[3];
  float v11 = 1 - 2 * (y * y + z * z), v12 = 2 * (x * y - w * z), v13 = 2 * (x * z + w * y);
  float v21 = 2 * (x * y + w * z), v22 = 1 - 2 * (x * x + z * z), v23 = 2 * (y * z - w * x);
  float v31 = 2 * (x * z - w * y), v32 = 2 * (y * z + w * x), v33 = 1 - 2 * (x * x + y * y);
  // B = A V
  float b11 = a11 * v11 + a12 * v21 + a13 * v31;
  float b12 = a11 * v12 + a12 * v22 + a13 * v32;
  float b13 = a11 * v13 + a12 * v23 + a13 * v33;
  float b21 = a21 * v11 + a22 * v21 + a23 * v31;
  float b22 = a21 * v12 + a22 * v22 + a23 * v32;
  float b23 = a21 * v13 + a22 * v23 + a23 * v33;
  float b31 = a31 * v11 + a32 * v21 + a33 * v31;
  float b32 = a31 * v12 + a32 * v22 + a33 * v32;
  float b33 = a31 * v13 + a32 * v23 + a33 * v33;
  // sort singular values (column norms), keep det(V) = +1
  float rho1 = b11 * b11 + b21 * b21 + b31 * b31;
  float rho2 = b12 * b12 + b22 * b22 + b32 * b32;
  float rho3 = b13 * b13 + b23 * b23 + b33 * b33;
  bool c = rho1 < rho2;
  cond_neg_swap(c, b11, b12);
  cond_neg_swap(c, v11, v12);
  cond_neg_swap(c, b21, b22);
  cond_neg_swap(c, v21, v22);
  cond_neg_swap(c, b31, b32);
  cond_neg_swap(c, v31, v32);
  cond_swap(c, rho1, rho2);
  c = rho1 < rho3;
  cond_neg_swap(c, b11, b13);
  cond_neg_swap(c, v11, v13);
  cond_neg_swap(c, b21, b23);
  cond_neg_swap(c, v21, v23);
  cond_neg_swap(c, b31, b33);
  cond_neg_swap(c, v31, v33);
  cond_swap(c, rho1, rho3);
  c = rho2 < rho3;
  cond_neg_swap(c, b12, b13);
  cond_neg_swap(c, v12, v13);
  cond_neg_swap(c, b22, b23);
  cond_neg_swap(c, v22, v23);
  cond_neg_swap(c, b32, b33);
  cond_neg_swap(c, v32, v33);
  // QR decomposition of B with three Givens rotations: B = Q R
  Matrix3 B(Vector3(b11, b21, b31), Vector3(b12, b22, b32), Vector3(b13, b23, b33));
  float ch, sh, a, b;
  qr_givens(B[0][0], B[0][1], ch, sh);
  a = 1 - 2 * sh * sh;
  b = 2 * ch * sh;
  Matrix3 G1(1.0f);  // rows (0, 1)
  G1[0][0] = a;
  G1[1][0] = b;
  G1[0][1] = -b;
  G1[1][1] = a;
  B = G1 * B;
  qr_givens(B[0][0], B[0][2], ch, sh);
  a = 1 - 2 * sh * sh;
  b = 2 * ch * sh;
  Matrix3 G2(1.0f);  // rows (0, 2)
  G2[0][0] = a;
  G2[2][0] = b;
  G2[0][2] = -b;
  G2[2][2] = a;
  B = G2 * B;
  qr_givens(B[1][1], B[1][2], ch, sh);
  a = 1 - 2 * sh * sh;
  b = 2 * ch * sh;
  Matrix3 G3(1.0f);  // rows (1, 2)
  G3[1][1] = a;
  G3[2][1] = b;
  G3[1][2] = -b;
  G3[2][2] = a;
  B = G3 * B;
  U = transposed(G1) * transposed(G2) * transposed(G3);
  sig = Matrix3(Vector3(B[0][0], B[1][1], B[2][2]));
  V = Matrix3(Vector3(v11, v21, v31), Vector3(v12, v22, v32), Vector3(v13, v23, v33));
}

inline void polar_decomp(const Matrix3 &A, Matrix3 &R, Matrix3 &S) {
  Matrix3 U, sig, V;
  svd(A, U, sig, V);
  R = U * transposed(V);
  S = V * sig * transposed(V);
}

// ----------------------------------------------------------------------------
// Rotations
// ----------------------------------------------------------------------------
struct Quaternion {
  real w = 1, x = 0, y = 0, z = 0;
  Quaternion() {}
  Quaternion(real w, real x, real y, real z) : w(w), x(x), y(y), z(z) {}
  static Quaternion angle_axis(real angle, const Vector3 &axis) {
    real s = std::sin(angle * 0.5f), c = std::cos(angle * 0.5f);
    return Quaternion(c, s * axis[0], s * axis[1], s * axis[2]);
  }
  Quaternion operator*(const Quaternion &q) const {
    return Quaternion(w * q.w - x * q.x - y * q.y - z * q.z,
                      w * q.x + x * q.w + y * q.z - z * q.y,
                      w * q.y - x * q.z + y * q.w + z * q.x,
                      w * q.z + x * q.y - y * q.x + z * q.w);
  }
  Quaternion inverse() const {
    real n = w * w + x * x + y * y + z * z;
    return Quaternion(w / n, -x / n, -y / n, -z / n);
  }
  Quaternion normalized() const {
    real n = 1.0f / std::sqrt(w * w + x * x + y * y + z * z);
    return Quaternion(w * n, x * n, y * n, z * n);
  }
  Matrix3 to_matrix() const {
    Matrix3 m;
    m[0][0] = 1 - 2 * (y * y + z * z);
    m[1][0] = 2 * (x * y - w * z);
    m[2][0] = 2 * (x * z + w * y);
    m[0][1] = 2 * (x * y + w * z);
    m[1][1] = 1 - 2 * (x * x + z * z);
    m[2][1] = 2 * (y * z - w * x);
    m[0][2] = 2 * (x * z - w * y);
    m[1][2] = 2 * (y * z + w * x);
    m[2][2] = 1 - 2 * (x * x + y * y);
    return m;
  }
  // Eigen::AngleAxis(quaternion) semantics
  void to_angle_axis(real &angle, Vector3 &axis) const {
    real n = std::sqrt(x * x + y * y + z * z);
    if (n > 1e-20f) {
      angle = 2 * std::atan2(n, std::fabs(w));
      real s = (w < 0 ? -1.0f : 1.0f) / n;
      axis = Vector3(x * s, y * s, z * s);
    } else {
      angle = 0;
      axis = Vector3(1, 0, 0);
    }
  }
};

template <int dim>
struct AngularVelocity;

template <>
struct AngularVelocity<2> {
  using ValueType = real;
  real value = 0;
  AngularVelocity() {}
  explicit AngularVelocity(real v) : value(v) {}
  AngularVelocity &operator+=(const AngularVelocity &o) {
    value += o.value;
    return *this;
  }
  AngularVelocity &operator+=(real o) {
    value += o;
    return *this;
  }
  AngularVelocity operator+(const AngularVelocity &o) const { return AngularVelocity(value + o.value); }
  AngularVelocity operator*(real v) const { return AngularVelocity(value * v); }
  Vector2 cross(const Vector2 &input) const { return Vector2(-input[1], input[0]) * value; }
};

template <>
struct AngularVelocity<3> {
  using ValueType = Vector3;
  Vector3 value;
  AngularVelocity() {}
  explicit AngularVelocity(const Vector3 &v) : value(v) {}
  AngularVelocity &operator+=(const AngularVelocity &o) {
    value += o.value;
    return *this;
  }
  AngularVelocity &operator+=(const Vector3 &o) {
    value += o;
    return *this;
  }
  AngularVelocity operator+(const AngularVelocity &o) const { return AngularVelocity(value + o.value); }
  AngularVelocity operator*(real v) const { return AngularVelocity(value * v); }
  Vector3 cross(const Vector3 &input) const { return taichi::cross(value, input); }
};

template <int dim>
struct Rotation;

template <>
struct Rotation<2> {
  real value = 0;
  Rotation() {}
  explicit Rotation(real v) : value(v) {}
  Matrix2 get_rotation_matrix() const {
    real c = std::cos(value), s = std::sin(value);
    return Matrix2(Vector2(c, s), Vector2(-s, c));
  }
  void apply_angular_velocity(const AngularVelocity<2> &vel, real dt) { value += dt * vel.value; }
  Vector2 rotate(const Vector2 &v) const { return get_rotation_matrix() * v; }
};

template <>
struct Rotation<3> {
  Quaternion value;
  Rotation() {}
  Matrix3 get_rotation_matrix() const { return value.to_matrix(); }
  void apply_angular_velocity(const AngularVelocity<3> &vel, real dt) {
    Vector3 axis = vel.value;
    real angle = length(axis);
    if (angle < 1e-10f)
      return;
    axis = axis * (1.0f / angle);
    value = (Quaternion::angle_axis(angle * dt, axis) * value).normalized();
  }
  Vector3 rotate(const Vector3 &v) const { return get_rotation_matrix() * v; }
};

// Euler angles (radians) -> quaternion, X * Y * Z order (create_rigid_body)
inline Quaternion euler_xyz(const Vector3 &e) {
  return Quaternion::angle_axis(e[0], Vector3(1, 0, 0)) *
         Quaternion::angle_axis(e[1], Vector3(0, 1, 0)) *
         Quaternion::angle_axis(e[2], Vector3(0, 0, 1));
}
// Z * Y * X order (RigidBody::advance with scripted rotation)
inline Quaternion euler_zyx(const Vector3 &e) {
  return Quaternion::angle_axis(e[2], Vector3(0, 0, 1)) *
         Quaternion::angle_axis(e[1], Vector3(0, 1, 0)) *
         Quaternion::angle_axis(e[0], Vector3(1, 0, 0));
}

// ----------------------------------------------------------------------------
// Config (string key/value store, mirrors taichi::Config)
// ----------------------------------------------------------------------------
namespace config_detail {
inline std::vector<double> parse_numbers(const std::string &s) {
  std::vector<double> out;
  const char *p = s.c_str();
  while (*p) {
    while (*p && !(std::isdigit((unsigned char)*p) || *p == '-' || *p == '+' || *p == '.'))
      p++;
    if (!*p)
      break;
    char *end = nullptr;
    double v = std::strtod(p, &end);
    if (end == p) {
      p++;
      continue;
    }
    out.push_back(v);
    p = end;
  }
  return out;
}
inline void parse(const std::string &s, float &v) { v = (float)std::strtod(s.c_str(), nullptr); }
inline void parse(const std::string &s, double &v) { v = std::strtod(s.c_str(), nullptr); }
inline void parse(const std::string &s, int &v) { v = (int)std::strtol(s.c_str(), nullptr, 10); }
inline void parse(const std::string &s, uint64 &v) { v = std::strtoull(s.c_str(), nullptr, 10); }
inline void parse(const std::string &s, bool &v) {
  v = (s == "true" || s == "True" || s == "1" || s == "yes");
}
inline void parse(const std::string &s, std::string &v) { v = s; }
template <int dim, typename T>
inline void parse(const std::string &s, VectorND<dim, T> &v) {
  auto nums = parse_numbers(s);
  for (int i = 0; i < dim; i++)
    v[i] = T(nums.empty() ? 0 : nums[std::min<int>(i, (int)nums.size() - 1)]);
}
inline std::string to_str(const std::string &s) { return s; }
inline std::string to_str(const char *s) { return std::string(s); }
inline std::string to_str(bool b) { return b ? "true" : "false"; }
template <typename T>
inline typename std::enable_if<std::is_arithmetic<T>::value, std::string>::type to_str(T v) {
  char buf[64];
  snprintf(buf, sizeof(buf), "%.9g", (double)v);
  return buf;
}
template <typename T>
inline std::string to_str(T *p) {
  char buf[64];
  snprintf(buf, sizeof(buf), "%llu", (unsigned long long)(uintptr_t)p);
  return buf;
}
template <int dim, typename T>
inline std::string to_str(const VectorND<dim, T> &v) {
  std::string r = "(";
  for (int i = 0; i < dim; i++) {
    r += to_str(v[i]);
    if (i + 1 < dim)
      r += ",";
  }
  return r + ")";
}
}  // namespace config_detail

class Config {
  std::map<std::string, std::string> data;

 public:
  // Parse "key=value" lines (separated by '\n')
  void parse_lines(const char *text) {
    std::string s(text ? text : "");
    size_t start = 0;
    while (start < s.size()) {
      size_t end = s.find('\n', start);
      if (end == std::string::npos)
        end = s.size();
      std::string line = s.substr(start, end - start);
      size_t eq = line.find('=');
      if (eq != std::string::npos)
        data[line.substr(0, eq)] = line.substr(eq + 1);
      start = end + 1;
    }
  }
  bool has_key(const std::string &k) const { return data.count(k) > 0; }
  const std::string &raw(const std::string &k) const {
    auto it = data.find(k);
    if (it == data.end())
      TC_ERROR("Config: key '%s' not found", k.c_str());
    return it->second;
  }
  template <typename T>
  T get(const std::string &k) const {
    T v;
    config_detail::parse(raw(k), v);
    return v;
  }
  template <typename T>
  T get(const std::string &k, const T &def) const {
    if (!has_key(k))
      return def;
    return get<T>(k);
  }
  std::string get_string(const std::string &k) const { return raw(k); }
  template <typename T>
  T *get_ptr(const std::string &k) const {
    return reinterpret_cast<T *>((uintptr_t)std::strtoull(raw(k).c_str(), nullptr, 10));
  }
  template <typename T>
  Config &set(const std::string &k, const T &v) {
    data[k] = config_detail::to_str(v);
    return *this;
  }
};

// ----------------------------------------------------------------------------
// Element meshes (segments in 2D, triangles in 3D)
// ----------------------------------------------------------------------------
template <int dim>
struct Element {
  using Vector = VectorND<dim, real>;
  using MatrixP = MatrixND<dim + 1, real>;
  Vector v[dim];
  bool open_end[dim];
  Element() {
    for (int i = 0; i < dim; i++)
      open_end[i] = false;
  }
  Element get_transformed(const MatrixP &m) const {
    Element ret;
    for (int i = 0; i < dim; i++) {
      ret.v[i] = transform<dim>(m, v[i], 1.0f);
      ret.open_end[i] = open_end[i];
    }
    return ret;
  }
  Vector get_center() const {
    Vector sum;
    for (int i = 0; i < dim; i++)
      sum += v[i];
    return sum * (1.0f / dim);
  }
  Vector get_normal() const {
    if constexpr (dim == 2) {
      Vector d = v[1] - v[0];
      return normalized(Vector(d[1], -d[0]));
    } else {
      return normalized(cross(v[1] - v[0], v[2] - v[1]));
    }
  }
};

TC_FORCE_INLINE Matrix2 world_to_element(const Element<2> &elem) {
  Vector2 v = elem.v[1] - elem.v[0];
  Vector2 n = normalized(Vector2(v[1], -v[0]));
  return inversed(Matrix2(v, n));
}
TC_FORCE_INLINE Matrix3 world_to_element(const Element<3> &elem) {
  Vector3 u = elem.v[1] - elem.v[0];
  Vector3 v = elem.v[2] - elem.v[0];
  Vector3 n = normalized(cross(u, v));
  return inversed(Matrix3(u, v, n));
}

// Uploaded raw meshes (flat float arrays: 4 floats / segment, 9 floats / tri)
inline std::vector<std::vector<float>> &mesh_registry() {
  static std::vector<std::vector<float>> meshes;
  return meshes;
}

template <int dim>
struct ElementMesh {
  using Elem = Element<dim>;
  std::vector<Elem> elements;
  void initialize(const Config &config) {
    elements.clear();
    if (config.has_key("mesh_id")) {
      int id = config.get<int>("mesh_id");
      TC_ASSERT(0 <= id && id < (int)mesh_registry().size());
      const auto &m = mesh_registry()[id];
      bool reverse = config.get("reverse_vertices", false);
      int stride = dim * dim;
      for (size_t i = 0; i + stride <= m.size(); i += stride) {
        Elem e;
        for (int k = 0; k < dim; k++)
          for (int j = 0; j < dim; j++)
            e.v[k][j] = m[i + k * dim + j];
        if (reverse)
          std::swap(e.v[0], e.v[dim - 1]);
        elements.push_back(e);
      }
    } else if constexpr (dim == 2) {
      // "n x0 y0 x1 y1 ..." exactly as taichi's SegmentMesh serialization
      auto nums = config_detail::parse_numbers(config.get_string("segment_mesh"));
      int n = nums.empty() ? 0 : (int)nums[0];
      for (int i = 0; i < n && 1 + i * 4 + 3 < (int)nums.size(); i++) {
        Elem e;
        e.v[0] = Vector2((real)nums[1 + i * 4], (real)nums[2 + i * 4]);
        e.v[1] = Vector2((real)nums[3 + i * 4], (real)nums[4 + i * 4]);
        elements.push_back(e);
      }
    } else {
      TC_ERROR("3D rigid bodies require 'mesh_id'");
    }
  }
};

// ----------------------------------------------------------------------------
// Level sets
// ----------------------------------------------------------------------------
template <int dim>
class LevelSet {
 public:
  using Vector = VectorND<dim, real>;
  using VectorI = VectorND<dim, int>;
  VectorI res;
  std::vector<real> data;
  real friction = 1.0f;

  void initialize(const VectorI &res_, real value = 1e10f) {
    res = res_;
    size_t n = 1;
    for (int i = 0; i < dim; i++)
      n *= (size_t)res[i];
    data.assign(n, value);
  }
  TC_FORCE_INLINE int index(const VectorI &i) const {
    int idx = 0;
    for (int k = 0; k < dim; k++)
      idx = idx * res[k] + i[k];
    return idx;
  }
  TC_FORCE_INLINE real get(const VectorI &i) const { return data[index(i)]; }
  TC_FORCE_INLINE void set(const VectorI &i, real v) { data[index(i)] = v; }
  template <typename F>
  void for_each_node(const F &f) {
    VectorI i;
    size_t n = data.size();
    for (size_t l = 0; l < n; l++) {
      size_t t = l;
      for (int k = dim - 1; k >= 0; k--) {
        i[k] = int(t % res[k]);
        t /= res[k];
      }
      f(i, data[l]);
    }
  }
  bool inside(const Vector &pos) const {
    for (int k = 0; k < dim; k++)
      if (!(0 <= pos[k] && pos[k] <= real(res[k] - 1)))
        return false;
    return true;
  }
  // multilinear interpolation (clamped) and its analytic gradient
  void interpolate(const Vector &pos, real &value, Vector &grad) const {
    VectorI base;
    Vector f;
    for (int k = 0; k < dim; k++) {
      real p = clamp(pos[k], 0.0f, real(res[k] - 1) - 1e-4f);
      base[k] = clamp((int)std::floor(p), 0, std::max(res[k] - 2, 0));
      f[k] = p - base[k];
    }
    value = 0;
    grad = Vector(0.0f);
    for (int c = 0; c < (1 << dim); c++) {
      VectorI node;
      real w = 1;
      Vector gw(1.0f);
      for (int k = 0; k < dim; k++) {
        int bit = (c >> k) & 1;
        node[k] = std::min(base[k] + bit, res[k] - 1);
        real wk = bit ? f[k] : 1 - f[k];
        real dk = bit ? 1.0f : -1.0f;
        w *= wk;
        for (int j = 0; j < dim; j++)
          gw[j] *= (j == k) ? dk : wk;
      }
      real v = get(node);
      value += w * v;
      grad += gw * v;
    }
  }
  real sample(const Vector &pos) const {
    real v;
    Vector g;
    interpolate(pos, v, g);
    return v;
  }
  Vector get_gradient(const Vector &pos) const {
    real v;
    Vector g;
    interpolate(pos, v, g);
    return g;
  }
  Vector get_normalized_gradient(const Vector &pos) const {
    Vector g = get_gradient(pos);
    if (length(g) < 1e-10f)
      g[0] = 1.0f;
    return normalized(g);
  }
  // ---- construction helpers (all in grid units; solids have phi < 0) ----
  void add_sphere(const Vector &center, real radius, bool inside_out = false) {
    for_each_node([&](const VectorI &i, real &v) {
      real dist = (inside_out ? -1 : 1) * (length(center - i.template cast<real>()) - radius);
      v = std::min(v, dist);
    });
  }
  void add_plane(const Vector &normal_, real d) {
    Vector normal = normalized(normal_);
    real coeff = 1.0f / length(normal_);
    for_each_node([&](const VectorI &i, real &v) {
      real dist = (dot(i.template cast<real>(), normal) + d) * coeff;
      v = std::min(v, dist);
    });
  }
  // add_cuboid in Taichi (generalised to 2D/3D)
  void add_box(const Vector &lower, const Vector &upper, bool inside_out = false) {
    for_each_node([&](const VectorI &i, real &v) {
      Vector s = i.template cast<real>();
      bool in = true;
      for (int k = 0; k < dim; k++)
        if (!(lower[k] <= s[k] && s[k] <= upper[k]))
          in = false;
      real dist;
      if (in) {
        dist = 1e30f;
        for (int k = 0; k < dim; k++)
          dist = std::min(dist, std::min(upper[k] - s[k], s[k] - lower[k]));
      } else {
        Vector nearest = s.clamp(lower, upper);
        dist = -length(nearest - s);
      }
      v = std::min(v, inside_out ? dist : -dist);
    });
  }
  void add_polygon(const std::vector<Vector> &poly, bool inside_out = false) {
    if constexpr (dim == 2) {
      for_each_node([&](const VectorI &i, real &v) {
        Vector p = i.template cast<real>();
        bool inside = false;
        real md = 1e30f;
        int n = (int)poly.size();
        for (int a = 0, b = n - 1; a < n; b = a++) {
          const Vector &pa = poly[a], &pb = poly[b];
          if (((pa[1] > p[1]) != (pb[1] > p[1])) &&
              (p[0] < (pb[0] - pa[0]) * (p[1] - pa[1]) / (pb[1] - pa[1]) + pa[0]))
            inside = !inside;
          Vector e = pb - pa;
          real t = clamp(dot(p - pa, e) / std::max(e.length2(), 1e-12f), 0.0f, 1.0f);
          md = std::min(md, length(p - (pa + e * t)));
        }
        real dist = ((inside ^ inside_out) ? -1 : 1) * md;
        v = std::min(v, dist);
      });
    }
  }
  void add_cylinder(const Vector &center, real radius, bool inside_out = false) {
    for_each_node([&](const VectorI &i, real &v) {
      Vector s = i.template cast<real>();
      real dx = s[0] - center[0];
      real dz = dim == 3 ? s[dim - 1] - center[dim - 1] : 0.0f;
      real dist = std::sqrt(dx * dx + dz * dz) - radius;
      v = std::min(v, inside_out ? -dist : dist);
    });
  }
  void global_increase(real delta) {
    for (auto &v : data)
      v += delta;
  }
};

template <int dim>
class DynamicLevelSet {
 public:
  using Vector = VectorND<dim, real>;
  real t0 = 0, t1 = 1;
  std::shared_ptr<LevelSet<dim>> levelset0, levelset1;

  void initialize(real t0_, real t1_, std::shared_ptr<LevelSet<dim>> ls0,
                  std::shared_ptr<LevelSet<dim>> ls1) {
    t0 = t0_;
    t1 = t1_;
    levelset0 = ls0;
    levelset1 = ls1;
  }
  bool inside(const Vector &pos) const { return levelset0->inside(pos); }
  real sample(const Vector &pos, real t) const {
    real l1 = levelset0->sample(pos);
    if (levelset1 == levelset0)
      return l1;
    real l2 = levelset1->sample(pos);
    return lerp((t - t0) / (t1 - t0), l1, l2);
  }
  Vector get_spatial_gradient(const Vector &pos, real t) const {
    Vector g0 = levelset0->get_gradient(pos);
    Vector g = g0;
    if (levelset1 != levelset0)
      g = lerp((t - t0) / (t1 - t0), g0, levelset1->get_gradient(pos));
    if (length(g) < 1e-10f)
      return Vector::axis(0);
    return normalized(g);
  }
  real get_temporal_derivative(const Vector &pos, real t) const {
    if (levelset1 == levelset0)
      return 0;
    return (levelset1->sample(pos) - levelset0->sample(pos)) / (t1 - t0);
  }
};

// ----------------------------------------------------------------------------
// Procedural density textures (subset of taichi::Texture). Coordinates are in
// world space ([0, 1]^dim); 2D samples use z = 0.5.
// ----------------------------------------------------------------------------
class Texture {
 public:
  virtual ~Texture() {}
  virtual real sample(const Vector3 &p) const = 0;
};

inline std::vector<std::shared_ptr<Texture>> &texture_registry() {
  static std::vector<std::shared_ptr<Texture>> textures;
  return textures;
}

namespace texture_detail {
struct ConstTex : Texture {
  real v;
  explicit ConstTex(real v) : v(v) {}
  real sample(const Vector3 &) const override { return v; }
};
struct BoxTex : Texture {  // 'rect' / 'box': center + full size
  Vector3 center, half;
  int dim;
  real sample(const Vector3 &p) const override {
    for (int k = 0; k < dim; k++)
      if (std::fabs(p[k] - center[k]) > half[k])
        return 0;
    return 1;
  }
};
struct RingTex : Texture {  // 'ring' / 'sphere': inner <= |p - c| <= outer
  Vector3 center;
  real inner, outer;
  int dim;
  real sample(const Vector3 &p) const override {
    real d2 = 0;
    for (int k = 0; k < dim; k++)
      d2 += sqr(p[k] - center[k]);
    return (d2 >= inner * inner && d2 <= outer * outer) ? 1.0f : 0.0f;
  }
};
struct CylinderTex : Texture {
  Vector3 center;
  real radius, half_height;
  int axis;
  real sample(const Vector3 &p) const override {
    Vector3 d = p - center;
    if (std::fabs(d[axis]) > half_height)
      return 0;
    d[axis] = 0;
    return d.length2() <= radius * radius ? 1.0f : 0.0f;
  }
};
struct PolygonTex : Texture {
  std::vector<Vector2> poly;
  real sample(const Vector3 &q) const override {
    bool inside = false;
    int n = (int)poly.size();
    for (int a = 0, b = n - 1; a < n; b = a++) {
      const Vector2 &pa = poly[a], &pb = poly[b];
      if (((pa[1] > q[1]) != (pb[1] > q[1])) &&
          (q[0] < (pb[0] - pa[0]) * (q[1] - pa[1]) / (pb[1] - pa[1]) + pa[0]))
        inside = !inside;
    }
    return inside ? 1.0f : 0.0f;
  }
};
struct TranslateTex : Texture {
  std::shared_ptr<Texture> tex;
  Vector3 offset;
  real sample(const Vector3 &p) const override { return tex->sample(p - offset); }
};
struct RotateTex : Texture {  // rotate around 'center' by angle (degrees) around axis
  std::shared_ptr<Texture> tex;
  Matrix3 inv_rot;
  Vector3 center;
  real sample(const Vector3 &p) const override { return tex->sample(inv_rot * (p - center) + center); }
};
struct MultiplyTex : Texture {
  std::shared_ptr<Texture> tex;
  real value;
  real sample(const Vector3 &p) const override { return tex->sample(p) * value; }
};
struct BinaryTex : Texture {
  std::shared_ptr<Texture> a, b;
  int op;  // 0 union (max), 1 intersect (min), 2 subtract
  real sample(const Vector3 &p) const override {
    real va = a->sample(p);
    if (op == 2)
      return va > 0 && b->sample(p) <= 0 ? va : 0;
    real vb = b->sample(p);
    return op == 0 ? std::max(va, vb) : std::min(va, vb);
  }
};
struct BoundTex : Texture {
  std::shared_ptr<Texture> tex;
  int axis;
  real lo, hi, outside_val;
  real sample(const Vector3 &p) const override {
    if (p[axis] < lo || p[axis] > hi)
      return outside_val;
    return tex->sample(p);
  }
};
}  // namespace texture_detail

inline std::shared_ptr<Texture> get_texture(int id) {
  auto &reg = texture_registry();
  TC_ASSERT(0 <= id && id < (int)reg.size());
  return reg[id];
}

inline int create_texture(const Config &c) {
  using namespace texture_detail;
  std::string type = c.get_string("type");
  std::shared_ptr<Texture> t;
  if (type == "const") {
    t = std::make_shared<ConstTex>(c.get("value", 1.0f));
  } else if (type == "rect" || type == "box") {
    auto b = std::make_shared<BoxTex>();
    b->dim = c.get("dim", 3);
    b->center = c.get("center", Vector3(0.5f));
    b->half = c.get("size", Vector3(0.5f)) * 0.5f;
    if (b->dim == 2)
      b->half[2] = 1e9f;
    t = b;
  } else if (type == "ring" || type == "sphere") {
    auto r = std::make_shared<RingTex>();
    r->dim = c.get("dim", 3);
    r->center = c.get("center", Vector3(0.5f));
    r->inner = c.get("inner", 0.0f);
    r->outer = c.get("outer", c.get("radius", 0.5f));
    t = r;
  } else if (type == "cylinder") {
    auto r = std::make_shared<CylinderTex>();
    r->center = c.get("center", Vector3(0.5f));
    r->radius = c.get("radius", 0.1f);
    r->half_height = c.get("height", 0.2f) * 0.5f;
    r->axis = c.get("axis", 1);
    t = r;
  } else if (type == "polygon") {
    auto r = std::make_shared<PolygonTex>();
    auto nums = config_detail::parse_numbers(c.get_string("points"));
    for (size_t i = 0; i + 1 < nums.size(); i += 2)
      r->poly.push_back(Vector2((real)nums[i], (real)nums[i + 1]));
    t = r;
  } else if (type == "translate") {
    auto r = std::make_shared<TranslateTex>();
    r->tex = get_texture(c.get<int>("tex"));
    r->offset = c.get("offset", Vector3(0.0f));
    t = r;
  } else if (type == "rotate") {
    auto r = std::make_shared<RotateTex>();
    r->tex = get_texture(c.get<int>("tex"));
    r->center = c.get("center", Vector3(0.5f));
    Vector3 axis = c.get("axis", Vector3(0, 0, 1));
    real angle = radians(c.get("angle", 0.0f));
    r->inv_rot = Quaternion::angle_axis(-angle, normalized(axis)).to_matrix();
    t = r;
  } else if (type == "multiply") {
    auto r = std::make_shared<MultiplyTex>();
    r->tex = get_texture(c.get<int>("tex"));
    r->value = c.get("value", 1.0f);
    t = r;
  } else if (type == "union" || type == "intersect" || type == "subtract") {
    auto r = std::make_shared<BinaryTex>();
    r->a = get_texture(c.get<int>("a"));
    r->b = get_texture(c.get<int>("b"));
    r->op = type == "union" ? 0 : (type == "intersect" ? 1 : 2);
    t = r;
  } else if (type == "bound") {
    auto r = std::make_shared<BoundTex>();
    r->tex = get_texture(c.get<int>("tex"));
    r->axis = c.get("axis", 0);
    Vector2 b = c.get("bounds", Vector2(0, 1));
    r->lo = b[0];
    r->hi = b[1];
    r->outside_val = c.get("outside_val", 0.0f);
    t = r;
  } else {
    TC_ERROR("Unknown texture type '%s'", type.c_str());
  }
  texture_registry().push_back(t);
  return (int)texture_registry().size() - 1;
}

// ----------------------------------------------------------------------------
// Poisson disk sampler (periodic precomputed tile, as in taichi_mpm's
// sample_from_periodic_data / sample_from_source). The tile is generated with
// Bridson's algorithm on a periodic domain instead of being read from disk.
// ----------------------------------------------------------------------------
template <int dim>
class PoissonDiskSampler {
  using Vector = VectorND<dim, real>;
  using VectorI = VectorND<dim, int>;

  real min_distance = 0;
  Vector min_corner, max_corner;

  static const std::vector<Vector> &periodic_tile(real &tile_size) {
    static std::vector<Vector> pts;
    const real L = dim == 2 ? 32.0f : 14.0f;  // in units of min_distance
    tile_size = L;
    if (!pts.empty())
      return pts;
    RNG rng(dim * 7919 + 17);
    const real r = 1.0f;
    const int n = (int)std::ceil(L / (r / std::sqrt((real)dim)));
    const real h = L / n;
    size_t total = 1;
    for (int k = 0; k < dim; k++)
      total *= n;
    std::vector<int> grid(total, -1);
    auto cell_of = [&](const Vector &p) {
      VectorI c;
      for (int k = 0; k < dim; k++)
        c[k] = clamp((int)(p[k] / h), 0, n - 1);
      return c;
    };
    auto lin = [&](const VectorI &c) {
      int idx = 0;
      for (int k = 0; k < dim; k++)
        idx = idx * n + ((c[k] % n) + n) % n;
      return idx;
    };
    std::vector<int> active;
    Vector first;
    for (int k = 0; k < dim; k++)
      first[k] = rng.uniform() * L;
    pts.push_back(first);
    grid[lin(cell_of(first))] = 0;
    active.push_back(0);
    while (!active.empty()) {
      int ai = int(rng.next() % active.size());
      Vector c = pts[active[ai]];
      bool found = false;
      for (int attempt = 0; attempt < 30 && !found; attempt++) {
        Vector off;
        real l2;
        do {
          for (int k = 0; k < dim; k++)
            off[k] = (rng.uniform() * 2 - 1) * 2 * r;
          l2 = off.length2();
        } while (l2 < r * r || l2 > 4 * r * r);
        Vector q = c + off;
        for (int k = 0; k < dim; k++) {
          q[k] = std::fmod(q[k], L);
          if (q[k] < 0)
            q[k] += L;
          if (q[k] >= L)
            q[k] = 0;
        }
        VectorI qc = cell_of(q);
        bool ok = true;
        int span = 1;
        for (int k = 0; k < dim; k++)
          span *= 5;
        for (int o = 0; o < span && ok; o++) {
          VectorI nc;
          int t = o;
          for (int k = 0; k < dim; k++) {
            nc[k] = qc[k] + (t % 5) - 2;
            t /= 5;
          }
          int id = grid[lin(nc)];
          if (id < 0)
            continue;
          real d2 = 0;
          for (int k = 0; k < dim; k++) {
            real dd = q[k] - pts[id][k];
            dd -= L * std::round(dd / L);
            d2 += dd * dd;
          }
          if (d2 < r * r)
            ok = false;
        }
        if (ok) {
          pts.push_back(q);
          grid[lin(qc)] = (int)pts.size() - 1;
          active.push_back((int)pts.size() - 1);
          found = true;
        }
      }
      if (!found) {
        active[ai] = active.back();
        active.pop_back();
      }
    }
    return pts;
  }

  static TC_FORCE_INLINE Vector3 to3(const Vector &p) {
    Vector3 r(0.5f);
    for (int k = 0; k < dim; k++)
      r[k] = p[k];
    return r;
  }

  void get_ready(const Texture &tex, const VectorI &res, real dx) {
    real ppc = 0;
    bool empty = true;
    VectorI i;
    size_t total = 1;
    for (int k = 0; k < dim; k++)
      total *= res[k];
    for (size_t l = 0; l < total; l++) {
      size_t t = l;
      for (int k = dim - 1; k >= 0; k--) {
        i[k] = int(t % res[k]);
        t /= res[k];
      }
      Vector coord = (i.template cast<real>() + Vector(0.5f)) * dx;
      real s = tex.sample(to3(coord));
      ppc = std::max(ppc, s);
      if (s > 0) {
        if (empty) {
          min_corner = max_corner = coord;
          empty = false;
        } else {
          min_corner = min(min_corner, coord);
          max_corner = max(max_corner, coord);
        }
      }
    }
    if (empty)
      TC_ERROR("density_texture is empty");
    min_corner -= Vector(dx);
    max_corner += Vector(dx);
    real v = std::pow(dx, (real)dim) / ppc;
    if (dim == 2)
      min_distance = std::sqrt(v * (2.0f / 3.0f));
    else
      min_distance = std::pow(v * (13.0f / 18.0f), 1.0f / 3.0f);
  }

  void emit(const Texture &tex, const Vector &offset, const Vector &advection,
            bool source, std::vector<Vector> &samples) {
    real L;
    const auto &tile = periodic_tile(L);
    real W = L * min_distance;
    VectorI lo, hi;
    for (int k = 0; k < dim; k++) {
      lo[k] = (int)std::floor((min_corner[k] - offset[k]) / W);
      hi[k] = (int)std::floor((max_corner[k] - offset[k]) / W);
    }
    VectorI t = lo;
    while (true) {
      for (const auto &q : tile) {
        Vector p = q * min_distance + t.template cast<real>() * W + offset;
        bool in_box = true;
        for (int k = 0; k < dim; k++)
          if (p[k] < min_corner[k] || p[k] > max_corner[k])
            in_box = false;
        if (!in_box)
          continue;
        if (tex.sample(to3(p)) <= 0)
          continue;
        if (source && tex.sample(to3(p - advection)) > 0)
          continue;
        samples.push_back(p);
      }
      int k = 0;
      while (k < dim) {
        t[k]++;
        if (t[k] <= hi[k])
          break;
        t[k] = lo[k];
        k++;
      }
      if (k == dim)
        break;
    }
  }

 public:
  void sample_from_periodic_data(const Texture &tex, const VectorI &res, real dx,
                                 std::vector<Vector> &samples) {
    get_ready(tex, res, dx);
    emit(tex, Vector(0.0f), Vector(0.0f), false, samples);
  }
  void sample_from_source(const Texture &tex, const VectorI &res, real dx,
                          const Vector &sample_offset, const Vector &sample_advection,
                          std::vector<Vector> &samples) {
    get_ready(tex, res, dx);
    emit(tex, sample_offset, sample_advection, true, samples);
  }
};

TC_NAMESPACE_END
