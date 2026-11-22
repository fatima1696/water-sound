import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { Captions } from "./Captions";
import { Overlay } from "./Overlay";
import { World } from "./World";
import {
  COLORS,
  MUSIC_VOLUME,
  POUR_SEC,
  POUR_VOLUME,
  SFX,
  VOICE_VOLUME,
  WHOOSH_VOLUME,
} from "./script";
import { buildTimeline, type Timeline, type VideoProps } from "./timeline";

const Soundtrack: React.FC<{ tl: Timeline; voice: (number | null)[] }> = ({ tl, voice }) => {
  const { fps } = useVideoConfig();
  const pourFrames = Math.round(POUR_SEC * fps);
  return (
    <>
      {/* music bed, faded in and out, loops if the video is longer than the file */}
      <Audio
        src={staticFile("audio/bed.wav")}
        loop
        volume={(f) =>
          MUSIC_VOLUME *
          interpolate(f, [0, fps, tl.total - 1.5 * fps, tl.total], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* narration: one file per beat, only where the file exists */}
      {tl.beats.map((b, i) =>
        voice[i] !== null ? (
          <Sequence
            key={`vo-${b.id}`}
            from={Math.round(b.speechStartSec * fps)}
            durationInFrames={Math.ceil((voice[i] as number) * fps) + 2}
            layout="none"
          >
            <Audio src={staticFile(`voiceover/${b.id}.mp3`)} volume={VOICE_VOLUME} />
          </Sequence>
        ) : null,
      )}

      {/* the two pours the video is about */}
      {tl.beats.map((b) =>
        b.pour && b.pourStartSec !== null ? (
          <Sequence key={`pour-${b.id}`} from={Math.round(b.pourStartSec * fps)} durationInFrames={pourFrames} layout="none">
            <Audio
              src={staticFile(`audio/pour-${b.pour}.wav`)}
              trimAfter={pourFrames}
              volume={(f) =>
                POUR_VOLUME *
                interpolate(f, [0, 3, pourFrames - 9, pourFrames], [0, 1, 1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              }
            />
          </Sequence>
        ) : null,
      )}

      {/* whooshes on the big camera moves */}
      {SFX.map((s, i) => {
        const b = tl.beats.find((x) => x.id === s.beat);
        if (!b) return null;
        return (
          <Sequence key={`sfx-${i}`} from={b.startFrame + Math.round(s.at * fps)} durationInFrames={Math.round(1.2 * fps)} layout="none">
            <Audio src={staticFile(s.file)} volume={s.volume ?? WHOOSH_VOLUME} />
          </Sequence>
        );
      })}
    </>
  );
};

export const Video: React.FC<VideoProps> = ({ voice, scene }) => {
  const { width, height } = useVideoConfig();
  const tl = useMemo(() => buildTimeline(voice), [voice]);
  // Scene clips use the very same timeline, just shifted so that frame 0 is the start of the chosen beat.
  const offset = scene === null ? 0 : (tl.beats[scene]?.startFrame ?? 0);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Sequence from={-offset} durationInFrames={tl.total} layout="none">
        <AbsoluteFill>
          <ThreeCanvas width={width} height={height} camera={{ fov: 40, near: 0.1, far: 600, position: [0, 3, 15] }}>
            <World tl={tl} />
          </ThreeCanvas>
        </AbsoluteFill>
        <AbsoluteFill>
          <Captions chunks={tl.chunks} />
          <Overlay tl={tl} />
        </AbsoluteFill>
        <Soundtrack tl={tl} voice={voice} />
      </Sequence>
    </AbsoluteFill>
  );
};
