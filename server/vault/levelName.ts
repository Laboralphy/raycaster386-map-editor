import { dirname, resolve } from 'node:path';

/**
 * What a level may be called, and where that puts it on disk.
 *
 * The original server had none of this — `VaultFS.fqn()` was a bare
 * `path.join(root, namespace, name)` with the name straight off the request, so
 * `PUT /vault/..%2fpwned` wrote wherever it liked. Every path the vault touches
 * now goes through `levelDir`, which is the only place a request-supplied
 * string becomes a path.
 *
 * The rule is a whitelist rather than a blacklist of `..` and separators: a
 * level directory is one path segment, ASCII, and starts with a letter or a
 * digit. Leading `.` is out so a level can never be a hidden file, and leading
 * `-` so a name can never be read as a flag by anything downstream.
 */

/** One segment: alphanumeric first, then alphanumerics, dot, dash, underscore. */
const LEVEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export class BadLevelName extends Error {
    readonly status = 400;

    constructor(message: string) {
        super(message);
        this.name = 'BadLevelName';
    }
}

/** Whether a string is usable as a level name, without throwing. */
export function isLevelName(name: unknown): name is string {
    return typeof name === 'string' && LEVEL_NAME.test(name);
}

/** The name, or a 400. Returns it so it can be used inline. */
export function assertLevelName(name: unknown): string {
    if (typeof name !== 'string') {
        throw new BadLevelName('the level name is missing');
    }
    if (!LEVEL_NAME.test(name)) {
        throw new BadLevelName(`"${name}" is not a valid level name`);
    }
    return name;
}

/**
 * The directory a level lives in — the single place a name becomes a path.
 *
 * The containment check after `resolve` is redundant given the whitelist, and
 * deliberately so: it is what keeps this function correct if the pattern above
 * is ever loosened.
 */
export function levelDir(root: string, name: unknown): string {
    const safe = assertLevelName(name);
    const base = resolve(root);
    const dir = resolve(base, safe);
    if (dirname(dir) !== base) {
        throw new BadLevelName(`"${safe}" does not resolve inside the vault`);
    }
    return dir;
}
