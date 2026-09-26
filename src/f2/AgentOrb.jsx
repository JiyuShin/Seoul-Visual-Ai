import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform float time;
  uniform float motion;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  float blob(vec2 p, vec2 c, vec2 radius) {
    vec2 d = (p - c) / radius;
    return exp(-dot(d, d));
  }

  void main() {
    vec2 p = (vUv * 2.0 - 1.0) / 0.613;
    float r = length(p);
    float aa = max(fwidth(r) * 1.25, 0.004);
    float mask = 1.0 - smoothstep(1.0 - aa, 1.0, r);
    if (mask <= 0.001) discard;

    float t = time;
    float lively = 1.0 + max(motion - 1.0, 0.0) * 0.45;
    float sway = 0.22 + motion * 0.08;
    vec2 warp = vec2(
      fbm(p * 1.7 + vec2(t * 0.31, t * 0.22)),
      fbm(p * 1.7 + vec2(-t * 0.24, t * 0.28) + 4.8)
    );
    vec2 q = p + (warp - 0.5) * sway;

    vec2 gradOrigin = vec2(0.1215, -1.0384);
    float g = clamp(length(q - gradOrigin) / 1.6867, 0.0, 1.0);
    vec3 blue = vec3(0.0667, 0.6706, 0.9922);
    vec3 mint = vec3(0.4706, 0.9608, 0.7804);
    vec3 yellow = vec3(0.9333, 0.9176, 0.4353);
    vec3 col = mix(blue, mint, smoothstep(0.0, 0.490385, g));
    col = mix(col, yellow, smoothstep(0.490385, 1.0, g));

    vec2 warmC = vec2(0.34, 0.18) + 0.28 * lively * vec2(sin(t * 0.72), cos(t * 0.51));
    vec2 pinkC = vec2(-0.36, -0.16) + 0.26 * lively * vec2(cos(t * 0.46), sin(t * 0.63));
    vec2 mintC = vec2(0.02, -0.08) + 0.22 * lively * vec2(sin(t * 0.38), cos(t * 0.41));
    vec2 cyanC = vec2(-0.04, 0.32) + 0.2 * lively * vec2(cos(t * 0.88), sin(t * 0.47));

    float warm = blob(q, warmC, vec2(0.62, 0.42));
    float pink = blob(q, pinkC, vec2(0.5, 0.58));
    float mintBand = blob(q, mintC, vec2(0.95, 0.28));
    float cyan = blob(q, cyanC, vec2(1.05, 0.16));

    float warmN = fbm(q * 2.4 + vec2(t * 0.45, -t * 0.3));
    float pinkN = fbm(q * 2.6 + vec2(-t * 0.36, t * 0.27) + 8.0);

    vec3 orange = mix(vec3(1.0, 0.702, 0.2784), vec3(1.0, 0.6157, 0.2784), warmN);
    vec3 pinkCol = mix(vec3(0.7882, 0.6510, 1.0), vec3(0.8627, 0.7765, 1.0), pinkN);
    vec3 mintGlow = vec3(0.7843, 1.0, 0.8353);
    vec3 cyanCol = mix(vec3(0.6157, 1.0, 0.9922), vec3(0.8353, 1.0, 0.9961), 0.45);

    col = mix(col, orange, warm * 0.72);
    col = mix(col, pinkCol, pink * 0.58);
    col = mix(col, mintGlow, mintBand * 0.4);
    col = mix(col, cyanCol, cyan * 0.46);

    float rim = smoothstep(0.9, 0.995, r) * smoothstep(0.05, 0.85, -p.y);
    col = mix(col, vec3(1.0), rim * 0.82);

    float sheen = pow(max(0.0, 1.0 - length((p - vec2(-0.18, 0.28)) * vec2(1.15, 1.35))), 2.4);
    col = mix(col, vec3(1.0), sheen * 0.16);
    col = clamp(col, 0.0, 1.0);

    gl_FragColor = vec4(col, mask);
  }
