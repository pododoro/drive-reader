import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { type ShareIntentFile, useShareIntentContext } from 'expo-share-intent';
import * as Linking from 'expo-linking';
import * as Speech from 'expo-speech';
import {
  FileAudio,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic2,
  RotateCcw,
  Share2,
  Square,
  Volume2,
  Video,
} from 'lucide-react-native';

const SAMPLE_TEXT =
  'Drive Reader turns text, shared links, and text files into spoken audio so you can keep your eyes on the road.';
const NAVER_MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const NAVER_DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

type FileCard = {
  file: ShareIntentFile;
  preview?: string;
  note: string;
};

type RecentSource = {
  id: string;
  kind: 'text' | 'file' | 'url';
  label: string;
  value: string;
  hint: string;
};

type WorkflowStep = {
  number: string;
  title: string;
  description: string;
};

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isReadableTextFile(file: ShareIntentFile) {
  return (
    file.mimeType.startsWith('text/') ||
    /\.(txt|md|csv|json|log|xml|html?|yaml|yml|rtf)$/i.test(file.fileName)
  );
}

function fileCategory(file: ShareIntentFile) {
  if (file.mimeType.startsWith('image/')) return 'Image';
  if (file.mimeType.startsWith('video/')) return 'Video';
  if (file.mimeType.startsWith('audio/')) return 'Audio';
  if (isReadableTextFile(file)) return 'Text';
  return 'File';
}

function categoryIcon(file: ShareIntentFile) {
  if (file.mimeType.startsWith('image/')) return ImageIcon;
  if (file.mimeType.startsWith('video/')) return Video;
  if (file.mimeType.startsWith('audio/')) return FileAudio;
  return FileText;
}

function formatBytes(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'unknown size';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function makeRecentSourceId(kind: RecentSource['kind'], value: string) {
  return `${kind}:${value}`;
}

function summarizeInlineText(text: string, maxLength = 36) {
  const normalized = normalizeText(text).replace(/\s+/g, ' ');
  if (!normalized) {
    return 'Empty text';
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function formatRecentSourceLabel(kind: RecentSource['kind'], value: string) {
  const fallback = kind === 'file' ? 'File path' : kind === 'url' ? 'Web link' : 'Text';
  const summary = summarizeInlineText(value);
  return summary ? `${fallback}: ${summary}` : fallback;
}

function rememberRecentSource(
  setRecentSources: any,
  kind: RecentSource['kind'],
  label: string,
  value: string,
  hint: string
) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return;
  }

  const source: RecentSource = {
    id: makeRecentSourceId(kind, trimmedValue),
    kind,
    label,
    value: trimmedValue,
    hint,
  };

  setRecentSources((current: RecentSource[]) => {
    const next = [source, ...current.filter((item: RecentSource) => item.id !== source.id)];
    return next.slice(0, 5);
  });
}

function applyRecentSource(
  setManualFileUri: any,
  setText: any,
  setStatus: any,
  source: RecentSource
) {
  if (source.kind === 'file') {
    setManualFileUri(source.value);
    setStatus('Restored file path from recent history.');
    return;
  }

  setText(source.value);
  setStatus(`Restored ${source.kind} input from recent history.`);
}

function normalizeText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeBlogBodyText(text: string) {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return '';
  }

  const paragraphs = cleaned
    .replace(/\u2028|\u2029/g, '\n')
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .filter((line) => line.length > 1)
    .filter((line, index, lines) => index === 0 || line !== lines[index - 1]);

  return paragraphs.join('\n\n').trim();
}
function cleanNaverBlogText(title: string, text: string) {
  const normalizedTitle = normalizeText(title);
  const lines = normalizeBlogBodyText(text)
    .split(/\n+/)
    .map((line: string) => normalizeText(line))
    .filter(Boolean);

  const output: string[] = [];
  const titleLine = normalizedTitle ? `${normalizedTitle} : 네이버 블로그` : '';
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
    '출처 OGQ',
    'CoolPubilcDomains',
  ]);
  const layoutNoise = [
    /^\* html /i,
    /^#[-\w]+(?:[.#\s{]|$)/i,
    /^\/\*/,
    /filter:progid/i,
    /background:url/i,
    /font-family/i,
    /border-/i,
    /width:\d/i,
    /height:\d/i,
  ];
  const isCssLikeLine = (line: string) => {
    const lower = line.toLowerCase();
    return (
      layoutNoise.some((pattern) => pattern.test(line)) ||
      ((line.includes('{') || line.includes('}')) && (line.includes(':') || line.includes(';'))) ||
      /(?:filter:|background:|font-size|font-family|border-|margin-|padding-|position:|display:|width:|height:|color:|top:|left:|right:|bottom:)/i.test(
        lower
      )
    );
  };
  const isLikelyBodyStart = (line: string) => {
    if (isCssLikeLine(line)) {
      return false;
    }

    if (
      /블로그 주소 변경|블로그 아이디|레이어 닫기|자세히 보기|이웃과 소식을 만나보세요|진짜 나를 기록하고/i.test(
        line
      )
    ) {
      return false;
    }

    const hasSentenceMark = /[.!?~]/.test(line);
    const hasKoreanWord = /[가-힣]{2,}/.test(line);
    const hasAlphaWord = /[A-Za-z]{2,}/.test(line);
    const hasDigit = /\d/.test(line);
    const looksLikeSentence = hasSentenceMark && (hasKoreanWord || hasAlphaWord || hasDigit);
    const looksLikeParagraph = line.length > 28 && hasKoreanWord;

    return looksLikeSentence || looksLikeParagraph;
  };

  if (normalizedTitle) {
    output.push(normalizedTitle);
  }

  let seenBody = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }

    if (
      line.startsWith("{") ||
      /&#\d+;/.test(line) ||
      /"title"\s*:/.test(line) ||
      /"source"\s*:/.test(line) ||
      /blog\.naver\.com/.test(line) ||
      /^https?:\/\/(?:m\.)?blog\.naver\.com/i.test(line) ||
      /^blog\.naver\.com$/i.test(line)
    ) {
      break;
    }

    if (normalizedTitle && line.endsWith(': 네이버 블로그') && !line.startsWith(normalizedTitle)) {
      break;
    }

    if (layoutNoise.some((pattern) => pattern.test(line))) {
      if (seenBody) {
        break;
      }
      continue;
    }

    if (metaNoise.has(line)) {
      continue;
    }

    if (normalizedTitle && (line === normalizedTitle || line === titleLine || line.includes(normalizedTitle))) {
      continue;
    }

    if (
      /블로그 주소 변경|블로그 아이디|레이어 닫기|자세히 보기|이웃과 소식을 만나보세요|진짜 나를 기록하고/i.test(
        line
      )
    ) {
      if (seenBody) {
        break;
      }
      continue;
    }

    if (/^\d+\s*(분|시간|일|주|개월)\s*전$/.test(line)) {
      continue;
    }

    if (/^[^ ]+\([^()]+\)$/.test(line)) {
      continue;
    }

    if (/^수익,시스템,투자 인사이트$/.test(line)) {
      continue;
    }

    if (/^1인기업가/.test(line)) {
      continue;
    }

    if (/^바닐라라떼$/.test(line)) {
      continue;
    }

    if (!seenBody) {
      if (/^From,/i.test(line)) {
        seenBody = true;
        output.push(line);
        continue;
      }
      if (isLikelyBodyStart(line)) {
        seenBody = true;
        output.push(line);
        continue;
      }
      if (line.length < 2) {
        continue;
      }
      continue;
    }

    output.push(line);
  }

  return output.join('\\n\\n').trim();
}

