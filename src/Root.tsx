import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";
import { BEATS, FPS, HEIGHT, WIDTH } from "./script";
import { calculateMetadata } from "./timeline";

const common = {
  component: Video,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: 1800, // placeholder, calculateMetadata sets the real length from the narration
  calculateMetadata,
};

export const RemotionRoot: React.FC = () => (
  <>
    {/* the whole video */}
    <Composition id="WaterSound" {...common} defaultProps={{ voice: [], scene: null }} />
    {/* one clip per beat: Scene-1 ... Scene-9 */}
    {BEATS.map((b, i) => (
      <Composition key={b.id} id={`Scene-${i + 1}`} {...common} defaultProps={{ voice: [], scene: i }} />
    ))}
  </>
);
