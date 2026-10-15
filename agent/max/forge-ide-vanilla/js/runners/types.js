function stoppedResult(startedAt) {
  return { status: "stopped", exitCode: null, durationMs: performance.now() - startedAt, summary: "Stopped by user" };
}
export {
  stoppedResult
};
