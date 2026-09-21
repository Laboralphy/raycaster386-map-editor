# Where the editor stands

A handoff note: what works, what to do next, and the things that are not
obvious from the code. Written 2026-09-18, at the end of phase 5.

The README is the project's documentation; this is the "pick it up from here".
If you are a fresh session with no context, read this first, then the README.

---

## Do this first

**The interface was confirmed working in a browser on 2026-09-18**, after the
layout fix. That was the first look at any of it, and it found the bug that
mattered: the app had been rendering only its menu and status bar, with nothing
between them, while all 187 tests passed — happy-dom computes no layout.

So the shell is known good. What is still unverified is the _detail_ of anything
drawn on a canvas: the tests assert _where_ things are drawn, never what they
look like. One small glitch was noticed and judged not worth chasing at the
time; it is not written down, so whoever sees it next should describe it here.

**The 3D preview was confirmed working in a browser on 2026-09-18.** Picture,
WASD, mouse look, wall collision and opening a door with E were all checked by
hand and all work. The one thing that came back wrong was walking pace, and it
is fixed — see below.

It had also been verified headless first: both `mans-test-ai` and `mans-intro`
converted, loaded and rendered outside the app, with correct textures, 63
sprites placed in `mans-intro`, torch lighting, a door sliding from offset 0 to
32, and the camera contained by walls. That used a throwaway harness built on
the library's own `@napi-rs/canvas` shim, and is not in the suite, because
keeping it would mean adding a native dependency here. **Worth considering for
phase 6**: the export path and the preview are the same path, so a golden-image
test of one covers the other.

**Camera speeds are per second, and that is load-bearing.** They were per tick
at first, copied from the library's demos, which tick at 60Hz — but the preview
ticks at the level's own `time.interval`, and all four real levels declare 40ms.
So the camera walked at 80 units a second instead of 192, which is what "a bit
too slow" turned out to mean. Per-tick speeds would also have made a level that
declared a shorter interval walk faster, which is indefensible in an editor: how
fast you cross a map you are inspecting has nothing to do with how fast its
doors slide. `tests/libs/previewPlayer.test.ts` pins a second of walking to the
same distance at 25Hz and at 60Hz.

```bash
cd ~/projects/raycaster386-map-editor
npm run serve     # terminal 1 — the vault, on :8080, reading ./vault
npm run dev       # terminal 2 — the app, on :5173
```

Open `mans-test-ai` first (17×17, 2 blocks — a broken render is obvious), then
`mans-intro` (59×59, 53 blocks, two storeys). Worth a look while you have it
open, roughly in order of how likely I think each is to be wrong:

1. **Do blocks appear on the grid at all?** A field of small red dots means the
   block cache is not hydrating — that dot is the "no block here" marker.
2. **Do clicks land on the cell under the cursor?** The port moved from the old
   non-standard `layerX` to `offsetX`.
3. **Does dragging a selection leave trails?** Only cells believed dirty are
   repainted; smears or stale blue wash mean that bookkeeping is wrong.
4. **Painting**: pick a block in the right-hand panel, choose the pencil tool,
   drag, release.
5. **Zoom, and the upper-floor toggle.** Both force a full redraw, and the
   two-storey ghosting is the fiddliest part of the paint code.
6. **Undo and redo**, including after a paste.
7. The tile browser, block builder and the four side panels — all of them
   render correctly in tests, but nobody has looked at them.

---

## What works

Phases 1 to 5 of the plan are done. The editor opens the four real mansion
levels, holds them in a typed document model, writes them back in a form the
shipped converter still accepts, and renders them as the game would.

| Area                                                         | State                                     |
| ------------------------------------------------------------ | ----------------------------------------- |
| Vault (list, load, save, delete, previews)                   | done, byte-compatible with the old server |
| Document model, parse and serialise                          | done, with the round-trip guarantee below |
| Tiles: import from a sheet, browse, reorder, delete, animate | done                                      |
| Blocks and thing templates: build, browse, delete            | done                                      |
| The grid: paint, select, copy, paste, clear, zoom, resize    | done                                      |
| Undo and redo                                                | done, scoped per change                   |
| Tags, marks, start points, map shifting                      | done                                      |
| 3D preview                                                   | done, verified headless — see above       |
| Ambiance (sky, fog, brightness)                              | done, beside the preview                  |
| **Export to a game directory**                               | **not started — phase 6**                 |

`npm run check` runs typecheck, lint, format, 249 tests and the build. It is the
gate to run before committing.

---

## Next: phase 6, export to a game directory

