#!/usr/bin/env node
// Regenerates public/sitemap.xml and public/robots.txt from the single source of
// truth for languages (core/config/languages.ts) and the public route list below.
//
// Run automatically before every production build (see package.json "prebuild").
// Adding a language to LANGUAGES, or a route to PUBLIC_ROUTES, requires no other edit.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const BASE_URL = 'https://fouriersolver.com';
const DEFAULT_LANG = 'es';

// Mirrors the RenderMode.Prerender entries in src/app/app.routes.server.ts —
// i.e. only routes that are publicly indexable and don't require auth state.
const PUBLIC_ROUTES = [
  { path: 'home', priority: '1.0' },
  { path: 'transforms/continuous', priority: '0.9' },
  { path: 'transforms/dft', priority: '0.7' },
  { path: 'fourier-integral', priority: '0.8' },
  { path: 'laplace', priority: '0.9' },
  { path: 'ode', priority: '0.9' },
  { path: 'grapher', priority: '0.7' },
  { path: 'about', priority: '0.5' },
];

function readLanguageCodes() {
  const source = readFileSync(
    path.join(root, 'src/app/core/config/languages.ts'),
    'utf8',
  );
  const codes = [...source.matchAll(/code:\s*'([a-z]{2})'/g)].map((m) => m[1]);
  if (codes.length === 0) {
    throw new Error('Could not extract language codes from languages.ts');
  }
  return codes;
}

function buildSitemap(langCodes) {
  const alternates = (routePath) =>
    langCodes
      .map(
        (lang) =>
          `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}/${lang}/${routePath}"/>`,
      )
      .join('\n') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/${DEFAULT_LANG}/${routePath}"/>`;

  const urls = PUBLIC_ROUTES.flatMap(({ path: routePath, priority }) =>
    langCodes.map(
      (lang) => `  <url>
    <loc>${BASE_URL}/${lang}/${routePath}</loc>
${alternates(routePath)}
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`,
    ),
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
${urls}
</urlset>
`;
}

function buildRobotsTxt() {
  // Language-agnostic patterns — no per-language duplication needed as langs are added.
  return `User-agent: *

# Private / auth-gated routes
Disallow: /*/auth/
Disallow: /*/admin/
Disallow: /*/profile
Disallow: /*/history
Disallow: /*/dev/

Sitemap: ${BASE_URL}/sitemap.xml
`;
}

const langCodes = readLanguageCodes();
writeFileSync(path.join(root, 'public/sitemap.xml'), buildSitemap(langCodes));
writeFileSync(path.join(root, 'public/robots.txt'), buildRobotsTxt());

console.log(`Generated sitemap.xml and robots.txt for languages: ${langCodes.join(', ')}`);
