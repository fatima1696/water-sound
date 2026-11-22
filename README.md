# You can hear the temperature of water

Remotion + Three.js short (1080x1920, 30 fps, about 62-68 s). Style: `science-short-style` skill
(punch captions, constant camera motion, few labels, loops back to the opening shot).

## Render on GitHub
1. Push this whole folder to a GitHub repository (the `.github` folder must be included).
2. Optional, better voice: Settings > Secrets and variables > Actions > New repository secret
   `ELEVENLABS_API_KEY`. Without it the free `edge-tts` voice is used.
3. Actions tab > **Render video** > **Run workflow**.
   - `scale` = `0.5` for a quick preview, `1` for the final video.
   - `scenes` = on to also get every scene as its own clip.
4. When the run finishes, download from the run page > Artifacts: `water-sound-full` and `scene-1` ... `scene-9`.
   The `assets` artifact holds the voiceover and sounds that were used.

Private repository? Each job uses Actions minutes. Untick `scenes` to render only the full video.

## Edit
| What | Where |
|---|---|
| The spoken script | `src/beats.json` (keep the `id`s) |
| Volumes, timing, colours, caption colours, whooshes | `src/script.ts` |
| Camera moves | `RIGS` in `src/World.tsx` |
| Scenes (cups, bubbles, molecules, cup field) | `src/World.tsx` and `src/parts.tsx` |
| Labels (20 °C, 100 °C, viscosity counter, frequency) | `src/Overlay.tsx` |

## Your own sound
Files that already exist are never overwritten:
- Real pours: put `pour-cold.wav` and `pour-hot.wav` in `public/audio/` (cut to `POUR_SEC` = 4 s).
- Your own narration: `public/voiceover/<beat-id>.mp3`, one file per beat (ids in `src/beats.json`).
  The video length follows the narration automatically.

## Run on your own computer
```
npm install
npm run voiceover   # optional, needs ELEVENLABS_API_KEY or: pip install edge-tts
npm run dev         # Remotion Studio, compositions WaterSound and Scene-1 ... Scene-9
npm run render      # writes out/water-sound.mp4
```
