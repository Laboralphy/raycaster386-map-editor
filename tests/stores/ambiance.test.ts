import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyLevel, defaultAmbiance } from '../../src/domain/defaults.ts';
import { useLevelStore } from '../../src/stores/level.ts';

/**
 * Ambiance and the level thumbnail.
 *
 * Both are set by phase 5's screens, and both write straight into the document,
 * so what is worth pinning is that they write a *copy* — the old
 * `AmbianceSetup` held a reference to the store's own object and edited the
 * document with every keystroke, so its Apply button had nothing left to do and
 * there was no way to back out of a change.
 */

beforeEach(() => setActivePinia(createPinia()));

function seeded() {
    const store = useLevelStore();
    store.load(createEmptyLevel(1));
    return store;
}

describe('setting the ambiance', () => {
    it('replaces every field', () => {
        const store = seeded();
        store.setAmbiance({
            sky: 'data:image/png;base64,iVBORw0KGgo=',
            fog: { distance: 12, color: '#102030' },
            filter: { enabled: true, color: '#889900' },
            brightness: 40,
        });
        expect(store.doc.ambiance).toEqual({
            sky: 'data:image/png;base64,iVBORw0KGgo=',
            fog: { distance: 12, color: '#102030' },
            filter: { enabled: true, color: '#889900' },
            brightness: 40,
        });
    });

    it('does not keep the caller’s object, so a later edit cannot leak in', () => {
        const store = seeded();
        const draft = defaultAmbiance();
        store.setAmbiance(draft);

        draft.fog.color = '#ff0000';
        draft.brightness = 99;
        draft.filter.enabled = true;

        expect(store.doc.ambiance.fog.color).not.toBe('#ff0000');
        expect(store.doc.ambiance.brightness).not.toBe(99);
        expect(store.doc.ambiance.filter.enabled).toBe(false);
    });

    /**
     * `<input type="number">` hands back a string unless it is coerced, and the
     * converter runs `int()` over these — a string would survive as far as the
     * saved file and compare unequal on a round trip.
     */
    it('coerces numbers that arrived from a form as strings', () => {
        const store = seeded();
        const fromForm = {
            ...defaultAmbiance(),
            fog: { distance: '25' as unknown as number, color: 'black' },
            brightness: '30' as unknown as number,
        };
        store.setAmbiance(fromForm);
        expect(store.doc.ambiance.fog.distance).toBe(25);
        expect(store.doc.ambiance.brightness).toBe(30);
    });
});

describe('the level thumbnail', () => {
    it('is stored on the document, where the vault serves it from', () => {
        const store = seeded();
        store.setPreview('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
        expect(store.doc.preview).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
        expect(store.serialise().preview).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    });
});
