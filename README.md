# naver-seo-expert

**네이버 검색(서치어드바이저) SEO 전문가 AI 스킬.**
Claude·Cursor 등 AI 에이전트에 설치하면, 네이버 공식 웹마스터 가이드 **55개 문서 전문**을 근거로 네이버 SEO를 다룬다.

> A Claude Skill that turns any AI agent into a Naver Search (Search Advisor) SEO expert, grounded in the full official Korean webmaster guide.

Claude Code에서는 플러그인으로 **두 줄이면 설치**된다 → [설치](#설치)

---

## 왜 필요한가

AI에게 "네이버 SEO 봐줘"라고 하면 대부분 **구글 SEO 지식을 그대로 답한다.** 네이버는 다르다.

| | 네이버 | 구글 |
|---|---|---|
| 검색로봇 | **Yeti** | Googlebot |
| 웹마스터 도구 | **서치어드바이저** | Search Console |
| 고유 메타값 | **`nosourceinfo`** (AI 출처설명 제외) | 없음 |
| 즉시 색인 | **IndexNow** (`searchadvisor.naver.com/indexnow`) | Indexing API |
| robots.txt 5xx | **전체 수집 차단** | 대체로 캐시 사용 |

이 스킬은 추측 대신 **원문을 읽고 출처(`guid`)를 밝히며** 답하도록 강제한다.
가이드에 없는 용어(C-Rank, D.I.A.+, 최적화 지수, 저품질 등)는 "공식 가이드에 없는 개념"이라고 명시하게 되어 있다.

## 무엇이 들어있나

```
SKILL.md                  스킬 본문 — 라우팅 표, 워크플로, 하드 룰
.claude-plugin/           Claude Code 플러그인 매니페스트 (이 저장소 = 마켓플레이스)
references/
  INDEX.md                55개 문서 카테고리별 색인
  guide/                  네이버 공식 가이드 원문 55개 (Markdown)
scripts/
  audit.mjs               URL 하나를 가이드 기준으로 점검 (의존성 0, Node 18+)
tools/
  fetch-guide.mjs         네이버 원문 재수집 (문서 갱신용)
```

각 원문은 front matter에 `guid` · `source`(원문 URL) · `updated`(네이버가 명시한 수정일)를 갖는다.
수집 시점: **2026년 7월**.

## 설치

### Claude Code (권장) — 플러그인

이 저장소가 곧 마켓플레이스다. **실행 중인 Claude Code 세션의 입력창에** 아래 두 줄을 차례로 친다.
(터미널이 아니라 Claude Code 안이다. `>` 프롬프트가 뜬 상태에서 `/`로 시작하는 명령이다.)

```
/plugin marketplace add JaceProgramming/naver-seo-expert
```
```
/plugin install naver-seo-expert@naver-seo-expert
```

`/plugin` 명령이 목록에 없으면 Claude Code가 구버전이다. `claude update` 로 올린 뒤 다시 시도한다.

<details>
<summary>터미널에서 설치하기 (Claude Code를 안 켜고)</summary>

```bash
claude plugin marketplace add JaceProgramming/naver-seo-expert
claude plugin install naver-seo-expert@naver-seo-expert
```
</details>

**설치 확인** — 세션에서 `/plugin` 을 열면 `naver-seo-expert` 가 enabled 로 보인다.
터미널에서는 `claude plugin list` 로도 확인된다. 목록에 안 뜨면 `/reload-plugins` 또는 세션 재시작.

설치하면 네이버 SEO 관련 질문에서 **자동으로 활성화**된다. `/naver-seo-expert` 로 직접 부를 수도 있다.
업데이트·비활성화·삭제는 모두 `/plugin` 에서 한다.

<details>
<summary>플러그인 대신 스킬로 직접 설치하기</summary>

플러그인 시스템을 쓰고 싶지 않다면 스킬 디렉터리에 그냥 클론해도 된다.

```bash
git clone https://github.com/JaceProgramming/naver-seo-expert.git \
  ~/.claude/skills/naver-seo-expert
```

프로젝트 단위로만 쓰려면 `<프로젝트>/.claude/skills/naver-seo-expert` 에 클론한다.
설치 후 `/skills` 로 목록에서 확인할 수 있다. 업데이트는 `git pull`.
</details>

### Claude 앱 (claude.ai / 데스크톱)

1. 이 저장소를 zip으로 내려받는다 ([Code → Download ZIP](https://github.com/JaceProgramming/naver-seo-expert/archive/refs/heads/main.zip))
2. 압축을 풀고, `SKILL.md`가 최상위에 있는 폴더째로 다시 압축한다
3. Settings → Capabilities → Skills → Upload

### 그 외 AI 도구 (Cursor, Windsurf, Copilot 등)

스킬 형식을 지원하지 않아도 된다. 저장소를 클론한 뒤 **`SKILL.md`를 컨텍스트에 넣고, `references/guide/`를 읽을 수 있게** 해주면 동일하게 동작한다.

## 사용

설치하면 관련 질문에서 자동으로 활성화된다.

```
사이트가 네이버 검색에 안 나옵니다. https://example.com 점검해주세요
```
```
우리 쇼핑몰에 네이버 구조화된 데이터 넣으려는데 뭘 써야 하나요?
```
```
robots.txt 이렇게 쓰면 Yeti가 수집할 수 있나요?
```
```
이 블로그 글이 네이버 스팸 정책에 걸릴 소지가 있는지 봐주세요
```

### 진단 스크립트 단독 실행

AI 없이도 쓸 수 있다.

```bash
node scripts/audit.mjs https://example.com
node scripts/audit.mjs https://example.com --json
```

점검 항목 — 리다이렉트 체인 · HTTP 상태 · `X-Robots-Tag` · robots.txt(응답코드/Content-Type/Yeti 규칙/Sitemap) · title · description · canonical · 로봇 메타 · 오픈그래프 · **og:image 실측(150×150 초과, 5,000 byte 이상, 3:1 이내)** · viewport · 파비콘 · 구조화된 데이터 · SPA 렌더링 의존 · 이미지 alt · **Yeti UA와 브라우저 UA 응답 비교(방화벽 차단·클로킹 탐지)**

페이지 경로만 보는 도구들이 놓치는 항목도 본다:

- **구성 리소스 차단** — 페이지는 허용인데 CSS/JS/이미지가 `Disallow`에 걸리는 경우. 로봇이 문서를 온전히 해석하지 못한다 (`resource-and-link`). Yeti 전용 그룹 덕분에만 열려 있는 상태면 그 의존성 자체를 경고한다.
- **apex ↔ www robots.txt 분기** — robots 규칙은 호스트별로만 유효하다. 한쪽이 `Disallow: /`면 그 호스트 URL은 통째로 죽는데 다른 쪽 설정으로는 구제되지 않는다.
- **`User-agent :` 느슨한 문법** — 표준상 허용이지만 엄격한 파서는 그 줄을 버린다. Yeti 그룹이 이 형태면 사이트 수집 정책 전체가 파서 관용도에 걸린다.
- **크롤 불가 링크** — `href="javascript:..."`는 로봇이 새 URL을 발견하는 경로를 끊는다.
- **프로토콜 혼용** — HTTPS 페이지가 동일 호스트를 `http://`로 참조하는 리소스.

결과는 **차단 → 색인 → 표현 → 참고** 순으로 정렬된다. og:image 비율보다 robots.txt 5xx가 먼저다.

<details>
<summary>출력 예시</summary>

```
네이버 SEO 점검 — https://example.com
근거: 네이버 서치어드바이저 웹마스터 가이드 (references/guide/)

🔴 수집·색인 차단
  · robots.txt가 503를 반환합니다. 네이버는 5xx를 "모두 허용하지 않음"으로 해석합니다.  [seo-basic-robots]
    → 서버 오류를 해결하세요. 이 상태로는 사이트 전체가 수집 차단됩니다.

🟠 색인 품질
  · canonical이 상대 경로입니다: "/article/1". 가이드는 절대 경로를 요구합니다.  [markup-structure]
    → <link rel="canonical" href="https://example.com/article/1">

🟡 검색결과 표현
  · og:image 비율이 4.20:1 입니다. 가이드 기준은 3:1 이내입니다.  [markup-content]

요약: 차단 1 / 색인 1 / 표현 1 / 참고 8
```
</details>

`[대괄호]` 안은 근거가 된 네이버 원문의 `guid`다. `references/guide/`에서 바로 찾아볼 수 있다.

## 가이드 원문 갱신

네이버가 문서를 고치면 다시 받을 수 있다.

```bash
cd tools
npm install
npm run list      # 목차·수정일만 확인 (네트워크 1회)
npm run refresh   # references/guide/ 전체 재수집 + 색인 갱신
```

원문은 Nuxt SSR 페이지에서 직접 파싱하므로 브라우저가 필요 없다.
`npm run list`의 `수정 YYYY-MM-DD` 값을 현재 `references/INDEX.md`와 비교하면 변경된 문서만 골라낼 수 있다.

## 한계

- 이 스킬은 **공식 가이드에 적힌 것만** 안다. 네이버 랭킹 알고리즘은 공개되어 있지 않고, 이 스킬도 모른다.
- 구조화된 데이터를 정확히 마크업해도 **검색결과 반영은 보장되지 않는다** (네이버 명시).
- 채용정보(`JobPosting`)·동영상(`VideoObject`)은 **제휴 없이는 마크업만으로 노출되지 않는다.**
- `audit.mjs`는 기계적으로 확인 가능한 것만 본다. 콘텐츠 품질·스팸 소지·실제 순위는 판정하지 않는다.
- 서치어드바이저 [사이트 간단 체크]와 [URL 검사]로 교차검증할 것.

## 라이선스

- **스킬 지침·스크립트** (`SKILL.md`, `scripts/`, `tools/`, `README.md`) — [MIT](LICENSE)
- **`references/guide/` 원문** — 저작권은 네이버(주)에 있다. 학습·참조 목적의 재배포이며, 각 파일은 원문 URL을 `source`로 보존한다. 자세한 내용은 [NOTICE.md](NOTICE.md).

이 프로젝트는 네이버(주)와 무관하며 공식 제공물이 아니다.

## 기여

원문 갱신 PR, 오탐 신고, 진단 항목 추가 환영. 다만 **가이드에 근거가 없는 SEO 팁은 받지 않는다** — 이 스킬의 존재 이유가 그것이기 때문이다.
