import React, { useLayoutEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, ID } from "./script";
import { levelAt, type Timeline } from "./timeline";
import {
  AirRings,
  Bubbles,
  clamp01,
  CupField,
  Dust,
  Glass,
  GlassBox,
  GlowPool,
  GLASS_H,
  GLASS_R,
  Molecules,
  Rings,
  smooth,
  Steam,
  Stream,
  surfaceY,
  Table,
  Wave,
  type V3,
} from "./parts";

// Every scene lives at its own spot in space, so one canvas serves the whole video.
const KITCHEN: V3 = [0, 0, 0]; // beats 1-4 and 9
const MOLECULES: V3 = [60, 0, 0]; // beat 5
const COLD_CUP: V3 = [120, 0, 0]; // beat 6
const HOT_CUP: V3 = [180, 0, 0]; // beat 7
const FIELD: V3 = [240, 0, 0]; // beat 8
const GLASS_X = 1.6; // cold glass at -1.6, hot glass at +1.6

// ------------------------------------------------------------------ camera
type Key = { u: number; pos: V3; look: V3; fov?: number; roll?: number }; // u = 0..1 through the beat, roll in degrees
type Rig = { ease: (x: number) => number; keys: Key[]; whipIn?: V3; whipOut?: V3 };

const inOut = Easing.inOut(Easing.cubic);
const outC = Easing.out(Easing.cubic);
const WHIP_OUT: V3 = [10, 0.4, 0];
const WHIP_IN: V3 = [-10, 0.4, 0];
const at = (p: V3, o: V3): V3 => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];

// Rules from the style skill: every beat has a camera move, dive-ins alternate with pull-backs,
// the scale beats (4 and 8) get a big zoom-out, and the last beat pulls back to the opening shot.
const OPENING: Key = { u: 0, pos: [-3, 3.4, 15], look: [0, 1.3, 0], fov: 40, roll: -2 };
const COLD_CLOSE: Key = { u: 1, pos: [-1.6, 2.5, 7.4], look: [-1.6, 1.3, 0], fov: 36, roll: 0 };
const COLD_POUR_END: Key = { u: 1, pos: [-1.8, 1.9, 4.2], look: [-1.6, 1.55, 0], fov: 36, roll: -1.5 };
const HOT_POUR_END: Key = { u: 1, pos: [1.8, 1.9, 4.2], look: [1.6, 1.55, 0], fov: 36, roll: 1.5 };