`;

export default function AgentOrb({ agentSpeaking = false, userLevelRef, className }) {
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const haloBlurRef = useRef(null);
  const agentSpeakingRef = useRef(agentSpeaking);
  const levelSourceRef = useRef(userLevelRef);
  agentSpeakingRef.current = agentSpeaking;
  levelSourceRef.current = userLevelRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const uniforms = {
      time: { value: 0 },
      motion: { value: 1 },
    };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      })
    );
    scene.add(mesh);

    let frame = 0;
    let last = 0;
    let haloPhase = 0;
    let haloBlur = 8;

    const resize = () => {
      const size = canvas.clientWidth || 148;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size, false);
    };

    const render = (now) => {
      frame = requestAnimationFrame(render);
      const size = Math.max(1, canvas.clientWidth || 148);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (Math.abs(canvas.width - size * ratio) > 2) resize();
      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      last = now;
      const level = levelSourceRef.current?.current || 0;
      const target = 1 + level * 0.65;
      uniforms.motion.value += (target - uniforms.motion.value) * 0.12;
      uniforms.time.value += dt * 2.58 * (1 + level * 0.42);
      if (rootRef.current) {
        rootRef.current.style.transform = `scale(${(1 + level * 0.07).toFixed(4)})`;
      }
      if (agentSpeakingRef.current) {
        haloPhase += dt / 3.6;
        const cycle = haloPhase % 1;
        const tri = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
        const eased = tri * tri * (3 - 2 * tri);
        haloBlur = 8 + eased * 19;
      } else {
        haloBlur += (8 - haloBlur) * 0.08;
      }
      if (haloBlurRef.current) haloBlurRef.current.setAttribute('stdDeviation', haloBlur.toFixed(2));
      renderer.render(scene, camera);
    };

    resize();
    frame = requestAnimationFrame(render);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      mesh.geometry.dispose();
      mesh.material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <span
      ref={rootRef}
      style={{ position: 'relative', display: 'block', width: '100%', height: '100%', transformOrigin: 'center center' }}
    >
      <canvas ref={canvasRef} className={className} aria-hidden="true" />
      <svg
        viewBox="0 0 253 215"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <g filter="url(#agentHalo)">
          <circle cx="122.938" cy="107.117" r="77.5" fill="#fff" />
        </g>
        <g filter="url(#agentInner)">
          <circle cx="122.938" cy="107.117" r="77.5" fill="#fff" />
        </g>
        <g opacity="0.84" filter="url(#agentRing)">
          <circle cx="122.682" cy="107.117" r="76.9053" fill="none" stroke="url(#agentRingPaint)" strokeWidth="1.18941" />
        </g>
        <g opacity="0.27" filter="url(#agentWarm)">
          <path d="M216.934 95.8491C198.857 105.775 201.253 139.198 157.585 134.718C113.917 130.239 74.2755 99.25 94.061 89.2871C61.3261 88.6251 141.227 25.5777 158.312 50.3006C175.397 75.0236 225.565 64.1717 216.934 95.8491Z" fill="url(#agentWarmPaint)" />
        </g>
        <g opacity="0.25" filter="url(#agentPink)">
          <path d="M159.103 95.8507C142.18 105.777 144.423 184.63 103.543 180.15C62.662 175.671 25.5508 144.682 44.0734 134.719C13.4279 134.057 88.2283 25.5793 104.223 50.3022C120.217 75.0251 167.183 64.1732 159.103 95.8507Z" fill="url(#agentPinkPaint)" />
        </g>
        <g opacity="0.27" filter="url(#agentMint)">
          <path d="M228.176 109.541C198.616 113.427 202.535 144.293 131.129 142.539C59.724 140.786 -5.09755 128.656 27.2555 124.756C-26.2724 124.497 104.38 82.0338 132.318 91.7114C160.255 101.389 242.289 97.1411 228.176 109.541Z" fill="url(#agentMintPaint)" />
        </g>
        <g opacity="0.35" filter="url(#agentCyan)">
          <path d="M239.558 87.2283C207.93 88.427 212.123 97.9498 135.721 97.4088C59.3193 96.8678 -10.038 93.1255 24.5789 91.9223C-32.6945 91.8423 107.1 78.7419 136.992 81.7276C166.885 84.7133 254.659 83.4027 239.558 87.2283Z" fill="url(#agentCyanPaint)" />
        </g>
        <defs>
          <filter id="agentHalo" x="-100" y="-120" width="460" height="460" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur ref={haloBlurRef} in="SourceAlpha" stdDeviation="8" result="blur" />
            <feComposite in="blur" in2="SourceAlpha" operator="out" result="outside" />
            <feComponentTransfer in="outside" result="strong">
              <feFuncA type="gamma" amplitude="1" exponent="0.55" />
            </feComponentTransfer>
            <feFlood floodColor="#ffffff" floodOpacity="1" result="color" />
            <feComposite in="color" in2="strong" operator="in" />
          </filter>
          <filter id="agentInner" x="15.8212" y="0" width="214.233" height="214.233" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="empty" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="4.75764" />
            <feGaussianBlur stdDeviation="2.37882" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.97 0" />
            <feBlend mode="normal" in2="empty" result="s1" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="-11.8941" />
            <feGaussianBlur stdDeviation="3.6277" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.866956 0 0 0 0 1 0 0 0 0 0.795316 0 0 0 0.2 0" />
            <feBlend mode="normal" in2="s1" result="s2" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dx="-23.7882" dy="11.8941" />
            <feGaussianBlur stdDeviation="2.37882" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 0.869181 0 0 0 0 0.686035 0 0 0 0.24 0" />
            <feBlend mode="normal" in2="s2" result="s3" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dx="23.7882" dy="4.75764" />
            <feGaussianBlur stdDeviation="2.37882" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.923894 0 0 0 0 0.847788 0 0 0 0 1 0 0 0 0.25 0" />
            <feBlend mode="normal" in2="s3" result="s4" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dx="17.8411" dy="11.8941" />
            <feGaussianBlur stdDeviation="7.13646" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.784314 0 0 0 0 1 0 0 0 0 0.835294 0 0 0 1 0" />
            <feBlend mode="normal" in2="s4" />
          </filter>
          <filter id="agentRing" x="40.424" y="22.3618" width="164.515" height="167.013" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="4.75764" />
            <feGaussianBlur stdDeviation="2.37882" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.97 0" />
            <feBlend mode="normal" in2="shape" result="effect1" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="-11.8941" />
            <feGaussianBlur stdDeviation="3.6277" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.866956 0 0 0 0 1 0 0 0 0 0.795316 0 0 0 0.2 0" />
            <feBlend mode="normal" in2="effect1" result="effect2" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dx="-23.7882" dy="11.8941" />
            <feGaussianBlur stdDeviation="2.37882" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 0.869181 0 0 0 0 0.686035 0 0 0 0.24 0" />
            <feBlend mode="normal" in2="effect2" result="effect3" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dx="23.7882" dy="4.75764" />
            <feGaussianBlur stdDeviation="2.37882" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.923894 0 0 0 0 0.847788 0 0 0 0 1 0 0 0 0.25 0" />
            <feBlend mode="normal" in2="effect3" result="effect4" />
            <feGaussianBlur stdDeviation="2.37882" />
          </filter>
          <filter id="agentWarm" x="75.325" y="33.6141" width="153.541" height="112.457" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="5.47128" />
          </filter>
          <filter id="agentPink" x="25.8348" y="35.6961" width="145.137" height="155.58" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="5.47128" />
          </filter>
          <filter id="agentMint" x="3.56915" y="79.3348" width="237.168" height="74.2191" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="5.47128" />
          </filter>
          <filter id="agentCyan" x="0" y="70.3426" width="252.233" height="38.0316" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="5.47128" />
          </filter>
          <linearGradient id="agentRingPaint" x1="122.682" y1="29.6172" x2="122.682" y2="184.617" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="white" />
          </linearGradient>
          <radialGradient id="agentWarmPaint" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(149.329 118.454) rotate(-90) scale(72.2914 106.653)">
            <stop stopColor="#FFB347" />
            <stop offset="0.490385" stopColor="#FF9D47" />
            <stop offset="1" stopColor="#EEEA6F" />
          </radialGradient>
          <radialGradient id="agentPinkPaint" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(95.8136 118.455) rotate(-90) scale(72.2914 99.8451)">
            <stop stopColor="#C9A6FF" />
            <stop offset="0.490385" stopColor="#DCC6FF" />
            <stop offset="1" stopColor="#E8D6FF" />
          </radialGradient>
          <radialGradient id="agentMintPaint" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117.629 118.389) rotate(-90) scale(28.2979 174.398)">
            <stop stopColor="#C8FFD5" stopOpacity="0.5" />
            <stop offset="0.490385" stopColor="#C8FFD5" stopOpacity="0.5" />
            <stop offset="1" stopColor="#C8FFD5" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id="agentCyanPaint" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(121.276 89.9581) rotate(-90) scale(8.73033 186.601)">
            <stop stopColor="#9DFFFD" stopOpacity="0.5" />
            <stop offset="0.490385" stopColor="#D5FFFE" stopOpacity="0.5" />
            <stop offset="1" stopColor="#A3FFFD" stopOpacity="0.5" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  );
}
