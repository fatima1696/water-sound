#!/usr/bin/env node
// Makes the sound effects and the music bed straight into public/audio/.
//
// Files that already exist are NOT overwritten, so you can drop in your own
// recordings (best: real pours, public/audio/pour-cold.wav and pour-hot.wav)
// and this script will leave them alone. Use --force to regenerate everything.
//
// The pours are synthesized from the physics in the video: a pour is a stream of
// tiny bubble "plinks" (pitch = 3.26 / bubble radius, the Minnaert formula) over a
// hiss and a cup resonance that rises as the cup fills.
//   cold water -> larger bubbles (about 2.6 mm) -> lower pitch, darker hiss
//   hot water  -> smaller bubbles (about 0.9 mm) -> higher pitch, brighter hiss

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "audio");
mkdirSync(outDir, { recursive: true });
const force = process.argv.includes("--force");

// ---------- helpers ----------
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const gaussian = (rand) => {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const rms = (a) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s / a.length) || 1;
};

const normalizeRms = (a, target) => {
  const k = target / rms(a);
  for (let i = 0; i < a.length; i++) a[i] *= k;
};

const normalizePeak = (a, peak) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  const k = m ? peak / m : 1;
  for (let i = 0; i < a.length; i++) a[i] *= k;
};

const writeWav = (name, samples, rate) => {
  const path = join(outDir, name);
  if (existsSync(path) && !force) {
    console.log(`skip   ${name} (already exists)`);
    return;
  }
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
  console.log(`wrote  ${name}  (${(n / rate).toFixed(1)} s, ${(buf.length / 1024).toFixed(0)} KB)`);
};

// ---------- pours ----------
const makePour = (kind, seed) => {
  const rate = 44100;
  const dur = 4.0; // keep in sync with POUR_SEC in src/script.ts
  const n = Math.floor(rate * dur);
  const hot = kind === "hot";
  const rand = mulberry32(seed);

  // 1) hiss: one-pole low-passed noise (hot = brighter)
  const hiss = new Float32Array(n);
  const a = hot ? 0.6 : 0.16;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += a * (rand() * 2 - 1 - lp);
    hiss[i] = lp;
  }

  // 2) cup resonance: band-passed noise, centre frequency rises as the cup fills
  const cav = new Float32Array(n);
  let low = 0;
  let band = 0;
  const damping = 0.035;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f0 = (hot ? 430 : 270) + (hot ? 380 : 270) * (t / dur);
    const f = 2 * Math.sin((Math.PI * f0) / rate);
    const x = rand() * 2 - 1;
    low += f * band;
    const high = x - low - damping * band;
    band += f * high;
    cav[i] = band;
  }

  // 3) bubbles: random plinks, each a decaying chirp at the Minnaert frequency
  const bub = new Float32Array(n);
  const perSec = hot ? 240 : 95;
  const meanR = hot ? 0.9 : 2.6; // bubble radius in millimetres
  const sdLog = hot ? 0.25 : 0.3;
  const tau = hot ? 0.005 : 0.011; // seconds
  for (let i = 0; i < n; i++) {
    if (rand() >= perSec / rate) continue;
    const rMm = Math.exp(Math.log(meanR) + sdLog * gaussian(rand));
    const f0 = 3260 / rMm; // Hz
    const amp = 0.25 + 0.75 * rand() * rand();
    const len = Math.min(n - i, Math.floor(tau * 6 * rate));
    let phase = 0;
    for (let k = 0; k < len; k++) {
      const tt = k / rate;
      const f = f0 * (1 + 0.12 * (1 - Math.exp(-tt / tau)));
      phase += (2 * Math.PI * f) / rate;
      bub[i + k] += amp * Math.exp(-tt / tau) * Math.sin(phase);
    }
  }

  normalizeRms(hiss, 0.1);
  normalizeRms(cav, 0.2);
  normalizeRms(bub, 0.22);

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.min(1, t / 0.08) * Math.min(1, (dur - t) / 0.45);
    out[i] = (hiss[i] + cav[i] + bub[i]) * env;
  }
  normalizePeak(out, 0.85);
  return { samples: out, rate };
};

// ---------- whoosh ----------
const makeWhoosh = () => {
  const rate = 44100;
  const dur = 0.8;
  const n = Math.floor(rate * dur);
  const rand = mulberry32(7);
  const out = new Float32Array(n);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const x01 = i / n;
    const f0 = 300 * Math.pow(2600 / 300, x01);
    const f = 2 * Math.sin((Math.PI * f0) / rate);
    low += f * band;
    const high = rand() * 2 - 1 - low - 0.25 * band;
    band += f * high;
    const env = Math.pow(Math.sin(Math.PI * Math.pow(x01, 0.7)), 2);
    out[i] = band * env;
  }
  normalizePeak(out, 0.8);
  return { samples: out, rate };
};

// ---------- music bed: a soft pad with a few plucks, loops seamlessly every 60 s ----------
const makeBed = () => {
  const rate = 22050;
  const dur = 60;
  const n = rate * dur;
  const out = new Float32Array(n);
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  // every frequency is a multiple of 1/60 Hz so each sine repeats exactly after 60 s
  const q = (f) => Math.round(f * dur) / dur;
  const chords = [
    [45, 52, 60, 64, 67], // Am9
    [41, 48, 57, 60, 64], // Fmaj7
    [48, 55, 60, 64, 67], // C
    [43, 50, 59, 62, 67], // G
  ];
  const chordLen = 7.5;
  const nChords = dur / chordLen; // 8
  const TAU = 2 * Math.PI;

  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let s = 0;
    for (let k = 0; k < nChords; k++) {
      const c = k * chordLen + chordLen / 2;
      let d = ((((t - c + dur / 2) % dur) + dur) % dur) - dur / 2; // circular distance
      if (Math.abs(d) >= chordLen) continue;
      const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / chordLen);
      const chord = chords[k % 4];
      for (let j = 0; j < chord.length; j++) {
        const f = hz(chord[j]);
        s += w * (j === 0 ? 0.9 : 0.5) * (Math.sin(TAU * q(f) * t) + Math.sin(TAU * q(f * 1.003) * t)) * 0.5;
      }
    }
    s *= 1 + 0.15 * Math.sin((TAU * t) / chordLen);
    out[i] = s * 0.12;
  }

  // plucks every 0.75 s, stopping 2 s before the loop point so nothing rings across the seam
  const pattern = [2, 3, 4, 3, 2, 4, 3, 1];
  for (let j = 0; (j + 1) * 0.75 < dur - 2; j++) {
    const t0 = j * 0.75;
    const chord = chords[Math.floor(t0 / chordLen) % 4];
    const f = q(hz(chord[pattern[j % pattern.length]] + 12));
    const start = Math.floor(t0 * rate);
    const len = Math.floor(1.6 * rate);
    for (let k = 0; k < len && start + k < n; k++) {
      const tt = k / rate;
      out[start + k] += 0.05 * Math.exp(-tt * 2.6) * Math.sin(TAU * f * tt);
    }
  }
  normalizePeak(out, 0.6);
  return { samples: out, rate };
};

// ---------- go ----------
for (const [name, make] of [
  ["pour-cold.wav", () => makePour("cold", 11)],
  ["pour-hot.wav", () => makePour("hot", 29)],
  ["whoosh.wav", makeWhoosh],
  ["bed.wav", makeBed],
]) {
  if (existsSync(join(outDir, name)) && !force) {
    console.log(`skip   ${name} (already exists)`);
    continue;
  }
  const { samples, rate } = make();
  writeWav(name, samples, rate);
}
