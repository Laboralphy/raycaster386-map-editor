import type { VaultLevelSummary } from '../../shared/api';

/**
 * Talking to the vault.
 *
 * Ported from `_OLD_MAPEDIT_/src/libs/fetch-helper/index.js`, minus the two
 * calls that no longer exist: `exportLevel` (`PUT /publish/:name`, now a
 * client-side conversion) and `getUserData` (`GET /user.json`, which no server
 * route ever implemented — it 404'd on every load).
 *
 * URLs stay relative so dev and production are identical: in dev Vite proxies
 * `/vault` to the Koa server, in production Koa serves both.
 */

export class VaultError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'VaultError';
        this.status = status;
    }
}

async function request(url: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(url, {
        headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
        ...init,
    });
    if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;
        try {
            const body = (await response.json()) as { error?: string };
            if (typeof body.error === 'string') {
                message = body.error;
            }
        } catch {
            // The body was not the JSON error shape; the status line will do.
        }
        throw new VaultError(response.status, message);
    }
    return response.json();
}

export function listLevels(): Promise<VaultLevelSummary[]> {
    return request('/vault') as Promise<VaultLevelSummary[]>;
}

/** The level as stored, with its images inlined as data URLs. */
export function loadLevel(name: string): Promise<unknown> {
    return request(`/vault/${encodeURIComponent(name)}.json`);
}

export async function saveLevel(name: string, level: unknown): Promise<void> {
    await request(`/vault/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify(level),
    });
}

export async function deleteLevel(name: string): Promise<void> {
    await request(`/vault/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/** The URL of a level's thumbnail. */
export function previewUrl(name: string): string {
    return `/vault/${encodeURIComponent(name)}.jpg`;
}
