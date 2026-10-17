const STOP = new Set((
  'the a an and or of to in on for with is are was were be been it this that these those as at by from ' +
  'not no but if then else so we you they he she i our your their its can will should would could may ' +
  'const let var function return import export default new class true false null undefined'
).split(' '));

/**
 * Split text into lowercase terms. Splits camelCase, drops stopwords and
 * single characters.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  const spaced = String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const out = [];
  for (const m of spaced.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const t = m[0];
    if (t.length < 2 || t.length > 40 || STOP.has(t)) continue;
    out.push(t);
  }
  return out;
}

/**
 * Count term frequencies, keeping the `cap` most frequent terms.
 * @param {string[]} tokens
 * @param {number} [cap]
 * @returns {Object<string, number>}
 */
export function termFreq(tokens, cap = 300) {
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, cap);
  return Object.fromEntries(top);
}

function weigh(tf, idf) {
  const vec = {};
  let norm = 0;
  for (const [term, n] of Object.entries(tf)) {
    const w = idf[term];
    if (!w) continue;
    const v = (1 + Math.log(n)) * w;
    vec[term] = v;
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  for (const term of Object.keys(vec)) vec[term] /= norm;
  return vec;
}

/**
 * Build L2-normalised TF-IDF vectors.
 * @param {{id: string, tf: Object<string, number>}[]} entries
 * @returns {{idf: Object<string, number>, vectors: Map<string, Object<string, number>>}}
 */
export function buildTfidf(entries) {
  const df = {};
  for (const { tf } of entries) for (const term of Object.keys(tf)) df[term] = (df[term] || 0) + 1;
  const n = entries.length;
  const idf = {};
  for (const [term, d] of Object.entries(df)) idf[term] = Math.log((1 + n) / (1 + d)) + 1;
  const vectors = new Map(entries.map(({ id, tf }) => [id, weigh(tf, idf)]));
  return { idf, vectors };
}

/**
 * Vectorise a query against an existing idf table.
 * @param {Object<string, number>} idf
 * @param {string} text
 */
export function queryVector(idf, text) {
  return weigh(termFreq(tokenize(text)), idf);
}

/**
 * Cosine similarity of two sparse vectors (objects term -> weight).
 * @param {Object<string, number>} a
 * @param {Object<string, number>} b
 * @returns {number}
 */
export function cosine(a, b) {
  const [small, big] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of Object.entries(small)) if (big[t]) dot += w * big[t];
  const na = Math.sqrt(Object.values(a).reduce((s, w) => s + w * w, 0));
  const nb = Math.sqrt(Object.values(b).reduce((s, w) => s + w * w, 0));
  return na && nb ? dot / (na * nb) : 0;
}

/**
 * Top-k most similar entries per id, via an inverted index.
 * @param {Map<string, Object<string, number>>} vectors normalised vectors
 * @param {{k?: number, threshold?: number, filter?: (a: string, b: string) => boolean}} [opts]
 * @returns {Map<string, {id: string, score: number}[]>}
 */
export function topNeighbours(vectors, { k = 5, threshold = 0.35, filter } = {}) {
  const postings = new Map();
  for (const [id, vec] of vectors) {
    for (const [term, w] of Object.entries(vec)) {
      if (!postings.has(term)) postings.set(term, []);
      postings.get(term).push([id, w]);
    }
  }
  // Very common terms add little signal and make candidate generation O(N^2).
  const maxDf = vectors.size * 0.5;
  for (const [term, list] of postings) if (list.length > maxDf) postings.delete(term);
  const result = new Map();
  for (const [id, vec] of vectors) {
    const acc = new Map();
    for (const [term, w] of Object.entries(vec)) {
      for (const [other, ow] of postings.get(term) || []) {
        if (other !== id) acc.set(other, (acc.get(other) || 0) + w * ow);
      }
    }
    const hits = [];
    for (const [other, score] of acc) {
      if (score >= threshold && (!filter || filter(id, other))) hits.push({ id: other, score });
    }
    hits.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
    result.set(id, hits.slice(0, k));
  }
  return result;
}
