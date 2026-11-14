# NAVAZESH — a cinematic music experience

An interactive, black-and-white audiovisual piece for **“Navaesh” by Amir Tataloo**.
React + Vite + TypeScript, Three.js (WebGL), GSAP, Web Audio API.

- Real audio from the supplied MP3, analysed live with an `AnalyserNode` (bass / mid / high / energy / kick).
- Lyrics synced to the supplied JSON with **word-level** timestamps, driven by `audio.currentTime` every frame (no `setTimeout`).
- 9 configurable scenes (camera, light, smoke, orb, particle ring, rain, dust, lyric typography/position).
- Persian RTL, supplied font `Ios_15_Black.ttf`, custom cursor, reduced-motion support, adaptive quality.

## Run on Windows

1. Install **Node.js 18+** (LTS) from https://nodejs.org
2. Open PowerShell in this folder, then:

```powershell
npm install
npm run dev
```

3. Open the URL it prints (normally http://localhost:5173) and click **ENTER**.
   (Browsers require a click before audio can start; the ~4.5 s intro plays after it, then the song begins.)

Production build / local preview:

```powershell
npm run build
npm run preview
```

Optional type check: `npm run typecheck`.

## Deploy to Vercel

**Dashboard:** push the folder to GitHub → https://vercel.com/new → import the repo.
Framework preset *Vite* is detected automatically (Build: `npm run build`, Output: `dist`). Deploy.

**CLI:**

```powershell
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

`vercel.json` only adds long-term caching headers for `/audio` and `/fonts`.
The MP3 is ~9.7 MB, well within Vercel's static file limits.

## Project layout

```
public/
  audio/Amir_Tataloo_-_Navazesh__320_.mp3   original audio (unrenamed)
  data/Amir_Tataloo_-_Navazesh__320_.json   original synced lyrics (unrenamed)
  fonts/Ios_15_Black.ttf                    supplied Persian font
src/
  audio/AudioEngine.ts       <audio> + AnalyserNode, adaptive band normalisation, kick detection
  lyrics/adapter.ts          schema detection + timing sanitiser (word / nested / line-only)
  lyrics/LyricsRenderer.ts   frame-driven, auto-scrolling lyric track (roles: past / active / future, per-word states)
  scenes/scenes.ts           ← the scene timeline: edit start times and parameters here
  scenes/SceneDirector.ts    smooth cross-fades between scenes
  effects/World.ts           Three.js world (fog shader, smoke sprites, orb, ring, dust, rain)
  effects/shaders.ts, textures.ts
  components/                Experience (main loop), Intro, Controls, Cursor, ErrorScreen, …
  styles/global.css
```

## The lyric JSON (as inspected)

A flat array of 313 words: `{ "word", "start", "end", "confidence", "line_index" }`, seconds, 44 lines
(first word at 24.15 s, last at ~228.9 s, instrumental break 91.7 → 106.9 s).
The adapter groups by `line_index`, never alters the text, drops malformed entries, sorts by time,
clamps each word's end to the next word's start (no overlaps), and gives zero-length words a minimum duration.
It also understands nested `{lines:[{words:[…]}]}` files, and **line-only** files (shown without word highlighting —
it never fakes word precision). `confidence` is ignored: the text is shown as supplied.

## Scenes

The song's section structure was not supplied, so scene start times in `src/scenes/scenes.ts`
are derived from the lyric timing (repeated “نه میتونم جلوت…” hooks and the instrumental gaps):
void 0 s · verse 20 s · hook 54.3 s · stillness 91.7 s · verse 2 106.9 s · hook 141.7 s · bridge 159.2 s · final hook 194 s · outro 229 s.
They are plain configuration — retime or retune them freely.

## Controls

Play/pause button (bottom-left, fades when idle) or **Space**. No seek, no time readout; a 1 px progress line sits at the bottom edge.

## Notes

- If WebGL is unavailable or the context is lost, a CSS smoke backdrop is used and lyrics/audio keep working.
- If the lyric file is missing/invalid, a small notice appears and the music + visuals continue.
- If the MP3 is missing/unsupported, an error screen is shown.
- Latin intro text uses Cormorant Garamond, plus Noto Naskh Arabic / Vazirmatn for lyric variety, loaded from Google Fonts with system fallbacks (works offline too, just with fallback fonts).
