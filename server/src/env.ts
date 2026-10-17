import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads the repo-root .env (local only, gitignored) when there is one. Scripts run
 * either from the repo root or from server/, so look in the cwd and its parent.
 * On Railway there is no file; variables already in the environment always win.
 */
export function loadLocalEnv(): void {
  for (const dir of [process.cwd(), path.dirname(process.cwd())]) {
    const file = path.join(dir, '.env');
    if (fs.existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}
