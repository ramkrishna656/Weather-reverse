import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneState } from "../../lib/weather";

const TREES: Array<[number, number, number]> = [
  [2.1, 1.4, 1.0],
  [-2.4, 0.9, 0.9],
  [0.6, -2.5, 1.15],
  [-1.2, 2.5, 0.8],
  [2.6, -1.3, 0.85],
];

function Tree({ x, z, s }: { x: number; z: number; s: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 0.6, 6]} />
        <meshStandardMaterial color="#6b4a32" flatShading />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <coneGeometry args={[0.5, 0.9, 7]} />
        <meshStandardMaterial color="#2f7d4f" flatShading />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <coneGeometry args={[0.36, 0.7, 7]} />
        <meshStandardMaterial color="#3a9160" flatShading />
      </mesh>
    </group>
  );
}

/** A small floating diorama. The top turns white under snow; windows glow at night. */
export function Island({ state }: { state: SceneState }) {
  const group = useRef<THREE.Group>(null);
  const top = useRef<THREE.MeshStandardMaterial>(null);
  const target = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, dt) => {
    if (group.current) group.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.1;
    if (top.current) {
      target.set(state.kind === "snow" ? "#eef3f8" : state.isDay ? "#79b265" : "#4f8a4f");
      top.current.color.lerp(target, 1 - Math.exp(-dt * 1.5));
    }
  });

  const glow = state.isDay ? 0 : 2.2;

  return (
    <group ref={group}>
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[4, 3.8, 0.5, 10]} />
        <meshStandardMaterial ref={top} color="#79b265" flatShading />
      </mesh>
      <mesh position={[0, -2.2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[3.8, 3.4, 10]} />
        <meshStandardMaterial color="#6d6b78" flatShading />
      </mesh>
      {TREES.map(([x, z, s]) => (
        <Tree key={`${x},${z}`} x={x} z={z} s={s} />
      ))}
      <group position={[-0.5, 0, -0.2]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.3, 0.9, 1.05]} />
          <meshStandardMaterial color="#eadcc8" flatShading />
        </mesh>
        <mesh position={[0, 1.2, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1.1, 0.7, 4]} />
          <meshStandardMaterial color="#b8553d" flatShading />
        </mesh>
        <mesh position={[0.25, 0.5, 0.531]}>
          <planeGeometry args={[0.32, 0.32]} />
          <meshStandardMaterial color="#ffe9a6" emissive="#ffcf66" emissiveIntensity={glow} />
        </mesh>
        <mesh position={[-0.3, 0.38, 0.531]}>
          <planeGeometry args={[0.26, 0.5]} />
          <meshStandardMaterial color="#7a5338" />
        </mesh>
      </group>
    </group>
  );
}
