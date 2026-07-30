#!/usr/bin/env node
/**
 * 네이버 서치어드바이저 웹마스터 가이드 원문 수집기
 *
 * 사이트가 Nuxt 2 SSR이라 브라우저가 필요 없다.
 *  - 전체 목차: 아무 가이드 페이지 HTML에 박힌 window.__NUXT__ 페이로드의 guideList
 *  - 본문: 같은 HTML의 .markdown-body 컨테이너 (이미 서버에서 렌더됨)
 *
 * 사용법
 *   node fetch-guide.mjs --list      목차만 출력 (네트워크 1회)
 *   node fetch-guide.mjs             out/ 에 페이지별 .md + INDEX.md 저장
 *   node fetch-guide.mjs --html      위와 동일 + out/_html/ 에 원본 HTML 보존
 *
 * ── 이 파일은 두 곳에 산다 ──────────────────────────────────────────────
 *   정본  naver-doc-fetchers/searchadvisor/fetch-guide.mjs        (로컬 수집기 모음)
 *   사본  naver-searchadvisor-expert 리포의 tools/fetch-guide.mjs  (공개 스킬. references/guide/ 재수집용)
 *
 * 두 파일은 바이트 동일하게 유지한다 — 배선(OUT 경로)만 각자 package.json 에서 다르게 준다.
 * 한쪽을 고쳤으면 반드시 다른 쪽에 복사하고 `diff` 로 확인할 것.
 */

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import path from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const BASE = 'https://searchadvisor.naver.com';
const SEED = process.env.SEED || `${BASE}/guide/seo-basic-intro`;
const OUT = process.env.OUT || 'out';
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const args = new Set(process.argv.slice(2));
const LIST_ONLY = args.has('--list');
const SAVE_HTML = args.has('--html');

/* ---------------------------------------------------------------- fetching */

async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries) throw new Error(`${url} → ${err.message}`);
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

/* ------------------------------------------------------------ nuxt payload */

/**
 * window.__NUXT__ 는 압축된 IIFE 형태다:
 *   window.__NUXT__=(function(a,b,c,...){return {...}}(1,"publish",...));
 * JSON.parse 로는 못 읽으니 격리된 vm 컨텍스트에서 평가한다.
 */
function extractNuxt(html) {
  const start = html.indexOf('window.__NUXT__');
  if (start === -1) throw new Error('window.__NUXT__ 를 찾지 못했습니다 (SSR 구조가 바뀌었을 수 있음)');
  const end = html.indexOf('</script>', start);
  const src = html.slice(start, end === -1 ? undefined : end);

  const sandbox = { window: {} };
  createContext(sandbox);
  runInContext(src, sandbox, { timeout: 5000 });
  return sandbox.window.__NUXT__;
}

/** guideList 가 payload 어디에 있든 찾아낸다 (data[0] 위치가 바뀌어도 견디도록). */
function findGuideList(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node.guideList)) return node.guideList;
  for (const v of Object.values(node)) {
    const hit = findGuideList(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function buildDocList(guideList) {
  const docs = [];
  for (const cat of guideList) {
    const category = cat.menuItemName || cat.termName || '(미분류)';
    for (const item of cat.subItemList || []) {
      if (!item.guid) continue;
      if (item.postStatus && item.postStatus !== 'publish') continue;
      if (docs.some((d) => d.guid === item.guid)) continue; // 카테고리 중복 노출 방지
      docs.push({
        guid: item.guid,
        title: item.postTitle || item.guid,
        category,
        updated: item.postModified ? new Date(item.postModified).toISOString().slice(0, 10) : '',
        created: item.postCreated ? new Date(item.postCreated).toISOString().slice(0, 10) : '',
        url: `${BASE}/guide/${item.guid}`,
      });
    }
  }
  return docs;
}

/* ------------------------------------------------------- html → markdown */

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});
turndown.use(gfm);

// <br> 를 줄바꿈으로 (기본은 공백으로 뭉갬)
turndown.addRule('lineBreak', {
  filter: 'br',
  replacement: () => '  \n',
});

