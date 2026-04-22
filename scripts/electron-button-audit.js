// Electron button audit — launches the real desktop app and clicks every visible
// control end-to-end against the actual IPC layer.
/* eslint-disable */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = path.join(__dirname, '..', '.overnight-plan', 'electron-button-audit');
fs.mkdirSync(OUT, { recursive: true });

function log(...a) {
  console.log('[e-audit]', ...a);
}

(async () => {
  const userData = path.join(os.tmpdir(), `ultronos-eaudit-${Date.now()}`);
  fs.mkdirSync(userData, { recursive: true });
  log('userData:', userData);

  const app = await electron.launch({
    args: [path.join(__dirname, '..'), `--user-data-dir=${userData}`],
    env: {
      ...process.env,
      ULTRONOS_DEV_URL: 'http://127.0.0.1:3100',
      NODE_ENV: 'development',
      ULTRONOS_NO_DEVTOOLS: '1',
    },
    timeout: 30000,
  });

  // Pick the renderer window (skip devtools).
  let page = null;
  for (let i = 0; i < 30; i++) {
    page = app.windows().find((w) => {
      const u = w.url();
      return u.startsWith('http://') || u.startsWith('file://');
    });
    if (page) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!page) {
    console.error('[e-audit] FAIL: no app window');
    await app.close();
    process.exit(1);
  }

  const errors = [];
  const warnings = [];
  const logs = [];
  page.on('console', (msg) => {
    const txt = msg.text();
    if (msg.type() === 'error') errors.push(txt);
    if (msg.type() === 'warning') warnings.push(txt);
    if (txt.includes('[launch-debug]') || txt.includes('[page-debug]')) {
      logs.push(`[${msg.type()}] ${txt}`);
      console.log('    >>', txt);
    }
  });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, '00-boot.png') });

  const report = [];
  async function step(name, fn) {
    const before = errors.length;
    let status = 'ok';
    let note = '';
    try {
      await fn();
    } catch (e) {
      status = 'fail';
      note = String(e.message || e).slice(0, 240);
    }
    const newErrs = errors.slice(before);
    if (newErrs.length) {
      status = 'fail';
      note = (note ? note + ' | ' : '') + newErrs.map((s) => s.slice(0, 200)).join(' | ').slice(0, 320);
    }
    report.push({ name, status, note });
    log(`${status === 'ok' ? '✓' : '✗'} ${name}${note ? ' — ' + note : ''}`);
  }

  // Wait helper
  async function clickIfVisible(selector, timeout = 2500) {
    const l = page.locator(selector).first();
    await l.waitFor({ state: 'visible', timeout });
    await l.click();
  }

  // ===== TitleBar =====
  await step('titlebar: open Galaxy', async () => {
    await clickIfVisible('button[aria-label="Memory Galaxy"]');
    await page.waitForTimeout(400);
  });
  await step('titlebar: close Galaxy (X)', async () => {
    await clickIfVisible('button[title^="Close (Ctrl+G"]');
    await page.waitForTimeout(300);
  });

  await step('titlebar: open Settings', async () => {
    await clickIfVisible('button[aria-label="Settings"]');
    await page.waitForTimeout(500);
  });
  await page.screenshot({ path: path.join(OUT, '01-settings.png') });
  await step('titlebar: close Settings', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // Skip min/max/close (they would tear down the window) — verify the buttons exist.
  await step('titlebar: window controls present', async () => {
    for (const t of ['Minimize', 'Maximize', 'Close']) {
      const v = await page.locator(`button[title="${t}"], button[title="Restore"]`).first().isVisible().catch(() => false);
      if (!v) throw new Error(`${t} button missing`);
    }
  });

  // ===== Shortcuts =====
  await step('shortcut: ⌘K palette', async () => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    const ok = await page.locator('input[placeholder*="Summon"]').first().isVisible().catch(() => false);
    if (!ok) throw new Error('palette did not open');
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await step('shortcut: ⌘M memory', async () => {
    await page.keyboard.press('Control+m');
    await page.waitForTimeout(300);
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await step('shortcut: ⌘G galaxy toggle', async () => {
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(200);
  });

  // ===== Gating: empty grid → launch chip → live console → close → empty =====
  await step('grid: empty state by default', async () => {
    const empty = await page.locator('text=No consoles online').first().isVisible().catch(() => false);
    if (!empty) throw new Error('expected empty state');
  });

  await step('launcher: ULTRON chip OFF', async () => {
    const off = await page.locator('button[title*="Launch ULTRON console"]').first().isVisible().catch(() => false);
    if (!off) throw new Error('OFF chip missing');
  });

  await step('launcher: launch ULTRON', async () => {
    const btn = page.locator('button[title*="Launch ULTRON console"]').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await page.waitForTimeout(800);
    const live = await page.locator('button[title*="ULTRON console open"]').first().isVisible().catch(() => false);
    if (!live) throw new Error('chip did not flip to LIVE');
  });
  await page.screenshot({ path: path.join(OUT, '02-ultron-live.png') });

  await step('grid: ULTRON card visible in grid', async () => {
    const card = page.locator('section:has-text("ACTIVE CONSOLES") button:has-text("COMMAND BRIDGE")').first();
    await card.waitFor({ state: 'visible', timeout: 2000 });
  });

  await step('chat modal: SEND visible, STOP hidden', async () => {
    await page.locator('button[type="submit"]:has-text("SEND")').first().waitFor({ state: 'visible', timeout: 3000 });
    const stopVis = await page.locator('button[type="button"]:has-text("STOP")').first().isVisible().catch(() => false);
    if (stopVis) throw new Error('STOP should be hidden when idle');
  });

  await step('chat modal: NEW button reachable', async () => {
    await clickIfVisible('button[title="New session"]');
    await page.waitForTimeout(200);
  });

  await step('chat modal: close via header X', async () => {
    const x = page.locator('.chat-modal-titlebar button').last();
    await x.click();
    await page.waitForTimeout(400);
  });

  await step('grid: returns to empty after close', async () => {
    const empty = await page.locator('text=No consoles online').first().isVisible().catch(() => false);
    if (!empty) throw new Error('grid did not reset');
  });

  // ===== Add Agent =====
  await step('add agent: open modal', async () => {
    await clickIfVisible('button:has-text("Add Agent")');
    await page.waitForTimeout(400);
    const v = await page.locator('input[placeholder*="CIPHER"]').first().isVisible().catch(() => false);
    if (!v) throw new Error('form did not render');
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ===== Sidebar =====
  await step('sidebar: Listener tab', async () => {
    await clickIfVisible('button:has-text("Listener")');
    await page.waitForTimeout(200);
  });
  await step('sidebar: Conductor tab', async () => {
    await clickIfVisible('button:has-text("Conductor")');
    await page.waitForTimeout(200);
  });

  // ===== Final =====
  await page.screenshot({ path: path.join(OUT, '99-final.png') });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ errors, warnings, report }, null, 2));

  const fails = report.filter((r) => r.status !== 'ok');
  log(`SUMMARY: ${report.length - fails.length}/${report.length} pass`);
  for (const r of report) log(`  ${r.status === 'ok' ? '✓' : '✗'} ${r.name}${r.note ? ' — ' + r.note : ''}`);
  if (errors.length) {
    console.log(`\nElectron console errors (${errors.length}):`);
    errors.forEach((e) => console.log('  !', e.slice(0, 240)));
  }

  await app.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('[e-audit] FAIL', e);
  process.exit(2);
});