Phase 5 is done: `/render` runs the level, and `/setup-ambiance` tunes what it
looks like. How it fits together:

```
store.serialise()  →  convertMapEditLevel(save, appendImages)  →  RceLevel
                   →  loadLevel(renderer, rce, { loadImage })
                   →  buildObjects(renderer, loaded, { loadImage })
                   →  renderer.render(x, y, angle, height)
```

- `src/libs/previewWorld.ts` holds the world — renderer underneath, simulation
  above, camera as an actor. No Vue, no timers. Modelled on the library's
  `demos/dark-village/world.ts`, which is the reference for this path.
- `src/views/RenderView.vue` owns the canvas, the frame loop and the keyboard.
- `src/libs/previewPlayer.ts` and `previewInput.ts` are split out because they
  are the only parts testable without a canvas — and movement is worth testing,
  since walking through a wall does not show up in a screenshot.

**The preview is the export path**, which is why phase 6 comes after it: every
time someone looks at a preview, `convertMapEditLevel` runs over the real
document. A preview that draws correctly is the strongest evidence available
that the export will be correct. The compiled level is on the editor store as
`generatedLevel` while the render screen is open, and the side panel already
offers it as a `.json` download — phase 6 is about writing it to a game
directory, not about producing it.

What phase 6 has to decide is where a game directory is and how the editor is
told about it. The old `flags.export` ("publish this level on save") is carried
in the document and surfaced in Settings, but nothing acts on it yet; the old
server did the publishing behind `PUT /publish/:name`, which this server
deliberately does not have.

After that, phase 7 is validation surfaced in the UI plus the UX improvements
deliberately deferred.

Notes that still apply:

- **A new level cannot be previewed.** The converter refuses a level with no
  wall tile and with no flat tile. `src/domain/previewable.ts` asks first and
  says so in words; its test pins it against the converter in both directions,
  so the two cannot drift apart.
- **Converting is not cheap.** `mans-intro` is 59×59 with 98 tiles and the
  appender builds every atlas, so it happens when the screen opens and on no
  other trigger.
- The preview stores a screenshot as the level's `preview` on the way out,
  which is what the vault serves as the thumbnail — it is why the level list
  has pictures.

## The things that are not obvious

**The document model is a structural subtype of the library's wire type.**
`src/domain/types.ts` narrows every `number | string` to `number`, and a
compile-time assertion at the bottom of that file proves an `EditorLevel` is
still a valid `MapEditLevel`. That is what lets `serialise()` be a plain deep
clone instead of a mapper — and a mapper is the thing that would silently drift.
If that assertion ever fails, do not delete it; it is doing its job.

**Two of the library's types are wrong about real saves**, and are patched
locally with a note in `types.ts`: `MapEditCell.mark.color` is typed `number`
but every real save stores CSS colour names, and `block`/`upperblock` are typed
as required but are frequently absent. Both are worth reporting upstream to
`raycaster-386`.

**The guarantee that matters** is `tests/domain/roundtrip.test.ts`: for each of
the four real levels, the original and the re-saved document are converted and
compared. Identical output means opening a level here cannot silently change
what the engine would load. `fidelity.test.ts` is stricter — it diffs the
documents directly and fails on anything outside a reviewed allowlist, which is
exactly two things: numbers that were stored as strings, and empty cells that
gain an explicit `block: 0`.

**The vault's storage contract is inherited, not invented.** MD5 blob names,
two-space JSON indent and key insertion order all have to stay as they are, or
the four existing levels stop round-tripping. `server/vault/blobz.ts` says so,
and `tests/server/vault.test.ts` proves a loaded level saves back byte-identical.

**Undo is scoped.** Each change declares the cells or document slices it
touches, and only those are cloned — a document snapshot per change would copy
381 KB of grid to paint one cell. **Anything a transaction leaves out of its
scope is not restored.** That is the one way to use it wrongly.

**`MyButton` is an `<a>`, and its `href` is a real prop.** The port handled its
click with `@click.stop.prevent`, which cancels exactly the navigation an
`href` exists for — so the render panel's download button, the one call site
that needs it, did nothing at all. The default is now suppressed only for a
button with no `href`. Worth knowing before making it a real `<button>` in the
accessibility pass.

**The drawing libraries take their canvas operations as a dependency**
(`src/libs/canvasOps.ts`). happy-dom has no 2D context, so this is what makes
the splitter, the appender, the block renderer and the grid renderer testable at
all. Anything new that draws should do the same.