function extractSmartEditorParagraphTexts(html: string) {
  const matches = html.matchAll(
    /<p[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi
  );
  const paragraphs: string[] = [];

  for (const match of matches) {
    const raw = match[1] ?? '';
    const text = normalizeText(
      decodeHtmlEntities(
        raw
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\u200b/g, ' ')
      )
    );

    if (text) {
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

function extractSmartEditorText(html: string, title: string) {
  const normalizedTitle = normalizeText(title);
  const titleLine = normalizedTitle ? `${normalizedTitle} : 네이버 블로그` : '';
  const paragraphs = extractSmartEditorParagraphTexts(html);
  const output: string[] = [];
  let started = false;

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

  for (const paragraph of paragraphs) {
    const line = normalizeText(paragraph.replace(/\u200b/g, ''));
    if (!line) {
      continue;
    }

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

    if (/\s-\s.*: 네이버 블로그$/.test(line)) {
      continue;
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

    if (/^\d+\s*(분|시간|일|주|개월)\s*전$/.test(line)) {
      continue;
    }

    if (/^[^ ]+\([^()]+\)$/.test(line)) {
      continue;
    }

    if (/^수익,시스템,투자 인사이트$/.test(line)) {
      continue;
    }

    if (/^1인기업가/.test(line)) {
      continue;
    }

    if (/^바닐라라떼$/.test(line)) {
      continue;
    }

    if (/출처\s*OGQ|CoolPubilcDomains/i.test(line)) {
      continue;
    }

    if (!started) {
      if (/^From,/i.test(line)) {
        started = true;
        output.push(line);
        continue;
      }

      if (/[.!?~]/.test(line) || /[가-힣]{2,}/.test(line) || line.length > 20) {
        started = true;
        output.push(line);
        continue;
      }

      continue;
    }

    output.push(line);
  }

  const result = output.join('\n\n').trim();
  return result;
}

function scoreNaverBlogText(title: string, text: string) {
  const normalizedTitle = normalizeText(title);
  const lines = normalizeBlogBodyText(text)
    .split(/\n+/)
    .map((line: string) => normalizeText(line))
    .filter(Boolean);

  let score = 0;
  let bodyLines = 0;

  for (const line of lines) {
    if (
      !line ||
      (normalizedTitle &&
        (line === normalizedTitle || line === `${normalizedTitle} : 네이버 블로그` || line.includes(normalizedTitle)))
    ) {
      continue;
    }

    if (
      /^https?:\/\/|^blog\.naver\.com$/i.test(line) ||
      /블로그 주소 변경|블로그 아이디|레이어 닫기|자세히 보기|이웃과 소식을 만나보세요|진짜 나를 기록하고/i.test(
        line
      ) ||
      /출처\s*OGQ|CoolPubilcDomains/i.test(line) ||
      line.startsWith('{') ||
      /"title"\s*:/.test(line) ||
      /"source"\s*:/.test(line)
    ) {
      score -= 6;
      continue;
    }

    if (/^\d+\s*(분|시간|일|주|개월)\s*전$/.test(line)) {
      score -= 2;
      continue;
    }

    if (/^[^ ]+\([^()]+\)$/.test(line)) {
      score -= 2;
      continue;
    }

    const hasKorean = /[가-힣]/.test(line);
    const hasSentenceMark = /[.!?~]/.test(line);
    const hasAlpha = /[A-Za-z]/.test(line);
    const hasDigit = /\d/.test(line);

    if (hasKorean && line.length >= 20) {
      score += 4;
      bodyLines += 1;
      continue;
    }

    if (hasKorean && hasSentenceMark) {
      score += 3;
      bodyLines += 1;
      continue;
    }

    if (hasKorean && (hasAlpha || hasDigit) && line.length >= 10) {
      score += 2;
      bodyLines += 1;
      continue;
    }

    if (hasKorean && line.length >= 8) {
      score += 1;
      bodyLines += 1;
      continue;
    }

    score -= 1;
  }

  score += Math.min(bodyLines, 8);

  return { bodyLines, score };
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function isNaverBlogUrl(input: string) {
  try {
    const host = new URL(normalizeUrl(input)).hostname.toLowerCase();
    return (
      host === 'blog.naver.com' ||
      host.endsWith('.blog.naver.com') ||
      host === 'm.blog.naver.com' ||
      host.endsWith('.m.blog.naver.com')
    );
  } catch {
    return false;
  }
}

function safeFileName(value: string) {
  const normalized = value
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return normalized || 'naver_blog';
}

async function fetchHtml(url: string, userAgent = NAVER_MOBILE_USER_AGENT) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load page (${response.status})`);
  }

  return response.text();
}

function buildNaverDebugSnapshot(
  inputUrl: string,
  userAgent: string,
  html: string,
  errorMessage: string,
  extractedText: string
) {
  const paragraphs = extractSmartEditorParagraphTexts(html);
  const title = extractTitleFromHtml(html);
  const preview = paragraphs
    .slice(0, 40)
    .map((line, index) => `${String(index + 1).padStart(2, '0')}. ${line}`)
    .join('\n');

  return [
    `URL: ${inputUrl}`,
    `User-Agent: ${userAgent}`,
    `Title: ${title}`,
    `Error: ${errorMessage}`,
    `Extracted length: ${extractedText.length}`,
    `Paragraph count: ${paragraphs.length}`,
    '',
    '--- HTML HEAD ---',
    html.slice(0, 12000),
    '',
    '--- SMARTEDITOR PARAGRAPHS ---',
    preview,
    '',
    '--- EXTRACTED TEXT ---',
    extractedText.slice(0, 12000),
    '',
  ].join('\n');
}

async function saveNaverDebugSnapshot(inputUrl: string, errorMessage: string) {
  const variants = buildNaverRetryProfiles(inputUrl).slice(0, 2);
  for (const variant of variants) {
    try {
      const html = await fetchHtml(variant.url, variant.userAgent);
      const extracted = extractTextFromHtml(html, variant.url);
      const snapshotName = `naver-debug-${safeFileName(extractTitleFromHtml(html))}-${Date.now()}.txt`;
      const snapshotFile = new File(Paths.cache, snapshotName);
      snapshotFile.write(
        buildNaverDebugSnapshot(inputUrl, variant.userAgent, html, errorMessage, extracted.text)
      );
      return snapshotFile.uri;
    } catch {
      // Try the next variant. If all fail, the caller will still get the original error.
    }
  }

  return null;
}

function buildNaverUrlVariants(inputUrl: string) {
  const normalized = normalizeUrl(inputUrl);
  const variants = [normalized];

  try {
    const url = new URL(normalized);
    const postViewUrl = (() => {
      const match = url.pathname.match(/^\/([^/]+)\/(\d+)(?:\/)?$/);
      if (!match) {
        return null;
      }

      const blogId = match[1];
      const logNo = match[2];
      const postView = new URL(url.toString());
      postView.pathname = '/PostView.naver';
      postView.search = `?blogId=${encodeURIComponent(blogId)}&logNo=${encodeURIComponent(logNo)}`;
      return postView.toString();
    })();

    if (postViewUrl) {
      variants.push(postViewUrl);
    }

    if (url.hostname === 'blog.naver.com' || url.hostname.endsWith('.blog.naver.com')) {
      const mobile = new URL(url.toString());
      mobile.hostname = 'm.blog.naver.com';
      variants.push(mobile.toString());
    }

    if (url.hostname === 'm.blog.naver.com' || url.hostname.endsWith('.m.blog.naver.com')) {
      const desktop = new URL(url.toString());
      desktop.hostname = 'blog.naver.com';
      variants.push(desktop.toString());
    }
  } catch {
    // Let the caller handle invalid URLs.
  }

  return [...new Set(variants)];
}

function buildNaverRetryProfiles(inputUrl: string) {
  const urls = buildNaverUrlVariants(inputUrl);
  const profiles: Array<{ url: string; userAgent: string }> = [];

  for (const url of urls) {
    profiles.push({ url, userAgent: NAVER_MOBILE_USER_AGENT });
    profiles.push({ url, userAgent: NAVER_DESKTOP_USER_AGENT });
  }

  return profiles;
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#xa0;/gi, ' ');
}

function extractAttrValue(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  if (!match) {
    return null;
  }

  return normalizeText(decodeHtmlEntities(match[1] ?? '')).trim() || null;
}

function stripHtmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|header|footer|nav|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote|pre|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function extractMainFrameSrc(html: string) {
  return (
    extractAttrValue(
      html,
      /<iframe[^>]*(?:id|name)=["']mainFrame["'][^>]*src=["']([^"']+)["'][^>]*>/i
    ) ??
    extractAttrValue(html, /<iframe[^>]*src=["']([^"']+)["'][^>]*(?:id|name)=["']mainFrame["'][^>]*>/i)
  );
}

function extractTitleFromHtml(html: string) {
  return (
    extractAttrValue(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ??
    extractAttrValue(html, /<meta[^>]*name=["']title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ??
    extractAttrValue(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
    'Naver Blog'
  );
}

function extractBodyCandidate(html: string, marker: string) {
  const markerIndex = html.toLowerCase().indexOf(marker.toLowerCase());
  if (markerIndex < 0) {
    return '';
  }

  const start = Math.max(0, markerIndex - 2000);
  const end = Math.min(html.length, markerIndex + 50000);
  return html.slice(start, end);
}

function extractTextFromHtml(html: string, pageUrl: string) {
  const title = extractTitleFromHtml(html);
  const iframeSrc = extractMainFrameSrc(html);
  const smartEditorText = extractSmartEditorText(html, title);

  if (smartEditorText.length >= 80) {
    return {
      iframeUrl: iframeSrc ? new URL(iframeSrc, pageUrl).toString() : null,
      text: smartEditorText,
      bodyLines: smartEditorText.split(/\n+/).filter(Boolean).length,
      score: Math.min(40, smartEditorText.length / 40),
      title,
    };
  }

  const markers = [
    'se-main-container',
    'postViewArea',
    'post-view',
    'se-viewer',
    'content-area',
    'post_content',
    'se_component_wrap',
    'blog_view',
  ];

  const textCandidates: Array<{ text: string; score: number; bodyLines: number }> = [];
  for (const marker of markers) {
    const candidateHtml = extractBodyCandidate(html, marker);
    if (!candidateHtml) {
      continue;
    }

    const cleaned = cleanNaverBlogText(title, normalizeBlogBodyText(stripHtmlToText(candidateHtml)));
    if (cleaned) {
      const evaluated = scoreNaverBlogText(title, cleaned);
      textCandidates.push({ text: cleaned, score: evaluated.score, bodyLines: evaluated.bodyLines });
    }
  }

  const body = cleanNaverBlogText(title, normalizeBlogBodyText(stripHtmlToText(html)));
  if (body) {
    const evaluated = scoreNaverBlogText(title, body);
    textCandidates.push({ text: body, score: evaluated.score, bodyLines: evaluated.bodyLines });
  }

  const bestCandidate =
    textCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (b.bodyLines !== a.bodyLines) {
        return b.bodyLines - a.bodyLines;
      }

      return b.text.length - a.text.length;
    })[0] ?? null;

  return {
    iframeUrl: iframeSrc ? new URL(iframeSrc, pageUrl).toString() : null,
    text: bestCandidate?.text ?? '',
    bodyLines: bestCandidate?.bodyLines ?? 0,
    score: bestCandidate?.score ?? 0,
    title,
  };
}

async function extractNaverBlogText(inputUrl: string) {
  const candidates = buildNaverRetryProfiles(inputUrl);
  if (!candidates.length || !candidates[0]) {
    throw new Error('Please enter a blog URL.');
  }

  const visited = new Set<string>();
  for (const candidate of candidates) {
    let currentUrl = candidate.url;
    let currentUserAgent = candidate.userAgent;
    for (let i = 0; i < 3; i += 1) {
      const visitKey = `${currentUserAgent}::${currentUrl}`;
      if (!currentUrl || visited.has(visitKey)) {
        break;
      }

      visited.add(visitKey);
      const html = await fetchHtml(currentUrl, currentUserAgent);
      const extracted = extractTextFromHtml(html, currentUrl);

      if (extracted.iframeUrl && extracted.iframeUrl !== currentUrl) {
        currentUrl = extracted.iframeUrl;
        continue;
      }

      if (extracted.text.length >= 40 && extracted.bodyLines >= 1 && extracted.score >= 0) {
        return extracted;
      }

      if (extracted.text.length >= 120) {
        return extracted;
      }

      break;
    }
  }

  throw new Error('Could not resolve the blog content.');
}

function splitTextForSpeech(input: string, maxChunkLength = 3800) {
  const normalized = input.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const limit = Math.max(1000, Math.min(maxChunkLength, Speech.maxSpeechInputLength - 1));
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) {
      chunks.push(trimmed);
    }
    current = '';
  };

  const pushHardSplit = (text: string) => {
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + limit, text.length);
      if (end < text.length) {
        const window = text.slice(start, end);
        const breakPoints = [
          window.lastIndexOf('\n'),
          window.lastIndexOf('. '),
          window.lastIndexOf('! '),
          window.lastIndexOf('? '),
          window.lastIndexOf(', '),
          window.lastIndexOf('; '),
        ];
        const breakPoint = Math.max(...breakPoints);
        if (breakPoint > Math.floor(limit * 0.6)) {
          end = start + breakPoint + 1;
        }
      }

      const part = text.slice(start, end).trim();
      if (part) {
        chunks.push(part);
      }
      start = end;
    }
  };

  const appendPart = (part: string) => {
    const cleaned = part.trim();
    if (!cleaned) {
      return;
    }

    if (cleaned.length > limit) {
      pushCurrent();
      const sentences = cleaned.match(/[^.!?]+[.!?]+[\])'"'"'"?앪?*|[^.!?]+$/g) ?? [cleaned];
      for (const sentence of sentences) {
        const sentenceText = sentence.trim();
        if (!sentenceText) {
          continue;
        }
        if (sentenceText.length > limit) {
          pushHardSplit(sentenceText);
        } else if (current && `${current}\n\n${sentenceText}`.length > limit) {
          pushCurrent();
          current = sentenceText;
        } else if (!current) {
          current = sentenceText;
        } else {
          current = `${current}\n\n${sentenceText}`;
        }
      }
      return;
    }

    if (!current) {
      current = cleaned;
    } else if (`${current}\n\n${cleaned}`.length <= limit) {
      current = `${current}\n\n${cleaned}`;
    } else {
      pushCurrent();
      current = cleaned;
    }
  };

  for (const paragraph of normalized.split(/\n{2,}/)) {
    appendPart(paragraph);
  }

  pushCurrent();
  return chunks;
}

function normalizeFileUri(uri: string) {
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }

  if (/^[a-z]+:\/\//i.test(uri)) {
    return uri;
  }

  return `file://${uri}`;
}

async function readTextFromFileUri(uri: string) {
  const normalized = normalizeFileUri(uri);
  if (!normalized.startsWith('file://')) {
    throw new Error('Only file:// paths can be read directly in this build.');
  }

  return new File(normalized).text();
}

function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        pressed && styles.buttonPressed,
      ]}>
      <View style={styles.buttonIcon}>{icon}</View>
      <Text style={[styles.buttonLabel, variant !== 'primary' && styles.buttonLabelDark]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SourceChip({
  source,
  onPress,
}: {
  source: RecentSource;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sourceChip, pressed && styles.buttonPressed]}>
      <Text style={styles.sourceChipKind}>{source.kind.toUpperCase()}</Text>
      <Text style={styles.sourceChipLabel} numberOfLines={1}>
        {source.label}
      </Text>
      <Text style={styles.sourceChipHint} numberOfLines={1}>
        {source.hint}
      </Text>
    </Pressable>
  );
}

function StatPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.statPill}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WorkflowCard({
  steps,
  dark,
}: {
  steps: WorkflowStep[];
  dark: boolean;
}) {
  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <RotateCcw size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
          <Text style={[styles.sectionTitle, dark && styles.textLight]}>Workflow</Text>
        </View>
      </View>
      <Text style={[styles.helperText, dark && styles.textMuted]}>
        Follow this order while using the app.
      </Text>
      <View style={styles.workflowGrid}>
        {steps.map((step) => (
          <View key={step.number} style={[styles.workflowStep, dark && styles.workflowStepDark]}>
            <Text style={[styles.workflowNumber, dark && styles.textLight]}>{step.number}</Text>
            <Text style={[styles.workflowStepTitle, dark && styles.textLight]}>{step.title}</Text>
            <Text style={[styles.workflowStepDesc, dark && styles.textMuted]}>{step.description}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FileRow({
  card,
  dark,
}: {
  card: FileCard;
  dark: boolean;
}) {
  const Icon = categoryIcon(card.file);

  return (
    <View style={[styles.fileRow, dark && styles.fileRowDark]}>
      <View style={styles.fileRowTop}>
        <View style={styles.fileRowIconWrap}>
          <Icon size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
        </View>
        <View style={styles.fileRowMeta}>
          <Text style={[styles.fileRowTitle, dark && styles.textLight]} numberOfLines={1}>
            {card.file.fileName}
          </Text>
          <Text style={[styles.fileRowSub, dark && styles.textMuted]}>
            {fileCategory(card.file)} 쨌 {card.file.mimeType} 쨌 {formatBytes(card.file.size)}
          </Text>
        </View>
      </View>

      <Text style={[styles.filePath, dark && styles.textMuted]} numberOfLines={2}>
        {card.file.path}
      </Text>

      {card.preview ? (
        <View style={styles.previewBlock}>
          <Text style={[styles.previewLabel, dark && styles.textSoft]}>Preview</Text>
          <Text style={[styles.previewText, dark && styles.textLight]} numberOfLines={7}>
            {card.preview}
          </Text>
        </View>
      ) : (
        <Text style={[styles.fileNote, dark && styles.textMuted]}>{card.note}</Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const dark = false;
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const speechRunIdRef = useRef(0);

  const [text, setText] = useState(SAMPLE_TEXT);
  const [manualFileUri, setManualFileUri] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<ShareIntentFile | null>(null);
  const [sharedFiles, setSharedFiles] = useState<FileCard[]>([]);
  const [recentSources, setRecentSources] = useState<RecentSource[]>([]);
  const [status, setStatus] = useState('Ready for text, file URIs, deep links, and share intents.');
  const [isBusy, setIsBusy] = useState(false);
  const [isBlogBusy, setIsBlogBusy] = useState(false);

  const [blogSnapshot, setBlogSnapshot] = useState<{
    title: string;
    text: string;
    uri: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    const syncFromUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (!initialUrl || !alive) {
        return;
      }

      const parsed = Linking.parse(initialUrl);
      const incomingText = firstValue(parsed.queryParams?.text as string | string[] | undefined);
      const incomingFile = firstValue(parsed.queryParams?.file as string | string[] | undefined);
      const incomingUrl = firstValue(parsed.queryParams?.url as string | string[] | undefined);

      if (incomingText) {
        setText(incomingText);
        rememberRecentSource(setRecentSources, 'text', 'Deep link text', incomingText, 'From initial URL');
        setStatus('Loaded text from the deep link.');
        return;
      }

      if (incomingUrl) {
        setText(incomingUrl);
        rememberRecentSource(setRecentSources, 'url', 'Deep link URL', incomingUrl, 'Ready to read');
        setStatus('Loaded URL from the deep link.');
        return;
      }

      if (incomingFile) {
        setManualFileUri(incomingFile);
        rememberRecentSource(setRecentSources, 'file', 'Deep link file URI', incomingFile, 'Ready for file loading');
        setStatus('Loaded file URI from the deep link.');
      }
    };

    syncFromUrl();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url);
      const incomingText = firstValue(parsed.queryParams?.text as string | string[] | undefined);
      const incomingFile = firstValue(parsed.queryParams?.file as string | string[] | undefined);
      const incomingUrl = firstValue(parsed.queryParams?.url as string | string[] | undefined);

      if (incomingText) {
        setText(incomingText);
        rememberRecentSource(setRecentSources, 'text', 'Incoming text', incomingText, 'From app link');
        setStatus('Loaded text from an incoming deep link.');
        return;
      }

      if (incomingUrl) {
        setText(incomingUrl);
        rememberRecentSource(setRecentSources, 'url', 'Incoming URL', incomingUrl, 'From app link');
        setStatus('Loaded URL from an incoming deep link.');
        return;
      }

      if (incomingFile) {
        setManualFileUri(incomingFile);
        rememberRecentSource(setRecentSources, 'file', 'Incoming file URI', incomingFile, 'From app link');
        setStatus('Loaded file URI from an incoming deep link.');
      }
    });

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const consumeShareIntent = async () => {
      if (!hasShareIntent || !shareIntent) {
        return;
      }

      setIsBusy(true);
      try {
        if (shareIntent.files?.length) {
          const cards: FileCard[] = [];
          const textFiles = shareIntent.files.filter((file) => isReadableTextFile(file));

          for (const file of shareIntent.files) {
            if (!alive) {
              return;
            }

            let preview: string | undefined;
            let note = `${fileCategory(file)} shared.`;

            if (isReadableTextFile(file)) {
              try {
                preview = await readTextFromFileUri(file.path);
                note = `Text content loaded from ${file.fileName}.`;
                rememberRecentSource(setRecentSources, 'file', `Shared file ${file.fileName}`, file.path, 'Tap to reload');
              } catch (error) {
                note =
                  error instanceof Error
                    ? `Could not read text content: ${error.message}`
                    : 'Could not read text content.';
              }
            }

            cards.push({ file, preview, note });
          }

          setSharedFiles(cards);
          setSelectedFile(cards[0]?.file ?? null);
          setManualFileUri(cards[0]?.file.path ?? '');

          if (textFiles.length > 0) {
            const firstTextPreview = cards.find((card) => card.preview)?.preview ?? '';
            if (firstTextPreview) {
              setText(firstTextPreview);
              rememberRecentSource(setRecentSources, 'text', 'Shared text file', firstTextPreview, 'From share intent');
            }
            setStatus(`Loaded ${textFiles.length} text file(s) from sharing.`);
          } else if (shareIntent.text) {
            setText(shareIntent.text);
            rememberRecentSource(setRecentSources, 'text', 'Shared text', shareIntent.text, 'From share intent');
            setStatus('Loaded shared text.');
          } else if (shareIntent.webUrl) {
            setText(shareIntent.webUrl);
            rememberRecentSource(setRecentSources, 'url', 'Shared web link', shareIntent.webUrl, 'From share intent');
            setStatus('Loaded a shared web link.');
          } else {
            setStatus(`Received ${shareIntent.files.length} shared file(s).`);
          }
        } else if (shareIntent.webUrl) {
          setSharedFiles([]);
          setSelectedFile(null);
          setManualFileUri('');
          setText(shareIntent.webUrl);
          rememberRecentSource(setRecentSources, 'url', 'Shared web link', shareIntent.webUrl, 'From share intent');
          setStatus('Loaded a shared web link.');
        } else if (shareIntent.text) {
          setSharedFiles([]);
          setSelectedFile(null);
          setManualFileUri('');
          setText(shareIntent.text);
          rememberRecentSource(setRecentSources, 'text', 'Shared text', shareIntent.text, 'From share intent');
          setStatus('Loaded shared text.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read the shared file.';
        setStatus(message);
        Alert.alert('Drive Reader', message);
      } finally {
        if (alive) {
          setIsBusy(false);
          resetShareIntent(true);
        }
      }
    };

    consumeShareIntent();

    return () => {
      alive = false;
    };
  }, [hasShareIntent, resetShareIntent, shareIntent]);

  const speakText = async () => {
    const content = text.trim();
    if (!content) {
      setStatus('Type or load some text before speaking.');
      return;
    }

    await Speech.stop();
    const chunks = splitTextForSpeech(content);
    if (!chunks.length) {
      setStatus('Type or load some text before speaking.');
      return;
    }

    const runId = ++speechRunIdRef.current;
    const total = chunks.length;
    const speakChunk = (chunk: string, index: number) =>
      new Promise<void>((resolve, reject) => {
        Speech.speak(chunk, {
          rate: 0.96,
          pitch: 1.0,
          onStart: () => {
            if (runId === speechRunIdRef.current) {
              setStatus(`Speaking part ${index + 1} of ${total}.`);
            }
          },
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => reject(new Error('Speech failed to start.')),
        });
      });

    try {
      if (total === 1) {
        setStatus('Speaking now.');
      } else {
        setStatus(`Speaking long text in ${total} parts.`);
      }

      for (let i = 0; i < chunks.length; i += 1) {
        if (runId !== speechRunIdRef.current) {
          return;
        }
        await speakChunk(chunks[i], i);
      }

      if (runId === speechRunIdRef.current) {
        setStatus('Finished speaking.');
      }
    } catch (error) {
      if (runId === speechRunIdRef.current) {
        const message = error instanceof Error ? error.message : 'Speech failed to start.';
        setStatus(message);
        Alert.alert('Drive Reader', message);
      }
    }
  };

  const stopSpeech = async () => {
    speechRunIdRef.current += 1;
    await Speech.stop();
    setStatus('Speech stopped.');
  };

  const loadFile = async () => {
    const uri = manualFileUri.trim();
    if (!uri) {
      setStatus('Paste a local file path or file:// URI first.');
      return;
    }

    setIsBusy(true);
    try {
      const content = await readTextFromFileUri(uri);
      const file: ShareIntentFile = {
        fileName: uri.split(/[\\/]/).pop() ?? 'file',
        mimeType: 'text/plain',
        path: uri,
        size: content.length,
        width: null,
        height: null,
        duration: null,
      };

      setSharedFiles([{ file, preview: content, note: 'Loaded from the local file system.' }]);
      setSelectedFile(file);
      setText(content);
      rememberRecentSource(setRecentSources, 'file', `Local file ${file.fileName}`, file.path, 'From local filesystem');
      setStatus('Loaded file from the local file system.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read the file.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    } finally {
      setIsBusy(false);
    }
  };

  const resetAll = () => {
    setText(SAMPLE_TEXT);
    setManualFileUri('');
    setSelectedFile(null);
    setSharedFiles([]);
    setStatus('Reset to the sample text.');
  };

  const clearTextOnly = () => {
    setText('');
    setStatus('Cleared the text field.');
  };

  const openAppUrl = async () => {
    const url = Linking.createURL('');
    try {
      await Linking.openURL(url);
    } catch {
      setStatus(`App URL is ${url}`);
    }
  };

  const saveBlogSnapshot = async () => {
    const sourceText = blogSnapshot?.text ?? text;
    const sourceTitle = blogSnapshot?.title ?? 'drive-reader-blog';
    const trimmed = sourceText.trim();

    if (!trimmed) {
      setStatus('Nothing to save yet.');
      return;
    }

    setIsBusy(true);
    try {
      const snapshotName = `${safeFileName(sourceTitle)}-${Date.now()}.txt`;
      const snapshotFile = new File(Paths.cache, snapshotName);
      snapshotFile.write(trimmed);

      const file: ShareIntentFile = {
        fileName: snapshotName,
        mimeType: 'text/plain',
        path: snapshotFile.uri,
        size: trimmed.length,
        width: null,
        height: null,
        duration: null,
      };

      setBlogSnapshot({
        title: sourceTitle,
        text: trimmed,
        uri: snapshotFile.uri,
      });
      setSharedFiles([
        {
          file,
          preview: trimmed,
          note: 'Saved blog snapshot.',
        },
      ]);
      setSelectedFile(file);
      setManualFileUri(snapshotFile.uri);
      rememberRecentSource(setRecentSources, 'file', `Blog snapshot ${snapshotName}`, snapshotFile.uri, 'Saved to cache');
      setStatus(`Saved blog snapshot as ${snapshotName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the blog snapshot.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    } finally {
      setIsBusy(false);
    }
  };

  const shareBlogSnapshot = async () => {
    const sourceText = blogSnapshot?.text ?? text;
    const sourceTitle = blogSnapshot?.title ?? 'Drive Reader';
    const trimmed = sourceText.trim();

    if (!trimmed) {
      setStatus('Nothing to share yet.');
      return;
    }

    try {
      await Share.share({
        title: sourceTitle,
        message: trimmed,
      });
      setStatus('Shared the extracted blog text.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to share the blog text.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    }
  };

  const loadBlogText = async () => {
    const url = blogUrl.trim();
    if (!url) {
      setStatus('Enter a Naver blog URL first.');
      return;
    }

    if (!isNaverBlogUrl(url)) {
      setStatus('Please enter a Naver blog URL.');
      return;
    }

    setIsBusy(true);
    setIsBlogBusy(true);
      try {
        const result = await extractNaverBlogText(url);
        const textSnapshotName = `${safeFileName(result.title)}-${Date.now()}.txt`;
        const snapshotFile = new File(Paths.cache, textSnapshotName);
        snapshotFile.write(result.text);

      const file: ShareIntentFile = {
        fileName: textSnapshotName,
        mimeType: 'text/plain',
        path: snapshotFile.uri,
        size: result.text.length,
        width: null,
        height: null,
        duration: null,
      };

      setSharedFiles([
        {
          file,
          preview: result.text,
          note: `Extracted from ${url}`,
        },
      ]);
      setSelectedFile(file);
      setManualFileUri(snapshotFile.uri);
      rememberRecentSource(setRecentSources, 'url', `Naver blog ${result.title}`, url, 'Extracted content');
        setBlogSnapshot({
          title: result.title,
          text: result.text,
          uri: snapshotFile.uri,
        });
        setText(result.text);
        setStatus(`Loaded blog body from ${result.title}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to extract the blog text.';
        if (/Could not resolve the blog content/i.test(message)) {
          const debugSnapshot = await saveNaverDebugSnapshot(url, message);
          if (debugSnapshot) {
            setStatus(`Extraction failed. Saved debug snapshot to cache.`);
          } else {
            setStatus(message);
          }
        } else {
          setStatus(message);
        }
        Alert.alert('Drive Reader', message);
      } finally {
        setIsBusy(false);
        setIsBlogBusy(false);
    }
  };

  const pickTextFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/*', '.txt', '.md'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        setStatus('File selection canceled.');
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'text/plain';
      if (!mimeType.startsWith('text/') && !/\.(txt|md|csv|json|log|xml|html?|yaml|yml|rtf)$/i.test(asset.name)) {
        setStatus('Select a text file such as .txt, .md, or .csv.');
        return;
      }

      const content = await readTextFromFileUri(asset.uri);
      const file: ShareIntentFile = {
        fileName: asset.name,
        mimeType,
        path: asset.uri,
        size: asset.size ?? content.length,
        width: null,
        height: null,
        duration: null,
      };

      setSharedFiles([{ file, preview: content, note: 'Picked from the system file chooser.' }]);
      setSelectedFile(file);
      setManualFileUri(asset.uri);
      setText(content);
      rememberRecentSource(setRecentSources, 'file', `Picked file ${asset.name}`, asset.uri, 'From system picker');
      setStatus(`Loaded ${asset.name} from the system file chooser.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to pick a file.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    }
  };

  const workflowSteps: WorkflowStep[] = [
    {
      number: '1',
      title: 'Open the app',
      description: 'Land on a clean screen and choose the source you want to read.',
    },
    {
      number: '2',
      title: 'Put data in',
      description: 'Paste text, a file path, a blog URL, or choose a local file.',
    },
    {
      number: '3',
      title: 'Confirm it',
      description: 'Check the preview, recent inputs, and shared file card before reading.',
    },
    {
      number: '4',
      title: 'Read it',
      description: 'Use Speak when the content looks right.',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandMark}>
              <Mic2 color="#0F172A" size={22} strokeWidth={2.5} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={[styles.kicker, dark && styles.textSoft]}>Drive Reader</Text>
              <Text style={[styles.heroTitle, dark && styles.textLight]}>
                Open, load, confirm, then read.
              </Text>
            </View>
          </View>
          <Text style={[styles.heroBody, dark && styles.textMuted]}>
            Keep the flow simple: put content in, check the preview, and only then press Speak.
          </Text>
          <View style={styles.statsRow}>
            <StatPill icon={<Volume2 size={14} color="#0F172A" strokeWidth={2.5} />} label="TTS" />
            <StatPill
              icon={<FileText size={14} color="#0F172A" strokeWidth={2.5} />}
              label="Files"
            />
            <StatPill
              icon={<Share2 size={14} color="#0F172A" strokeWidth={2.5} />}
              label="Flow"
            />
          </View>
        </View>

        <WorkflowCard steps={workflowSteps} dark={dark} />

        <View style={[styles.card, dark && styles.cardDark]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FileText size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Step 2. Put data in</Text>
            </View>
            {isBusy ? <ActivityIndicator color={dark ? '#E2E8F0' : '#0F172A'} /> : null}
          </View>

          <View style={styles.inputStack}>
            <View style={styles.inputStackItem}>
              <Text style={[styles.helperText, dark && styles.textMuted]}>
                Pick a local file, paste a file path, or open a deep link.
              </Text>
              <TextInput
                value={manualFileUri}
                onChangeText={setManualFileUri}
                placeholder="file:///path/to/book.txt"
                placeholderTextColor={dark ? '#64748B' : '#94A3B8'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.singleLineInput, dark && styles.textInputDark]}
              />
              <View style={styles.fileReaderActions}>
                <ActionButton
                  label="Read file"
                  icon={<FileAudio size={16} color="#FFFFFF" />}
                  onPress={loadFile}
                />
                <ActionButton
                  label="Choose file"
                  icon={<FileText size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={pickTextFile}
                  variant="secondary"
                />
                <ActionButton
                  label="App URL"
                  icon={<Link2 size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={openAppUrl}
                  variant="ghost"
                />
              </View>
            </View>

            <View style={styles.inputStackItem}>
              <Text style={[styles.helperText, dark && styles.textMuted]}>
                Paste a Naver blog URL if the content you want is on the web.
              </Text>
              <TextInput
                value={blogUrl}
                onChangeText={setBlogUrl}
                placeholder="https://blog.naver.com/..."
                placeholderTextColor={dark ? '#64748B' : '#94A3B8'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.singleLineInput, dark && styles.textInputDark]}
              />
              <View style={styles.fileReaderActions}>
                <ActionButton
                  label="Extract"
                  icon={<Link2 size={16} color="#FFFFFF" />}
                  onPress={loadBlogText}
                />
                <ActionButton
                  label="Example"
                  icon={<RotateCcw size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={() =>
                    setBlogUrl('https://m.blog.naver.com/PostView.naver?blogId=YOUR_ID&logNo=POST_NO')
                  }
                  variant="secondary"
                />
                <ActionButton
                  label="Save"
                  icon={<Square size={16} color="#FFFFFF" />}
                  onPress={saveBlogSnapshot}
                />
                <ActionButton
                  label="Share"
                  icon={<Share2 size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={shareBlogSnapshot}
                  variant="ghost"
                />
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Volume2 size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Step 3. Confirm it</Text>
            </View>
          </View>

          <Text style={[styles.helperText, dark && styles.textMuted]}>
            Check the preview before you press Speak.
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            scrollEnabled
            textAlignVertical="top"
            placeholder="Paste text here or load it from a share intent."
            placeholderTextColor={dark ? '#64748B' : '#94A3B8'}
            style={[styles.textInput, dark && styles.textInputDark]}
          />

          <View style={[styles.readerBox, dark && styles.readerBoxDark]}>
            <View style={styles.readerHeader}>
              <Text style={[styles.readerLabel, dark && styles.textSoft]}>Reader</Text>
              <Text style={[styles.readerHint, dark && styles.textMuted]}>
                Swipe inside this box to scroll long text.
              </Text>
            </View>
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.readerScroll}
              contentContainerStyle={styles.readerScrollContent}>
              <Text style={[styles.readerText, dark && styles.textLight]} selectable>
                {text || 'No text loaded yet.'}
              </Text>
            </ScrollView>
          </View>

          <View style={styles.actionsWrap}>
            <ActionButton
              label="Load sample"
              icon={<RotateCcw size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
              onPress={() => setText(SAMPLE_TEXT)}
              variant="secondary"
            />
            <ActionButton
              label="Clear"
              icon={<Square size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
              onPress={clearTextOnly}
              variant="ghost"
            />
            <ActionButton
              label="Reset"
              icon={<Square size={16} color="#FFFFFF" />}
              onPress={resetAll}
            />
          </View>
        </View>

        {recentSources.length > 0 ? (
          <View style={[styles.card, dark && styles.cardDark]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <RotateCcw size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
                <Text style={[styles.sectionTitle, dark && styles.textLight]}>Recent inputs</Text>
              </View>
            </View>
            <Text style={[styles.helperText, dark && styles.textMuted]}>
              Tap a recent file path, shared text, or deep link to restore it into the main input.
            </Text>
            <View style={styles.sourceChipList}>
              {recentSources.map((source) => (
                <SourceChip
                  key={source.id}
                  source={source}
                  onPress={() => applyRecentSource(setManualFileUri, setText, setStatus, source)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {sharedFiles.length > 0 ? (
          <View style={[styles.card, dark && styles.cardDark]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <FileText size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
                <Text style={[styles.sectionTitle, dark && styles.textLight]}>Shared files</Text>
              </View>
            </View>

            <View style={styles.sharedList}>
              {sharedFiles.map((card) => (
                <FileRow key={`${card.file.path}-${card.file.fileName}`} card={card} dark={dark} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.card, dark && styles.cardDark]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Link2 size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Step 4. Read it</Text>
            </View>
            {isBusy ? <ActivityIndicator color={dark ? '#E2E8F0' : '#0F172A'} /> : null}
          </View>

          <Text style={[styles.statusText, dark && styles.textMuted]}>{status}</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.metaLabel, dark && styles.textSoft]}>Share intent</Text>
            <Text style={[styles.metaValue, dark && styles.textLight]}>
              {hasShareIntent
                ? sharedFiles.length
                  ? `${sharedFiles.length} file(s)`
                  : shareIntent?.webUrl
                    ? 'web URL'
                    : shareIntent?.text
                      ? 'text'
                      : 'available'
                : 'none'}
            </Text>
          </View>

          {selectedFile ? (
            <View style={styles.filePreviewBox}>
              <View style={styles.filePreviewHead}>
                <FileAudio size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
                <Text style={[styles.filePreviewTitle, dark && styles.textLight]}>
                  {selectedFile.fileName}
                </Text>
              </View>
              <Text style={[styles.fileMeta, dark && styles.textMuted]}>
                {selectedFile.mimeType} 쨌 {formatBytes(selectedFile.size)}
              </Text>
              <Text style={[styles.fileMeta, dark && styles.textMuted]} numberOfLines={2}>
                {selectedFile.path}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <ActionButton
              label="Speak"
              icon={<Mic2 size={16} color="#FFFFFF" />}
              onPress={speakText}
            />
            <ActionButton
              label="Stop"
              icon={<Square size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
              onPress={stopSpeech}
              variant="secondary"
            />
          </View>
        </View>

        <View style={[styles.footerCard, dark && styles.cardDark]}>
          <Text style={[styles.footerTitle, dark && styles.textLight]}>Quick test links</Text>
          <Text style={[styles.footerText, dark && styles.textMuted]}>
            `drivereader://?text=Hello` loads text. `drivereader://?file=file:///...` points at a
            file. Shared text, URLs, and text files land here through `expo-share-intent`.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 36,
    gap: 14,
  },
  hero: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  brandCopy: {
    flex: 1,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#0F172A',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  statLabel: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  workflowGrid: {
    gap: 10,
  },
  workflowStep: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    gap: 6,
  },
  workflowStepDark: {
    backgroundColor: '#081423',
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  workflowNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  workflowStepTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  workflowStepDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  card: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#0C1828',
    borderColor: 'rgba(148, 163, 184, 0.12)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  metaValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  filePreviewBox: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  filePreviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filePreviewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  fileMeta: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  sharedList: {
    gap: 12,
  },
  fileRow: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#F9FAFB',
    gap: 10,
  },
  fileRowDark: {
    backgroundColor: '#F9FAFB',
  },
  fileRowTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  fileRowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileRowMeta: {
    flex: 1,
    gap: 2,
  },
  fileRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  fileRowSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  filePath: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  fileNote: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  previewBlock: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F9FAFB',
    gap: 10,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748B',
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0F172A',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputStack: {
    gap: 16,
  },
  inputStackItem: {
    gap: 12,
  },
  fileReaderActions: {
    flexDirection: 'column',
    gap: 12,
  },
  actionsWrap: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buttonPrimary: {
    backgroundColor: '#0F172A',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
  },
  buttonGhost: {
    backgroundColor: '#FFFFFF',
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  buttonIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonLabelDark: {
    color: '#0F172A',
  },
  textInput: {
    minHeight: 210,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  textInputDark: {
    backgroundColor: '#081423',
    color: '#E2E8F0',
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  readerBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 10,
    maxHeight: 300,
  },
  readerBoxDark: {
    backgroundColor: '#081423',
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  readerHeader: {
    gap: 4,
  },
  readerLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748B',
  },
  readerHint: {
    fontSize: 12,
    color: '#475569',
  },
  readerScroll: {
    maxHeight: 240,
  },
  readerScrollContent: {
    paddingBottom: 6,
  },
  readerText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#0F172A',
  },
  helperText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  sourceChipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sourceChip: {
    minWidth: 160,
    flexGrow: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  sourceChipKind: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#0F172A',
  },
  sourceChipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sourceChipHint: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  singleLineInput: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  footerCard: {
    borderRadius: 24,
    padding: 16,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  footerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  textLight: {
    color: '#E2E8F0',
  },
  textMuted: {
    color: '#94A3B8',
  },
  textSoft: {
    color: '#CBD5E1',
  },
});

