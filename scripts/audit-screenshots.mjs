import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium, devices } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const artifactDir = process.env.ARTIFACT_DIR
  ? path.resolve(process.env.ARTIFACT_DIR)
  : path.resolve('audit-artifacts', 'latest');

async function captureSection(page, headingText, fileName) {
  const section = page
    .locator('div.rounded-lg')
    .filter({ has: page.getByText(headingText, { exact: true }) })
    .first();
  await section.screenshot({ path: path.join(artifactDir, fileName) });
}

async function main() {
  await fs.mkdir(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({ viewport: { width: 1600, height: 2200 } });
  const desktopPage = await desktop.newPage();
  const desktopErrors = [];
  const desktopFailed = [];
  desktopPage.on('console', (message) => {
    if (message.type() === 'error') {
      desktopErrors.push(message.text());
    }
  });
  desktopPage.on('requestfailed', (request) => {
    desktopFailed.push({
      url: request.url(),
      error: request.failure()?.errorText ?? 'unknown',
    });
  });

  await desktopPage.goto(baseUrl, { waitUntil: 'networkidle' });
  await desktopPage.getByText('Claude Code', { exact: false }).first().waitFor({ state: 'visible' });
  await desktopPage.screenshot({ path: path.join(artifactDir, 'desktop-full.png'), fullPage: true });
  await captureSection(desktopPage, 'Local Time', 'desktop-clock.png');
  await captureSection(desktopPage, 'Next Off-Peak Window', 'desktop-forecast.png');
  await captureSection(desktopPage, 'Promotion History', 'desktop-history.png');

  const desktopAudit = await desktopPage.evaluate(() => ({
    title: document.title,
    bodyText: document.body.innerText,
  }));

  const mobile = await browser.newContext({ ...devices['iPhone 13'] });
  const mobilePage = await mobile.newPage();
  const mobileErrors = [];
  const mobileFailed = [];
  mobilePage.on('console', (message) => {
    if (message.type() === 'error') {
      mobileErrors.push(message.text());
    }
  });
  mobilePage.on('requestfailed', (request) => {
    mobileFailed.push({
      url: request.url(),
      error: request.failure()?.errorText ?? 'unknown',
    });
  });

  await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobilePage.getByText('Claude Code', { exact: false }).first().waitFor({ state: 'visible' });
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-full.png'), fullPage: true });
  await captureSection(mobilePage, 'Next Off-Peak Window', 'mobile-forecast.png');

  const mobileAudit = await mobilePage.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    bodyText: document.body.innerText,
  }));

  await browser.close();

  await fs.writeFile(
    path.join(artifactDir, 'playwright-audit.json'),
    JSON.stringify(
      {
        baseUrl,
        desktopAudit,
        mobileAudit,
        desktopErrors,
        desktopFailed,
        mobileErrors,
        mobileFailed,
      },
      null,
      2,
    ),
  );

  console.log(`Audit artifacts written to ${artifactDir}`);
}

await main();
