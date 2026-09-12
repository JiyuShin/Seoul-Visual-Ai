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

export default function StreetView3D({
  colorImage = '/og.png',
  depthImage = '/pn.png',
  depthScale = 0.15,
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
  const markerRef = useRef(null);
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

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 하늘색 배경 (디버깅용)
    sceneRef.current = scene;

    // Camera
    const aspect = width / height || 16/9;
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
    camera.position.z = 1;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Texture Loader
    const textureLoader = new THREE.TextureLoader();

    // Load textures with error handling
    const colorTexture = textureLoader.load(
      colorImage,
      () => console.log('[StreetView3D] Color texture loaded'),
      undefined,
      (err) => console.error('[StreetView3D] Color texture error:', err)
    );
    const depthTexture = textureLoader.load(
      depthImage,
      () => console.log('[StreetView3D] Depth texture loaded'),
      undefined,
      (err) => console.error('[StreetView3D] Depth texture error:', err)
    );

    colorTexture.minFilter = THREE.LinearFilter;
    colorTexture.magFilter = THREE.LinearFilter;
    depthTexture.minFilter = THREE.LinearFilter;
    depthTexture.magFilter = THREE.LinearFilter;

    // Shader Material
    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        colorMap: { value: colorTexture },
        depthMap: { value: depthTexture },
        depthScale: { value: depthScale },
      },
      vertexShader: `
        uniform sampler2D depthMap;
        uniform float depthScale;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vec4 depthColor = texture2D(depthMap, uv);
          float depth = depthColor.r;
          
          vec3 newPosition = position;
          // 밝을수록 가까움 (z축으로 앞으로)
          newPosition.z += depth * depthScale;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D colorMap;
        varying vec2 vUv;
        
        void main() {
          vec4 color = texture2D(colorMap, vUv);
          gl_FragColor = color;
        }
      `,
      side: THREE.DoubleSide,
    });

    // Plane Geometry (250x250 분할)
    const planeWidth = 2 * aspect;
    const planeHeight = 2;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 250, 250);
    const mesh = new THREE.Mesh(geometry, shaderMaterial);
    scene.add(mesh);
    meshRef.current = mesh;

    // 마커 (응시 완료 시 표시)
    const markerGeometry = new THREE.RingGeometry(0.02, 0.03, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4caf6d, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.visible = false;
    marker.position.z = 0.2;
    scene.add(marker);
    markerRef.current = marker;

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
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
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

      // 카메라 적용
      camera.position.x = currentCamRef.current.x;
      camera.position.y = currentCamRef.current.y;
      camera.rotation.x = currentCamRef.current.rotX;
      camera.rotation.y = currentCamRef.current.rotY;

      // 3초 응시 감지
      const dwell = dwellRef.current;
      const now = Date.now();
      const dist = Math.sqrt((gaze.x - dwell.x) ** 2 + (gaze.y - dwell.y) ** 2);

      if (dist < 0.1) {
        // 같은 위치 유지
        if (!dwell.triggered && now - dwell.since >= DWELL_THRESHOLD_MS) {
          // 3초 경과 - 마커 표시
          dwell.triggered = true;
          
          const marker = markerRef.current;
          marker.position.x = gaze.x * (planeWidth / 2);
          marker.position.y = gaze.y * (planeHeight / 2);
          marker.visible = true;
          
          console.log('3초 응시 완료:', { x: gaze.x.toFixed(3), y: gaze.y.toFixed(3) });
          onDwellComplete?.({ x: gaze.x, y: gaze.y });
        }
      } else {
        // 위치 변경 - 리셋
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
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [colorImage, depthImage, depthScale, onDwellComplete, getGazeInput]);

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
