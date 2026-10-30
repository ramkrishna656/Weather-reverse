import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneState } from "../../lib/weather";

const RAIN_COUNT = 1100;
const SNOW_COUNT = 800;
const HALF = 8;
const TOP = 9;

// Wind blows *from* windDirection; map that to a +x/+z drift in scene space.
function drift(state: SceneState) {
  const strength = Math.min(state.wind, 60) / 60;
  const rad = ((state.windDirection + 180) * Math.PI) / 180;
  return { x: Math.sin(rad) * strength, z: Math.cos(rad) * strength };
}

function seed(count: number) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * HALF * 2;
    pos[i * 3 + 1] = Math.random() * TOP;
    pos[i * 3 + 2] = (Math.random() - 0.5) * HALF * 2;
  }
  return pos;
}

function Rain({ state }: { state: SceneState }) {
  const heads = useMemo(() => seed(RAIN_COUNT), []);
  const line = useMemo(() => new Float32Array(RAIN_COUNT * 6), []);
  const geo = useRef<THREE.BufferGeometry>(null);

  useFrame((_, dt) => {
    const w = drift(state);
    const fall = 11 + state.intensity * 9;
    const visible = Math.max(1, Math.floor(RAIN_COUNT * (0.15 + state.intensity * 0.85)));
    for (let i = 0; i < RAIN_COUNT; i++) {
      const o = i * 3;
      heads[o] += w.x * 6 * dt;
      heads[o + 1] -= fall * dt;
      heads[o + 2] += w.z * 6 * dt;
      if (heads[o + 1] < 0) {
        heads[o + 1] = TOP;
        heads[o] = (Math.random() - 0.5) * HALF * 2;
        heads[o + 2] = (Math.random() - 0.5) * HALF * 2;
      }
      const l = i * 6;
      line[l] = heads[o];
      line[l + 1] = heads[o + 1];
      line[l + 2] = heads[o + 2];
      line[l + 3] = heads[o] - w.x * 0.28;
      line[l + 4] = heads[o + 1] + 0.45;
      line[l + 5] = heads[o + 2] - w.z * 0.28;
    }
    const g = geo.current;
    if (g) {
      (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      g.setDrawRange(0, visible * 2);
    }
  });

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" array={line} count={RAIN_COUNT * 2} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color={state.isDay ? "#bcd6ff" : "#8fb0ff"} transparent opacity={0.65} />
    </lineSegments>
  );
}

function Snow({ state }: { state: SceneState }) {
  const pos = useMemo(() => seed(SNOW_COUNT), []);
  const phase = useMemo(() => Float32Array.from({ length: SNOW_COUNT }, () => Math.random() * 6.28), []);
  const geo = useRef<THREE.BufferGeometry>(null);

  useFrame(({ clock }, dt) => {
    const w = drift(state);
    const t = clock.elapsedTime;
    const visible = Math.max(1, Math.floor(SNOW_COUNT * (0.2 + state.intensity * 0.8)));
    for (let i = 0; i < SNOW_COUNT; i++) {
      const o = i * 3;
      pos[o] += (w.x * 3 + Math.sin(t * 0.8 + phase[i]) * 0.5) * dt;
      pos[o + 1] -= (1.1 + (i % 5) * 0.12) * dt;
      pos[o + 2] += (w.z * 3 + Math.cos(t * 0.7 + phase[i]) * 0.4) * dt;
      if (pos[o + 1] < 0) {
        pos[o + 1] = TOP;
        pos[o] = (Math.random() - 0.5) * HALF * 2;
        pos[o + 2] = (Math.random() - 0.5) * HALF * 2;
      }
    }
    const g = geo.current;
    if (g) {
      (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      g.setDrawRange(0, visible);
    }
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" array={pos} count={SNOW_COUNT} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.14} sizeAttenuation transparent opacity={0.92} depthWrite={false} />
    </points>
  );
}

export function Precipitation({ state }: { state: SceneState }) {
  if (state.kind === "rain" || state.kind === "storm") return <Rain state={state} />;
  if (state.kind === "snow") return <Snow state={state} />;
  return null;
}
