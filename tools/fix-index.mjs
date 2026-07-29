#!/usr/bin/env node
/**
 * fetch-guide.mjs 는 목차를 OUT 폴더 안(references/guide/INDEX.md)에 만든다.
 * 스킬은 목차를 references/INDEX.md 에 두므로, 링크 경로를 한 단계 올려 옮긴다.
 *
 *   node fix-index.mjs        (tools/ 에서 실행)
 */
import { readFile, writeFile, rm } from 'node:fs/promises';

const SRC = '../references/guide/INDEX.md';
const DEST = '../references/INDEX.md';

let t = await readFile(SRC, 'utf8');

t = t.replace(/\]\((\d\d-[a-z0-9-]+\.md)\)/g, '](guide/$1)');
t = t.replace(/^# .*$/m, '# 네이버 서치어드바이저 웹마스터 가이드 — 전체 색인');
t = t.replace(
  /^출처: (.*)$/m,
  `출처: $1
라이선스: 아래 문서 본문의 저작권은 네이버(주)에 있습니다. NOTICE.md 참고.`
);

await writeFile(DEST, t);
await rm(SRC, { force: true });

const n = (t.match(/\]\(guide\//g) || []).length;
console.log(`references/INDEX.md 갱신 완료 — 문서 ${n}개`);
