import { useEffect, useRef } from 'react';
import styles from './MobileConvertShader.module.css';

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uIntro;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime * 0.18;

  float wave = sin(uv.y * 3.2 + t * 1.3) * 0.08 + sin(uv.y * 7.1 - t * 0.9) * 0.03;
  float x = uv.x + wave - t;

  float b1 = sin(x * 6.2831) * 0.5 + 0.5;
  float b2 = sin(x * 12.566 + 1.7) * 0.5 + 0.5;

  vec3 white = vec3(1.0);
  vec3 mint = vec3(0.84, 1.0, 0.73);
  vec3 leaf = vec3(0.62, 0.9, 0.5);
  vec3 aqua = vec3(0.78, 0.98, 0.93);

  vec3 col = mix(white, mint, b1);
  col = mix(col, leaf, smoothstep(0.55, 1.0, b1 * b2) * 0.6);
  col = mix(col, aqua, (1.0 - b1) * b2 * 0.35);

  float a = (0.55 + 0.25 * b1) * uIntro;
  gl_FragColor = vec4(col * a, a);
}
`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** 변환 대기 중 전체 화면 WebGL 배경 — 가로로 흐르는 그라디언트 */
export default function MobileConvertShader({ fading = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
    if (!gl) return undefined;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return undefined;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'uRes');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uIntro = gl.getUniformLocation(program, 'uIntro');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 모바일 GPU 부담 때문에 DPR 상한을 둔다
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };

    let raf = 0;
    const start = performance.now();
    const frame = (now) => {
      resize();
      const elapsed = (now - start) / 1000;
      gl.uniform1f(uTime, reduceMotion ? 0 : elapsed);
      gl.uniform1f(uIntro, reduceMotion ? 1 : Math.min(1, elapsed / 1.2));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduceMotion) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${fading ? styles.canvasFading : ''}`}
      aria-hidden="true"
    />
  );
}
