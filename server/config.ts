import { resolve } from 'node:path';

/**
 * Where the vault is and what port to listen on.
 *
 * The vault root is the directory that directly contains level directories.
 * The original server nested them under `<user>/maps`; that namespace went away
 * with the decision that this editor is single-user.
 */
export interface Config {
    vaultRoot: string;
    port: number;
    /** The built SPA, served in production. */
    staticDir: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
    return {
        vaultRoot: resolve(env.MAPEDIT_VAULT ?? './vault'),
        port: Number(env.MAPEDIT_PORT ?? 8080),
        staticDir: resolve(env.MAPEDIT_STATIC ?? './dist'),
    };
}
