import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { random } from "remotion";
import { COLORS } from "./script";

// Everything here is a pure function of `t` (seconds). Nothing animates by itself,
// so every rendered frame is identical no matter how often or in what order it is drawn.

export type V3 = [number, number, number];
const TAU = Math.PI * 2;
const ADD = THREE.AdditiveBlending;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// ---------------------------------------------------------------- glass + water
export const GLASS_H = 1.5;
export const GLASS_R = 0.55;
/** y of the water surface (glass local space) for a fill level 0..1 */
export const surfaceY = (level: number) => 0.06 + level * (GLASS_H - 0.12);

export const Glass: React.FC<{
  position?: V3;
  scale?: number;
  level: number;
  tint: "cold" | "hot";
}> = ({ position = [0, 0, 0], scale = 1, level, tint }) => {
  const deep = tint === "cold" ? COLORS.coldDeep : COLORS.hotDeep;
  const glow = tint === "cold" ? COLORS.cold : COLORS.hot;
  const wh = Math.max(0.001, level * (GLASS_H - 0.12));
  return (
    <group position={position} scale={scale}>
      {/* water body */}
      <mesh position={[0, 0.06 + wh / 2, 0]} scale={[1, wh, 1]}>
        <cylinderGeometry args={[GLASS_R * 0.93, GLASS_R * 0.88, 1, 40]} />
        <meshStandardMaterial color={deep} emissive={glow} emissiveIntensity={0.55} roughness={0.25} />
      </mesh>
      {/* glowing surface */}
      {level > 0.01 ? (
        <mesh position={[0, 0.06 + wh + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[GLASS_R * 0.93, 40]} />
          <meshBasicMaterial color={glow} toneMapped={false} />
        </mesh>
      ) : null}
      {/* glass wall */}
      <mesh position={[0, GLASS_H / 2, 0]}>
        <cylinderGeometry args={[GLASS_R, GLASS_R * 0.94, GLASS_H, 48, 1, true]} />
        <meshStandardMaterial
          color={COLORS.ice}
          transparent
          opacity={0.16}
          roughness={0.05}
          metalness={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* rim */}
      <mesh position={[0, GLASS_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[GLASS_R, 0.018, 8, 64]} />
        <meshBasicMaterial color={COLORS.ice} toneMapped={false} />
      </mesh>
      {/* base */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[GLASS_R * 0.94, GLASS_R * 0.94, 0.06, 40]} />
        <meshStandardMaterial color={COLORS.ice} transparent opacity={0.4} />
      </mesh>
    </group>
  );
};

export const Table: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
    <circleGeometry args={[16, 64]} />
    <meshStandardMaterial color="#15103f" roughness={0.6} metalness={0.3} />
  </mesh>
);

export const GlowPool: React.FC<{ x: number; color: string; z?: number }> = ({ x, color, z = 0 }) => (
  <mesh position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
    <circleGeometry args={[1.6, 48]} />
    <meshBasicMaterial color={color} transparent opacity={0.22} blending={ADD} depthWrite={false} toneMapped={false} />
  </mesh>
);

export const Stream: React.FC<{ t: number; x: number; top: number; surface: number; color: string; z?: number }> = ({
  t,
  x,
  top,
  surface,
  color,
  z = 0,
}) => {
  const len = Math.max(0.01, top - surface);
  const wob = 1 + 0.12 * Math.sin(t * 38);
  return (
    <mesh position={[x, surface + len / 2, z]} scale={[wob, len, wob]}>
      <cylinderGeometry args={[0.07, 0.055, 1, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
    </mesh>
  );
};

// ---------------------------------------------------------------- sound visuals
/** Flat rings spreading outward. `rate` = rings per second (pitch). Same speed for all, so a higher pitch = tighter spacing. */
export const Rings: React.FC<{
  t: number;
  position: V3;
  color: string;
  rate: number;
  speed?: number;
  maxR?: number;
  fade?: number;
}> = ({ t, position, color, rate, speed = 2.2, maxR = 3.2, fade = 1 }) => {
  const wl = speed / rate;
  const n = Math.min(14, Math.ceil(maxR / wl) + 1);
  const items: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const rad = (t * speed + k * wl) % (n * wl);
    if (rad > maxR || rad < 0.05) continue;
    const a = Math.pow(1 - rad / maxR, 1.4) * fade;
    items.push(
      <mesh key={k} position={position} rotation={[Math.PI / 2, 0, 0]} scale={[rad, rad, 1]}>
        <torusGeometry args={[1, 0.02, 8, 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.85 * a} blending={ADD} depthWrite={false} toneMapped={false} />
      </mesh>,
    );
  }
  return <>{items}</>;
};

/** Rings that travel up and down inside the cup's air space and bounce off the surface and the rim. */
export const AirRings: React.FC<{
  t: number;
  position: V3; // centre of the bottom of the air space
  radius: number;
  height: number;
  color: string;
  rate: number;
  speed?: number;
}> = ({ t, position, radius, height, color, rate, speed = 2.4 }) => {
  const wl = speed / rate;
  const n = Math.min(12, Math.ceil(height / wl) + 1);
  const items: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const u = (t * speed + k * wl) % (2 * height);
    const y = u < height ? u : 2 * height - u;
    items.push(
      <mesh key={k} position={[position[0], position[1] + y, position[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[radius, radius, 1]}>
        <torusGeometry args={[1, 0.02, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} blending={ADD} depthWrite={false} toneMapped={false} />
      </mesh>,
    );
  }
  return <>{items}</>;
};

/** A waveform drawn as a row of glowing beads: few cycles + slow = low pitch, many cycles + fast = high pitch. */
export const Wave: React.FC<{
  t: number;
  position: V3;
  width: number;
  cycles: number; // waves across the width
  speed: number; // cycles per second
  amp: number;
  color: string;
  n?: number;
  bead?: number;
}> = ({ t, position, width, cycles, speed, amp, color, n = 56, bead = 0.05 }) => {
  const beads: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const env = Math.sin(Math.PI * s);
    const x = (s - 0.5) * width;
    const y = amp * env * Math.sin(TAU * (cycles * s - speed * t));
    beads.push(
      <mesh key={i} position={[x, y, 0]} scale={bead * (0.6 + 0.8 * env)}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>,
    );
  }
  return <group position={position}>{beads}</group>;
};

// ---------------------------------------------------------------- bubbles, steam, molecules
export const Bubbles: React.FC<{
  t: number;
  seed: string;
  count: number;
  rMin: number;
  rMax: number;
  height: number;
  spread: number;
  speed: number;
  color: string;
  origin: V3; // centre of the bubble column
}> = ({ t, seed, count, rMin, rMax, height, spread, speed, color, origin }) => {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        r: rMin + random(`${seed}-r-${i}`) * (rMax - rMin),
        x: (random(`${seed}-x-${i}`) - 0.5) * spread,
        z: (random(`${seed}-z-${i}`) - 0.5) * spread * 0.6,
        v: 0.6 + random(`${seed}-v-${i}`) * 0.8,
        p: random(`${seed}-p-${i}`),
        w: random(`${seed}-w-${i}`) * TAU,
      })),
    [seed, count, rMin, rMax, spread],
  );
  return (
    <group position={origin}>
      {items.map((b, i) => {
        const life = (t * speed * b.v + b.p) % 1;
        const y = (life - 0.5) * height;
        const x = b.x + Math.sin(t * 2 + b.w) * 0.05;
        const pop = 1 - smooth(0.9, 1, life);
        const grow = smooth(0, 0.08, life);
        return (
          <mesh key={i} position={[x, y, b.z]} scale={b.r * pop * grow}>
            <sphereGeometry args={[1, 18, 14]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.7}
              transparent
              opacity={0.55}
              roughness={0.1}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export const Steam: React.FC<{ t: number; position: V3; intensity: number; width?: number }> = ({
  t,
  position,
  intensity,
  width = 0.7,
}) => {
  const items = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        p: random(`steam-p-${i}`),
        x: (random(`steam-x-${i}`) - 0.5) * width,
        w: random(`steam-w-${i}`) * TAU,
      })),
    [width],
  );
  if (intensity < 0.02) return null;
  return (
    <group position={position}>
      {items.map((s, i) => {
        const life = (t * 0.45 + s.p) % 1;
        const size = (0.12 + life * 0.3) * intensity;
        return (
          <mesh key={i} position={[s.x + Math.sin(t * 1.3 + s.w) * 0.16 * life, life * 2.3, 0]} scale={size}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={Math.sin(Math.PI * life) * 0.3 * intensity} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Molecules wandering in a box. Faster `speed` = hotter. Hot ones get motion trails. */
export const Molecules: React.FC<{
  t: number;
  seed: string;
  box: V3;
  count: number;
  speed: number;
  color: string;
  trails?: boolean;
  size?: number;
}> = ({ t, seed, box, count, speed, color, trails = false, size = 0.11 }) => {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        f: [0.7 + random(`${seed}-fa-${i}`) * 0.8, 0.7 + random(`${seed}-fb-${i}`) * 0.8, 0.7 + random(`${seed}-fc-${i}`) * 0.8],
        p: [random(`${seed}-pa-${i}`) * TAU, random(`${seed}-pb-${i}`) * TAU, random(`${seed}-pc-${i}`) * TAU],
      })),
    [seed, count],
  );
  const lags = trails ? [0, 0.035, 0.07] : [0];
  const out: React.ReactNode[] = [];
  items.forEach((m, i) => {
    lags.forEach((lag, li) => {
      const tt = t - lag;
      const pos: V3 = [
        Math.sin(tt * speed * m.f[0] + m.p[0]) * box[0] * 0.42,
        Math.sin(tt * speed * m.f[1] + m.p[1]) * box[1] * 0.42,
        Math.sin(tt * speed * m.f[2] + m.p[2]) * box[2] * 0.42,
      ];
      out.push(
        <mesh key={`${i}-${li}`} position={pos} scale={size * (1 - li * 0.28)}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.8}
            transparent={li > 0}
            opacity={li === 0 ? 1 : 0.35 / li}
            depthWrite={li === 0}
          />
        </mesh>,
      );
    });
  });
  return <>{out}</>;
};

export const GlassBox: React.FC<{ position: V3; box: V3; color: string }> = ({ position, box, color }) => {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(box[0], box[1], box[2])), [box]);
  return (
    <group position={position}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} toneMapped={false} />
      </lineSegments>
      <mesh>
        <boxGeometry args={box} />
        <meshStandardMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------- big static fields (instanced, built once)
export const Dust: React.FC<{ center: V3; t: number; count?: number; spread?: number }> = ({
  center,
  t,
  count = 140,
  spread = 15,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const s = 0.02 + random(`dust-s-${i}`) * 0.05;
      m.compose(
        new THREE.Vector3(
          (random(`dust-x-${i}`) - 0.5) * spread * 2,
          (random(`dust-y-${i}`) - 0.5) * spread,
          (random(`dust-z-${i}`) - 0.5) * spread * 2,
        ),
        q,
        new THREE.Vector3(s, s, s),
      );
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, spread]);
  return (
    <group position={center} rotation={[0, t * 0.05, 0]}>
      <instancedMesh ref={ref} args={[undefined as never, undefined as never, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#9db7ff" transparent opacity={0.55} toneMapped={false} />
      </instancedMesh>
    </group>
  );
};

/** Thousands of cups laid out in a sunflower spiral. */
export const CupField: React.FC<{ t: number; count?: number }> = ({ t, count = 2400 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const k = i + 1;
      const r = 0.9 * Math.sqrt(k) + 0.6;
      const a = k * 2.399963; // golden angle
      m.compose(new THREE.Vector3(Math.cos(a) * r, 0.25, Math.sin(a) * r), q, one);
      mesh.setMatrixAt(i, m);
      const pick = random(`cup-${i}`);
      c.set(pick < 0.42 ? COLORS.cold : pick < 0.84 ? COLORS.hot : COLORS.gold);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);
  return (
    <group rotation={[0, t * 0.06, 0]}>
      <instancedMesh ref={ref} args={[undefined as never, undefined as never, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.2, 0.15, 0.5, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.45} />
      </instancedMesh>
    </group>
  );
};