const RIGS: Record<string, Rig> = {
  // dive-in from wide to the (still empty) cold glass
  [ID.hook]: {
    ease: inOut,
    keys: [OPENING, { u: 0.5, pos: [2, 3, 10.5], look: [0, 1.3, 0], fov: 38, roll: 2 }, COLD_CLOSE],
  },
  // push-in while the cold glass fills
  [ID.cold]: { ease: inOut, keys: [{ ...COLD_CLOSE, u: 0 }, COLD_POUR_END] },
  // slide across to the hot glass, then push in while it fills
  [ID.hot]: {
    ease: inOut,
    keys: [
      { ...COLD_POUR_END, u: 0 },
      { u: 0.28, pos: [0, 2.6, 9.2], look: [0, 1.4, 0], fov: 40, roll: 0 },
      { u: 0.4, pos: [1.6, 2.3, 6.6], look: [1.6, 1.4, 0], fov: 36, roll: 1 },
      HOT_POUR_END,
    ],
  },
  // BIG pull-back: from the hot glass to both glasses
  [ID.reveal]: {
    ease: outC,
    whipOut: WHIP_OUT,
    keys: [
      { ...HOT_POUR_END, u: 0 },
      { u: 0.5, pos: [1.5, 2.8, 8], look: [0.6, 1.5, 0], fov: 38, roll: 0 },
      { u: 1, pos: [0, 3.8, 13.5], look: [0, 1.4, 0], fov: 42, roll: -1 },
    ],
  },
  // dive-in on the molecules
  [ID.visc]: {
    ease: inOut,
    whipIn: WHIP_IN,
    whipOut: WHIP_OUT,
    keys: [
      { u: 0, pos: at(MOLECULES, [3.5, 1.4, 16]), look: MOLECULES, fov: 40, roll: -3 },
      { u: 0.55, pos: at(MOLECULES, [-1.8, 0.8, 10]), look: MOLECULES, fov: 39, roll: 0 },
      { u: 1, pos: at(MOLECULES, [-0.4, 0.2, 7.4]), look: at(MOLECULES, [0, 0.1, 0]), fov: 38, roll: 2 },
    ],
  },
  // start tight on the big bubbles, pull back to see the whole cup and the slow wave
  [ID.coldBub]: {
    ease: outC,
    whipIn: WHIP_IN,
    whipOut: WHIP_OUT,
    keys: [
      { u: 0, pos: at(COLD_CUP, [0.4, -0.3, 2.4]), look: at(COLD_CUP, [0, -0.3, 0]), fov: 42, roll: 4 },
      { u: 0.45, pos: at(COLD_CUP, [0, 0.4, 5.5]), look: at(COLD_CUP, [0, 0, 0]), fov: 41, roll: 1 },
      { u: 1, pos: at(COLD_CUP, [0, 0.7, 9.5]), look: at(COLD_CUP, [0, 0.3, 0]), fov: 40, roll: 0 },
    ],
  },
  // same move on the hot cup: tiny bubbles, tight rings, fast wave
  [ID.hotBub]: {
    ease: outC,
    whipIn: WHIP_IN,
    whipOut: WHIP_OUT,
    keys: [
      { u: 0, pos: at(HOT_CUP, [-0.4, -0.4, 2.4]), look: at(HOT_CUP, [0, -0.4, 0]), fov: 42, roll: -4 },
      { u: 0.45, pos: at(HOT_CUP, [0, 0.4, 5.5]), look: at(HOT_CUP, [0, 0, 0]), fov: 41, roll: -1 },
      { u: 1, pos: at(HOT_CUP, [0, 0.7, 9.5]), look: at(HOT_CUP, [0, 0.3, 0]), fov: 40, roll: 0 },
    ],
  },
  // HUGE pull-back: one glass to thousands
  [ID.brain]: {
    ease: outC,
    whipIn: WHIP_IN,
    whipOut: WHIP_OUT,
    keys: [
      { u: 0, pos: at(FIELD, [0, 1.1, 4.2]), look: at(FIELD, [0, 0.5, 0]), fov: 40, roll: 0 },
      { u: 0.4, pos: at(FIELD, [1, 14, 20]), look: FIELD, fov: 42, roll: -2 },
      { u: 1, pos: at(FIELD, [0, 92, 34]), look: FIELD, fov: 45, roll: 0 },
    ],
  },
  // push in between the glasses, then pull back to the opening shot (the video loops)
  [ID.test]: {
    ease: inOut,
    whipIn: WHIP_IN,
    keys: [
      { u: 0, pos: [4.5, 2.3, 5.6], look: [0, 1.4, 0], fov: 36, roll: 3 },
      { u: 0.5, pos: [1, 2.8, 8.5], look: [0, 1.4, 0], fov: 38, roll: 0 },
      { ...OPENING, u: 1 },
    ],
  },
};

