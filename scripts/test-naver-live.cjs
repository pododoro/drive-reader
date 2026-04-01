const fs = require('fs');
const path = require('path');

const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const fixturesPath = path.resolve(__dirname, '..', '..', 'reference', 'naver-fixtures.json');

function normalize(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

function diffLines(actual, expected) {
  const actualLines = normalize(actual).split('\n');
  const expectedLines = normalize(expected).split('\n');
  const max = Math.max(actualLines.length, expectedLines.length);
  for (let i = 0; i < max; i += 1) {
    const a = actualLines[i] ?? '';
    const e = expectedLines[i] ?? '';
    if (a !== e) {
      return { line: i + 1, actual: a, expected: e };
    }
  }
  return null;
}

function userAgentForEntry(entry) {
  if (entry.userAgent) {
    return entry.userAgent;
  }

  if ((entry.label ?? '').toLowerCase().includes('desktop')) {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  }

  return ua;
}

function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#xa0;/gi, ' ');
}

function stripHtmlToText(html) {
  return decodeHtmlEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\u200b/g, ' '));
}

function extractParagraphs(html) {
  const matches = html.matchAll(/<p[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi);
  const paragraphs = [];
  for (const match of matches) {
    const text = stripHtmlToText(match[1] ?? '').replace(/[ \t]+/g, ' ').trim();
    if (text) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

function cleanParagraphs(paragraphs, title) {
  const normalizedTitle = normalize(title);
  const titleLine = `${normalizedTitle} : 네이버 블로그`;
  const metaNoise = new Set([
    '본문 바로가기',
    '블로그',
    '검색',
    'MY메뉴 열기',
    '본문 기타 기능',
    '본문 폰트 크기 조정',
    '본문 폰트 크기 작게 보기',
    '본문 폰트 크기 크게 보기',
    '공유하기',
    'URL복사',
    '신고하기',
    '닫기',
    '카테고리 이동',
    '카테고리',
    '카테고리 메뉴',
    '이 블로그 홈',
    '이웃추가',
    '이웃추가하고 새글을 받아보세요',
    '추천글',
    '관련글',
    '공감',
    '칭찬',
    '감사',
    '웃김',
    '놀람',
    '슬픔',
    '댓글',
    'NAVER',
    '메르의 블로그',
    '주절주절',
    '메르',
    '취소',
    'Preview',
    '블로그 주소 변경이 불가합니다.',
    '블로그 주소 변경 불가 안내',
    '자세히 보기',
    '블로그 아이디가 필요해요!',
    '블로그에서 진짜 나를 기록하고',
    '다양한 이웃과 소식을 만나보세요. 지금 시작해볼까요?',
    '블로그 아이디 만들기',
    '블로그 아이디 만들기 레이어 닫기',
    '레이어 닫기',
  ]);

  const output = [normalizedTitle];
  let started = false;

  for (const raw of paragraphs) {
    const line = normalize(raw.replace(/\u200b/g, ''));
    if (!line) continue;

    if (
      line.startsWith('{') ||
      /&#\d+;/.test(line) ||
      /"title"\s*:/.test(line) ||
      /"source"\s*:/.test(line) ||
      /blog\.naver\.com/.test(line) ||
      /^https?:\/\/(?:m\.)?blog\.naver\.com/i.test(line) ||
      /^blog\.naver\.com$/i.test(line)
    ) {
      break;
    }

    if (started && line.endsWith(': 네이버 블로그') && !line.startsWith(normalizedTitle)) {
      break;
    }

    if (normalizedTitle && (line === normalizedTitle || line === titleLine || line.includes(normalizedTitle))) {
      continue;
    }

    if (metaNoise.has(line)) {
      continue;
    }

    if (/^\d+\s*(분|시간|일|주|개월)\s*전$/.test(line)) continue;
    if (/^[^ ]+\([^()]+\)$/.test(line)) continue;
    if (/^수익,시스템,투자 인사이트$/.test(line)) continue;
    if (/^1인기업가/.test(line)) continue;
    if (/^바닐라라떼$/.test(line)) continue;

    if (!started) {
      if (/^From,/i.test(line) || /[.!?~]/.test(line) || /\p{Script=Han}{2,}/u.test(line) || line.length > 20) {
        started = true;
        output.push(line);
      }
      continue;
    }

    output.push(line);
  }

  return output.join('\n\n').trim();
}

async function main() {
  if (!fs.existsSync(fixturesPath)) {
    console.error(`Missing fixture manifest: ${fixturesPath}`);
    process.exit(1);
  }

  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  const selected = Array.isArray(fixtures)
    ? fixtures.filter((entry) => {
        if (process.env.NAVER_URLS) {
          const urls = process.env.NAVER_URLS.split(/[,\n]/).map((value) => value.trim()).filter(Boolean);
          return urls.length === 0 || urls.includes(entry.url);
        }
        if (process.env.NAVER_URL) {
          return entry.url === process.env.NAVER_URL;
        }
        return true;
      })
    : [];

  if (selected.length === 0) {
    console.error('No fixtures matched the provided filter.');
    process.exit(1);
  }

  let failed = false;
  for (const entry of selected) {
    const expectedPath = path.resolve(__dirname, '..', '..', 'reference', entry.expected);
    if (!fs.existsSync(expectedPath)) {
      console.error(`Missing expected fixture for ${entry.label ?? entry.url}: ${expectedPath}`);
      failed = true;
      continue;
    }

    const entryUa = userAgentForEntry(entry);
    const res = await fetch(entry.url, { headers: { 'User-Agent': entryUa, Accept: 'text/html' } });
    if (!res.ok) {
      console.error(`fetch failed for ${entry.label ?? entry.url}: ${res.status}`);
      failed = true;
      continue;
    }

    const html = await res.text();
    const title = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1] ?? 'Naver Blog';
    const actual = cleanParagraphs(extractParagraphs(html), title);
    const expected = fs.readFileSync(expectedPath, 'utf8');
    const mismatch = diffLines(actual, expected);

    if (mismatch) {
      failed = true;
      console.error(`Mismatch for ${entry.label ?? entry.url} at line ${mismatch.line}`);
      console.error(`actual  : ${mismatch.actual}`);
      console.error(`expected: ${mismatch.expected}`);
    } else {
    console.log(`PASS ${entry.label ?? entry.url}`);
    }
  }

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
