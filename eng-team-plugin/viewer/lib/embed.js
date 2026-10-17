import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const BATCH = 16;

const PKG = '@huggingface/transformers';

/**
 * Directory holding the optional semantic-layer install (`<dir>/node_modules/@huggingface/transformers`): the
 * ENG_VIEW_DEPS_DIR override, else `$CLAUDE_PLUGIN_DATA/viewer-deps` (persists across plugin updates), else null.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|null}
 */
export function depsDir(env = process.env) {
  if (env.ENG_VIEW_DEPS_DIR) return path.resolve(env.ENG_VIEW_DEPS_DIR);
  if (env.CLAUDE_PLUGIN_DATA) return path.join(env.CLAUDE_PLUGIN_DATA, 'viewer-deps');
  return null;
}

/**
 * Find the ESM entry file of the optional package installed under `dir`, or null.
 * @param {string|null|undefined} dir
 * @returns {string|null} absolute file path
 */
export function resolveInstalled(dir) {
  if (!dir) return null;
  const pkgDir = path.join(dir, 'node_modules', ...PKG.split('/'));
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const ex = pkg.exports;
    const entry = ex?.node?.import?.default ?? ex?.node?.import ?? ex?.import?.default ?? ex?.import ?? pkg.module ?? pkg.main;
    if (typeof entry !== 'string') return null;
    const file = path.resolve(pkgDir, entry);
    if (file !== pkgDir && !file.startsWith(pkgDir + path.sep)) return null;
    return fs.existsSync(file) ? file : null;
  } catch {
    return null;
  }
}

/**
 * Import the optional package: from `dir` (see depsDir) when installed there, else the normal bare import.
 * @param {{dir?: string|null, fallback?: () => Promise<any>}} [opts] both injectable for tests
 * @returns {Promise<any>} the module namespace; rejects when not available
 */
export function loadTransformers({ dir = depsDir(), fallback = () => import('@huggingface/transformers') } = {}) {
  const file = resolveInstalled(dir);
  return file ? import(pathToFileURL(file).href) : fallback();
}

/**
 * Create the optional local embedder. Loads `@huggingface/transformers` by
 * dynamic import; returns null (silently) when it is not installed or the
 * model cannot be loaded, so callers fall back to lexical similarity.
 * @param {{cacheDir?: string, load?: () => Promise<any>}} [opts] model cache directory; `load` imports the package (injectable)
 * @returns {Promise<{embed: (texts: string[]) => Promise<Float32Array[]>, model: string}|null>}
 */
export async function createEmbedder({ cacheDir, load = loadTransformers } = {}) {
  try {
    const { pipeline } = await load();
    if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });
    const extractor = await pipeline('feature-extraction', MODEL, cacheDir ? { cache_dir: cacheDir } : {});
    return { model: MODEL, embed: (texts) => embedAll(extractor, texts) };
  } catch {
    return null;
  }
}

async function embedAll(extractor, texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await extractor(batch, { pooling: 'mean', normalize: true });
    const dim = res.dims[res.dims.length - 1];
    for (let j = 0; j < batch.length; j++) out.push(Float32Array.from(res.data.subarray(j * dim, (j + 1) * dim)));
  }
  return out;
}
