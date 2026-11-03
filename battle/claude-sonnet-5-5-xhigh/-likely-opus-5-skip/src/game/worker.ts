import { handleJob } from './workerCore';

self.onmessage = (e: MessageEvent) => {
  const r = handleJob(e.data);
  (self as any).postMessage(r.res, r.transfer);
};
