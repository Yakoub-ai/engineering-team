import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE = path.join(here, 'fixtures', 'project');

/**
 * Copy the fixture project into a fresh temp dir so tests never write into it.
 * @returns {string} absolute path of the copy
 */
export function copyFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-view-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

/** Remove a temp dir created by copyFixture. */
export function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
