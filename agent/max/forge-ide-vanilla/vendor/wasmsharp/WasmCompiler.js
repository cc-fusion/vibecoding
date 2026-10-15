import * as Comlink from "./comlink.mjs";
import { WasmSharpWorker } from "./WasmSharpWorker.js";
export class WasmSharpModule {
    worker;
    constructor(worker) {
        this.worker = worker;
    }
    static async initializeAsync(options) {
        //TODO: Rewrite this using dynamic import so that we do not load web worker code when its disabled, and vice versa.
        if (options?.disableWebWorker) {
            const module = await WasmSharpWorker.initializeAsync(options, {
                onConfigLoaded: options?.onConfigLoaded,
                onDownloadResourceProgress: options?.onDownloadResourceProgress,
            });
            return new WasmSharpModule(module);
        }
        else {
            const worker = new Worker(new URL("./worker.js", import.meta.url).href, { type: "module" });
            const WorkerClass = Comlink.wrap(worker);
            //functions are not structured cloneable
            if (options?.onConfigLoaded || options?.onDownloadResourceProgress) {
                const onConfigLoaded = options.onConfigLoaded;
                const onDownloadResourceProgress = options.onDownloadResourceProgress;
                worker.addEventListener("message", (e) => {
                    if (e.data.type && e.data.type === "configLoaded" && e.data.config) {
                        onConfigLoaded?.(e.data.config);
                    }
                    if (e.data.type && e.data.type === "downloadResourceProgress") {
                        onDownloadResourceProgress?.(e.data.loadedResources, e.data.totalResources);
                    }
                });
                delete options.onConfigLoaded;
                delete options.onDownloadResourceProgress;
            }
            const module = await new WorkerClass();
            await module.initializeAsync(options);
            return new WasmSharpModule(module);
        }
    }
    createCompilationAsync = async (code) => await this.worker.createCompilationAsync(code);
}
export * from "./Roslyn/Text.js";
export * from "./Roslyn/WellKnownTags.js";
export * from "./WasmSharpWorker.js";
export { Compilation } from "./Compilation.js";