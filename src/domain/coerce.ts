/**
 * The two numeric coercions, matching the converter's own.
 *
 * `convertMapEditLevel` reads the same fields through `Number(v) | 0` and
 * `parseFloat(String(v))`. Using anything else here — `parseInt`, `Math.round`,
 * `Number()` alone — would make a normalised document convert differently from
 * the save it came from, which is the one guarantee this editor owes.
 */

/** Integer coercion: `Number(v) | 0`, with a fallback for NaN and nullish input. */
export function toInt(value: unknown, fallback = 0): number {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }
    const n = Number(value);
    return Number.isNaN(n) ? fallback : n | 0;
}

/** Float coercion: `parseFloat(String(v))`, with a fallback for NaN. */
export function toFloat(value: unknown, fallback = 0): number {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }
    const n = parseFloat(String(value));
    return Number.isNaN(n) ? fallback : n;
}

export function toBool(value: unknown, fallback = false): boolean {
    return value === undefined || value === null ? fallback : !!value;
}

export function toStr(value: unknown, fallback = ''): string {
    return typeof value === 'string'
        ? value
        : value === undefined || value === null
          ? fallback
          : String(value);
}

/** A tile id, or null for "no tile on this face". */
export function toIdOrNull(value: unknown): number | null {
    return value === null || value === undefined || value === '' ? null : toInt(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}
