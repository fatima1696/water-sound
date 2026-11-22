import { CalculateMetadataFunction, Easing, interpolate, staticFile } from "remotion";
import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import { ACCENTS, BEATS, FPS, GAP_SEC, LAST_TAIL_SEC, LEAD_SEC, POUR_SEC, TAIL_SEC, WORDS_PER_SECOND } from "./script";

/** `voice[i]` = length in seconds of beat i's voiceover file, or null when there is none. `scene` = render one beat only (null = whole video). */
export type VideoProps = { voice: (number | null)[]; scene: number | null };

export type BeatTiming = {
  index: number;
  id: string;
  text: string;
  pour?: "cold" | "hot";
  startFrame: number;
  durationFrames: number;
  speechStartSec: number;
  speechSec: number;
  hasVoice: boolean;
  pourStartSec: number | null;
};

export type Chunk = { words: { text: string; color?: string }[]; start: number; end: number }; // frames

export type Timeline = {
  beats: BeatTiming[];
  total: number;
  chunks: Chunk[];
  pours: Record<"cold" | "hot", { start: number; end: number }>; // seconds
  beatAt: (frame: number) => BeatTiming;
};

const splitWords = (text: string) => text.replace(/—/g, " ").split(/\s+/).filter(Boolean);
const norm = (w: string) => w.toLowerCase().replace(/[^a-z-]/g, "");

const makeChunks = (b: BeatTiming): Chunk[] => {
  const accents = ACCENTS[b.id] ?? {};
  const groups: string[][] = [];
  let cur: string[] = [];
  for (const w of splitWords(b.text)) {
    const joined = [...cur, w].join(" ");
    // a short word that ends a clause ("up,") may join a full chunk instead of standing alone
    const tailWord = /[.,!?;:]$/.test(w) && w.length <= 4 && joined.length <= 24;
    if (cur.length && ((cur.length >= 3 && !tailWord) || joined.length > (tailWord ? 24 : 22))) {
      groups.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.,!?;:]$/.test(w)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);

  // time is shared out by the number of letters, plus a small pause after punctuation
  const weights = groups.map((g) => g.reduce((s, w) => s + w.length + 1, 0) + (/[.,!?;:]$/.test(g[g.length - 1]) ? 4 : 0));
  const sum = weights.reduce((a, c) => a + c, 0);
  const startF = b.speechStartSec * FPS;
  const lenF = b.speechSec * FPS;
  let acc = 0;
  return groups.map((g, i) => {
    const start = Math.round(startF + (acc / sum) * lenF);
    acc += weights[i];
    const end = Math.round(startF + (acc / sum) * lenF);
    return {
      start,
      end: Math.max(end, start + 1),
      words: g.map((w) => ({ text: w, color: accents[norm(w)] })),
    };
  });
};

export const buildTimeline = (voice: (number | null)[]): Timeline => {
  const beats: BeatTiming[] = [];
  const pours = { cold: { start: 0, end: 0 }, hot: { start: 0, end: 0 } };
  let cursor = 0; // frame

  BEATS.forEach((b, index) => {
    const v = voice[index] ?? null;
    const speechSec = v ?? splitWords(b.text).length / WORDS_PER_SECOND;
    const speechStartSec = cursor / FPS + LEAD_SEC;
    const pourStartSec = b.pour ? speechStartSec + speechSec + GAP_SEC : null;
    const tail = index === BEATS.length - 1 ? LAST_TAIL_SEC : TAIL_SEC;
    const endSec = (pourStartSec !== null ? pourStartSec + POUR_SEC : speechStartSec + speechSec) + tail;
    const durationFrames = Math.max(1, Math.ceil(endSec * FPS) - cursor);
    if (b.pour && pourStartSec !== null) pours[b.pour] = { start: pourStartSec, end: pourStartSec + POUR_SEC };
    beats.push({
      index,
      id: b.id,
      text: b.text,
      pour: b.pour,
      startFrame: cursor,
      durationFrames,
      speechStartSec,
      speechSec,
      hasVoice: v !== null,
      pourStartSec,
    });
    cursor += durationFrames;
  });

  return {
    beats,
    total: cursor,
    chunks: beats.flatMap(makeChunks),
    pours,
    beatAt: (frame) => {
      for (let i = beats.length - 1; i >= 0; i--) if (frame >= beats[i].startFrame) return beats[i];
      return beats[0];
    },
  };
};

/** 0 -> 0.86 while the cup fills. Used for the water level of the cold and the hot glass. */
export const levelAt = (tl: Timeline, kind: "cold" | "hot", t: number) =>
  interpolate(t, [tl.pours[kind].start, tl.pours[kind].end], [0, 0.86], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// ---- reads the length of each voiceover file, so the video length follows the narration ----
const getAudioDuration = async (src: string) => {
  const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(src) });
  return input.computeDuration();
};

export const calculateMetadata: CalculateMetadataFunction<VideoProps> = async ({ props }) => {
  const voice = await Promise.all(
    BEATS.map(async (b) => {
      try {
        const d = await getAudioDuration(staticFile(`voiceover/${b.id}.mp3`));
        return Number.isFinite(d) && d > 0.2 ? d : null;
      } catch {
        return null; // no file for this beat: timing falls back to the word count
      }
    }),
  );
  const tl = buildTimeline(voice);
  const beat = props.scene === null ? null : tl.beats[props.scene];
  return {
    props: { ...props, voice },
    durationInFrames: beat ? beat.durationFrames : tl.total,
  };
};
