#pragma once
// Python registration is unused in WASM. The actual factory registry is retained
// and the browser uses the exported C ABI instead of Python.
namespace pybind11 {
class module {
 public:
  template <class... T> void def(T&&...) {}
};
}