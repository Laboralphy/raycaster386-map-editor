import { createHash } from 'node:crypto';

/**
 * Images in, file names out — and back again.
 *
 * A port of the original's `libs/json-blobz`. The editor holds every tile as an
 * inline `data:` URL; storing those verbatim would put megabytes of base64 in
 * `level.json` and duplicate a tile for every place it is used. So on the way
 * out each image becomes `<md5 of the bytes>.png`, and on the way in each such
 * name becomes its image again.
 *
 * Three things here are a compatibility contract with the levels the original
 * editor wrote, not style choices:
 *
 *  - the name is the MD5 of the decoded bytes, lowercase hex, `.png` or `.jpg`;
 *  - only `image/png` and `image/jpeg` data URLs are extracted;
 *  - key order survives, because the walk is a `JSON.stringify` replacer and
 *    that visits and rebuilds keys in order.
 *
 * MD5 is a content address here, never a security claim.
 */

/** The blobs a document refers to, by file name. */
export type BlobMap = Map<string, Buffer>;

/** Loads the named blobs. Given every name the document mentions, once. */
export type BlobFetcher = (names: string[]) => Promise<BlobMap>;

export interface Deblobbed {
    /** The document, with each image replaced by its file name. */
    data: unknown;
    /** The images that came out of it, keyed by that file name. */
    blobs: BlobMap;
}

const PREFIX = {
    png: 'data:image/png;base64',
    jpg: 'data:image/jpeg;base64',
} as const;

type BlobType = keyof typeof PREFIX;

/** A stored reference: exactly an md5 and one of the two extensions. */
const BLOB_NAME = /^[0-9a-f]{32}\.(jpg|png)$/i;

export function isBlobName(value: unknown): value is string {
    return typeof value === 'string' && BLOB_NAME.test(value);
}

/**
 * Rebuild a document, mapping every value through `visit`.
 *
 * `JSON.stringify` with a replacer is the original's `walk`, and it is kept for
 * a reason beyond fidelity: it is what guarantees the output is plain JSON data
 * in source key order, so a document that goes out and comes back serialises to
 * the same bytes.
 */
function walk(data: unknown, visit: (value: unknown) => unknown): unknown {
    return JSON.parse(JSON.stringify(data, (_key, value: unknown) => visit(value))) as unknown;
}

function blobType(value: string): BlobType | null {
    if (value.startsWith(PREFIX.png)) {
        return 'png';
    }
    if (value.startsWith(PREFIX.jpg)) {
        return 'jpg';
    }
    return null;
}

function toBinary(dataUrl: string): Buffer {
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

function toDataUrl(blob: Buffer, type: BlobType): string {
    return `${PREFIX[type]},${blob.toString('base64')}`;
}

/** Every blob name the document mentions, each once, in encounter order. */
export function blobNames(data: unknown): string[] {
    const names = new Set<string>();
    walk(data, (value) => {
        if (isBlobName(value)) {
            names.add(value);
        }
        return value;
    });
    return [...names];
}

/** Split the images out of a document. */
export function deblob(data: unknown): Deblobbed {
    const blobs: BlobMap = new Map();
    const stripped = walk(data, (value) => {
        if (typeof value !== 'string') {
            return value;
        }
        const type = blobType(value);
        if (type === null) {
            return value;
        }
        const blob = toBinary(value);
        // The name is the content hash, so the same image used twice is one
        // file, and an unchanged image keeps its name across saves.
        const name = `${createHash('md5').update(blob).digest('hex')}.${type}`;
        blobs.set(name, blob);
        return name;
    });
    return { data: stripped, blobs };
}

/**
 * Put the images back. Rejects if the document names a blob `fetch` did not
 * return — a level referring to a file that is not there is corrupt, and
 * silently handing back the bare name would look like a tile called `a1b2….png`.
 */
export async function reblob(data: unknown, fetch: BlobFetcher): Promise<unknown> {
    const blobs = await fetch(blobNames(data));
    return walk(data, (value) => {
        if (!isBlobName(value)) {
            return value;
        }
        const blob = blobs.get(value);
        if (blob === undefined) {
            throw new Error(`error while fetching resource "${value}"`);
        }
        return toDataUrl(blob, value.toLowerCase().endsWith('.jpg') ? 'jpg' : 'png');
    });
}
