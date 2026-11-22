import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { COLORS, ID } from "./script";
import type { BeatTiming, Timeline } from "./timeline";

const inter = loadInter("normal", { weights: ["600", "700"], subsets: ["latin"] }).fontFamily;
const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

// Labels are kept few and only name measured values or technical terms (style skill):
//   20 °C, 100 °C, the viscosity counter, LOWER / HIGHER FREQUENCY, and a faint "not to scale" footer.

const useShow = (b: BeatTiming) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - b.startFrame;
  const inn = spring({ frame: local - 6, fps, config: { damping: 14, stiffness: 200 } });
  const out = interpolate(local, [b.durationFrames - 8, b.durationFrames - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return {
    visible: local >= 6 && local < b.durationFrames,
    scale: interpolate(inn, [0, 1], [0.85, 1]),
    opacity: Math.min(inn, out),
    local,
  };
};

const Pill: React.FC<{ beat: BeatTiming; lead?: string; text: string; color: string }> = ({ beat, lead, text, color }) => {
  const { width, height } = useVideoConfig();
  const k = width / 720;
  const s = useShow(beat);
  if (!s.visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: height * 0.13,
        display: "flex",
        justifyContent: "center",
        opacity: s.opacity,
        transform: `scale(${s.scale})`,
      }}
    >
      <div
        style={{
          padding: `${10 * k}px ${26 * k}px`,
          borderRadius: 999,
          background: "rgba(8,10,40,0.6)",
          border: "1px solid rgba(255,255,255,0.35)",
          fontFamily: inter,
          fontWeight: 700,
          fontSize: 28 * k,
          letterSpacing: "0.08em",
          color: "#fff",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {lead ? <span>{lead} </span> : null}
        <span style={{ color }}>{text}</span>
      </div>
    </div>
  );
};

const Viscosity: React.FC<{ beat: BeatTiming }> = ({ beat }) => {
  const { width, height } = useVideoConfig();
  const k = width / 720;
  const s = useShow(beat);
  if (!s.visible) return null;
  // 1.00 mPa·s at 20 °C -> 0.28 mPa·s at 100 °C. The number runs while the camera moves.
  const v = interpolate(s.local, [10, beat.durationFrames * 0.85], [1.0, 0.28], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: height * 0.1,
        textAlign: "center",
        opacity: s.opacity,
        transform: `scale(${s.scale})`,
        color: "#fff",
      }}
    >
      <div style={{ fontFamily: inter, fontWeight: 600, fontSize: 16 * k, letterSpacing: "0.12em", opacity: 0.8 }}>
        WATER VISCOSITY
      </div>
      <div
        style={{
          fontFamily: anton,
          fontSize: 44 * k,
          color: COLORS.amber,
          WebkitTextStroke: `${3 * k}px #000`,
          paintOrder: "stroke fill",
          lineHeight: 1.1,
        }}
      >
        {v.toFixed(2)} <span style={{ fontSize: 24 * k }}>mPa·s</span>
      </div>
      <div style={{ fontFamily: inter, fontWeight: 600, fontSize: 18 * k, letterSpacing: "0.1em", opacity: 0.7 }}>
        20 °C → 100 °C
      </div>
    </div>
  );
};

const Footer: React.FC<{ beat: BeatTiming }> = ({ beat }) => {
  const { width, height } = useVideoConfig();
  const k = width / 720;
  const frame = useCurrentFrame();
  if (frame < beat.startFrame || frame >= beat.startFrame + beat.durationFrames) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: height * 0.92,
        textAlign: "center",
        fontFamily: inter,
        fontWeight: 600,
        fontSize: 14 * k,
        letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.25)",
      }}
    >
      ILLUSTRATION · NOT TO SCALE
    </div>
  );
};

export const Overlay: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const by = (id: string) => tl.beats.find((b) => b.id === id)!;
  return (
    <>
      <Pill beat={by(ID.cold)} text="20 °C" color={COLORS.coldText} />
      <Pill beat={by(ID.hot)} text="100 °C" color={COLORS.hot} />
      <Viscosity beat={by(ID.visc)} />
      <Pill beat={by(ID.coldBub)} lead="Lower" text="frequency" color={COLORS.coldText} />
      <Pill beat={by(ID.hotBub)} lead="Higher" text="frequency" color={COLORS.hot} />
      <Footer beat={by(ID.visc)} />
      <Footer beat={by(ID.coldBub)} />
      <Footer beat={by(ID.hotBub)} />
    </>
  );
};
