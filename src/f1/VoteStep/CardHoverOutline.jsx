import { useEffect, useRef } from 'react';
import { VOTE_VIEWER_IDS } from '../../shared/gazeConfig';
import styles from './CardHoverOutline.module.css';

const DRAW_MS = 1400;
const REF_W = 800.537;
const REF_STROKE = 6;
const REF_RADIUS = 44.151;

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uProgress;
uniform float uVariant;
uniform float uStroke;
uniform float uRadius;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float arc01(vec2 p, vec2 b, float r) {
  float topLen = max(0.0, (b.x - r) * 2.0);
  float sideLen = max(0.0, (b.y - r) * 2.0);
  float corn = 1.5707963 * r;
  float total = topLen * 2.0 + sideLen * 2.0 + corn * 4.0;
  float left = -b.x;
  float right = b.x;
  float top = -b.y;
  float bot = b.y;
  float x = p.x;
  float y = p.y;
  float s = 0.0;

  if (x > right - r && y < top + r) {
    float ang = atan(y - (top + r), x - (right - r));
    float u = clamp((ang + 1.5707963) / 1.5707963, 0.0, 1.0);
    s = topLen + u * corn;
  } else if (x > right - r && y > bot - r) {
    float ang = atan(y - (bot - r), x - (right - r));
    float u = clamp(ang / 1.5707963, 0.0, 1.0);
    s = topLen + corn + sideLen + u * corn;
  } else if (x < left + r && y > bot - r) {
    float ang = atan(y - (bot - r), x - (left + r));
    float u = clamp((ang - 1.5707963) / 1.5707963, 0.0, 1.0);
    s = topLen * 2.0 + sideLen + corn * 2.0 + u * corn;
  } else if (x < left + r && y < top + r) {
    float ang = atan(y - (top + r), x - (left + r));
    if (ang < 0.0) ang += 6.2831853;
    float u = clamp((ang - 3.14159265) / 1.5707963, 0.0, 1.0);
    s = topLen * 2.0 + sideLen * 2.0 + corn * 3.0 + u * corn;
  } else {
    float dTop = abs(y - top);
    float dBot = abs(y - bot);
    float dLeft = abs(x - left);
    float dRight = abs(x - right);
    if (dTop <= dBot && dTop <= dLeft && dTop <= dRight) {
      s = clamp(x, left + r, right - r) - (left + r);
    } else if (dRight <= dLeft && dRight <= dBot) {
      s = topLen + corn + (clamp(y, top + r, bot - r) - (top + r));
    } else if (dBot <= dLeft) {
      s = topLen + sideLen + corn * 2.0 + ((right - r) - clamp(x, left + r, right - r));
    } else {
      s = topLen * 2.0 + sideLen + corn * 3.0 + ((bot - r) - clamp(y, top + r, bot - r));
    }
  }

  return s / max(total, 1.0);
}

void main() {
  vec2 pix = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = pix - uRes * 0.5;
  float stroke = max(uStroke, 1.0);
  vec2 b = uRes * 0.5 - vec2(stroke * 0.5);
  float r = min(uRadius, min(b.x, b.y) - 1.0);
  float d = sdRoundBox(p, b, r);
  float halfW = stroke * 0.5;
  float core = 1.0 - smoothstep(halfW * 0.2, halfW, abs(d));
  float glow = exp(-(d * d) / (halfW * halfW * 3.4));
  float band = max(core, glow * 0.42);
  float s = arc01(p, b, r);
  float head = uProgress > 0.985 ? 1.0 : smoothstep(0.0, 0.14, uProgress - s);
  float drawn = step(s, uProgress + 0.001);
  float along = band * head * drawn;
  if (along < 0.004) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec3 green = vec3(0.396078, 1.0, 0.0);
  vec3 purple = vec3(0.486275, 0.125490, 0.800000);
  vec2 corner = vec2(-b.x, -b.y);
  float dist = length(p - corner) / max(length(b * 2.0), 1.0);
  float strength = mix(1.0, 0.16, smoothstep(0.0, 0.92, dist));
  vec3 col = green;
  if (uVariant > 1.5) {
    float xMix = clamp((p.x + b.x) / max(b.x * 2.0, 1.0), 0.0, 1.0);
    vec3 white = vec3(1.0);
    col = xMix < 0.5 ? mix(green, white, xMix * 2.0) : mix(white, purple, (xMix - 0.5) * 2.0);
    strength = 1.0;
  } else if (uVariant > 0.5) {
    col = purple;
  }

  float alpha = along * strength;
  gl_FragColor = vec4(col, alpha);
}
`;

function outlineVariant(viewers = []) {
  const purpleCursor = viewers.includes(VOTE_VIEWER_IDS[0]);
  const orangeCursor = viewers.includes(VOTE_VIEWER_IDS[1]);
  if (purpleCursor && orangeCursor) return 2;
  if (orangeCursor) return 0;
  return 1;
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'shader compile failed');
  }
  return shader;
}

export function CardHoverOutline({ viewers }) {
  const canvasRef = useRef(null);
  const variant = outlineVariant(viewers);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) return undefined;

    let vert;
    let frag;
    let program;
    try {
      vert = compile(gl, gl.VERTEX_SHADER, VERT);
      frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      program = gl.createProgram();
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'program link failed');
      }
    } catch (err) {
      console.error(err);
      return undefined;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'aPos');
    const uRes = gl.getUniformLocation(program, 'uRes');
    const uProgress = gl.getUniformLocation(program, 'uProgress');
    const uVariant = gl.getUniformLocation(program, 'uVariant');
    const uStroke = gl.getUniformLocation(program, 'uStroke');
    const uRadius = gl.getUniformLocation(program, 'uRadius');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const startedAt = performance.now();
    let rafId = 0;

    const paint = (now) => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW < 2 || cssH < 2) {
        rafId = requestAnimationFrame(paint);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const progress = easeInOut(Math.min(1, (now - startedAt) / DRAW_MS));
      const scale = w / REF_W;
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uProgress, progress);
      gl.uniform1f(uVariant, variant);
      gl.uniform1f(uStroke, REF_STROKE * scale);
      gl.uniform1f(uRadius, REF_RADIUS * scale);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (progress < 1) rafId = requestAnimationFrame(paint);
    };

    rafId = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(rafId);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [variant]);

  return <canvas ref={canvasRef} className={styles.outline} aria-hidden="true" />;
}
