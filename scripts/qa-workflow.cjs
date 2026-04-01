const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEFAULT_URLS = [
  process.env.QA_URL,
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
  'http://localhost:8081',
  'http://localhost:19006',
].filter(Boolean);

async function openApp(page) {
  let lastError = null;

  for (const url of DEFAULT_URLS) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.getByText('Put data in').waitFor({ timeout: 10000 });
      return url;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Could not open the web app. Last error: ${lastError?.message ?? 'unknown'}`);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
  });

  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
  });

  try {
    const url = await openApp(page);
    console.log(`Opened ${url}`);

    const fileMode = page.getByTestId('input-mode-file');
    const naverMode = page.getByTestId('input-mode-naver');
    const websiteMode = page.getByTestId('input-mode-website');

    assert.equal(await fileMode.isVisible(), true);
    assert.equal(await naverMode.isVisible(), true);
    assert.equal(await websiteMode.isVisible(), true);

    await naverMode.click();
    assert.equal(await page.getByTestId('naver-url-input').isVisible(), true);
    assert.equal(await page.getByTestId('file-uri-input').isVisible(), false);

    await websiteMode.click();
    assert.equal(await page.getByTestId('website-url-input').isVisible(), true);

    await fileMode.click();
    const confirmInput = page.getByTestId('confirm-text-input');
    await confirmInput.fill(Array.from({ length: 80 }, (_, index) => `Line ${index + 1}`).join('\n'));

    const toggle = page.getByTestId('preview-toggle');
    const panel = page.getByTestId('preview-panel');
    const scroll = page.getByTestId('preview-scroll');

    const beforeHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
    await toggle.click();
    await page.waitForTimeout(100);
    const afterHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
    assert.ok(afterHeight > beforeHeight, `Expected preview panel to expand (${beforeHeight} -> ${afterHeight})`);

    const scrollInfo = await scroll.evaluate((element) => {
      const node = element;
      const canScroll = node.scrollHeight > node.clientHeight;
      node.scrollTop = Math.min(120, Math.max(0, node.scrollHeight - node.clientHeight));
      return {
        canScroll,
        scrollTop: node.scrollTop,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
      };
    });

    assert.equal(scrollInfo.canScroll, true, 'Expected preview content to overflow for internal scrolling');
    assert.ok(scrollInfo.scrollTop > 0, 'Expected preview scroll container to accept scrollTop changes');

    await toggle.click();
    await page.waitForTimeout(100);
    const collapsedHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
    assert.ok(collapsedHeight < afterHeight, `Expected preview panel to collapse (${afterHeight} -> ${collapsedHeight})`);

    console.log('QA workflow passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
