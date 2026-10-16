"use client";

import { useEffect, useRef } from "react";
import { useImmersiveAllowed, useOnScreen, useThemeColors } from "./useImmersive";

/**
 * A slow-moving surface behind the first screen of the store, drawn in the
 * store's own two colours.
 *
 * Hand-written WebGL rather than a 3D library: one full-screen triangle and a
 * ~30-line fragment shader, so the section costs a few kilobytes instead of a
 * few hundred. It draws at most 30 frames a second, stops entirely when it
 * scrolls out of view, and never runs at all for a visitor on reduced motion,
 * a metered connection or a weak device — those see the gradient underneath,
 * which is always painted first.
 */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Two drifting waves of colour. `u_m` fades the whole thing towards the paper
// colour so text stays readable on top of it.
const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_t;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_paper;
uniform float u_m;

float wave(vec2 uv, float t, float f) {
  return sin(uv.x * f + t) * 0.5 + sin((uv.y + uv.x * 0.4) * f * 0.8 - t * 0.7) * 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float w1 = wave(uv, u_t * 0.25, 4.0);
  float w2 = wave(uv + 0.35, -u_t * 0.18, 6.5);
  float mixv = clamp(0.5 + 0.28 * w1 + 0.18 * w2, 0.0, 1.0);
  vec3 col = mix(u_a, u_b, mixv);
  // Softly lift the bottom so the section blends into the page below it.
  col = mix(col, u_paper, smoothstep(0.55, 1.0, 1.0 - uv.y) * u_m);
  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.12, 0.36, 0.35];
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
}

export function ShaderHero({
  children,
  minHeight = 420,
  softness = 0.7,
}: {
  children?: React.ReactNode;
  minHeight?: number;
  /** How far the surface fades into the page colour at the bottom, 0–1. */
  softness?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const allowed = useImmersiveAllowed();
  const onScreen = useOnScreen(hostRef);
  const colors = useThemeColors(hostRef);

  useEffect(() => {
    if (!allowed || !onScreen) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(program, "u_res"),
      t: gl.getUniformLocation(program, "u_t"),
      a: gl.getUniformLocation(program, "u_a"),
      b: gl.getUniformLocation(program, "u_b"),
      paper: gl.getUniformLocation(program, "u_paper"),
      m: gl.getUniformLocation(program, "u_m"),
    };
    gl.uniform3fv(u.a, hexToRgb(colors.primary));
    gl.uniform3fv(u.b, hexToRgb(colors.accent));
    gl.uniform3fv(u.paper, hexToRgb(colors.paper));
    gl.uniform1f(u.m, Math.max(0, Math.min(1, softness)));

    // Half resolution on dense screens: this is a soft background, nobody can
    // tell, and it roughly quarters the work on a phone.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(host.clientWidth * dpr * 0.5));
      const h = Math.max(1, Math.round(host.clientHeight * dpr * 0.5));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(u.res, w, h);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let last = 0;
    const start = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30fps is plenty for something this slow
      last = now;
      gl.uniform1f(u.t, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [allowed, onScreen, colors.primary, colors.accent, colors.paper, softness]);

  return (
    <div
      ref={hostRef}
      className="relative isolate overflow-hidden rounded-[var(--radius-card)]"
      style={{
        minHeight,
        // Painted first and always: the still version of the same two colours.
        background:
          "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-accent) 70%, var(--color-primary)) 55%, var(--color-paper) 140%)",
      }}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 -z-10 h-full w-full" />
      <div className="relative flex h-full flex-col justify-center gap-4 px-6 py-14 sm:px-10">{children}</div>
    </div>
  );
}
