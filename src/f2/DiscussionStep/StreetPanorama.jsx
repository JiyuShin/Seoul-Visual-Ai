import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { lookFromPointer, screenToWorld, viewFov, worldToScreen } from './streetLook';
import styles from './StreetCanvas.module.css';

const VERTEX = `
attribute vec2 position;
varying vec2 screenUV;
void main() {
  screenUV = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 screenUV;
uniform sampler2D panorama;
uniform vec2 viewport;
uniform vec3 view;
const float PI = 3.141592653589793;
void main() {
  float a = viewport.x / viewport.y;
  float t = tan(view.z * 0.5);
  vec2 p = screenUV * 2.0 - 1.0;
  vec3 ray = normalize(vec3(p.x * a * t, p.y * t, 1.0));
  float cp = cos(view.y);
  float sp = sin(view.y);
  ray = vec3(ray.x, cp * ray.y + sp * ray.z, -sp * ray.y + cp * ray.z);
  float cy = cos(view.x);
  float sy = sin(view.x);
  ray = vec3(cy * ray.x + sy * ray.z, ray.y, -sy * ray.x + cy * ray.z);
  vec2 uv = vec2(fract(0.5 + atan(ray.x, ray.z) / (2.0 * PI)),
                 0.5 - asin(clamp(ray.y, -1.0, 1.0)) / PI);
  uv.y += 0.12 * sin(PI * uv.y);
  gl_FragColor = vec4(texture2D(panorama, uv).rgb, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default forwardRef(function StreetPanorama({ imageUrl, lookRef, markRefs, marks }, ref) {
  const canvasRef = useRef(null);
  const viewRef = useRef({ yaw: 0, pitch: 0, fov: viewFov(16 / 9), aspect: 16 / 9 });
  const marksRef = useRef(marks);
  marksRef.current = marks;

  useImperativeHandle(ref, () => ({
    directionAt(nx, ny) {
      const view = viewRef.current;
      return screenToWorld(nx, ny, view.yaw, view.pitch, view.fov, view.aspect);
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return undefined;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return undefined;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return undefined;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, 'panorama'), 0);
    const sizeUniform = gl.getUniformLocation(program, 'viewport');
    const viewUniform = gl.getUniformLocation(program, 'view');

    let ready = false;
    let dead = false;
    let frame = 0;
    let last = 0;
    const current = { yaw: 0, pitch: 0 };
    const target = { yaw: 0, pitch: 0 };

    const placeMarks = () => {
      const view = viewRef.current;
      marksRef.current.forEach((mark) => {
        const el = markRefs.current?.[mark.id];
        if (!el) return;
        const point = worldToScreen(mark.direction, view.yaw, view.pitch, view.fov, view.aspect);
        if (!point) {
          el.style.opacity = '0';
          return;
        }
        el.style.opacity = '1';
        el.style.left = `${point.x * 100}%`;
        el.style.top = `${point.y * 100}%`;
      });
    };

    const draw = (time) => {
      frame = 0;
      if (dead || !ready) return;
      const dt = last ? Math.min(50, time - last) : 16.7;
      last = time;
      const look = lookRef.current;
      if (look) {
        const next = lookFromPointer(look.nx, look.ny);
        target.yaw = next.yaw;
        target.pitch = next.pitch;
      }
      const follow = 1 - Math.exp(-dt / 160);
      current.yaw += (target.yaw - current.yaw) * follow;
      current.pitch += (target.pitch - current.pitch) * follow;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const aspect = w / h;
      const fov = viewFov(aspect);
      viewRef.current = { yaw: current.yaw, pitch: current.pitch, fov, aspect };
      gl.viewport(0, 0, w, h);
      gl.uniform2f(sizeUniform, w, h);
      gl.uniform3f(viewUniform, current.yaw, current.pitch, fov);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      placeMarks();
      frame = requestAnimationFrame(draw);
    };

    const image = new Image();
    image.onload = () => {
      if (dead) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      ready = true;
      frame = requestAnimationFrame(draw);
    };
    image.onerror = () => {
      canvas.dataset.failed = '1';
    };
    image.src = imageUrl;

    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      image.onload = null;
      image.onerror = null;
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteProgram(program);
    };
  }, [imageUrl, lookRef, markRefs]);

  return <canvas ref={canvasRef} className={styles.panorama} />;
});
