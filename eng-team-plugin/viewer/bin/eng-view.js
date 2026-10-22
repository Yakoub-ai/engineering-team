#!/usr/bin/env node
import { updateIndex } from '../lib/index.js';
import { start } from '../lib/server.js';
import { createMcp } from '../lib/mcp.js';
import { buildOutputs, OUTPUTS } from '../lib/present.js';
import { resolveProjectDir, setupEmbedder } from '../lib/runtime.js';

const USAGE = 'usage: eng-view <index|serve|mcp|build> [--project <dir>] [--port <n>] [--no-semantic] [--only <a,b>] [--force]';
const DEFAULT_PORT = 4777;

function parseArgs(argv) {
  const opts = { command: null, project: undefined, port: DEFAULT_PORT, semantic: true, only: undefined, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-semantic') opts.semantic = false;
    else if (a === '--force') opts.force = true;
    else if (a === '--only') opts.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--project') opts.project = argv[++i];
    else if (a === '--port') opts.port = Number(argv[++i]);
    else if (a.startsWith('--') || opts.command) throw new Error(`unknown argument: ${a}`);
    else opts.command = a;
  }
  if (!['index', 'serve', 'mcp', 'build'].includes(opts.command)) throw new Error('missing or unknown command');
  if (opts.project === undefined && argv.includes('--project')) throw new Error('--project needs a value');
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) throw new Error('--port must be 0-65535');
  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`eng-view: ${err.message}\n${USAGE}\n`);
    process.exit(2);
  }
  const projectDir = resolveProjectDir(opts.project);
  if (opts.command === 'build') {
    const { theme, results } = buildOutputs(projectDir, { only: opts.only ?? Object.keys(OUTPUTS), force: opts.force });
    process.stdout.write(`eng-view: theme ${theme.name} (${theme.source})\n`);
    for (const r of results) {
      process.stdout.write(`eng-view: ${r.status} ${r.file} (${r.sections} sections, ${r.gaps.length} gaps)\n`);
      for (const g of r.gaps) process.stdout.write(`eng-view: gap ${r.name}: ${g.title} <- ${g.source}\n`);
    }
    return;
  }
  const getEmbedder = () => setupEmbedder(projectDir, { semantic: opts.semantic, cachedOnly: opts.command === 'mcp' });

  if (opts.command === 'mcp') {
    // stdout carries the protocol; keep library chatter off it.
    console.log = console.info = (...args) => console.error(...args);
    await createMcp({ projectDir, getEmbedder }).run();
    return;
  }
  const embedder = await getEmbedder();
  if (opts.command === 'index') {
    const index = await updateIndex(projectDir, { embedder });
    process.stdout.write(`eng-view: indexed ${index.nodes.length} nodes, ${index.edges.length} edges (${index.semantic})\n`);
  } else if (opts.command === 'serve') {
    const { url } = await start({ projectDir, port: opts.port, embedder });
    process.stdout.write(`eng-view: ${url}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`eng-view: ${err.message}\n`);
  process.exit(1);
});
