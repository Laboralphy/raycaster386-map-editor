import { createApp } from './app.ts';
import { readConfig } from './config.ts';

/**
 * Run with `node server/index.ts` — Node 24 strips the types itself, so there
 * is no build step and no dev-only transpiler to keep in step with the build.
 * That is also why nothing in `server/` may use `enum`, `namespace` or
 * constructor parameter properties: type stripping erases, it does not emit.
 */
const config = readConfig();
const app = createApp(config);

app.listen(config.port, () => {
    console.log(`vault  ${config.vaultRoot}`);
    console.log(`listen http://localhost:${config.port}`);
});
