import { chromium } from 'playwright';
import fs from 'node:fs';

const out = '/root/projects/photo-editor/docs/screenshots';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('shot', name);
}

async function openPhoto() {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').first().setInputFiles('/tmp/opencode/sample2.jpg');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1400);
}

async function setStrength(label, value) {
  await page.getByLabel(label).evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// 0. Welcome / empty state
await shot('00-welcome');

// Load sample photo
await openPhoto();

// 1. Suggestions / auto enhance
await shot('01-suggestions');

// 2. Adjust panel
await page.getByTestId('tab-adjust').click();
await page.waitForTimeout(350);
await shot('02-adjust');

// 3. Filters grid
await page.getByTestId('tab-filters').click();
await page.waitForTimeout(600);
await shot('03-filters');

// 4. Artistic category
await page.getByTestId('cat-artistic').click();
await page.waitForTimeout(600);
await shot('04-artistic');

// 5. Apply two looks, tune strengths, show the stack
await page.getByTestId('cat-effects').click();
await page.waitForTimeout(300);
await page.getByTestId('filter-goldenHour').click();
await page.waitForTimeout(350);
await page.getByTestId('cat-lut').click();
await page.waitForTimeout(300);
await page.getByTestId('filter-tealOrange').click();
await page.waitForTimeout(600);
await page.getByTestId('tab-stack').click();
await page.waitForTimeout(350);
await setStrength('Golden Hour strength', 75);
await setStrength('Teal & Orange strength', 40);
await page.waitForTimeout(600);
await shot('05-stack');

// 6. Crop: drag a selection on the full frame
await openPhoto();
await page.getByTestId('tab-crop').click();
await page.waitForTimeout(250);
await page.getByTestId('crop-toggle').click();
await page.waitForTimeout(300);
const box = await page.locator('.canvas-container canvas').boundingBox();
await page.mouse.move(box.x + box.width * 0.16, box.y + box.height * 0.14);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.84, box.y + box.height * 0.9, { steps: 12 });
await page.waitForTimeout(400);
await shot('06-crop');
await page.mouse.up();
await page.waitForTimeout(700);

// 7. View / zoom (with the crop applied)
await page.getByTestId('tab-view').click();
await page.waitForTimeout(400);
await shot('07-view');

await browser.close();
console.log('done');
