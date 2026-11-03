#pragma once
#include <taichi/common/util.h>
#define WASM_JOIN_(a, b) a##b
#define WASM_JOIN(a, b) WASM_JOIN_(a, b)
// Keep upstream checks compilable, without registering desktop Catch tests.
#define TC_TEST(name) static void WASM_JOIN(upstream_test_, __LINE__)()
#define CHECK(value) TC_ASSERT(value)
#define TC_CHECK(value) TC_ASSERT(value)
#define TC_CHECK_EQUAL(a, b, tol) TC_ASSERT(taichi::math::equal(a, b, tol))
#define TC_ASSERT_EQUAL(a, b, tol) TC_ASSERT(taichi::math::equal(a, b, tol))