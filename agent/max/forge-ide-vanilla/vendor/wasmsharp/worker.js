//There does not appear to be a good way to reference web worker and DOM types in the same project for different files.
//For now, just comment in the above if web worker types are desired (and ignore any DOM types)
// /// <reference lib="webworker" />
import * as Comlink from "./comlink.mjs";
import { Compilation } from "./Compilation.js";
import { initializeWasmSharpModule } from "./initializeWasmSharpModule.js";
export class WasmSharpWebWorker {
    interop;
    constructor() {
        return this;
    }
    async initializeAsync(options) {
        const onConfigLoaded = (config) => postMessage({ type: "configLoaded", config: null });
        const onDownloadResourceProgress = (loaded, total) => postMessage({
            type: "downloadResourceProgress",
            loadedResources: loaded,
            totalResources: total,
        });
        this.interop = await initializeWasmSharpModule(options, {
            onConfigLoaded,
            onDownloadResourceProgress,
        });
    }
    createCompilationAsync(code) {
        this.#ensureInitialized();
        return Comlink.proxy(Compilation.create(code, this.interop));
    }
    #ensureInitialized() { }
}
Comlink.expose(WasmSharpWebWorker);