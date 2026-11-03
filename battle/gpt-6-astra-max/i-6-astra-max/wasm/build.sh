#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
EMXX="${EMXX:-$(command -v em++ || echo /tmp/emsdk/upstream/emscripten/em++)}"
mkdir -p wasm/build public/wasm
FLAGS=(-std=c++17 -O3 -flto -msimd128 -msse4.1 -DTC_ISE_SSE -DTC_PLATFORM_LINUX -DTC_INCLUDED
  -DFMT_HEADER_ONLY -DEIGEN_DONT_VECTORIZE -fexceptions
  -Iwasm/shims -Ivendor/taichi/include -Ivendor/taichi/external/include
  -Ivendor/taichi_mpm/external -Ivendor/taichi_mpm/external/libccd/src
  -Ivendor/taichi_mpm/src -include wasm/platform.h
  -Wno-deprecated-declarations -Wno-unused-value -Wno-inconsistent-missing-override
  -Wno-c++11-narrowing -Wno-shift-count-overflow -Wno-format)
# All templates and portability headers affect the generated physics kernels.
signature=$(find wasm/shims vendor/taichi/include vendor/taichi_mpm/src vendor/taichi_mpm/external/SPGrid -name '*.h' -type f -print0 | sort -z | xargs -0 sha256sum; sha256sum wasm/platform.h wasm/build.sh)
signature=$(printf '%s' "$signature" | sha256sum)
if [[ "$(cat wasm/build/signature 2>/dev/null || true)" != "$signature" ]]; then
  rm -f wasm/build/*.o
  printf '%s' "$signature" > wasm/build/signature
fi
SOURCES=(vendor/taichi_mpm/src/mpm.cpp vendor/taichi_mpm/src/transfer.cpp
  vendor/taichi_mpm/src/particles.cpp vendor/taichi_mpm/src/boundary_particle.cpp
  vendor/taichi_mpm/src/rigid_transfer.cpp vendor/taichi_mpm/src/mpm_rigid_body.cpp
  vendor/taichi_mpm/src/articulation.cpp
  vendor/taichi/include/taichi/dynamics/rigid_body.cpp
  vendor/taichi/include/taichi/math/levelset.cpp
  vendor/taichi/include/taichi/math/svd.cpp
  vendor/taichi/include/taichi/visual/scene.cpp
  vendor/taichi/include/taichi/geometry/factory.cpp
  vendor/taichi/include/taichi/common/asset_manager.cpp
  vendor/taichi/src/core/core.cpp
  vendor/taichi/src/system/timer.cpp
  vendor/taichi/include/taichi/visualization/image_buffer.cpp
  vendor/taichi_mpm/external/SPGrid/Core/SPGrid_Utilities.cpp
  vendor/taichi_mpm/external/SPGrid/Core/SPGrid_Geometry.cpp)
OBJECTS=()
for file in "${SOURCES[@]}"; do
  obj="wasm/build/$(basename "$file" .cpp).o"
  OBJECTS+=("$obj")
  if [[ ! -f "$obj" || "$file" -nt "$obj" || "wasm/platform.h" -nt "$obj" ]]; then
    echo "Compiling $file"
    "$EMXX" "${FLAGS[@]}" -c "$file" -o "$obj"
  fi
done
for file in vendor/taichi_mpm/external/libccd/src/*.c; do
  obj="wasm/build/ccd_$(basename "$file" .c).o"
  OBJECTS+=("$obj")
  if [[ ! -f "$obj" || "$file" -nt "$obj" ]]; then
    "${EMXX%em++}emcc" -O2 -Iwasm/shims -Ivendor/taichi_mpm/external/libccd/src -c "$file" -o "$obj"
  fi
done
if [[ "${1:-}" == "objects" ]]; then exit 0; fi
"$EMXX" "${FLAGS[@]}" "${OBJECTS[@]}" wasm/runtime.cpp wasm/bridge.cpp \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createMPM \
  -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 \
  -sINITIAL_MEMORY=134217728 -sMAXIMUM_MEMORY=1073741824 \
  -sSTACK_SIZE=8388608 -sDISABLE_EXCEPTION_CATCHING=0 \
  -sEXPORTED_RUNTIME_METHODS=HEAPF32,HEAPU8,UTF8ToString,FS,ccall,cwrap \
  -sFILESYSTEM=1 -o public/wasm/taichi-mpm.mjs