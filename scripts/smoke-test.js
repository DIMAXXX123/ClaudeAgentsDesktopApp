// Electron smoke test — launches app, screenshots layout, verifies panels
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const outDir = path.join(__dirname, '..', '.overnight-plan', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const testUserData = path.join(require('os').tmpdir(), `ultronos-smoke-${Date.now()}`);
  fs.mkdirSync(testUserData, { recursive: true });
  console.log('[smoke] launching electron with isolated userData:', testUserData);
  const app = await electron.launch({
    args: [path.join(__dirname, '..'), `--user-data-dir=${testUserData}`],
    env: {
      ...process.env,
      ULTRONOS_DEV_URL: 'http://127.0.0.1:3100',
      NODE_ENV: 'development',
    },
    timeout: 30000,
  });

  // Wait for the app window (not devtools)
  let window = null;
  for (let i = 0; i < 30; i++) {
    const wins = app.windows();
    window = wins.find((w) => {
      const u = w.url();
      return u.startsWith('http://') || u.startsWith('file://');
    });
    if (window) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!window) {
    console.error('[smoke] FAIL: no app window found. windows:', app.windows().map((w) => w.url()));
    await app.close();
    process.exit(1);
  }
  console.log('[smoke] found app window:', window.url());
  const consoleErrors = [];
  const consoleWarnings = [];
  window.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') consoleErrors.push(text);
    if (type === 'warning') consoleWarnings.push(text);
  });
  window.on('pageerror', (err) => {
    consoleErrors.push('PAGEERROR: ' + err.message);
  });
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(4000);
  console.log('[smoke] ERRORS:', consoleErrors.slice(0, 8));
  console.log('[smoke] WARNINGS:', consoleWarnings.slice(0, 3));

  const size = await window.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  console.log('[smoke] window size:', size);

  const panelWidths = await window.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('[style*="width:"]'))
      .filter((el) => /width:\s*\d+px/.test(el.getAttribute('style') || ''))
      .slice(0, 5)
      .map((el) => ({
        style: el.getAttribute('style'),
        actualWidth: el.getBoundingClientRect().width,
      }));
    return panels;
  });
  console.log('[smoke] panel widths:', JSON.stringify(panelWidths, null, 2));

  const hasCapabilities = await window.locator('text=/capabilities|quick|agents/i').first().isVisible().catch(() => false);
  const hasRoomGrid = await window.locator('text=/ULTRON|NOVA|FORGE|ARES/i').first().isVisible().catch(() => false);
  const hasListenerOrConductor = await window.locator('text=/listener|conductor/i').first().isVisible().catch(() => false);
  console.log('[smoke] visible sections:', { hasCapabilities, hasRoomGrid, hasListenerOrConductor });

  // Screenshot the app's root container (bypasses devtools)
  const root = window.locator('.starfield.scanlines').first();
  const ssPath = path.join(outDir, `smoke-${Date.now()}.png`);
  try {
    await root.screenshot({ path: ssPath });
  } catch (e) {
    console.log('[smoke] root screenshot failed, full window:', e.message);
    await window.screenshot({ path: ssPath, fullPage: true });
  }
  console.log('[smoke] screenshot:', ssPath);

  // Dump full DOM state
  const dom = await window.evaluate(() => {
    return {
      url: location.href,
      bodyChildren: document.body.children.length,
      bodyHTML: document.body.innerHTML.substring(0, 2000),
      rootClass: document.body.firstElementChild?.nextElementSibling?.className,
      hasTitleBar: !!document.querySelector('.titlebar-drag'),
      hasStarfield: !!document.querySelector('.starfield'),
      hasMain: !!document.querySelector('main'),
    };
  });
  console.log('[smoke] DOM:', JSON.stringify(dom, null, 2).substring(0, 3000));

  console.log('[smoke] testing Ctrl+G galaxy toggle...');
  await window.keyboard.press('Control+g');
  await window.waitForTimeout(600);
  const ssGalaxyPath = path.join(outDir, `smoke-galaxy-${Date.now()}.png`);
  await window.screenshot({ path: ssGalaxyPath, fullPage: false });
  console.log('[smoke] galaxy screenshot:', ssGalaxyPath);

  console.log('[smoke] testing Ctrl+K palette...');
  await window.keyboard.press('Control+k');
  await window.waitForTimeout(400);
  const ssPalettePath = path.join(outDir, `smoke-palette-${Date.now()}.png`);
  await window.screenshot({ path: ssPalettePath, fullPage: false });
  await window.keyboard.press('Escape');

  await app.close();
  console.log('[smoke] done');
})().catch((e) => {
  console.error('[smoke] FAIL:', e);
  process.exit(1);
});