**`LevelGridView` cannot be mounted in a test** for that same reason. Its parts
are covered (`useGridPaint` through the renderer's tests, the tools through the
store's), but the component's own wiring is verified only by the typecheck and
by the browser.

---

## Bugs fixed in the old editor

Each is noted in the code against the file it came from.

- `getBlocks` sorted `state.blocks` in place, so merely opening the block
  browser reordered the document — and block order is legend order in the
  exported level.
- `DELETE_TILE` left `block.faces.*` pointing at a deleted id. The converter's
  `buildFace` fails on an unknown face, so the level still edited and previewed
  but could no longer be exported.
- `DESTROY_BLOCK` cleared a cell's lower storey but left `upperblock` naming a
  block that no longer existed.
- `CLEAR_TILE_ANIMATION`'s action sent `{tile}` to a mutation reading `{idTile}`,
  so the animation builder's Delete button threw on every click and never once
  worked.
- `REPLACE_BLOCK_OFFSET` was committed but never implemented; the rescale it was
  meant to do is now part of `setTileSize`.
- The tile importer walked its candidates backwards while pushing forwards, so a
  sheet imported reversed and any animation built from it ran backwards.
- The tileset splitter reused one scratch canvas for the whole sheet, so a
  partial tile at an edge kept the previous tile's pixels.
- `ImageLoader` passed the literal string `"title"` to its button, so every
  import button carried the same tooltip.
- `ThingBuilder` took the light object off the stored thing by reference, so
  editing the form changed the document before saving, and cancelling kept it.
- `REMOVE_CELL_THING` left the cell unmarked, so the grid kept drawing a thing
  that was no longer there.
- The block cache was keyed on block id alone, so an edited block kept its old
  thumbnail until the level was reloaded.
- The tag panel kept a parallel list of "highlighted tags" that could drift from
  what the cells held.
- Removing a start point left `actor.startpoint` — an index, not an id — naming
  a different point.
- `ThingBrowser` carried a `setTileSelection` method referencing a `ref` its
  template never declared and an undeclared variable. Dead on arrival; dropped.
- `AmbianceSetup` assigned the store's own ambiance object to its form, so every
  keystroke was already applied to the document: its Apply button had nothing
  left to do, and there was no way to abandon a change. The same class of bug as
  `ThingBuilder` above. It was also captioned "Animation builder", having been
  copied from that component.
- `AmbianceSetup` let you enable a colour filter without choosing a colour, and
  the converter drops a filter whose colour is empty — so the setting looked
  applied and did nothing. Switching it on now fills in a usable colour.

**One is user-visible and worth knowing about.** The phys table labelled index 6
"Door right" and index 7 "Door left", but `convertMapEditLevel` maps 6 to
`@PHYS_DOOR_LEFT` and 7 to `@PHYS_DOOR_RIGHT` — so a door built as "Door right"
in the old editor slid _left_ in the game. The labels are corrected and
`tests/domain/reference.test.ts` pins the table against the engine's own
constants. Only the text changed; the indices, and therefore every existing
level, are untouched. **Any door built expecting the old label was already
behaving the other way.**

---

## Where things are

```
src/domain/     the document model — no Vue, no fetch, tests run in Node
src/stores/     level.ts (the document), editor.ts (UI), history.ts (undo)
src/libs/       framework-free drawing and the canvas seam
src/composables/ the grid, split three ways
src/components/ the chrome
src/views/      one per route
server/         the Koa vault
tests/          domain, server, libs and stores in Node; components in happy-dom
vault/          the four real levels — gitignored, seeded by copying
_OLD_MAPEDIT_/  the Vue 2 original — gitignored, a specification to read
```

Background reading, in the library repo:

- `documentation/MAPEDIT_ANALYSIS.md` — why the editor is being rebuilt rather
  than migrated, and the audit behind the plan.
- `documentation/functions-and-classes.md` — every export of the engine library.
- The migration plan this followed is at
  `~/.claude/plans/let-s-plan-on-migrating-bubbly-micali.md`.

## Housekeeping

- The engine library is consumed from npm (`@laboralphy/raycaster386@^1.0.0`),
  deliberately: the editor is its second consumer and its best test of whether
  the API reads well from outside. If a fix cannot wait for a release, `npm link`
  the local checkout — but unlink before committing, because a linked build
  hides packaging mistakes only the real tarball reveals.
- The repository is `git@github.com:Laboralphy/raycaster386-map-editor.git`.
  `gh` is not installed on this machine, so pull requests and issues are a
  web-UI job; pushing works over SSH as normal.
- `vault/` is a **copy** of the four mansion levels. The originals are at
  `~/projects/o876-raycaster-engine/_SAVE_FILES/vault/local/maps` and are the
  only copies that exist — never point a writable server at them.
