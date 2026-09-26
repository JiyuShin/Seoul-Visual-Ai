import { useLayoutEffect, useRef } from 'react';
import visionOrbMarkup from './visionOrbMarkup';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const VIEW_W = 675;
const VIEW_H = 679;
const PAD = 260;
const TEX_W = VIEW_W + PAD * 2;
const TEX_H = VIEW_H + PAD * 2;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform vec2 uOffset;
void main() {
  gl_FragColor = texture2D(uMap, uOrigin + vUv * uSize - uOffset);
}
`;

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

function place(el) {
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = `${VIEW_W}px`;
  el.style.height = `${VIEW_H}px`;
  el.style.pointerEvents = 'none';
}

function colorLayerMarkup(group, sourceSvg) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(TEX_W));
  svg.setAttribute('height', String(TEX_H));
  svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${TEX_W} ${TEX_H}`);
  const filter = sourceSvg.querySelector('#filter2_f_1581_291').cloneNode(true);
  filter.setAttribute('x', '-900');
  filter.setAttribute('y', '-900');
  filter.setAttribute('width', '2200');
  filter.setAttribute('height', '2200');
  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.appendChild(filter);
  defs.appendChild(sourceSvg.querySelector('#paint1_radial_1581_291').cloneNode(true));
  svg.appendChild(group.cloneNode(true));
  svg.appendChild(defs);
  return new XMLSerializer().serializeToString(svg);
}

export default function VisionOrb({ className }) {
  const hostRef = useRef(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const doc = new DOMParser().parseFromString(visionOrbMarkup, 'image/svg+xml');
    const svg = doc.documentElement;
    const colorGroup = svg.querySelector('g[filter="url(#filter2_f_1581_291)"]');
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || !colorGroup) {
      if (svg) host.replaceChildren(document.importNode(svg, true));
      return undefined;
    }

    const markup = colorLayerMarkup(colorGroup, svg);
    const base = document.importNode(svg, true);
    host.style.position = 'relative';
    host.replaceChildren(base);

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = VIEW_W * scale;
    canvas.height = VIEW_H * scale;
    place(canvas);
    canvas.style.zIndex = '1';
    canvas.style.clipPath = 'inset(55.93px 56.46px 56.07px 55.93px round 281.31px)';

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    const vert = gl && compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = gl && compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!gl || !vert || !frag) return undefined;

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    const originLoc = gl.getUniformLocation(program, 'uOrigin');
    const sizeLoc = gl.getUniformLocation(program, 'uSize');
    const offsetLoc = gl.getUniformLocation(program, 'uOffset');
    gl.uniform2f(originLoc, PAD / TEX_W, PAD / TEX_H);
    gl.uniform2f(sizeLoc, VIEW_W / TEX_W, VIEW_H / TEX_H);

    let frame = 0;
    let stopped = false;
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    const image = new Image();

    image.onload = () => {
      if (stopped) return;
      const source = document.createElement('canvas');
      source.width = TEX_W * scale;
      source.height = TEX_H * scale;
      source.getContext('2d').drawImage(image, 0, 0, source.width, source.height);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

      const liveColor = base.querySelector('g[filter="url(#filter2_f_1581_291)"]');
      const sheen = base.querySelector('rect[fill="url(#pattern0_1581_291)"]');
      const text = base.querySelector('path[fill="#414141"]');
      if (liveColor) liveColor.remove();

      const top = document.createElementNS(SVG_NS, 'svg');
      top.setAttribute('xmlns', SVG_NS);
      top.setAttribute('xmlns:xlink', XLINK_NS);
      top.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
      place(top);
      top.style.zIndex = '2';
      const clipWrap = document.createElementNS(SVG_NS, 'g');
      clipWrap.setAttribute('clip-path', 'url(#clipTop)');
      if (sheen) {
        sheen.style.mixBlendMode = '';
        clipWrap.appendChild(sheen);
      }
      if (text) clipWrap.appendChild(text);
      const defs = document.createElementNS(SVG_NS, 'defs');
      const clip = base.querySelector('#clip0_1581_291').cloneNode(true);
      clip.id = 'clipTop';
      const pattern = base.querySelector('#pattern0_1581_291').cloneNode(true);
      pattern.id = 'patternTop';
      const use = pattern.querySelector('use');
      if (use) {
        use.setAttribute('href', '#imageTop');
        use.setAttributeNS(XLINK_NS, 'href', '#imageTop');
      }
      const photo = base.querySelector('#image0_1581_291').cloneNode(true);
      photo.id = 'imageTop';
      if (sheen) sheen.setAttribute('fill', 'url(#patternTop)');
      defs.append(clip, pattern, photo);
      top.append(clipWrap, defs);
      top.style.mixBlendMode = 'plus-lighter';

      const textLayer = document.createElementNS(SVG_NS, 'svg');
      textLayer.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
      place(textLayer);
      textLayer.style.zIndex = '3';
      if (text) {
        const textClip = document.createElementNS(SVG_NS, 'g');
        textClip.setAttribute('clip-path', 'url(#clipText)');
        textClip.appendChild(text);
        const textDefs = document.createElementNS(SVG_NS, 'defs');
        const textClipPath = clip.cloneNode(true);
        textClipPath.id = 'clipText';
        textDefs.appendChild(textClipPath);
        textLayer.append(textClip, textDefs);
      }

      host.append(canvas, top, textLayer);

      const started = performance.now();
      const draw = (now) => {
        if (stopped) return;
        const t = (now - started) / 1000;
        const x = Math.sin(t * 1.7) * 160 + Math.sin(t * 0.75) * 40;
        const y = Math.sin(t * 1.2) * 110 + Math.sin(t * 0.48) * 30;
        gl.uniform2f(offsetLoc, x / TEX_W, y / TEX_H);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    };
    image.src = url;

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
