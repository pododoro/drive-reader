import { File, Paths } from 'expo-file-system';

const NAVER_MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const NAVER_DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BLOG_NOISE_PATTERNS = [
  /blog address/i,
  /share/i,
  /preview/i,
  /copyright/i,
  /powered by/i,
  /coolpublicdomains/i,
  /\bogq\b/i,
];

export function normalizeText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeBlogBodyText(text: string) {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return '';
  }

  return cleaned
    .replace(/\u2028|\u2029/g, '\n')
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .filter((line, index, lines) => index === 0 || line !== lines[index - 1])
    .join('\n\n')
    .trim();
}

export function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function isNaverBlogUrl(input: string) {
  try {
    const host = new URL(normalizeUrl(input)).hostname.toLowerCase();
    return (
      host === 'blog.naver.com' ||
      host === 'm.blog.naver.com' ||
      host.endsWith('.blog.naver.com')
    );
  } catch {
    return false;
  }
}

export function safeFileName(value: string) {
  const normalized = value
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return normalized || 'naver_blog';
}

export async function fetchHtml(url: string, userAgent = NAVER_MOBILE_USER_AGENT) {
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

export function stripHtmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|header|footer|nav|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote|pre|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function extractAttrValue(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  if (!match) {
    return null;
  }

  return normalizeText(decodeHtmlEntities(match[1] ?? '')) || null;
}

export function extractTitleFromHtml(html: string) {
  return (
    extractAttrValue(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ??
    extractAttrValue(html, /<meta[^>]*name=["']title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ??
    extractAttrValue(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
    'Naver Blog'
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

function extractSmartEditorParagraphs(html: string) {
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
      )
    );

    if (text) {
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

function filterLines(lines: string[], title: string) {
  const normalizedTitle = normalizeText(title);

  return lines.filter((line) => {
    if (!line) {
      return false;
    }

    if (normalizedTitle && (line === normalizedTitle || line.includes(normalizedTitle))) {
      return false;
    }

    if (/^https?:\/\/(?:m\.)?blog\.naver\.com/i.test(line) || /^blog\.naver\.com$/i.test(line)) {
      return false;
    }

    if (/^https?:\/\/\S+$/.test(line) && line.length < 120) {
      return false;
    }

    if (BLOG_NOISE_PATTERNS.some((pattern) => pattern.test(line))) {
      return false;
    }

    if (/^[A-Za-z0-9_ -]{1,20}$/.test(line) && !/[.!?]/.test(line)) {
      return false;
    }

    return true;
  });
}

function scoreText(text: string) {
  const lines = text.split(/\n+/).filter(Boolean);
  const longLines = lines.filter((line) => line.length >= 20).length;
  return longLines * 4 + text.length / 80;
}

function extractBodyText(html: string, title: string) {
  const paragraphText = filterLines(extractSmartEditorParagraphs(html), title).join('\n\n').trim();
  if (paragraphText.length >= 80) {
    return paragraphText;
  }

  const fullText = normalizeBlogBodyText(stripHtmlToText(html));
  const filtered = filterLines(
    fullText
      .split(/\n+/)
      .map((line) => normalizeText(line))
      .filter(Boolean),
    title
  ).join('\n\n');

  const candidates = [paragraphText, filtered].filter(Boolean);
  return candidates.sort((a, b) => scoreText(b) - scoreText(a))[0] ?? '';
}

function buildNaverUrlVariants(inputUrl: string) {
  const normalized = normalizeUrl(inputUrl);
  const variants = [normalized];

  try {
    const url = new URL(normalized);

    const postViewMatch = url.pathname.match(/^\/([^/]+)\/(\d+)(?:\/)?$/);
    if (postViewMatch) {
      const postViewUrl = new URL(url.toString());
      postViewUrl.pathname = '/PostView.naver';
      postViewUrl.search = `?blogId=${encodeURIComponent(postViewMatch[1])}&logNo=${encodeURIComponent(postViewMatch[2])}`;
      variants.push(postViewUrl.toString());
    }

    if (url.hostname === 'blog.naver.com') {
      const mobileUrl = new URL(url.toString());
      mobileUrl.hostname = 'm.blog.naver.com';
      variants.push(mobileUrl.toString());
    }

    if (url.hostname === 'm.blog.naver.com') {
      const desktopUrl = new URL(url.toString());
      desktopUrl.hostname = 'blog.naver.com';
      variants.push(desktopUrl.toString());
    }
  } catch {
    // Let the caller surface invalid input.
  }

  return [...new Set(variants)];
}

function buildRetryProfiles(inputUrl: string) {
  const urls = buildNaverUrlVariants(inputUrl);
  const profiles: { url: string; userAgent: string }[] = [];

  for (const url of urls) {
    profiles.push({ url, userAgent: NAVER_MOBILE_USER_AGENT });
    profiles.push({ url, userAgent: NAVER_DESKTOP_USER_AGENT });
  }

  return profiles;
}

function buildNaverDebugSnapshot(
  inputUrl: string,
  userAgent: string,
  html: string,
  errorMessage: string,
  extractedText: string
) {
  const paragraphs = extractSmartEditorParagraphs(html);
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

export async function saveNaverDebugSnapshot(inputUrl: string, errorMessage: string) {
  const variants = buildRetryProfiles(inputUrl).slice(0, 2);

  for (const variant of variants) {
    try {
      const html = await fetchHtml(variant.url, variant.userAgent);
      const extractedText = extractBodyText(html, extractTitleFromHtml(html));
      const snapshotName = `naver-debug-${safeFileName(extractTitleFromHtml(html))}-${Date.now()}.txt`;
      const snapshotFile = new File(Paths.cache, snapshotName);
      snapshotFile.write(
        buildNaverDebugSnapshot(inputUrl, variant.userAgent, html, errorMessage, extractedText)
      );
      return snapshotFile.uri;
    } catch {
      // Try the next profile.
    }
  }

  return null;
}

export async function extractNaverBlogText(inputUrl: string) {
  const profiles = buildRetryProfiles(inputUrl);

  if (!profiles.length) {
    throw new Error('Please enter a blog URL.');
  }

  const visited = new Set<string>();

  for (const profile of profiles) {
    let currentUrl = profile.url;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const visitKey = `${profile.userAgent}::${currentUrl}`;
      if (!currentUrl || visited.has(visitKey)) {
        break;
      }

      visited.add(visitKey);
      const html = await fetchHtml(currentUrl, profile.userAgent);
      const iframeSrc = extractMainFrameSrc(html);
      const iframeUrl = iframeSrc ? new URL(iframeSrc, currentUrl).toString() : null;

      if (iframeUrl && iframeUrl !== currentUrl) {
        currentUrl = iframeUrl;
        continue;
      }

      const title = extractTitleFromHtml(html);
      const text = extractBodyText(html, title);

      if (text.length >= 40) {
        return {
          bodyLines: text.split(/\n+/).filter(Boolean).length,
          iframeUrl,
          score: scoreText(text),
          text,
          title,
        };
      }

      break;
    }
  }

  throw new Error('Could not resolve the blog content.');
}

export async function extractWebsiteText(inputUrl: string) {
  const normalizedUrl = normalizeUrl(inputUrl);
  const html = await fetchHtml(normalizedUrl);
  const title = extractTitleFromHtml(html);
  const text = normalizeBlogBodyText(stripHtmlToText(html));

  if (!text) {
    throw new Error('Could not extract readable text from the website.');
  }

  return { normalizedUrl, text, title };
}
