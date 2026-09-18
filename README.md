# Raycaster Map Editor

A level editor for [raycaster-386](https://github.com/Laboralphy/raycaster-386),
built on the published library rather than a copy of it.

It replaces `apps/mapedit` from the original `o876-raycaster-engine` — a Vue 2
app whose templates encode years of UX decisions, and whose scripts do not
survive the move to Vue 3. The reasoning, the audit behind it and the plan are
in the library's
[MAPEDIT_ANALYSIS.md](https://github.com/Laboralphy/raycaster-386/blob/master/documentation/MAPEDIT_ANALYSIS.md).

**Status: scaffold.** Step 1 of that plan — prove the dependency — is done.
Nothing is built on it yet.

## Stack

| Piece | Choice |
|---|---|
| Build | Vite 8 |
| UI | Vue 3, Composition API, `<script setup>` |
| State | Pinia |
| Routing | vue-router |
| Language | TypeScript, strict |
| Engine | `@laboralphy/raycaster386` from npm |
| Backend | Koa, four routes — not written yet |

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # vue-tsc typecheck, then a production build
npm run preview   # serve the production build
```

The one route renders a hard-coded level through the library, orbiting slowly.
If that draws, the dependency works in both a dev server and a production
bundle — which is all this scaffold claims.

## Layout

```
src/
  level/demoLevel.ts    the hard-coded level the preview draws
  views/PreviewView.vue the dependency proof: Renderer into a canvas
  stores/preview.ts     Pinia, wired and doing almost nothing yet
  router.ts             one route
  assets/textures/      walls.png and flats.png, from the library's simple demo
```

## The old editor

`_OLD_MAPEDIT_/` holds the original Vue 2 app, copied from
`o876-raycaster-engine/apps/mapedit`. **It is gitignored**: it is a
specification to read, not code to ship, and the library's history already
records what happened the last time a reference tree was committed.

What is worth taking from it, per the analysis:

- **The 38 templates.** Copy the markup, rewrite the script.
- **~730 lines of framework-free canvas code** in `src/libs/` — `block-renderer`
  (306), `silly-canvas-factory` (192), `grid-renderer` (96), `tileset-splitter`
  (37), `append-images` (35). Near-transcription plus types.
- **`append-images` especially**: `@laboralphy/raycaster386/mapedit` needs an
  `ImageAppender` injected, and that file is exactly it for a browser.

`libs/generate` is **not** on the list — it is already ported, and ships as
`@laboralphy/raycaster386/mapedit`.

## What comes next

From the analysis's order, with step 1 done and step 2 shipped in the library:

3. **Type the save format, then build the Pinia store.** The save format is the
   real domain model. `src/mapedit/types.ts` in the library already describes
   it — `MapEditLevel` and friends — because the converter had to read it.
4. **The grid editor.** `LevelGrid.vue` is a fifth of the old component code and
   the thing people actually use.
5. **Everything else**, browser by builder.
6. **Persistence.** The Koa vault, once the shape of what is saved has settled.

## Decisions still open

Settle these before the code that depends on them, not after:

- **How exported textures reach disk.** A level compiles to a JSON plus dozens
  of PNGs, and `generate` now runs in the browser. The analysis recommends the
  client POSTing the blobs to the vault, which keeps RCE-100 exactly as the
  engine expects.
- **Icons.** `@mdi/js` plus a small local `SvgIcon.vue` rather than
  `vue-material-design-icons`, which has never committed to Vue 3 in writing.
- **Whether the editor edits RCE-100 directly** for simple levels.
- **Whether the preview uses `buildObjects`**, so placed things exercise the
  same path a game uses.
- **Whether the editor re-atlases or only compiles.**

## On the library dependency

The editor deliberately consumes `@laboralphy/raycaster386` from npm, not from a
local checkout: it is the library's second consumer and its best test of whether
the API reads well from outside. Gaps found here are library bugs worth fixing
there — `Canvas.text` is already one the analysis names.

When a fix cannot wait for a release, `npm link` the local checkout, but unlink
before committing: a linked build hides packaging mistakes that only the real
tarball reveals.
