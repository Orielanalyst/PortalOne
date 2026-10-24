import { resolve } from 'node:path';

const child = Bun.spawn([process.execPath, 'vendor/meterless-world-model/conformance/runner.ts'], {
  env: { ...process.env, WORLD_MODEL_IMPL: resolve('vendor/meterless-world-model/dist/index.js') },
  stdout: 'inherit', stderr: 'inherit',
});
process.exit(await child.exited);
