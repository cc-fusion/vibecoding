// ----------------------------------------------------------------- exports
global.MPM = MPM;
if (typeof module !== 'undefined' && module.exports) module.exports = MPM;
if (IS_WORKER) workerMain();

})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));