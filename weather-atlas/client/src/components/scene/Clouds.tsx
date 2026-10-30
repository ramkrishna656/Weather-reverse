import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneState } from "../../lib/weather";

// Deterministic pseudo-random so cloud layouts stay stable between renders.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

interface Puff {
  x: number;
  y: number;
  z: number;
  scale: number;
  lobes: Array<[number, number, number, number]>;
}

const MAX_CLOUDS = 12;
const WRAP = 11;

function buildPuffs(): Puff[] {
  const r = rng(7);
  return Array.from({ length: MAX_CLOUDS }, () => {
    const angle = r() * Math.PI * 2;
    const radius = 2 + r() * 6;
    return {
      x: Math.cos(angle) * radius,
      y: 4 + r() * 2.6,
      z: Math.sin(angle) * radius,
      scale: 0.8 + r() * 0.9,
      lobes: Array.from({ length: 4 }, (_, i) => [
        (i - 1.5) * 0.8 + (r() - 0.5) * 0.3,
        (r() - 0.3) * 0.35,
        (r() - 0.5) * 0.5,
        0.55 + r() * 0.4,
      ]),
    };
  });
}

export function Clouds({ state }: { state: SceneState }) {
  const puffs = useMemo(buildPuffs, []);
  const groups = useRef<Array<THREE.Group | null>>([]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), []);
  const tone = useMemo(() => new THREE.Color(), []);
  const heavy = state.kind === "rain" || state.kind === "storm";
  const wanted = Math.min(MAX_CLOUDS, Math.round((state.cloudCover / 100) * 9) + (heavy ? 3 : 0));

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 2);
    tone.set(
      state.kind === "storm" ? "#4b5266" : heavy ? "#7c8797" : state.kind === "fog" ? "#c9cfd5" : state.isDay ? "#ffffff" : "#59638a",
    );
    mat.color.lerp(tone, k);
    // Wind pushes clouds along +x; faster wind, faster drift.
    const speed = 0.12 + Math.min(state.wind, 60) * 0.022;
    puffs.forEach((p, i) => {
      const g = groups.current[i];
      if (!g) return;
      p.x += speed * dt;
      if (p.x > WRAP) p.x = -WRAP;
      g.position.x = p.x;
      const targetScale = i < wanted ? p.scale : 0.0001;
      g.scale.setScalar(g.scale.x + (targetScale - g.scale.x) * k);
    });
  });

  return (
    <group>
      {puffs.map((p, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={[p.x, p.y, p.z]}
          scale={0.0001}
        >
          {p.lobes.map(([x, y, z, s], j) => (
            <mesh key={j} position={[x, y, z]} scale={s} material={mat}>
              <icosahedronGeometry args={[0.8, 1]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
