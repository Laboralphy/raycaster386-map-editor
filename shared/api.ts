/**
 * The types the editor and the vault server both speak.
 *
 * Deliberately tiny. The server stores whatever JSON it is handed and knows
 * nothing about the save format — that is what lets the format change without
 * touching the vault.
 */

/** One entry of `GET /vault`. */
export interface VaultLevelSummary {
    name: string;
    /** Last modification, in epoch seconds — the unit the old server used. */
    date: number;
    /** A URL, not a file name: `/vault/<name>.jpg`. */
    preview: string;
}

/** What the mutating routes answer. */
export interface VaultStatus {
    status: 'done';
}
