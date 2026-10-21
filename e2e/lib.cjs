// Shared setup for the browser end-to-end tests (Playwright driving the Expo web build).
const fs = require('fs');
const path = require('path');

let playwright;
try {
  playwright = require('playwright');
} catch {
  throw new Error('Install Playwright first: npm i -D playwright && npx playwright install chromium');
}

const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

module.exports = {
  chromium: playwright.chromium,
  // Set CHROMIUM_PATH to use an existing Chromium instead of Playwright's download.
  launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  OUT,
};
