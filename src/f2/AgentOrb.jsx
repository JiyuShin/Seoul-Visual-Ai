import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AGENT_LOOK, agentFragment, agentVertex } from './agentPlasmaShader';

function styleValue(style) {
  if (style === 'glass') return 1;
  if (style === 'liquid') return 2;
  return 0;
}

export default function AgentOrb({ speaking = false, className }) {
  const canvasRef = useRef(null);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const look = AGENT_LOOK;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    camera.position.set(0, 0, 4.4);

    const uniforms = {
      time: { value: 0 },
      lightDir: { value: new THREE.Vector3(0.2, 0.9, 0.3).normalize() },
      ringDir: { value: new THREE.Vector3(0.08, 0.56, 0.86).normalize() },
      boost: { value: 0.2 },
      globalAlpha: { value: look.opacity },
      paletteMix: { value: 0.2 },
      intensityBoost: { value: 0 },
      uColorA: { value: new THREE.Color(look.colorA) },
      uColorB: { value: new THREE.Color(look.colorB) },
      uColorC: { value: new THREE.Color(look.colorC) },
      uColorWarm: { value: new THREE.Color(look.colorWarm) },
      uRim: { value: new THREE.Color(look.rim) },
      uAreaA: { value: look.areaA },
      uAreaB: { value: look.areaB },
      uAreaC: { value: look.areaC },
      uAreaWarm: { value: look.areaWarm },
      uAreaRim: { value: look.areaRim },
      uRandom: { value: look.colorRandom },
      uSoftness: { value: look.softness },
      uBrightness: { value: look.brightness },
      uGlow: { value: look.glow },
      uFlowSpeed: { value: look.flowSpeed },
      uFlowScale: { value: look.flowScale },
      uStyle: { value: styleValue(look.style) },
    };

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 96),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: agentVertex,
        fragmentShader: agentFragment,
        transparent: true,
        depthWrite: false,
      })
    );
    scene.add(mesh);

    let frame = 0;
    let last = 0;

    const resize = () => {
      const size = canvas.clientWidth || 148;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };

    const render = (now) => {
      frame = requestAnimationFrame(render);
      const size = Math.max(1, canvas.clientWidth || 148);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (Math.abs(canvas.width - size * ratio) > 2) resize();
      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      last = now;
      const boostTarget = speakingRef.current ? 1 : 0.55;
      uniforms.boost.value += (boostTarget - uniforms.boost.value) * 0.018;
      uniforms.time.value += dt * look.spin;
      uniforms.globalAlpha.value = look.opacity;
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

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
