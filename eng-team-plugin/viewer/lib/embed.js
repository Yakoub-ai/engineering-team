import fs from 'node:fs';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const BATCH = 16;

/**
 * Create the optional local embedder. Loads `@huggingface/transformers` by
 * dynamic import; returns null (silently) when it is not installed or the
 * model cannot be loaded, so callers fall back to lexical similarity.
 * @param {{cacheDir?: string}} [opts] model cache directory
 * @returns {Promise<{embed: (texts: string[]) => Promise<Float32Array[]>, model: string}|null>}
 */
export async function createEmbedder({ cacheDir } = {}) {
  try {
    const { pipeline } = await import('@huggingface/transformers');
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
