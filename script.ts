import beatsJson from "./beats.json";

// ------------------------------------------------------------------
// Single place for everything you may want to tweak.
// The spoken script itself lives in src/beats.json (also used by scripts/make-voiceover.mjs).
// ------------------------------------------------------------------

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Speaking speed used for a beat that has no voiceover file yet (the style references run at about 2.8-3 words/s). */
export const WORDS_PER_SECOND = 2.9;
export const LEAD_SEC = 0.12; // silence before a line starts
export const GAP_SEC = 0.2; // pause between a line and the pour sound that follows it
export const TAIL_SEC = 0.22; // breathing room at the end of a beat
export const LAST_TAIL_SEC = 1.0; // hold on the final frame
/** Length of one pour sound. Longer recordings are cut to this; generated ones are exactly this long. */
export const POUR_SEC = 4.0;

export const VOICE_VOLUME = 1;
export const POUR_VOLUME = 0.9;
export const WHOOSH_VOLUME = 0.35;
export const MUSIC_VOLUME = 0.14;

export const COLORS = {
  bg: "#0c092c", // deep violet-navy
  cold: "#5babf9",
  coldDeep: "#1f61d9",
  coldText: "#6cc4ff",
  hot: "#ff8a3d",
  hotDeep: "#e8501f",
  gold: "#e0c28d",
  amber: "#f5b73a",
  ice: "#bfe6ff",
};

export type Beat = { id: string; text: string; pour?: "cold" | "hot" };
export const BEATS = beatsJson as unknown as Beat[];

/** Beat ids as used by the scenes. If you rename an id in beats.json, rename it here too. */
export const ID = {
  hook: "01-hook",
  cold: "02-cold",
  hot: "03-hot",
  reveal: "04-reveal",
  visc: "05-viscosity",
  coldBub: "06-cold-bubbles",
  hotBub: "07-hot-bubbles",
  brain: "08-brain",
  test: "09-test",
} as const;

/** Caption accent colours: lower-case word (letters and hyphen only) -> colour. One concept, one colour. */
export const ACCENTS: Record<string, Record<string, string>> = {
  [ID.hook]: { hear: COLORS.coldText, temperature: COLORS.amber, sound: COLORS.coldText },
  [ID.cold]: { listen: COLORS.coldText },
  [ID.hot]: { compare: COLORS.amber },
  [ID.reveal]: { boiling: COLORS.hot, steam: COLORS.hot },
  [ID.visc]: { viscosity: COLORS.amber, faster: COLORS.hot, thinner: COLORS.hot, syrupy: COLORS.coldText },
  [ID.coldBub]: { cold: COLORS.coldText, thicker: COLORS.coldText, larger: COLORS.coldText, deeper: COLORS.coldText, "lower-frequency": COLORS.coldText },
  [ID.hotBub]: { hot: COLORS.hot, thinner: COLORS.hot, smaller: COLORS.hot, higher: COLORS.hot, pitch: COLORS.amber },
  [ID.brain]: { thousands: COLORS.amber, heat: COLORS.hot },
  [ID.test]: { kitchen: COLORS.amber, tonight: COLORS.amber },
};

/** Sound effects. `at` = seconds after the beat starts. Files live in public/audio. */
export const SFX: { beat: string; at: number; file: string; volume?: number }[] = [
  { beat: ID.hook, at: 0.1, file: "audio/whoosh.wav" },
  { beat: ID.reveal, at: 0.4, file: "audio/whoosh.wav" },
  { beat: ID.visc, at: 0.0, file: "audio/whoosh.wav" },
  { beat: ID.brain, at: 0.0, file: "audio/whoosh.wav" },
  { beat: ID.test, at: 0.0, file: "audio/whoosh.wav" },
];
