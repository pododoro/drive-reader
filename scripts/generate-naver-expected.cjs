const fs = require('fs');
const path = require('path');

const url = 'https://m.blog.naver.com/ranto28/224205523591';
const outPath = path.resolve(__dirname, '..', '..', 'reference', 'naver-2026-03-31.expected.txt');
const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

function normalizeText(text) {
  return String(text)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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
  return decodeHtmlEntities(
    html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\u200b/g, ' ')
  );
}

function extractSmartEditorParagraphTexts(html) {
  const matches = html.matchAll(/<p[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi);
  const paragraphs = [];

  for (const match of matches) {
    const text = normalizeText(stripHtmlToText(match[1] ?? ''));
    if (text) {
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

function cleanParagraphs(paragraphs, title) {
  const normalizedTitle = normalizeText(title);
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
    const line = normalizeText(raw.replace(/\u200b/g, ''));
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

(async () => {
  const res = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'text/html' } });
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }

  const html = await res.text();
  const title = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1] ?? 'Naver Blog';
  const paragraphs = extractSmartEditorParagraphTexts(html);
  const cleaned = cleanParagraphs(paragraphs, title);

  fs.writeFileSync(outPath, `${cleaned}\n`, 'utf8');
  console.log(`wrote ${outPath}`);
})();