const samplePose = (keys: Key[], u: number, ease: (x: number) => number) => {
  const us = keys.map((k) => k.u);
  const o = { easing: ease, extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const pick = (f: (k: Key) => number) =>
    interpolate(
      u,
      us,
      keys.map(f),
      o,
    );
  return {
    pos: [pick((k) => k.pos[0]), pick((k) => k.pos[1]), pick((k) => k.pos[2])] as V3,
    look: [pick((k) => k.look[0]), pick((k) => k.look[1]), pick((k) => k.look[2])] as V3,
    fov: pick((k) => k.fov ?? 40),
    roll: pick((k) => k.roll ?? 0),
  };
};

const CameraRig: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);

  const beat = tl.beatAt(frame);
  const rig = RIGS[beat.id];
  const dur = Math.max(1, beat.durationFrames - 1);
  const u = clamp01((frame - beat.startFrame) / dur);
  const p = samplePose(rig.keys, u, rig.ease);

  // short whips hide the jump between scene sites: leave fast, arrive fast
  const w = (0.24 * fps) / dur;
  const out = rig.whipOut ? Easing.in(Easing.cubic)(clamp01((u - (1 - w)) / w)) : 0;
  const inn = rig.whipIn ? 1 - Easing.out(Easing.cubic)(clamp01(u / w)) : 0;
  const off: V3 = [
    (rig.whipOut?.[0] ?? 0) * out + (rig.whipIn?.[0] ?? 0) * inn,
    (rig.whipOut?.[1] ?? 0) * out + (rig.whipIn?.[1] ?? 0) * inn,
    (rig.whipOut?.[2] ?? 0) * out + (rig.whipIn?.[2] ?? 0) * inn,
  ];

  useLayoutEffect(() => {
    camera.position.set(p.pos[0] + off[0], p.pos[1] + off[1], p.pos[2] + off[2]);
    const r = (p.roll * Math.PI) / 180;
    camera.up.set(Math.sin(r), Math.cos(r), 0);
    camera.lookAt(p.look[0] + off[0], p.look[1] + off[1], p.look[2] + off[2]);
    camera.fov = p.fov;
    camera.updateProjectionMatrix();
    invalidate();
  });
  return null;
};

// ------------------------------------------------------------------ scenes
const Kitchen: React.FC<{ tl: Timeline; t: number; beatId: string }> = ({ tl, t, beatId }) => {
  const cold = levelAt(tl, "cold", t);
  const hot = levelAt(tl, "hot", t);
  const coldOn = t >= tl.pours.cold.start && t < tl.pours.cold.end;
  const hotOn = t >= tl.pours.hot.start && t < tl.pours.hot.end;
  const last = beatId === ID.test;
  const steam = smooth(tl.pours.hot.start, tl.pours.hot.start + 1.5, t);
  return (
    <group position={KITCHEN}>
      <Table />
      <GlowPool x={-GLASS_X} color={COLORS.cold} />
      <GlowPool x={GLASS_X} color={COLORS.hot} />
      <pointLight position={[-GLASS_X, 2.2, 1.8]} color={COLORS.cold} intensity={22} distance={9} />
      <pointLight position={[GLASS_X, 2.2, 1.8]} color={COLORS.hot} intensity={22} distance={9} />

      <Glass position={[-GLASS_X, 0, 0]} level={cold} tint="cold" />
      <Glass position={[GLASS_X, 0, 0]} level={hot} tint="hot" />

      {coldOn ? <Stream t={t} x={-GLASS_X} top={6} surface={surfaceY(cold)} color={COLORS.cold} /> : null}
      {hotOn ? <Stream t={t} x={GLASS_X} top={6} surface={surfaceY(hot)} color={COLORS.hot} /> : null}

      {/* slow, wide rings = low pitch; tight, quick rings = high pitch */}
      {coldOn || last ? <Rings t={t} position={[-GLASS_X, surfaceY(cold), 0]} color={COLORS.coldText} rate={1.3} /> : null}
      {hotOn || beatId === ID.reveal || last ? (
        <Rings t={t} position={[GLASS_X, surfaceY(hot), 0]} color={COLORS.hot} rate={4.2} />
      ) : null}

      <Steam t={t} position={[GLASS_X, GLASS_H, 0]} intensity={steam} />
    </group>
  );
};

const MoleculeScene: React.FC<{ t: number }> = ({ t }) => {
  const box: V3 = [2.7, 2.0, 1.8];
  return (
    <group position={MOLECULES}>
      <group position={[0, 1.35, 0]}>
        <GlassBox position={[0, 0, 0]} box={box} color={COLORS.cold} />
        <Molecules t={t} seed="cold" box={box} count={28} speed={0.9} color={COLORS.cold} />
      </group>
      <group position={[0, -1.35, 0]}>
        <GlassBox position={[0, 0, 0]} box={box} color={COLORS.hot} />
        <Molecules t={t} seed="hot" box={box} count={28} speed={4.4} color={COLORS.hot} trails />
      </group>
    </group>
  );
};

