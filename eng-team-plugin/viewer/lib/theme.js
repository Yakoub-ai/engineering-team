import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEMES_DIR = path.join(ROOT, 'themes');
const FONTS_DIR = path.join(ROOT, 'fonts');
const MAX_THEME_BYTES = 16 * 1024;

export const DEFAULT_PRESET = 'clean';
const COLOR_KEYS = ['bg', 'surface', 'text', 'muted', 'accent', 'accent2', 'border', 'codeBg'];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Bundled font families: CSS family name, fallback stack and the woff2 files that ship with the plugin. */
const FONTS = {
  inter: { family: 'Inter', fallback: 'system-ui, sans-serif', files: [[400, 'inter-latin-400-normal.woff2'], [700, 'inter-latin-700-normal.woff2']] },
  'source-serif-4': { family: 'Source Serif 4', fallback: 'Georgia, serif', files: [[400, 'source-serif-4-latin-400-normal.woff2'], [600, 'source-serif-4-latin-600-normal.woff2']] },
  'jetbrains-mono': { family: 'JetBrains Mono', fallback: 'ui-monospace, Menlo, monospace', files: [[400, 'jetbrains-mono-latin-400-normal.woff2']] },
};

export function listPresets() {
  return fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

function readJson(file) {
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.size > MAX_THEME_BYTES) throw new Error(`theme file not usable: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Validate a theme object; returns a clean copy. Colors must be #rrggbb and fonts bundled, so a theme can never inject CSS. */
export function validateTheme(theme) {
  if (!theme || typeof theme !== 'object') throw new Error('theme must be an object');
  const colors = {};
  for (const k of COLOR_KEYS) {
    const v = theme.colors?.[k];
    if (typeof v !== 'string' || !HEX.test(v)) throw new Error(`theme.colors.${k} must be a #rrggbb color`);
    colors[k] = v;
  }
  const fonts = {};
  for (const k of ['heading', 'body', 'mono']) {
    const v = theme.fonts?.[k];
    if (typeof v !== 'string' || !Object.hasOwn(FONTS, v)) {
      throw new Error(`theme.fonts.${k} must be one of: ${Object.keys(FONTS).join(', ')}`);
    }
    fonts[k] = v;
  }
  return { name: String(theme.name ?? 'custom').replace(/[^\w .-]/g, '').slice(0, 40) || 'custom', colors, fonts };
}

export function loadPreset(name) {
  if (!/^[a-z0-9-]+$/.test(name) || !listPresets().includes(name)) {
    throw new Error(`unknown preset "${name}" (available: ${listPresets().join(', ')})`);
  }
  return validateTheme(readJson(path.join(THEMES_DIR, `${name}.json`)));
}

/** A theme file is a full theme, `{"preset": "<name>"}`, or (project file only) `{"use": "shared"}`. */
function fromFile(file) {
  const raw = readJson(file);
  if (raw.use === 'shared') return { use: 'shared' };
  return { theme: raw.preset ? loadPreset(raw.preset) : validateTheme(raw) };
}

/** `~/.eng-team/theme.json` (ENG_TEAM_HOME overrides the folder) is the brand shared across projects. */
export function sharedThemePath() {
  return path.join(process.env.ENG_TEAM_HOME || path.join(os.homedir(), '.eng-team'), 'theme.json');
}

/**
 * Pick the theme for a project: `.eng-team/theme.json` wins unless it says `{"use": "shared"}`,
 * then the shared brand file, then the default preset. Returns `{theme, source}`.
 */
export function resolveTheme(projectDir) {
  const projectFile = path.join(projectDir, '.eng-team', 'theme.json');
  const sharedFile = sharedThemePath();
  const exists = (f) => { try { return fs.lstatSync(f).isFile(); } catch { return false; } };
  if (exists(projectFile)) {
    const r = fromFile(projectFile);
    if (r.theme) return { theme: r.theme, source: 'project' };
    if (!exists(sharedFile)) throw new Error('.eng-team/theme.json says "use": "shared" but no shared theme exists at ' + sharedFile);
  }
  if (exists(sharedFile)) {
    const r = fromFile(sharedFile);
    if (r.theme) return { theme: r.theme, source: 'shared' };
  }
  return { theme: loadPreset(DEFAULT_PRESET), source: 'default' };
}

/** CSS custom properties plus @font-face rules; fonts are inlined as data URIs so output files are self-contained. */
export function themeCss(theme) {
  const t = validateTheme(theme);
  const used = new Set(Object.values(t.fonts));
  let css = '';
  for (const key of used) {
    const f = FONTS[key];
    for (const [weight, file] of f.files) {
      const b64 = fs.readFileSync(path.join(FONTS_DIR, file)).toString('base64');
      css += `@font-face{font-family:'${f.family}';font-weight:${weight};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}\n`;
    }
  }
  const stack = (k) => `'${FONTS[t.fonts[k]].family}', ${FONTS[t.fonts[k]].fallback}`;
  const vars = COLOR_KEYS.map((k) => `--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${t.colors[k]};`);
  vars.push(`--font-heading:${stack('heading')};`, `--font-body:${stack('body')};`, `--font-mono:${stack('mono')};`);
  return `${css}:root{${vars.join('')}}`;
}

/** Palette and font summary for the "copy styles" action (paste into PowerPoint's theme dialogs). */
export function themeSummary(theme) {
  const t = validateTheme(theme);
  const lines = COLOR_KEYS.map((k) => `${k}: ${t.colors[k]}`);
  for (const k of ['heading', 'body', 'mono']) lines.push(`${k} font: ${FONTS[t.fonts[k]].family}`);
  return lines.join('\n');
}
