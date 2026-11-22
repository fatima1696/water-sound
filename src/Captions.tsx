import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Anton";
import type { Chunk } from "./timeline";

const { fontFamily } = loadFont("normal", { weights: ["400"], subsets: ["latin"] });

/** "Punch" captions from the style skill: 2-3 words, uppercase, white with a thick outline, one accent colour per concept, quick pop-in, no fade-out. */
export const Captions: React.FC<{ chunks: Chunk[] }> = ({ chunks }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const c = chunks.find((k) => frame >= k.start && frame < k.end);
  if (!c) return null;
  const pop = spring({ frame: frame - c.start, fps, config: { damping: 12, stiffness: 260 } });
  const scale = interpolate(pop, [0, 1], [0.82, 1]);
  const k = width / 720;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: height * 0.76,
        transform: `translateY(-50%) scale(${scale})`,
        textAlign: "center",
        padding: `0 ${40 * k}px`,
        fontFamily: `${fontFamily}, Impact, sans-serif`,
        textTransform: "uppercase",
        fontSize: 56 * k,
        lineHeight: 1.05,
        letterSpacing: 1,
        color: "#fff",
        WebkitTextStroke: `${6 * k}px #000`,
        paintOrder: "stroke fill",
        textShadow: "0 4px 14px rgba(0,0,0,0.6)",
      }}
    >
      {c.words.map((w, i) => (
        <span key={i} style={{ color: w.color ?? "#fff" }}>
          {w.text}{" "}
        </span>
      ))}
    </div>
  );
};
