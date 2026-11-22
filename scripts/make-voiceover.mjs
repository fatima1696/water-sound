#!/usr/bin/env node
// Makes one voiceover file per beat: public/voiceover/<beat-id>.mp3
// The text comes from src/beats.json, so changing the script there is enough.
//
// Voice provider (picked automatically):
//   1. ElevenLabs  - when the ELEVENLABS_API_KEY environment variable is set
//                    (optional ELEVENLABS_VOICE_ID, default is the premade voice "George")
//   2. edge-tts    - free, no key:  pip install edge-tts   (optional EDGE_VOICE, default en-US-AndrewNeural)
// Force one with VOICE_PROVIDER=elevenlabs|edge.
//
// Your own recording wins: if public/voiceover/<beat-id>.mp3 already exists it is kept.
// Use --force to regenerate. If nothing can be generated the video still renders
// (silent narration, timings estimated from the word count) and the script exits 0.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "voiceover");
mkdirSync(outDir, { recursive: true });

const beats = JSON.parse(readFileSync(join(root, "src", "beats.json"), "utf8"));
const force = process.argv.includes("--force");
const provider = (process.env.VOICE_PROVIDER || (process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "edge")).toLowerCase();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const viaElevenLabs = async (text, file) => {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
};

const viaEdge = async (text, file) => {
  const voice = process.env.EDGE_VOICE || "en-US-AndrewNeural";
  const r = spawnSync(
    "python3",
    ["-m", "edge_tts", "--voice", voice, "--rate=+4%", "--text", text, "--write-media", file],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`edge-tts failed: ${(r.stderr || r.stdout || "").slice(0, 300)}`);
  if (!existsSync(file)) throw new Error("edge-tts produced no file");
};

const generate = provider === "elevenlabs" ? viaElevenLabs : viaEdge;
console.log(`voiceover provider: ${provider}`);

let made = 0;
let kept = 0;
let failed = 0;

for (const beat of beats) {
  const file = join(outDir, `${beat.id}.mp3`);
  if (existsSync(file) && !force) {
    console.log(`keep   ${beat.id}.mp3`);
    kept++;
    continue;
  }
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      await generate(beat.text, file);
      ok = true;
    } catch (err) {
      console.warn(`attempt ${attempt} failed for ${beat.id}: ${err.message}`);
      await sleep(800 * attempt);
    }
  }
  if (ok) {
    console.log(`wrote  ${beat.id}.mp3`);
    made++;
  } else {
    failed++;
    if (made === 0 && kept === 0) {
      // the very first line failed three times: the provider is down or not set up, stop early
      failed = beats.length;
      break;
    }
  }
}

console.log(`voiceover: ${made} made, ${kept} kept, ${failed} failed`);
if (failed > 0) {
  console.log(
    `::warning::Voiceover missing for ${failed} beat(s). The video will render without that narration. ` +
      `Check the log above, or add public/voiceover/<beat-id>.mp3 yourself.`,
  );
}
process.exit(0);
