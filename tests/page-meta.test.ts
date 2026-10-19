// Audit F68: the page has a description and link-preview tags with absolute URLs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const built = path.resolve(import.meta.dirname, '../client/dist/index.html');

test('index.html has a description and Open Graph / Twitter tags', { skip: !fs.existsSync(built) && 'needs a client build' }, () => {
  const html = fs.readFileSync(built, 'utf8');
  const meta = (attr: string, name: string) => new RegExp(String.raw`<meta\s+${attr}="${name}"\s+content="([^"]+)"`).exec(html)?.[1];
  assert.match(meta('name', 'description') ?? '', /phishing-awareness game/);
  for (const name of ['og:type', 'og:site_name', 'og:url', 'og:title', 'og:description']) assert.ok(meta('property', name), name);
  for (const name of ['twitter:card', 'twitter:title', 'twitter:description']) assert.ok(meta('name', name), name);
  assert.match(meta('property', 'og:url') ?? '', /^https:\/\//, 'og:url is absolute');
});
