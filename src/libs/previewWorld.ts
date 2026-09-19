import {
    Renderer,
    SpriteBinding,
    buildObjects,
    loadLevel,
    worldToCell,
    type ActorFrame,
    type LoadedLevel,
    type PlacedObject,
    type RceLevel,
} from '@laboralphy/raycaster386';
import { ActorRegistry, DoorPolicy, type Actor } from '@laboralphy/raycaster386/simulation';
import type { PreviewInput } from './previewInput';
import { PreviewPlayerThinker, type PreviewContext } from './previewPlayer';

/**
 * The level, running.
 *
 * The same shape as the library's `demos/dark-village/world.ts`, which is the
 * reference for this path: a renderer underneath, the simulation tier above it,
 * and a camera that is an actor like any other. Deliberately free of Vue and of
 * timers — `RenderView.vue` owns the canvas, the frame loop and the keyboard,
 * and this owns the world.
 *
 * What it is not is a game. There are no entities, no thinkers but the
 * camera's, and the level's tags are ignored: an editor preview answers "does
 * this level look and move the way I meant it to", and everything past that
 * belongs to whatever eventually plays it.
 */

/** Decodes a texture the level names. As `LoadLevelOptions.loadImage`. */
export type LoadImage = (src: string) => Promise<HTMLCanvasElement>;

/** How close the camera must be to a door to open it, in world units. */
const REACH = 96;
/** Keeps the camera off the walls, in world units. */
const CAMERA_RADIUS = 12;
/** How long an opened door waits before closing itself, in ticks. */
const DOOR_MAINTAIN = 180;

/** Where the camera starts when the level declares no usable start point. */
const FALLBACK_START = { x: 1, y: 1, z: 1, angle: 0 };

export class PreviewWorld {
    readonly renderer = new Renderer();
    readonly actors = new ActorRegistry<PreviewContext>();
    readonly binding: SpriteBinding;

    /** Eye height, as the level's start point declares it. */
    cameraHeight = 1;

    private _doors: DoorPolicy | null = null;
    private _camera: Actor<PreviewContext> | null = null;
    private _loaded: LoadedLevel | null = null;
    private _objects: readonly PlacedObject[] = [];
    private _spacing = 64;
    private _time = 0;
    /** Milliseconds per tick, which is also the animation clock. */
    private _tickMs = 1000 / 60;

    constructor() {
        this.binding = new SpriteBinding(this.renderer);
    }

    /** Sizes the render surface. Must be called before {@link build}. */
    setScreen(width: number, height: number): void {
        this.renderer.setScreen({ width, height });
    }

    /**
     * Reads the level, places its scenery, and puts the camera in it.
     *
     * Async because `loadLevel` decodes textures, which is I/O the library
     * refuses to do itself — `loadImage` is handed in, as everywhere else in
     * this codebase that touches a canvas.
     *
     * Smoothing and storey stretching are *not* set here: `loadLevel` applies
     * both from the level's own `textures` section, and setting them again
     * afterwards would quietly override the document's flags.
     *
     * @param tickMs the document's `time.interval` — the simulation and
     * animation clock, so a level's animations run at the speed it declares
     */
    async build(data: RceLevel, loadImage: LoadImage, tickMs: number): Promise<void> {
        const renderer = this.renderer;
        const loaded = await loadLevel(renderer, data, { loadImage });
        this._loaded = loaded;
        this._spacing = data.level.metrics.spacing;
        this._tickMs = tickMs > 0 ? tickMs : 1000 / 60;

        // Scenery: sprites at positions, with their animations and lights.
        // This is the half of the export path nothing else in the editor looks
        // at, so a thing that converts wrongly shows up here first.
        this._objects = await buildObjects(renderer, loaded, { loadImage });

        // One sector per cell, so "what is standing here" is a lookup — which
        // is what the door occupancy check below asks.
        this.actors.setSectors(renderer.getMapSize(), this._spacing);

        this._doors = new DoorPolicy({
            map: renderer.cellMap,
            metrics: data.level.metrics,
            maintainDuration: DOOR_MAINTAIN,
            isCellOccupied: (x, y) => this.actors.actorsAt(x, y).length > 0,
        });

        // A level saved before any start point was placed carries the editor's
        // `{-1, -1}` placeholder, which would drop the camera outside the map.
        const declared = loaded.startpoint;
        const start =
            declared !== null && declared.x >= 0 && declared.y >= 0 ? declared : FALLBACK_START;
        this.cameraHeight = start.z;
        this._camera = this.actors.spawn({
            x: (start.x + 0.5) * this._spacing,
            y: (start.y + 0.5) * this._spacing,
            angle: start.angle,
            size: CAMERA_RADIUS,
            ref: 'camera',
        });
        this._camera.thinker = new PreviewPlayerThinker();
    }

