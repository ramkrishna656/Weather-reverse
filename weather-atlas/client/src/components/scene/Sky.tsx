import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneState } from "../../lib/weather";

const C = (hex: string) => new THREE.Color(hex);

const SKY = {
  dayClear: C("#7fbcf5"),
  dayCloud: C("#9db2c6"),
  dayFog: C("#bcc3ca"),
  dayRain: C("#6d7d8e"),
  dayStorm: C("#3f4859"),
  daySnow: C("#cfd9e4"),
  nightClear: C("#0a0f2e"),
  nightCloud: C("#1a2136"),
  warm: C("#ffb07c"),
};

export function skyColor(s: SceneState, out = new THREE.Color()): THREE.Color {
  const cloudy = Math.min(1, s.cloudCover / 100);
  if (!s.isDay) {
    out.copy(SKY.nightClear).lerp(SKY.nightCloud, cloudy);
    if (s.kind === "storm") out.multiplyScalar(0.8);
    return out;
  }
  let base = SKY.dayClear;
  if (s.kind === "fog") base = SKY.dayFog;
  else if (s.kind === "rain") base = SKY.dayRain;
  else if (s.kind === "storm") base = SKY.dayStorm;
  else if (s.kind === "snow") base = SKY.daySnow;
  out.copy(SKY.dayClear).lerp(s.kind === "clear" || s.kind === "cloud" ? SKY.dayCloud : base, s.kind === "clear" || s.kind === "cloud" ? cloudy : 1);
  // warm tint near sunrise / sunset
  const edge = 1 - Math.min(1, Math.min(s.arc, 1 - s.arc) / 0.12);
  if (edge > 0) out.lerp(SKY.warm, edge * 0.45 * (1 - cloudy * 0.6));
  return out;
}

/** Eases scene background + fog toward the colour implied by the weather. */
export function SkyRig({ state }: { state: SceneState }) {
  const { scene } = useThree();
  const target = useRef(new THREE.Color());
  if (!scene.background) scene.background = skyColor(state);
  if (!scene.fog) scene.fog = new THREE.Fog(skyColor(state), 14, 60);

  useFrame((_, dt) => {
    skyColor(state, target.current);
    const k = 1 - Math.exp(-dt * 2.2);
    (scene.background as THREE.Color).lerp(target.current, k);
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(scene.background as THREE.Color);
    const nearT = state.kind === "fog" ? 4 : 14;
    const farT = state.kind === "fog" ? 24 : 60;
    fog.near += (nearT - fog.near) * k;
    fog.far += (farT - fog.far) * k;
  });
  return null;
}

const ARC_RADIUS = 15;
export function arcPosition(arc: number, out = new THREE.Vector3()) {
  const a = Math.PI * arc;
  return out.set(-Math.cos(a) * ARC_RADIUS, Math.sin(a) * 11 + 1.5, -5);
}

/** Sun or moon on its arc, plus the lights that go with it. */
export function Celestial({ state }: { state: SceneState }) {
  const body = useRef<THREE.Mesh>(null);
  const bodyMat = useRef<THREE.MeshBasicMaterial>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.HemisphereLight>(null);
  const flash = useRef<THREE.PointLight>(null);
  const flashLevel = useRef(0);
  const pos = useRef(new THREE.Vector3());
  const bodyColor = useRef(new THREE.Color());

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 2);
    arcPosition(state.arc, pos.current);
    if (body.current) body.current.position.lerp(pos.current, k);
    if (bodyMat.current) {
      bodyColor.current.set(state.isDay ? "#ffe27a" : "#e8eeff");
      bodyMat.current.color.lerp(bodyColor.current, k);
      const hidden = state.kind === "storm" || (state.kind === "rain" && state.cloudCover > 90);
      bodyMat.current.opacity += ((hidden ? 0.12 : 1) - bodyMat.current.opacity) * k;
    }
    if (key.current) {
      key.current.position.lerp(pos.current, k);
      const dimmer = 1 - Math.min(1, state.cloudCover / 100) * 0.65;
      const target = (state.isDay ? 2.4 : 0.45) * dimmer;
      key.current.intensity += (target - key.current.intensity) * k;
      key.current.color.lerp(bodyColor.current.set(state.isDay ? "#fff1d0" : "#a9bcff"), k);
    }
    if (ambient.current) {
      const target = state.isDay ? 0.9 : 0.35;
      ambient.current.intensity += (target - ambient.current.intensity) * k;
    }
    if (flash.current) {
      if (state.kind === "storm" && Math.random() < 0.006) flashLevel.current = 1;
      flashLevel.current = Math.max(0, flashLevel.current - dt * 3.2);
      flash.current.intensity = flashLevel.current ** 2 * 180;
    }
  });

  return (
    <>
      <hemisphereLight ref={ambient} args={["#dbe9ff", "#4d5b45", 0.9]} />
      <directionalLight ref={key} intensity={2} position={[-10, 10, -5]} />
      <pointLight ref={flash} position={[0, 9, 0]} color="#cdd8ff" intensity={0} distance={40} />
      <mesh ref={body} position={[-15, 1.5, -5]}>
        <sphereGeometry args={[1.5, 24, 24]} />
        <meshBasicMaterial ref={bodyMat} transparent fog={false} />
      </mesh>
    </>
  );
}
