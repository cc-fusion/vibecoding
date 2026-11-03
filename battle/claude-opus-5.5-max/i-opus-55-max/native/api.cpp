/*******************************************************************************
  C API of the WebAssembly port of the taichi_mpm full solver.

  The JavaScript side mirrors the original Python API (tc.dynamics.MPM):
    MPM(res=..., ...)          -> mpm_create(dim, config)
    mpm.add_particles(...)     -> mpm_add_particles(config)
    mpm.add_articulation(...)  -> mpm_general_action("action=add_articulation...")
    mpm.step(dt)               -> mpm_begin_step(dt) + mpm_advance(max_substeps)
  Configs are passed as "key=value\n" strings (taichi::Config).
*******************************************************************************/
#include "mpm.h"

using namespace taichi;

#ifdef __wasm__
#define TC_EXPORT(name) extern "C" __attribute__((export_name(#name), used))
#else
#define TC_EXPORT(name) extern "C"
#endif

static std::unique_ptr<SimulationBase> g_sim;
static std::string g_ret;
static std::vector<float> g_particles, g_rigids, g_levelset, g_blocks;
static std::vector<double> g_stats;
static int g_ls_nx = 0, g_ls_ny = 0;

TC_EXPORT(tc_alloc) void *tc_alloc(int n) { return malloc((size_t)n); }
TC_EXPORT(tc_free) void tc_free(void *p) { free(p); }

TC_EXPORT(tc_reset) void tc_reset() {
  g_sim.reset();
  texture_registry().clear();
  mesh_registry().clear();
  global_rng().reseed(12345);
  g_particles.clear();
  g_particles.shrink_to_fit();
  g_rigids.clear();
  g_levelset.clear();
  g_blocks.clear();
}

TC_EXPORT(mpm_create) int mpm_create(int dim, const char *config) {
  Config c;
  c.parse_lines(config);
  if (dim == 2)
    g_sim = std::make_unique<MPM<2>>();
  else if (dim == 3)
    g_sim = std::make_unique<MPM<3>>();
  else
    return -1;
  g_sim->initialize(c);
  return 0;
}

TC_EXPORT(mpm_add_particles) const char *mpm_add_particles(const char *config) {
  Config c;
  c.parse_lines(config);
  g_ret = g_sim->add_particles(c);
  return g_ret.c_str();
}

TC_EXPORT(mpm_general_action) const char *mpm_general_action(const char *config) {
  Config c;
  c.parse_lines(config);
  g_ret = g_sim->general_action(c);
  return g_ret.c_str();
}

TC_EXPORT(tc_create_texture) int tc_create_texture(const char *config) {
  Config c;
  c.parse_lines(config);
  return create_texture(c);
}

TC_EXPORT(tc_upload_mesh) int tc_upload_mesh(const float *data, int n) {
  mesh_registry().emplace_back(data, data + n);
  return (int)mesh_registry().size() - 1;
}

TC_EXPORT(mpm_step) void mpm_step(float dt) { g_sim->step(dt); }
TC_EXPORT(mpm_begin_step) void mpm_begin_step(float dt) { g_sim->begin_step(dt); }
TC_EXPORT(mpm_advance) int mpm_advance(int max_substeps) { return g_sim->advance(max_substeps); }
TC_EXPORT(mpm_get_time) double mpm_get_time() { return g_sim ? g_sim->get_current_time() : 0.0; }

TC_EXPORT(mpm_export_particles) float *mpm_export_particles(int mode) {
  g_sim->export_particles(mode, g_particles);
  return g_particles.data();
}
TC_EXPORT(mpm_export_particles_count) int mpm_export_particles_count() { return (int)g_particles.size() / 4; }

TC_EXPORT(mpm_export_rigids) float *mpm_export_rigids() {
  g_sim->export_rigids(g_rigids);
  return g_rigids.data();
}
TC_EXPORT(mpm_export_rigids_size) int mpm_export_rigids_size() { return (int)g_rigids.size(); }

