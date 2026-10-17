import fs from 'node:fs';
import path from 'node:path';
import { createEmbedder } from './embed.js';
import { safeCacheDir } from './index.js';

const MODEL_CACHE_PARTS = ['.eng-team', '.cache', 'models'];

/**
 * Resolve the project directory: `--project`, else CLAUDE_PROJECT_DIR, else cwd.
 * @param {string|undefined} flag value of --project
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string} absolute path
 */
export function resolveProjectDir(flag, env = process.env) {
  return path.resolve(flag || env.CLAUDE_PROJECT_DIR || process.cwd());
}

/**
 * Create the one optional embedder shared by every index/search call. Returns
 * null when disabled, when the semantic layer is not installed, or when the
 * models cache path is a symlink or escapes the project (logged to stderr).
 * @param {string} projectDir
 * @param {{semantic?: boolean}} [opts]
 * @returns {Promise<{embed: Function, model: string}|null>}
 */
export async function setupEmbedder(projectDir, { semantic = true } = {}) {
  if (!semantic) return null;
  const root = fs.realpathSync(path.resolve(projectDir));
  let cacheDir;
  try {
    cacheDir = safeCacheDir(root, true, MODEL_CACHE_PARTS);
  } catch (err) {
    process.stderr.write(`eng-team-viewer: cannot prepare models cache: ${err.message}\n`);
  }
  if (!cacheDir) {
    process.stderr.write('eng-team-viewer: running without embeddings (unsafe models cache)\n');
    return null;
  }
  return createEmbedder({ cacheDir });
}
