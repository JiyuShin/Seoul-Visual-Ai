import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

// 시선 입력 함수 (나중에 아이트래킹으로 교체 가능)
// gazeX, gazeY: -1 ~ 1 정규화값
let gazeInputOverride = null;

export function setGazeInput(x, y) {
  gazeInputOverride = { x, y };
}

export function clearGazeInput() {
  gazeInputOverride = null;
}

const PANORAMA_SRC = '/2/boulevard-detail-panorama.webp';
const DEG = Math.PI / 180;
const BASE_FOV = 68 * DEG;

export default function StreetView3D({
  panorama = PANORAMA_SRC,
  onDwellComplete,
  gazePosition,
  className,
  style,
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRef = useRef(null);
  const rafRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetCamRef = useRef({ x: 0, y: 0, rotX: 0, rotY: 0 });
  const currentCamRef = useRef({ x: 0, y: 0, rotX: 0, rotY: 0 });
  const dwellRef = useRef({ x: 0, y: 0, since: 0, triggered: false });
  const gazePositionRef = useRef(gazePosition);

  // gazePosition이 바뀔 때마다 ref 업데이트
  useEffect(() => {
    gazePositionRef.current = gazePosition;
  }, [gazePosition]);

  // 시선 좌표 가져오기 (마우스 또는 외부 입력)
  const getGazeInput = useCallback(() => {
    const gaze = gazePositionRef.current;
    // 외부에서 gazePosition prop으로 전달받은 경우
    if (gaze && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const gazeX = ((gaze.x - cx) / (rect.width / 2));
      const gazeY = -((gaze.y - cy) / (rect.height / 2)); // Y축 반전
      return {
        x: Math.max(-1, Math.min(1, gazeX)),
        y: Math.max(-1, Math.min(1, gazeY)),
      };
    }
    // 외부 오버라이드
    if (gazeInputOverride) {
      return gazeInputOverride;
    }
    // 기본: 마우스 좌표
    return mouseRef.current;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 컨테이너 크기 확인
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    
    console.log('[StreetView3D] Container size:', width, height);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.Camera();
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const panoramaTexture = new THREE.TextureLoader().load(
      panorama,
      () => console.log('[StreetView3D] Panorama loaded'),
      undefined,
      (err) => console.error('[StreetView3D] Panorama error:', err)
    );
    panoramaTexture.colorSpace = THREE.NoColorSpace;
    panoramaTexture.flipY = false;
    panoramaTexture.generateMipmaps = false;
    panoramaTexture.minFilter = THREE.LinearFilter;
    panoramaTexture.magFilter = THREE.LinearFilter;
    panoramaTexture.wrapS = THREE.ClampToEdgeWrapping;
    panoramaTexture.wrapT = THREE.ClampToEdgeWrapping;

    const viewUniform = new THREE.Vector3(0, 0, BASE_FOV);
    const viewportUniform = new THREE.Vector2(width, height);
    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        panorama: { value: panoramaTexture },
        viewport: { value: viewportUniform },
        view: { value: viewUniform },
      },
      vertexShader: `
        varying vec2 screenUV;
        void main() {
          screenUV = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
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
          float cp = cos(view.y), sp = sin(view.y);
          ray = vec3(ray.x, cp * ray.y + sp * ray.z, -sp * ray.y + cp * ray.z);
          float cy = cos(view.x), sy = sin(view.x);
          ray = vec3(cy * ray.x + sy * ray.z, ray.y, -sy * ray.x + cy * ray.z);
          vec2 uv = vec2(fract(0.5 + atan(ray.x, ray.z) / (2.0 * PI)),
                         0.5 - asin(clamp(ray.y, -1.0, 1.0)) / PI);
          uv.y += 0.12 * sin(PI * uv.y);
          gl_FragColor = vec4(texture2D(panorama, uv).rgb, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, shaderMaterial);
    scene.add(mesh);
    meshRef.current = mesh;

    // Mouse move handler
    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseRef.current = { x, y };
    };

    container.addEventListener('mousemove', handleMouseMove);

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      const buffer = renderer.getSize(new THREE.Vector2());
      viewportUniform.set(buffer.x, buffer.y);
    };

    window.addEventListener('resize', handleResize);
    
    // 초기 resize 호출 (DOM이 완전히 렌더링된 후)
    setTimeout(handleResize, 100);

    // Animation loop
    const DWELL_THRESHOLD_MS = 3000;
    const MAX_POS_OFFSET = 0.15;
    const MAX_ROT_OFFSET = THREE.MathUtils.degToRad(3);
    const LERP_FACTOR = 0.05;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);

      const gaze = getGazeInput();

      // 목표 카메라 위치/회전 계산
      targetCamRef.current.x = gaze.x * MAX_POS_OFFSET;
      targetCamRef.current.y = gaze.y * MAX_POS_OFFSET;
      targetCamRef.current.rotY = -gaze.x * MAX_ROT_OFFSET;
      targetCamRef.current.rotX = gaze.y * MAX_ROT_OFFSET;

      // Lerp로 부드럽게 이동
      currentCamRef.current.x += (targetCamRef.current.x - currentCamRef.current.x) * LERP_FACTOR;
      currentCamRef.current.y += (targetCamRef.current.y - currentCamRef.current.y) * LERP_FACTOR;
      currentCamRef.current.rotX += (targetCamRef.current.rotX - currentCamRef.current.rotX) * LERP_FACTOR;
      currentCamRef.current.rotY += (targetCamRef.current.rotY - currentCamRef.current.rotY) * LERP_FACTOR;

      const buffer = renderer.getSize(new THREE.Vector2());
      const aspect = buffer.x / Math.max(1, buffer.y);
      const fov = Math.min(BASE_FOV, 2 * Math.atan(Math.tan(52.5 * DEG) / aspect));
      viewUniform.set(currentCamRef.current.rotY, currentCamRef.current.rotX, fov);

      // 3초 응시 감지
      const dwell = dwellRef.current;
      const now = Date.now();
      const dist = Math.sqrt((gaze.x - dwell.x) ** 2 + (gaze.y - dwell.y) ** 2);

      if (dist < 0.1) {
        if (!dwell.triggered && now - dwell.since >= DWELL_THRESHOLD_MS) {
          dwell.triggered = true;
          onDwellComplete?.({ x: gaze.x, y: gaze.y });
        }
      } else {
        dwellRef.current = { x: gaze.x, y: gaze.y, since: now, triggered: false };
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      geometry.dispose();
      shaderMaterial.dispose();
      panoramaTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [panorama, onDwellComplete, getGazeInput]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style,
      }}
    />
  );
}
