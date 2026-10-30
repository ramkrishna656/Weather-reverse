import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Day } from "../../lib/api";
import { describeCode, round, weekday, type Kind } from "../../lib/weather";

const KIND_COLOR: Record<Kind, string> = {
  clear: "#ffc94d",
  cloud: "#b4c0cf",
  fog: "#a7afb8",
  rain: "#5b8def",
  snow: "#dbe7f5",
  storm: "#8460ff",
};

const RING_RADIUS = 7.2;
const MIN_H = 0.8;
const MAX_H = 3.4;

interface Props {
  days: Day[];
  unit: string;
  selected: number;
  onSelect: (i: number) => void;
}

function Pillar({
  day,
  index,
  height,
  unit,
  selected,
  onSelect,
}: {
  day: Day;
  index: number;
  height: number;
  unit: string;
  selected: boolean;
  onSelect: (i: number) => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const angle = (index / 7) * Math.PI * 2;
  const x = Math.sin(angle) * RING_RADIUS;
  const z = Math.cos(angle) * RING_RADIUS;
  const kind = describeCode(day.weatherCode).kind;
  const lift = selected || hover;

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const k = 1 - Math.exp(-dt * 8);
    const targetScale = selected ? 1.18 : hover ? 1.08 : 1;
    m.scale.x += (targetScale - m.scale.x) * k;
    m.scale.z = m.scale.x;
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity += ((selected ? 0.55 : hover ? 0.3 : 0.05) - mat.emissiveIntensity) * k;
  });

  return (
    <group position={[x, -2.4, z]}>
      <mesh
        ref={mesh}
        position={[0, height / 2, 0]}
        scale={[1, height, 1]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <cylinderGeometry args={[0.5, 0.58, 1, 8]} />
        <meshStandardMaterial color={KIND_COLOR[kind]} emissive={KIND_COLOR[kind]} emissiveIntensity={0.05} flatShading />
      </mesh>
      <Html position={[0, height + 0.55, 0]} center distanceFactor={11} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className={`pillar-label${lift ? " is-active" : ""}`}>
          <span className="pillar-day">{index === 0 ? "Today" : weekday(day.date)}</span>
          <span className="pillar-temp">
            {round(day.tempMax)}
            {unit}
          </span>
        </div>
      </Html>
    </group>
  );
}

/** Seven pillars on a ring: height is the day's high, colour is the weather. */
export function Pillars({ days, unit, selected, onSelect }: Props) {
  const highs = days.map((d) => d.tempMax ?? 0);
  const lo = Math.min(...highs);
  const hi = Math.max(...highs);
  const span = Math.max(1, hi - lo);
  return (
    <group>
      {days.map((day, i) => (
        <Pillar
          key={day.date}
          day={day}
          index={i}
          height={MIN_H + (((day.tempMax ?? lo) - lo) / span) * (MAX_H - MIN_H)}
          unit={unit}
          selected={selected === i}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
