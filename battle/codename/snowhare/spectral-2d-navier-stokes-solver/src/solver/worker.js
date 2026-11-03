/* ===========================================================================
 *  worker.js — runs the Navier–Stokes solver in a Web Worker
 *  ---------------------------------------------------------------------------
 *  The file is a plain classic script that is concatenated after core.js and
 *  instantiated from a Blob URL, so it works even when the whole app is
 *  bundled into a single HTML file (no separate worker asset required).
 *
 *  protocol  main -> worker
 *    { type:'init',    canvas:OffscreenCanvas, width, height, params }
 *    { type:'params',  params }
 *    { type:'resize',  width, height }
 *    { type:'pointer', x, y, dx, dy, down }
 *    { type:'command', cmd:'play'|'pause'|'step'|'reset' }
 *  protocol  worker -> main
 *    { type:'stats', stats:{...} }
 * ========================================================================= */
(function () {
  'use strict';

  var engine = null;

  function post(msg) { self.postMessage(msg); }

  function requestFrame(cb) {
    // workers have no requestAnimationFrame, use a timer instead
    setTimeout(function () { cb(0); }, 0);
  }

  self.onmessage = function (e) {
    var msg = e.data || {};

    switch (msg.type) {

      case 'init': {
        var canvas = msg.canvas;
        canvas.width = msg.width;
        canvas.height = msg.height;
        var ctx = canvas.getContext('2d');
        engine = new self.NS.Engine({
          ctx: ctx,
          params: msg.params,
          requestFrame: requestFrame,
          onStats: function (stats) { post({ type: 'stats', stats: stats }); }
        });
        engine.start();
        break;
      }

      case 'params':
        if (engine) engine.setParams(msg.params);
        break;

      case 'resize':
        if (engine) {
          engine.ctx.canvas.width = msg.width;
          engine.ctx.canvas.height = msg.height;
        }
        break;

      case 'pointer':
        if (engine) engine.pointer(msg.x, msg.y, msg.dx, msg.dy, msg.down);
        break;

      case 'command':
        if (!engine) break;
        if (msg.cmd === 'play') engine.start();
        else if (msg.cmd === 'pause') engine.stop();
        else if (msg.cmd === 'step') { engine.stop(); engine.stepOnce(); }
        else if (msg.cmd === 'reset') engine.reset();
        break;
    }
  };
})();