    get camera(): Actor<PreviewContext> {
        if (this._camera === null) {
            throw new Error('PreviewWorld: build() has not run yet');
        }
        return this._camera;
    }

    get doors(): DoorPolicy {
        if (this._doors === null) {
            throw new Error('PreviewWorld: build() has not run yet');
        }
        return this._doors;
    }

    /** True once {@link build} has finished and a frame can be drawn. */
    get ready(): boolean {
        return this._camera !== null;
    }

    /** Milliseconds per simulation tick, from the document's `time.interval`. */
    get tickMs(): number {
        return this._tickMs;
    }

    /** The scenery this level placed, as `buildObjects` returned it. */
    get objects(): readonly PlacedObject[] {
        return this._objects;
    }

    get loaded(): LoadedLevel | null {
        return this._loaded;
    }

    /** The cell the camera is standing in. */
    get cell(): { x: number; y: number } {
        const p = this.camera.position;
        return worldToCell(p.x, p.y, this._spacing);
    }

    private context(input: PreviewInput): PreviewContext {
        return {
            map: this.renderer.cellMap,
            spacing: this._spacing,
            time: this._time,
            // The camera's speeds are per second, so the tick has to say how
            // much of a second it is. See `previewPlayer.ts`.
            dt: this._tickMs / 1000,
            input,
        };
    }

    /**
     * The cell directly in front of the camera.
     *
     * Probed from the camera's own position and facing rather than read off
     * the centre ray: that ray passes *through* a transparent block and reports
     * the opaque wall behind it, so a secret passage built on one could never
     * be opened by looking at it.
     */
    facedCell(): { x: number; y: number } {
        const p = this.camera.position;
        const probe = this._spacing * 0.75;
        return worldToCell(
            p.x + Math.cos(p.angle) * probe,
            p.y + Math.sin(p.angle) * probe,
            this._spacing
        );
    }

    /**
     * The door the camera is looking at and standing near, if any.
     *
     * This one does use the centre ray: a door is opaque, so the ray stops on
     * it, and a door you can see is a door you can ask to open.
     */
    aimedDoor(): { x: number; y: number } | null {
        const aimed = this.renderer.aimedCell;
        if (aimed === null || !this.doors.isDoor(aimed.xCell, aimed.yCell)) {
            return null;
        }
        const p = this.camera.position;
        const dx = aimed.x - p.x;
        const dy = aimed.y - p.y;
        if (dx * dx + dy * dy > REACH * REACH) {
            return null;
        }
        return { x: aimed.xCell, y: aimed.yCell };
    }

    /** Opens the door the camera is facing, if there is one. */
    use(): boolean {
        const door = this.aimedDoor() ?? this.facedCell();
        return this.doors.openDoor(door.x, door.y, true) !== null;
    }

    /** Advances the world one tick. */
    update(input: PreviewInput): void {
        ++this._time;

        const frame: ActorFrame = this.actors.process(this.context(input));

        if (input.use) {
            this.use();
        }

        // Door state is produced as plain data and applied by whoever owns
        // both tiers — which is this class, and is why the renderer stays a
        // pure function of world state.
        for (const { x, y, offset, phys } of this.doors.process()) {
            this.renderer.setCellOffset(x, y, offset | 0);
            this.renderer.setCellPhys(x, y, phys);
        }

        this.binding.apply(frame, this.camera.position);

        // The renderer holds animation frames but advances nothing itself, so
        // the clock is the simulation's — which keeps an animation showing the
        // same frame at the same tick however the browser paced the display.
        this.renderer.computeAnimations(this._tickMs);
    }

    /** Draws the current state into the renderer's own canvas. */
    render(): void {
        const p = this.camera.position;
        this.renderer.render(p.x, p.y, p.angle, this.cameraHeight);
    }

    /** The last frame as a data URL, for the level's thumbnail. */
    screenshot(width: number, height: number, type = 'image/jpeg'): string {
        return this.renderer.screenshot(width, height, type);
    }
}