TC_EXPORT(mpm_export_levelset) float *mpm_export_levelset() {
  g_sim->export_levelset(g_levelset, g_ls_nx, g_ls_ny);
  return g_levelset.data();
}
TC_EXPORT(mpm_export_levelset_nx) int mpm_export_levelset_nx() { return g_ls_nx; }
TC_EXPORT(mpm_export_levelset_ny) int mpm_export_levelset_ny() { return g_ls_ny; }
TC_EXPORT(mpm_export_levelset_size) int mpm_export_levelset_size() { return (int)g_levelset.size(); }

TC_EXPORT(mpm_export_blocks) float *mpm_export_blocks() {
  g_sim->export_blocks(g_blocks);
  return g_blocks.data();
}
TC_EXPORT(mpm_export_blocks_size) int mpm_export_blocks_size() { return (int)g_blocks.size(); }

TC_EXPORT(mpm_export_stats) double *mpm_export_stats() {
  g_sim->export_stats(g_stats);
  return g_stats.data();
}
TC_EXPORT(mpm_export_stats_size) int mpm_export_stats_size() { return (int)g_stats.size(); }

// ============================================================================
// Native test harness (not compiled into the WebAssembly module)
// ============================================================================
#ifndef __wasm__
#include <map>
static std::map<int, std::function<void(float, float *)>> g_scripts;
extern "C" void tc_script_eval(int id, float t, float *out) {
  auto it = g_scripts.find(id);
  if (it != g_scripts.end())
    it->second(t, out);
}

static void test_svd() {
  RNG rng(7);
  double max_err3 = 0, max_orth = 0, max_err2 = 0;
  for (int it = 0; it < 20000; it++) {
    Matrix3 A;
    for (int i = 0; i < 3; i++)
      for (int j = 0; j < 3; j++)
        A[i][j] = rng.uniform() * 2 - 1;
    if (it % 3 == 0)
      A = Matrix3(1.0f) + A * 0.01f;  // near identity (typical deformation gradients)
    if (it % 7 == 0)
      A[2] = A[0] * 0.5f + A[1] * 0.25f;  // singular
    Matrix3 U, S, V;
    svd(A, U, S, V);
    Matrix3 R = U * S * transposed(V) - A;
    max_err3 = std::max(max_err3, (double)R.frobenius_norm());
    max_orth = std::max(max_orth, (double)(U * transposed(U) - Matrix3(1.0f)).frobenius_norm());
    max_orth = std::max(max_orth, (double)(V * transposed(V) - Matrix3(1.0f)).frobenius_norm());
    if (determinant(U) < 0.99f || determinant(V) < 0.99f) {
      printf("SVD3: det(U)=%f det(V)=%f\n", determinant(U), determinant(V));
      exit(1);
    }
    Matrix2 B;
    for (int i = 0; i < 2; i++)
      for (int j = 0; j < 2; j++)
        B[i][j] = rng.uniform() * 2 - 1;
    Matrix2 u, s, v;
    svd(B, u, s, v);
    max_err2 = std::max(max_err2, (double)(u * s * transposed(v) - B).frobenius_norm());
  }
  printf("SVD3 max reconstruction error %.3g, orthogonality %.3g; SVD2 error %.3g\n", max_err3, max_orth, max_err2);
  if (max_err3 > 1e-3 || max_orth > 1e-3 || max_err2 > 1e-4) {
    printf("SVD TEST FAILED\n");
    exit(1);
  }
}

static std::string cfg(std::initializer_list<std::pair<std::string, std::string>> kv) {
  std::string s;
  for (auto &p : kv)
    s += p.first + "=" + p.second + "\n";
  return s;
}

static void print_stats(const char *tag) {
  double *s = mpm_export_stats();
  printf("%s t=%.4f substeps=%d particles=%d rigid_particles=%d blocks=%d fat=%d rigid_blocks=%d cut=%d near=%d wall=%.1fms/step\n",
         tag, s[0], (int)s[1], (int)s[2], (int)s[3], (int)s[4], (int)s[5], (int)s[6], (int)s[7], (int)s[12],
         s[15] > 0 ? s[16] / s[15] : 0.0);
  const char *names[] = {"sort", "rigidify", "articulate", "raster_rigid", "gather_cdf", "p2g", "grid", "boundary", "g2p", "clean", "advect_rigid"};
  for (int i = 0; i < P_NUM; i++)
    printf("  %-13s %.3f ms/substep\n", names[i], s[15] > 0 ? s[17 + i] / s[15] : 0.0);
}

