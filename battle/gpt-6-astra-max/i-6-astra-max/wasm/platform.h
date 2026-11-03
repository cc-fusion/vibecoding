#pragma once
#include <cstdint>
#include <numeric>
#include <immintrin.h>
#include <pybind11/pybind11.h>
#include <taichi/common/util.h>

// WASM SIMD has no baseline fused-multiply-add instruction.
#define _mm_fmadd_ps(a, b, c) _mm_add_ps(_mm_mul_ps((a), (b)), (c))
#define _mm_fmsub_ps(a, b, c) _mm_sub_ps(_mm_mul_ps((a), (b)), (c))
#define _mm_permute_ps(a, mask) _mm_shuffle_ps((a), (a), (mask))
template <class T> inline T wasm_bit_deposit(T value, T mask) {
  T result = 0;
  for (T bit = 1; mask; bit <<= 1) {
    T lowest = mask & (T(0) - mask);
    if (value & bit) result |= lowest;
    mask &= mask - 1;
  }
  return result;
}
inline uint32_t _pdep_u32(uint32_t v, uint32_t m) { return wasm_bit_deposit(v, m); }
inline uint64_t _pdep_u64(uint64_t v, uint64_t m) { return wasm_bit_deposit(v, m); }
#undef TC_TRACE
#undef TC_DEBUG
#undef TC_INFO
#undef TC_WARN
#define TC_TRACE(...) ((void)0)
#define TC_DEBUG(...) ((void)0)
#define TC_INFO(...) ((void)0)
#define TC_WARN(...) ((void)0)