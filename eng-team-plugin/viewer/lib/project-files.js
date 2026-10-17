import fs from 'node:fs';
import path from 'node:path';
import { classify, scanProject } from './scan.js';

/**
 * Validate a client-supplied project-relative path.
 * @param {unknown} input
 * @returns {string|null} normalised posix path, or null when it is empty,
 *   absolute, contains `..`, NUL or backslashes
 */
export function cleanRel(input) {
  if (typeof input !== 'string' || !input || input.includes('\0') || input.includes('\\')) return null;
  if (input.startsWith('/') || input.split('/').includes('..')) return null;
  const rel = path.posix.normalize(input);
  return rel === '.' || rel.startsWith('../') ? null : rel;
}

/**
 * Spec B6: only `.md` files under `docs/` and `.eng-team/*.md` except `state.md`.
 * @param {string} rel clean project-relative path
 * @returns {boolean}
 */
export function isEditablePath(rel) {
  if (!rel.endsWith('.md')) return false;
  if (rel.startsWith('docs/')) return true;
  return /^\.eng-team\/[^/]+\.md$/.test(rel) && rel !== '.eng-team/state.md';
}

/**
 * Resolve a clean relative path to an absolute path that is guaranteed not to
 * pass through any symlink (so it cannot leave the project or be redirected to
 * another file). `realRoot` must itself be a realpath.
 * @param {string} realRoot
 * @param {string} rel
 * @returns {string|null} absolute path, or null when missing or reached via a symlink
 */
export function resolveNoSymlink(realRoot, rel) {
  const abs = path.join(realRoot, rel);
  try {
    if (fs.realpathSync(abs) !== abs || !fs.statSync(abs).isFile()) return null;
    return abs;
  } catch {
    return null;
  }
}

/**
 * True when the file is one the scanner indexes (spec B8 exclusions). Uses the
 * index first and falls back to a fresh scan for files created since.
 * @param {string} realRoot
 * @param {{files?: object}} index
 * @param {string} rel
 * @returns {boolean}
 */
export function isIndexedFile(realRoot, index, rel) {
  if (!classify(rel)) return false;
  if (index?.files?.[rel]) return true;
  return scanProject(realRoot).some((f) => f.path === rel);
}
