/**
 * Minimal WebGL2 render-target plumbing for the spectral Navier–Stokes solver.
 * Everything is drawn with a single full-screen triangle (no attribute buffers).
 */

export type GLContext = WebGL2RenderingContext;

export interface GLCaps {
  floatRenderable: boolean;
  floatLinear: boolean;
  halfFloatRenderable: boolean;
  maxTextureSize: number;
  renderer: string;
}

export function createContext(canvas: HTMLCanvasElement): { gl: GLContext; caps: GLCaps } | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  }) as GLContext | null;
  if (!gl) return null;

  const floatExt = gl.getExtension("EXT_color_buffer_float");
  const floatLinear = !!gl.getExtension("OES_texture_float_linear");
  const halfExt = gl.getExtension("EXT_color_buffer_half_float");

  let renderer = "WebGL2 device";
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  if (dbg) {
    try {
      renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
    } catch {
      /* ignore */
    }
  }

  return {
    gl,
    caps: {
      floatRenderable: !!floatExt,
      floatLinear,
      halfFloatRenderable: !!halfExt || !!floatExt,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      renderer,
    },
  };
}

export function compile(gl: GLContext, type: number, src: string, label: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader "${label}" failed to compile:\n${log}\n\n${annotate(src)}`);
  }
  return sh;
}

function annotate(src: string): string {
  return src
    .split("\n")
    .map((l, i) => `${String(i + 1).padStart(3, " ")} | ${l}`)
    .join("\n");
}

export interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

export function program(gl: GLContext, name: string, fragSrc: string, uniformNames: string[]): Program {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT, `${name}.vert`);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc, `${name}.frag`);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program "${name}" failed to link: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of uniformNames) u[n] = gl.getUniformLocation(prog, n);
  return { prog, u };
}

const VERT = /* glsl */ `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export function createTarget(
  gl: GLContext,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  filter: number,
): Target {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  // REPEAT wrapping == periodic boundary conditions, for free, in hardware.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete (0x${status.toString(16)}) for ${w}x${h}`);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { tex, fbo, w, h };
}

export function destroyTarget(gl: GLContext, t: Target | null) {
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

let vao: WebGLVertexArrayObject | null = null;

/** Draw a full-screen triangle into whatever framebuffer is currently bound. */
export function blit(gl: GLContext, target: Target | null, viewport?: { x: number; y: number; w: number; h: number }) {
  if (!vao) vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  if (target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.w, target.h);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const v = viewport ?? { x: 0, y: 0, w: gl.drawingBufferWidth, h: gl.drawingBufferHeight };
    gl.viewport(v.x, v.y, v.w, v.h);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function bindTexture(gl: GLContext, unit: number, tex: WebGLTexture | null) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}
