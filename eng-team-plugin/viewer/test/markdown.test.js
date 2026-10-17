import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../lib/markdown.js';

test('escapes raw HTML and script tags', () => {
  const html = renderMarkdown('# Hi <script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /^<h1>Hi /);
});

test('headings, paragraphs, emphasis and inline code', () => {
  const html = renderMarkdown('## Title\n\nSome **bold** and *it* and `a<b` text\nsecond line\n');
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<p>Some <strong>bold<\/strong> and <em>it<\/em> and <code>a&lt;b<\/code> text second line<\/p>/);
});

test('unordered, ordered and nested lists', () => {
  const html = renderMarkdown('- a\n- b\n  - c\n\n1. one\n2. two\n');
  assert.match(html, /<ul><li>a<\/li><li>b<ul><li>c<\/li><\/ul><\/li><\/ul>/);
  assert.match(html, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
});

test('tables with alignment', () => {
  const html = renderMarkdown('| Name | N |\n|:--|--:|\n| a<b | 1 |\n| c | 2 |\n');
  assert.match(html, /<table><thead><tr><th style="text-align:left">Name<\/th><th style="text-align:right">N<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody><tr><td style="text-align:left">a&lt;b<\/td><td style="text-align:right">1<\/td><\/tr>/);
});

test('code fences keep content verbatim and escaped; mermaid is shown as code', () => {
  const html = renderMarkdown('```js\nconst a = "<b>" && **x**;\n```\n\n```mermaid\ngraph TD; A-->B\n```\n');
  assert.match(html, /<pre><code class="language-js">const a = &quot;&lt;b&gt;&quot; &amp;&amp; \*\*x\*\*;<\/code><\/pre>/);
  assert.match(html, /<code class="language-mermaid">graph TD; A--&gt;B<\/code>/);
});

test('blockquotes and horizontal rules', () => {
  const html = renderMarkdown('> quoted **text**\n> more\n\n---\n');
  assert.match(html, /<blockquote><p>quoted <strong>text<\/strong> more<\/p><\/blockquote>/);
  assert.match(html, /<hr>/);
});

test('in-project links carry data-path resolved against the document', () => {
  const html = renderMarkdown('[spec](../specs/a.md#intro) and [code](../../../src/a.js)', { basePath: 'docs/engineering/plans/p.md' });
  assert.match(html, /<a href="#" data-path="docs\/engineering\/specs\/a\.md">spec<\/a>/);
  assert.match(html, /data-path="src\/a\.js">code<\/a>/);
});

test('links escaping the project, javascript: and data: are not live', () => {
  const html = renderMarkdown('[x](../../../etc/passwd) [y](javascript:alert(1)) [z](data:text/html,hi)', { basePath: 'docs/a.md' });
  assert.ok(!/href="javascript|href="data|data-path="[^"]*etc/.test(html));
  assert.ok(!html.includes('<a '));
});

test('external links open safely and attributes are escaped', () => {
  const html = renderMarkdown('[e](https://example.com/?a=1&b="2")');
  assert.match(html, /<a href="https:\/\/example\.com\/\?a=1&amp;b=&quot;2&quot;" target="_blank" rel="noopener noreferrer">e<\/a>/);
});

test('pure anchors stay in-page and unclosed fences do not throw', () => {
  assert.match(renderMarkdown('[top](#intro)'), /<a href="#intro">top<\/a>/);
  assert.match(renderMarkdown('```\nopen'), /<pre><code>open<\/code><\/pre>/);
});