/** A large cup seen close up: bubbles in the water, sound bouncing in the air space, and a wave underneath. */
const PourScene: React.FC<{ t: number; center: V3; temp: "cold" | "hot" }> = ({ t, center, temp }) => {
  const hot = temp === "hot";
  const color = hot ? COLORS.hot : COLORS.coldText;
  const S = 1.7;
  const base = -1.3;
  const level = 0.62;
  const topY = base + surfaceY(level) * S; // water surface, about 0.26
  const rimY = base + GLASS_H * S; // about 1.25
  const bottomY = base + 0.06 * S;
  const colH = topY - bottomY;
  const [cx] = center;
  return (
    <group>
      <Glass position={[cx, base, 0]} scale={S} level={level} tint={temp} />
      <Stream t={t} x={cx} top={5.5} surface={topY} color={hot ? COLORS.hot : COLORS.cold} />
      <Bubbles
        t={t}
        seed={temp}
        count={hot ? 70 : 12}
        rMin={hot ? 0.035 : 0.12}
        rMax={hot ? 0.075 : 0.26}
        height={colH * 0.96}
        spread={1.2}
        speed={hot ? 0.55 : 0.32}
        color={hot ? COLORS.hot : COLORS.cold}
        origin={[cx, bottomY + colH / 2, 0]}
      />
      <AirRings
        t={t}
        position={[cx, topY, 0]}
        radius={GLASS_R * S * 0.93}
        height={rimY - topY}
        color={color}
        rate={hot ? 4.2 : 1.3}
      />
      <Rings t={t} position={[cx, rimY, 0]} color={color} rate={hot ? 4.2 : 1.3} maxR={3} />
      <Wave
        t={t}
        position={[cx, -2.55, 0]}
        width={3}
        cycles={hot ? 4.6 : 1.3}
        speed={hot ? 3 : 0.8}
        amp={0.32}
        color={color}
      />
    </group>
  );
};

const FieldScene: React.FC<{ t: number }> = ({ t }) => (
  <group position={FIELD}>
    <CupField t={t} />
    <Glass level={0.86} tint="hot" scale={1.1} />
    <Rings t={t} position={[0, 1.2, 0]} color={COLORS.gold} rate={0.4} speed={5} maxR={42} />
    <pointLight position={[0, 3, 0]} color={COLORS.hot} intensity={25} distance={12} />
  </group>
);

// ------------------------------------------------------------------ the world
export const World: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const id = tl.beatAt(frame).id;
  const kitchen = id === ID.hook || id === ID.cold || id === ID.hot || id === ID.reveal || id === ID.test;

  return (
    <>
      <color attach="background" args={[COLORS.bg]} />
      <fog attach="fog" args={[COLORS.bg, 60, 320]} />
      <ambientLight intensity={1.6} />
      <hemisphereLight args={["#9db7ff", "#1a1450", 1.2]} />
      <directionalLight position={[5, 9, 7]} intensity={3.2} />
      <CameraRig tl={tl} />

      {kitchen ? (
        <>
          <Kitchen tl={tl} t={t} beatId={id} />
          <Dust center={[0, 2, 0]} t={t} />
        </>
      ) : null}
      {id === ID.visc ? (
        <>
          <MoleculeScene t={t} />
          <Dust center={MOLECULES} t={t} />
        </>
      ) : null}
      {id === ID.coldBub ? (
        <>
          <PourScene t={t} center={COLD_CUP} temp="cold" />
          <Dust center={COLD_CUP} t={t} />
        </>
      ) : null}
      {id === ID.hotBub ? (
        <>
          <PourScene t={t} center={HOT_CUP} temp="hot" />
          <Dust center={HOT_CUP} t={t} />
        </>
      ) : null}
      {id === ID.brain ? <FieldScene t={t} /> : null}
    </>
  );
};
