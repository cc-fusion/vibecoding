import { meshChunk } from "./mesher.js";
self.onmessage = ({ data: { job, data, palette, options } }) => {
  try {
    const start = performance.now(),
      result = meshChunk(data, palette, options);
    self.postMessage({ job, result, ms: performance.now() - start }, [
      result.positions.buffer,
      result.normals.buffer,
      result.colors.buffer,
      result.indices.buffer,
    ]);
  } catch (error) {
    self.postMessage({ job, error: error.message });
  }
};
