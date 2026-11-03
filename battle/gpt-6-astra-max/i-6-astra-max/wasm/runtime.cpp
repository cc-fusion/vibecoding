#include <stdexcept>
#include <taichi/visual/texture.h>
#include <taichi/system/profiler.h>
#include "mpm.h"

namespace taichi {
Logger logger;
Logger::Logger() = default;
void Logger::trace(const std::string &) {}
void Logger::debug(const std::string &) {}
void Logger::info(const std::string &) {}
void Logger::warn(const std::string &) {}
void Logger::error(const std::string &s, bool) { throw std::runtime_error(s); }
void Logger::critical(const std::string &s, bool) { throw std::runtime_error(s); }
void Logger::flush() {}
void Logger::set_level(const std::string &) {}

TC_INTERFACE_DEF(Simulation2D, "simulation2")
TC_INTERFACE_DEF(Simulation3D, "simulation3")
TC_INTERFACE_DEF(Texture, "texture")
TC_INTERFACE_DEF(Pakua, "pakua")

// Browser rendering reads the particle buffer; no desktop display is created.
template <> void MPM<2>::visualize() const {}
template <> void MPM<3>::visualize() const {}

namespace zip {
void write(std::string, const uint8 *, std::size_t) {
  throw std::runtime_error("Use uncompressed .tcb snapshots in this WASM build.");
}
void write(const std::string &, const std::string &) {
  throw std::runtime_error("Use uncompressed .tcb snapshots in this WASM build.");
}
std::vector<uint8> read(std::string, bool) {
  throw std::runtime_error("Compressed native snapshots are not supported.");
}
}
}