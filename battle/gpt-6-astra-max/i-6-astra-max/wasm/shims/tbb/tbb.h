#pragma once
#include <algorithm>
// The browser worker is the execution lane; preserve the task API without TBB.
namespace tbb {
template <class I, class F> void parallel_for(I begin, I end, F fn) {
  for (I i = begin; i < end; ++i) fn(i);
}
template <class I> void parallel_sort(I begin, I end) { std::sort(begin, end); }
class task_arena {
 public:
  explicit task_arena(int) {}
  template <class F> void execute(F fn) { fn(); }
};
class global_control {
 public:
  enum parameter { max_allowed_parallelism };
  global_control(parameter, int) {}
};
}