import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { Day } from "../../lib/api";
import type { SceneState } from "../../lib/weather";
import { SkyRig, Celestial } from "./Sky";
import { Island } from "./Island";
import { Clouds } from "./Clouds";
import { Precipitation } from "./Precipitation";
import { Pillars } from "./Pillars";

interface Props {
  state: SceneState;
  days: Day[];
  unit: string;
  selectedDay: number;
  onSelectDay: (i: number) => void;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Scene({ state, days, unit, selectedDay, onSelectDay }: Props) {
  const [spin, setSpin] = useState(!prefersReducedMotion());
  const resume = useRef<number>();
  useEffect(() => () => window.clearTimeout(resume.current), []);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 5.5, 16], fov: 40, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => (document.body.style.cursor = "")}
    >
      <SkyRig state={state} />
      <Celestial state={state} />
      {!state.isDay && state.cloudCover < 85 && <Stars radius={70} depth={30} count={1600} factor={3.2} fade speed={0.4} />}
      <Island state={state} />
      <Clouds state={state} />
      <Precipitation state={state} />
      <Pillars days={days} unit={unit} selected={selectedDay} onSelect={onSelectDay} />
      <OrbitControls
        target={[0, 0.5, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={9}
        maxDistance={24}
        maxPolarAngle={Math.PI * 0.53}
        autoRotate={spin}
        autoRotateSpeed={0.35}
        onStart={() => {
          window.clearTimeout(resume.current);
          setSpin(false);
        }}
        onEnd={() => {
          if (prefersReducedMotion()) return;
          resume.current = window.setTimeout(() => setSpin(true), 5000);
        }}
      />
    </Canvas>
  );
}
