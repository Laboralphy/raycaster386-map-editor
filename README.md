# Raycaster Map Editor

A level editor for [raycaster-386](https://github.com/Laboralphy/raycaster-386),
built on the published library rather than a copy of it.

It replaces `apps/mapedit` from the original `o876-raycaster-engine` — a Vue 2
app whose templates encode years of UX decisions, and whose scripts do not
survive the move to Vue 3. The reasoning and the audit behind it are in the
library's
[MAPEDIT_ANALYSIS.md](https://github.com/Laboralphy/raycaster-386/blob/master/documentation/MAPEDIT_ANALYSIS.md).

**Status: phase 4 done — the editor edits.** It opens the four real mansion
levels, holds them in a typed document model, imports and manages their tiles,
builds blocks and thing templates, paints them onto the map with undo and redo,
tags and marks cells, places start points, shifts the map, and writes everything
back in a form the shipped converter still accepts.

What it cannot do yet is show you the level in 3D. That is phase 5.

## Stack

| Piece    | Choice                                   |
| -------- | ---------------------------------------- |
| Build    | Vite 8                                   |
| UI       | Vue 3, Composition API, `<script setup>` |
| State    | Pinia                                    |
| Routing  | vue-router                               |
| Language | TypeScript, strict                       |
| Engine   | `@laboralphy/raycaster386` from npm      |
| Icons    | `@mdi/js` paths + a local `SvgIcon.vue`  |
| Backend  | Koa 3, five vault routes                 |

## Running it

Two processes: the vault server, and Vite proxying `/vault` to it.

```bash
npm install
npm run serve     # the vault on :8080, reading ./vault
npm run dev       # the app on :5173
```

The server runs straight from TypeScript — Node strips the types — so there is
no build step for it, and nothing in `server/` may use syntax that needs
emitted code (no enums, no namespaces, no constructor parameter properties).
`tsconfig.server.json` sets `erasableSyntaxOnly` so that is a type error rather
than a crash at startup.

```bash
npm run check     # typecheck, lint, format, test, build — the pre-commit gate
npm run test      # tests only
npm run build     # production bundle
```

In production the same Koa process serves the built app and the API, so the
client uses the same relative `/vault` URLs either way.

## The vault

A directory of level directories, and the format is inherited — the four levels
the original editor produced load unchanged:

```
vault/<level>/level.json        the document, images replaced by file names
vault/<level>/tiles/<md5>.png   the images
```

The editor holds tile images as inline data URLs; the server splits them out on
save and puts them back on load (`server/vault/blobz.ts`, a port of the
original's `json-blobz`). MD5 naming, two-space JSON indent and key order are a
compatibility contract, not style — `tests/server/vault.test.ts` asserts a
loaded level saves back byte-identical.

`vault/` is **gitignored**, seeded by copying from
`o876-raycaster-engine/_SAVE_FILES/vault/local/maps`. Those four levels are the
only real editor data that exists; copy them, never move them.

Set `MAPEDIT_VAULT` to point elsewhere, `MAPEDIT_PORT` to change the port.

## Layout

```
src/
  domain/        the document model — types, parse, serialise, ids, reference
                 tables. No Vue, no fetch, so its tests run in milliseconds.
  stores/        level.ts (the document) and editor.ts (everything else)
  services/      vaultClient.ts — the four calls the editor makes
  components/    the chrome: WindowFrame, MyButton, SvgIcon, menus, popup
  views/         one per route; NotYetView names the phase that brings the rest
server/          the Koa vault: routes, blob splitting, path validation
shared/api.ts    the one type both sides import
tests/           domain/ and server/ in Node, components/ in happy-dom
```

### The document model

`src/domain/types.ts` narrows the library's `MapEdit*` types so every numeric
field is `number` — real saves store some of them as strings, because the old
editor bound them to text inputs. Narrowing is safe in both directions that
matter, and a compile-time assertion in that file proves an `EditorLevel` is
still a valid `MapEditLevel`, so `serialise()` is a deep clone rather than a
mapper and cannot drift.

Two of the library's types are inaccurate about real saves, and are patched
locally with a note: `MapEditCell.mark.color` is typed `number` but holds CSS
colour names, and `block`/`upperblock` are typed as required but are frequently
absent. Both are worth reporting upstream.

## What it guarantees

`tests/domain/roundtrip.test.ts` is the acceptance test: for each of the four
real levels, the original and the re-saved document are converted through
`convertMapEditLevel` and compared. Identical output means opening a level in
this editor cannot silently change what the engine would load.

`tests/domain/fidelity.test.ts` is stricter — it diffs the documents directly
and fails on any difference outside a reviewed allowlist. The allowlist is
exactly two things: numbers that were stored as strings, and empty cells that
gain an explicit `block: 0`.

## The old editor

`_OLD_MAPEDIT_/` holds the original Vue 2 app, copied from
`o876-raycaster-engine/apps/mapedit`. **It is gitignored**: it is a
specification to read, not code to ship.

Still to take from it:

- **The remaining templates.** Copy the markup, rewrite the script.
  Every component and library the analysis listed is ported. What is left in
  `_OLD_MAPEDIT_` is `RenderView`/`RenderSide` — the 3D preview, which phase 5
  rebuilds on the engine library rather than on the old `Engine`.

`libs/generate` is **not** on the list — it is already ported, and ships as
`@laboralphy/raycaster386/mapedit`.

## Roadmap

| Phase | Work                                                                      |
| ----- | ------------------------------------------------------------------------- |
| 1 ✅  | Chrome, document model, Pinia stores, Koa vault, level list, settings     |
| 2 ✅  | Tiles: splitter, appender, browser, loader, animation builder, `Siblings` |
| 3 ✅  | Blocks and things: block renderer, builders, browsers                     |
| 4 ✅  | The grid, overlays, undo, and the tag, marker, utility and thing panels   |
| 5     | Preview: convert → `loadLevel` → `Renderer` in the browser                |
| 6     | Export to a game directory                                                |
| 7     | Validation surfaced in the UI, then the UX improvements                   |

Bugs in the old editor are fixed as each piece is ported, with a comment naming
the old file. Twelve so far, including: a getter that sorted state in place (so
opening the block browser silently reordered the exported legend); a tile
deletion that left dangling face references, producing a level that could no
longer be exported; a block deletion that cleared the lower storey of a cell but
not the upper; an animation Delete button that threw on every click because its
action and its mutation disagreed about a payload key; an importer that reversed
every sheet it imported; and a splitter that reused one scratch canvas, so a
partial edge tile kept the previous tile's pixels.

**One is user-visible and worth knowing about.** The phys table labelled index 6
"Door right" and index 7 "Door left", but the converter maps 6 to
`@PHYS_DOOR_LEFT` and 7 to `@PHYS_DOOR_RIGHT` — so a door built as "Door right"
in the old editor slid left in the game. The labels are corrected here and
`tests/domain/reference.test.ts` pins the table against the engine's own
constants. Only the text changed: the indices, and therefore every existing
level, are untouched.

## Decisions still open

- **How exported textures reach disk** (phase 6). A level compiles to a JSON
  plus dozens of PNGs, and conversion now runs in the browser. The analysis
  recommends the client POSTing the blobs, which keeps RCE-100 unchanged.
- **Whether the preview uses `buildObjects`**, so placed things exercise the
  same path a game uses.
- **Whether the editor re-atlases or only compiles.**
- **Undo's scope** (phase 4). The old one was 16 snapshots of block painting
  only; whole-document snapshots are out, since one grid alone is 381 KB.

## On the library dependency

The editor deliberately consumes `@laboralphy/raycaster386` from npm, not from a
local checkout: it is the library's second consumer and its best test of whether
the API reads well from outside. Gaps found here are library bugs worth fixing
there — `Canvas.text` is one the analysis names.

When a fix cannot wait for a release, `npm link` the local checkout, but unlink
before committing: a linked build hides packaging mistakes that only the real
tarball reveals.