function extractBody(html, doc) {
  const $ = cheerio.load(html);
  const body = $('.markdown-body').first();
  if (!body.length) return null;

  // 사이드바/네비게이션이 섞여 들어오는 경우 대비
  body.find('.v-navigation-drawer, nav, script, style, .v-toolbar').remove();

  // 상대 경로를 절대 URL 로 (나중에 원문 대조 가능하도록)
  body.find('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('/')) $(el).attr('href', BASE + href);
  });
  body.find('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.startsWith('/')) $(el).attr('src', BASE + src);
    else if (src && src.startsWith('//')) $(el).attr('src', 'https:' + src);
  });

  const md = turndown.turndown(body.html() || '').trim();
  if (!md) return null;

  const pageTitle = ($('title').text() || '').replace(/\s*-\s*네이버 서치어드바이저\s*$/, '').trim();

  return { md, pageTitle: pageTitle || doc.title };
}

function frontMatter(doc, pageTitle) {
  const esc = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
  return [
    '---',
    `title: ${esc(pageTitle)}`,
    `category: ${esc(doc.category)}`,
    `guid: ${esc(doc.guid)}`,
    `source: ${esc(doc.url)}`,
    `updated: ${esc(doc.updated)}`,
    `created: ${esc(doc.created)}`,
    '---',
    '',
  ].join('\n');
}

/* -------------------------------------------------------------- run pool */

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ------------------------------------------------------------------ main */

const seedHtml = await get(SEED);
const nuxt = extractNuxt(seedHtml);
const guideList = findGuideList(nuxt);

if (!guideList) {
  await writeFile('nuxt-debug.json', JSON.stringify(nuxt, null, 2));
  console.error('guideList 를 찾지 못했습니다. nuxt-debug.json 을 확인하세요.');
  process.exit(1);
}

const docs = buildDocList(guideList);
console.log(`목차 ${docs.length}개 문서 / ${guideList.length}개 카테고리\n`);

if (LIST_ONLY) {
  let cat = '';
  docs.forEach((d, i) => {
    if (d.category !== cat) {
      cat = d.category;
      console.log(`\n## ${cat}`);
    }
    console.log(`  ${String(i + 1).padStart(2, '0')}. ${d.title}  (${d.guid}, 수정 ${d.updated})`);
  });
  console.log();
  process.exit(0);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
if (SAVE_HTML) await mkdir(path.join(OUT, '_html'), { recursive: true });

const pad = String(docs.length).length;
const failed = [];

await pool(docs, CONCURRENCY, async (doc, i) => {
  const n = String(i + 1).padStart(pad, '0');
  try {
    const html = doc.url === SEED ? seedHtml : await get(doc.url);
    if (SAVE_HTML) await writeFile(path.join(OUT, '_html', `${doc.guid}.html`), html);

    const extracted = extractBody(html, doc);
    if (!extracted) throw new Error('.markdown-body 본문이 비어 있음');

    const file = `${n}-${doc.guid}.md`;
    await writeFile(
      path.join(OUT, file),
      `${frontMatter(doc, extracted.pageTitle)}# ${extracted.pageTitle}\n\n${extracted.md}\n`
    );
    doc.file = file;
    doc.chars = extracted.md.length;
    console.log(`  ✓ ${file}  (${extracted.md.length}자)`);
  } catch (err) {
    failed.push({ ...doc, error: err.message });
    console.log(`  ✗ ${doc.guid}  ${err.message}`);
  }
});

/* ----------------------------------------------------------------- index */

const lines = [
  '# 네이버 서치어드바이저 웹마스터 가이드',
  '',
  `출처: ${BASE}/guide`,
  `수집 문서: ${docs.filter((d) => d.file).length} / ${docs.length}`,
  '',
];
let cat = '';
for (const d of docs) {
  if (!d.file) continue;
  if (d.category !== cat) {
    cat = d.category;
    lines.push('', `## ${cat}`, '');
  }
  lines.push(`- [${d.title}](${d.file}) — \`${d.guid}\`, 수정 ${d.updated}`);
}
if (failed.length) {
  lines.push('', '## 수집 실패', '');
  for (const f of failed) lines.push(`- ${f.guid}: ${f.error}`);
}
await writeFile(path.join(OUT, 'INDEX.md'), lines.join('\n') + '\n');

const total = docs.reduce((s, d) => s + (d.chars || 0), 0);
console.log(`\n완료: ${docs.length - failed.length}/${docs.length}개, 총 ${total.toLocaleString()}자 → ${OUT}/`);
if (failed.length) process.exitCode = 1;