static void check_particles(const char *tag) {
  float *p = mpm_export_particles(0);
  int n = mpm_export_particles_count();
  double cy = 0;
  for (int i = 0; i < n; i++) {
    if (!std::isfinite(p[i * 4]) || !std::isfinite(p[i * 4 + 1])) {
      printf("%s: NaN particle!\n", tag);
      exit(1);
    }
    cy += p[i * 4 + 1];
  }
  printf("%s: %d particles, mean y = %.4f\n", tag, n, n ? cy / n : 0.0);
}

int main() {
  test_svd();
  // ------------------------------------------------------------ 2D test
  {
    tc_reset();
    mpm_create(2, cfg({{"res", "(128,128)"}, {"base_delta_t", "2e-4"}, {"penalty", "1e4"}, {"pushing_force", "0"}}).c_str());
    std::string ls = mpm_general_action("action=create_levelset\n");
    mpm_general_action(("action=levelset_op\nid=" + ls + "\nop=add_plane\nnormal=(0,1)\nd=-0.1\n").c_str());
    mpm_general_action(("action=levelset_op\nid=" + ls + "\nop=set_friction\nfriction=0.4\n").c_str());
    mpm_general_action(("action=set_levelset\nid=" + ls + "\n").c_str());
    int t0 = tc_create_texture("type=rect\ndim=2\ncenter=(0.35,0.55,0.5)\nsize=(0.18,0.18,1)\n");
    int t1 = tc_create_texture(("type=multiply\ntex=" + std::to_string(t0) + "\nvalue=4\n").c_str());
    printf("added jelly: %s\n", mpm_add_particles(("type=jelly\nE=2e4\ndensity=400\ndensity_tex=" + std::to_string(t1) + "\n").c_str()));
    int t2 = tc_create_texture("type=sphere\ndim=2\ncenter=(0.65,0.6,0.5)\nradius=0.08\n");
    int t3 = tc_create_texture(("type=multiply\ntex=" + std::to_string(t2) + "\nvalue=4\n").c_str());
    printf("added sand: %s\n", mpm_add_particles(("type=sand\ndensity=1000\ndensity_tex=" + std::to_string(t3) + "\n").c_str()));
    // static thin blade (codimensional, scripted) cutting the jelly
    g_scripts[0] = [](float, float *o) { o[0] = 0.35f; o[1] = 0.3f; };
    g_scripts[1] = [](float, float *o) { o[0] = 90.0f; };
    printf("blade id %s\n", mpm_add_particles(cfg({{"type", "rigid"}, {"codimensional", "true"}, {"scripted_position", "0"}, {"scripted_rotation", "1"}, {"friction", "-1"}, {"segment_mesh", "1 -0.15 0 0.15 0"}}).c_str()));
    // dynamic solid box falling on the sand
    printf("box id %s\n", mpm_add_particles(cfg({{"type", "rigid"}, {"codimensional", "false"}, {"initial_position", "(0.65,0.8)"}, {"density", "300"}, {"friction", "0.3"}, {"segment_mesh", "4 -0.05 -0.05 0.05 -0.05 0.05 -0.05 0.05 0.05 0.05 0.05 -0.05 0.05 -0.05 0.05 -0.05 -0.05"}}).c_str()));
    // wheel + blades with rotation articulation (sand_wheel_2D style)
    g_scripts[2] = [](float, float *o) { o[0] = 0.8f; o[1] = 0.35f; };
    std::string seg = "12";
    for (int i = 0; i < 12; i++) {
      float a0 = -i / 12.0f * 2 * pi, a1 = -(i + 1) / 12.0f * 2 * pi;
      seg += " " + std::to_string(std::cos(a0) * 0.06f) + " " + std::to_string(std::sin(a0) * 0.06f) + " " +
             std::to_string(std::cos(a1) * 0.06f) + " " + std::to_string(std::sin(a1) * 0.06f);
    }
    std::string w = mpm_add_particles(cfg({{"type", "rigid"}, {"codimensional", "true"}, {"scripted_position", "2"}, {"density", "100"}, {"angular_damping", "2"}, {"friction", "-2.4"}, {"segment_mesh", seg}}).c_str());
    std::string w2 = mpm_add_particles(cfg({{"type", "rigid"}, {"codimensional", "true"}, {"scripted_position", "2"}, {"density", "100"}, {"friction", "-2.4"}, {"segment_mesh", "2 0.06 0 0.1 0 -0.06 0 -0.1 0"}}).c_str());
    mpm_general_action(("action=add_articulation\ntype=rotation\nobj0=" + w + "\nobj1=" + w2 + "\n").c_str());
    for (int f = 0; f < 15; f++) {
      mpm_begin_step(0.01f);
      while (!mpm_advance(1000)) {
      }
    }
    check_particles("2D");
    print_stats("2D");
    float *r = mpm_export_rigids();
    printf("2D rigid export: %d floats, %d bodies\n", mpm_export_rigids_size(), (int)r[0]);
    mpm_export_levelset();
    printf("levelset %dx%d\n", mpm_export_levelset_nx(), mpm_export_levelset_ny());
  }
  // ------------------------------------------------------------ 3D test
  {
    tc_reset();
    mpm_create(3, cfg({{"res", "(48,48,48)"}, {"base_delta_t", "3e-4"}, {"penalty", "1e3"}}).c_str());
    std::string ls = mpm_general_action("action=create_levelset\n");
    mpm_general_action(("action=levelset_op\nid=" + ls + "\nop=add_box\nlower=(0.18,0.18,0.18)\nupper=(0.82,0.82,0.82)\ninside_out=true\n").c_str());
    mpm_general_action(("action=set_levelset\nid=" + ls + "\n").c_str());
    int t0 = tc_create_texture("type=box\ncenter=(0.5,0.3,0.5)\nsize=(0.6,0.2,0.6)\n");
    int t1 = tc_create_texture(("type=multiply\ntex=" + std::to_string(t0) + "\nvalue=8\n").c_str());
    printf("added snow: %s\n", mpm_add_particles(("type=snow\ndensity=400\ndensity_tex=" + std::to_string(t1) + "\n").c_str()));
    // cube mesh (CCW, outward normals)
    float s = 0.05f;
    float V[8][3] = {{-s, -s, -s}, {s, -s, -s}, {s, s, -s}, {-s, s, -s}, {-s, -s, s}, {s, -s, s}, {s, s, s}, {-s, s, s}};
    int F[12][3] = {{0, 2, 1}, {0, 3, 2}, {4, 5, 6}, {4, 6, 7}, {0, 1, 5}, {0, 5, 4}, {2, 3, 7}, {2, 7, 6}, {1, 2, 6}, {1, 6, 5}, {0, 4, 7}, {0, 7, 3}};
    std::vector<float> mesh;
    for (auto &f : F)
      for (int k = 0; k < 3; k++)
        for (int j = 0; j < 3; j++)
          mesh.push_back(V[f[k]][j]);
    int mid = tc_upload_mesh(mesh.data(), (int)mesh.size());
    std::string a = mpm_add_particles(cfg({{"type", "rigid"}, {"codimensional", "false"}, {"initial_position", "(0.45,0.55,0.5)"}, {"density", "200"}, {"friction", "0.3"}, {"mesh_id", std::to_string(mid)}}).c_str());
    std::string b = mpm_add_particles(cfg({{"type", "rigid"}, {"codimensional", "false"}, {"initial_position", "(0.5,0.66,0.5)"}, {"initial_rotation", "(20,30,10)"}, {"density", "200"}, {"friction", "0.3"}, {"mesh_id", std::to_string(mid)}}).c_str());
    printf("cubes %s %s\n", a.c_str(), b.c_str());
    for (int f = 0; f < 6; f++) {
      mpm_begin_step(0.01f);
      while (!mpm_advance(1000)) {
      }
    }
    check_particles("3D");
    print_stats("3D");
  }
  printf("ALL NATIVE TESTS PASSED\n");
  return 0;
}
#endif
