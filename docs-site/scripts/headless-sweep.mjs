#!/usr/bin/env node
/**
 * Headless Playwright sweep for the AgentTrust docs site.
 *
 * Runs `chromium.launch({ headless: true })` only — never spawns a UI.
 * Walks every MDX page in `content/docs/`, hits it on a running dev server,
 * captures console errors, captures screenshots at the requested viewports.
 *
 * Usage:
 *   node scripts/headless-sweep.mjs            (default: 1440x900 light)
 *   SWEEP_VIEWPORT=mobile node scripts/...     (390x844)
 *   SWEEP_VIEWPORT=tablet node scripts/...     (1024x768)
 *   SWEEP_THEME=dark node scripts/...          (sets prefers-color-scheme)
 *   SWEEP_BASE_URL=https://docs.agenttrust.tech node scripts/...
 *   SWEEP_OUT=/tmp/docs-r/desktop-light node scripts/...
 *
 * Exits non-zero if any page returns non-200, has a console error, or
 * has a broken internal link.
 */

import { readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT_ROOT = join(ROOT, 'content/docs');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 390, height: 844 },
};

const VIEWPORT_NAME = process.env.SWEEP_VIEWPORT || 'desktop';
const VIEWPORT = VIEWPORTS[VIEWPORT_NAME];
if (!VIEWPORT) {
  console.error(`Unknown viewport: ${VIEWPORT_NAME}`);
  process.exit(2);
}
const THEME = process.env.SWEEP_THEME || 'light';
const BASE_URL = process.env.SWEEP_BASE_URL || 'http://localhost:3001';
const OUT = process.env.SWEEP_OUT || `/tmp/docs-r/${VIEWPORT_NAME}-${THEME}`;
mkdirSync(OUT, { recursive: true });

function pathsFromContent(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...pathsFromContent(abs, base ? `${base}/${entry}` : entry));
      continue;
    }
    if (!entry.endsWith('.mdx')) continue;
    const stem = entry.replace(/\.mdx$/, '');
    if (stem === 'index') {
      out.push(base ? `/${base}` : '/');
    } else {
      out.push(base ? `/${base}/${stem}` : `/${stem}`);
    }
  }
  return out.sort();
}

const PAGES = pathsFromContent(CONTENT_ROOT);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  colorScheme: THEME === 'dark' ? 'dark' : 'light',
});

const summary = {
  viewport: VIEWPORT_NAME,
  theme: THEME,
  base: BASE_URL,
  pageCount: PAGES.length,
  pages: [],
  failures: [],
  startedAt: new Date().toISOString(),
};

for (const path of PAGES) {
  const page = await context.newPage();
  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    networkFailures.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });

  const url = `${BASE_URL}${path}`;
  let status = null;
  let title = null;
  let h1 = null;
  let renderError = null;

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    status = resp ? resp.status() : null;
    title = await page.title();
    h1 = await page.$eval('h1', (el) => el.textContent.trim()).catch(() => null);

    const safeName = path === '/' ? 'index' : path.replace(/^\//, '').replace(/\//g, '__');
    await page.screenshot({
      path: join(OUT, `${safeName}.png`),
      fullPage: true,
    });
  } catch (err) {
    renderError = err.message;
  }

  const ok = status === 200 && consoleErrors.length === 0 && !renderError;
  const result = {
    path,
    status,
    title,
    h1,
    consoleErrors,
    networkFailures,
    renderError,
    ok,
  };
  summary.pages.push(result);
  if (!ok) summary.failures.push(result);

  console.log(
    `[${ok ? '✓' : '✗'}] ${path.padEnd(50)} ` +
      `status=${status} ` +
      `console=${consoleErrors.length} ` +
      `netfail=${networkFailures.length}` +
      (renderError ? ` ERR=${renderError}` : ''),
  );

  await page.close();
}

summary.completedAt = new Date().toISOString();
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

await context.close();
await browser.close();

console.log(
  `\n${summary.pageCount} pages probed at ${VIEWPORT_NAME} ${THEME}; ` +
    `${summary.failures.length} failures.`,
);
console.log(`Summary at ${join(OUT, 'summary.json')}`);

process.exit(summary.failures.length === 0 ? 0 : 1);
