import { describe, expect, it } from 'vitest';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { LevelParseError, parseLevel } from '../../src/domain/parse.ts';

/**
 * Reading a save into the document model.
 *
 * The old `SET_STATE_CONTENT` mutation was `for (key in content) state[key] =
 * content[key]` — no validation, no defaults — so a level missing a key kept
 * the value from the level opened before it, and a malformed file produced a
 * half-broken editor rather than an error. Most of these cases exist because
 * that was true.
 */

/** The smallest thing that parses, to build cases on top of. */
function minimal(): Record<string, unknown> {
    return { grid: [[{}]] };
}

describe('parsing a save', () => {
    it('coerces numbers the old editor stored as strings', () => {
        const level = parseLevel({
            ...minimal(),
            blocks: [
                { id: 1, offs: '16', phys: '2', light: { value: '0.5', inner: '3', outer: '7' } },
            ],
            things: [{ id: 1, size: '30', opacity: '2' }],
            metrics: { tileWidth: '64', tileHeight: '96' },
            ambiance: { fog: { distance: '50' }, brightness: '0.25' },
        });

        expect(level.blocks[0].offs).toBe(16);
        expect(level.blocks[0].phys).toBe(2);
        expect(level.blocks[0].light).toEqual({ enabled: false, value: 0.5, inner: 3, outer: 7 });
        expect(level.things[0].size).toBe(30);
        expect(level.metrics).toEqual({ tileWidth: 64, tileHeight: 96 });
        expect(level.ambiance.fog.distance).toBe(50);
        expect(level.ambiance.brightness).toBe(0.25);
    });

    it('fills in keys a save leaves out, rather than inheriting the last level', () => {
        const level = parseLevel(minimal());
        const empty = createEmptyLevel();
        expect(level.metrics).toEqual(empty.metrics);
        expect(level.flags).toEqual(empty.flags);
        expect(level.time).toEqual(empty.time);
        expect(level.ambiance).toEqual(empty.ambiance);
        expect(level.startpoints).toEqual(empty.startpoints);
        expect(level.preview).toBe('');
    });

    it('reads an absent cell block as empty', () => {
        // Real saves omit the key on empty cells; four cell shapes appear
        // across the four fixtures.
        const level = parseLevel({
            grid: [
                [{ tags: [] }, { block: 3, upperblock: 4 }],
                [{}, {}],
            ],
        });
        expect(level.grid[0][0].block).toBe(0);
        expect(level.grid[0][0].upperblock).toBe(0);
        expect(level.grid[0][1]).toMatchObject({ block: 3, upperblock: 4 });
    });

    it('keeps a null face as null rather than turning it into tile 0', () => {
        const level = parseLevel({
            ...minimal(),
            blocks: [{ id: 1, faces: { n: null, e: 7, w: null, s: null, f: 22, c: null } }],
        });
        expect(level.blocks[0].faces).toEqual({ n: null, e: 7, w: null, s: null, f: 22, c: null });
    });

    it('keeps a CSS colour name on a cell mark', () => {
        // The marker panel writes colour names; the library's type says number.
        const level = parseLevel({ grid: [[{ mark: { color: 'cyan', shape: 3 } }]] });
        expect(level.grid[0][0].mark).toEqual({ color: 'cyan', shape: 3 });
    });

    it('defaults a startpoint z to 1, as the old mutations forced', () => {
        const level = parseLevel({ ...minimal(), startpoints: [{ x: 2, y: 3, angle: 0.5 }] });
        expect(level.startpoints[0]).toEqual({ x: 2, y: 3, angle: 0.5, z: 1 });
    });

    it('labels tiles by the group they were found in when type is missing', () => {
        const level = parseLevel({
            ...minimal(),
            tiles: { walls: [{ id: 1 }], flats: [{ id: 2 }], sprites: [{ id: 3 }] },
        });
        expect(level.tiles.walls[0].type).toBe('wall');
        expect(level.tiles.flats[0].type).toBe('flat');
        expect(level.tiles.sprites[0].type).toBe('sprite');
    });

    it('rejects input that is not a level', () => {
        expect(() => parseLevel(null)).toThrow(LevelParseError);
        expect(() => parseLevel('a string')).toThrow(LevelParseError);
        expect(() => parseLevel({})).toThrow(/grid is empty/);
        expect(() => parseLevel({ grid: [[{}], [{}, {}]] })).toThrow(/not rectangular/);
        expect(() => parseLevel({ grid: [[{}, {}]] })).toThrow(/not square/);
    });

    it('refuses a save version it does not know, rather than guessing', () => {
        // The converter does the same, for the same reason: a guessed
        // conversion produces a level that loads and then behaves wrongly.
        expect(() => parseLevel({ ...minimal(), version: 'MAPEDIT-2' })).toThrow(
            /unknown save version/
        );
        expect(() => parseLevel({ ...minimal(), version: 'MAPEDIT-1' })).not.toThrow();
    });

    it('does not write a version field back', () => {
        // Absence is read as MAPEDIT-1, and preserving absence is what keeps a
        // re-saved level identical to the original.
        expect(parseLevel(minimal())).not.toHaveProperty('version');
    });
});
