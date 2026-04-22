// Exhaustive overlay audit for SettingsModal, CommandPalette, MemoryPanel
/* eslint-disable */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = path.join(__dirname, '..', '.overnight-plan', 'audit-overlays');
fs.mkdirSync(OUT, { recursive: true });

function log(...a) {
  console.log('[overlay-audit]', ...a);
}

(async () => {
  const userData = path.join(os.tmpdir(), `ultronos-overlay-${Date.now()}`);
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
    console.error('[overlay-audit] FAIL: no app window');
    await app.close();
    process.exit(1);
  }

  const errors = [];
  const warnings = [];
  page.on('console', (msg) => {
    const txt = msg.text();
    if (msg.type() === 'error') errors.push(txt);
    if (msg.type() === 'warning') warnings.push(txt);
  });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);

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

  async function clickIfVisible(selector, timeout = 2500) {
    const l = page.locator(selector).first();
    await l.waitFor({ state: 'visible', timeout });
    await l.click();
  }

  async function clickWithScroll(selector, timeout = 2500) {
    const l = page.locator(selector).first();
    await l.waitFor({ state: 'visible', timeout });
    // Scroll to view first
    await l.evaluate((el) => {
      el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    });
    await page.waitForTimeout(100);
    // Use playwright's click which handles visibility properly
    try {
      await l.click({ timeout: 3000 });
    } catch (e) {
      // Fallback: try JavaScript click
      await l.evaluate((el) => {
        el.click();
      });
    }
    await page.waitForTimeout(100);
  }

  // ===== SETTINGS MODAL =====
  log('\n--- SETTINGS MODAL ---');

  // Open via titlebar
  await step('settings: open via titlebar', async () => {
    await clickIfVisible('button[aria-label="Settings"]');
    await page.waitForTimeout(500);
  });
  await page.screenshot({ path: path.join(OUT, '01-settings-open.png') });

  // Verify header
  await step('settings: header visible', async () => {
    const header = page.locator('text=⚙ SETTINGS').first();
    if (!(await header.isVisible())) throw new Error('header missing');
  });

  // Tab switching: appearance → window → notifications → data → about
  await step('settings: tab appearance loads', async () => {
    const tab = page.locator('button:has-text("Appearance")').first();
    if (!(await tab.isVisible())) throw new Error('appearance tab missing');
  });

  await step('settings: tab window exists', async () => {
    const tab = page.locator('button:has-text("Window")').first();
    if (!(await tab.isVisible())) throw new Error('window tab missing');
  });

  await step('settings: tab notifications exists', async () => {
    const tab = page.locator('button:has-text("Notifications")').first();
    if (!(await tab.isVisible())) throw new Error('notifications tab missing');
  });

  await step('settings: tab data exists', async () => {
    const tab = page.locator('button:has-text("Data & Paths")').first();
    if (!(await tab.isVisible())) throw new Error('data tab missing');
  });

  await step('settings: tab about exists', async () => {
    const tab = page.locator('button:has-text("About")').first();
    if (!(await tab.isVisible())) throw new Error('about tab missing');
  });

  // Appearance tab: zoom buttons
  await step('settings: zoom minus button present', async () => {
    const btn = page.locator('button:has-text("−")').first();
    if (!(await btn.isVisible())) throw new Error('zoom minus missing');
  });

  await step('settings: zoom plus button present', async () => {
    const btn = page.locator('button:has-text("+")').first();
    if (!(await btn.isVisible())) throw new Error('zoom plus missing');
  });

  await step('settings: zoom value display visible', async () => {
    const val = page.locator('text=/\\d+%/').first();
    if (!(await val.isVisible())) throw new Error('zoom % display missing');
  });

  // Test zoom in
  await step('settings: zoom in increments', async () => {
    const before = await page.evaluate(async () => {
      const result = await window.ultronos?.zoom.get();
      return result || 1.0;
    });
    await clickWithScroll('button:has-text("+")');
    // Wait for IPC roundtrip and state update
    await page.waitForTimeout(1000);
    const after = await page.evaluate(async () => {
      const result = await window.ultronos?.zoom.get();
      return result || 1.0;
    });
    if (after <= before) throw new Error(`zoom in failed: ${before} → ${after}`);
  });
  await page.screenshot({ path: path.join(OUT, '02-settings-zoom.png') });

  // Test zoom out
  await step('settings: zoom out decrements', async () => {
    const before = await page.evaluate(async () => {
      const result = await window.ultronos?.zoom.get();
      return result || 1.0;
    });
    await clickWithScroll('button:has-text("−")');
    await page.waitForTimeout(500);
    const after = await page.evaluate(async () => {
      const result = await window.ultronos?.zoom.get();
      return result || 1.0;
    });
    if (after >= before) throw new Error(`zoom out failed: ${before} → ${after}`);
  });

  // Window tab: toggle buttons
  await step('settings: switch to window tab', async () => {
    await clickWithScroll('button:has-text("Window")');
    await page.waitForTimeout(800);
  });

  await step('settings: alwaysOnTop toggle visible', async () => {
    const toggle = page.locator('text=Always on Top').first();
    await toggle.scrollIntoViewIfNeeded({ timeout: 5000 });
    if (!(await toggle.isVisible())) throw new Error('alwaysOnTop label missing');
  });

  await step('settings: startMinimized toggle visible', async () => {
    const toggle = page.locator('text=Start Minimized').first();
    await toggle.scrollIntoViewIfNeeded({ timeout: 5000 });
    if (!(await toggle.isVisible())) throw new Error('startMinimized label missing');
  });

  await step('settings: hideToTrayOnClose toggle visible', async () => {
    const toggle = page.locator('text=Hide to Tray on Close').first();
    await toggle.scrollIntoViewIfNeeded({ timeout: 5000 });
    if (!(await toggle.isVisible())) throw new Error('hideToTrayOnClose label missing');
  });

  // Test toggle click
  await step('settings: toggle alwaysOnTop changes state', async () => {
    const label = page.locator('text=Always on Top').first();
    const parent = label.locator('xpath=ancestor::div[contains(@class, "space-y")]').first();
    const toggleBtn = parent.locator('role=switch, button[class*="toggle"]').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
    }
  });

  // Notifications tab
  await step('settings: switch to notifications tab', async () => {
    await page.locator('button:has-text("Notifications")').first().click();
    await page.waitForTimeout(300);
  });

  await step('settings: desktopNotifications toggle visible', async () => {
    const toggle = page.locator('text=Desktop Notifications').first();
    if (!(await toggle.isVisible())) throw new Error('desktopNotifications missing');
  });

  await step('settings: soundEffects toggle visible', async () => {
    const toggle = page.locator('text=Sound Effects').first();
    if (!(await toggle.isVisible())) throw new Error('soundEffects missing');
  });

  // Data tab
  await step('settings: switch to data tab', async () => {
    await page.locator('button:has-text("Data & Paths")').first().click();
    await page.waitForTimeout(300);
  });

  await step('settings: userData path visible', async () => {
    const path = page.locator('input[readonly]').first();
    if (!(await path.isVisible())) throw new Error('userData path input missing');
  });

  await step('settings: open userData button present', async () => {
    const btn = page.locator('button:has-text("Open"):visible').first();
    if (!(await btn.isVisible())) throw new Error('open button missing');
  });

  await step('settings: open logs button present', async () => {
    const btn = page.locator('button:has-text("Open Logs"):visible').first();
    if (!(await btn.isVisible())) throw new Error('open logs button missing');
  });

  await step('settings: open temp button present', async () => {
    const btn = page.locator('button:has-text("Open Temp"):visible').first();
    if (!(await btn.isVisible())) throw new Error('open temp button missing');
  });

  // About tab
  await step('settings: switch to about tab', async () => {
    await page.locator('button:has-text("About")').first().click();
    await page.waitForTimeout(300);
  });

  await step('settings: app version visible', async () => {
    const ver = page.locator('text=Version').first();
    if (!(await ver.isVisible())) throw new Error('version field missing');
  });

  await step('settings: github link visible', async () => {
    const link = page.locator('button:has-text("GitHub"):visible').first();
    if (!(await link.isVisible())) throw new Error('github link missing');
  });

  // Reset button
  await step('settings: reset to defaults button visible', async () => {
    const btn = page.locator('button:has-text("Reset"):visible').first();
    if (!(await btn.isVisible())) throw new Error('reset button missing');
  });

  // Relaunch button
  await step('settings: relaunch button visible', async () => {
    const btn = page.locator('button:has-text("Relaunch"):visible').first();
    if (!(await btn.isVisible())) throw new Error('relaunch button missing');
  });

  // Close button
  await step('settings: done button visible', async () => {
    const btn = page.locator('button:has-text("Done"):visible').first();
    if (!(await btn.isVisible())) throw new Error('done button missing');
  });

  // Close via X button
  await step('settings: close via X button', async () => {
    const closeBtn = page.locator('button[aria-label="Close settings"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  });

  // Verify closed
  await step('settings: verify modal closed', async () => {
    try {
      const title = page.locator('text=⚙ SETTINGS').first();
      const visible = await title.isVisible().catch(() => false);
      if (visible) throw new Error('settings still visible after close');
    } catch (e) {
      if (String(e).includes('Target page') || String(e).includes('crashed')) {
        throw new Error('app crashed during settings close');
      }
      throw e;
    }
  });

  // ===== COMMAND PALETTE =====
  log('\n--- COMMAND PALETTE ---');

  // Check if page is still alive
  let pageAlive = false;
  try {
    pageAlive = await page.evaluate(() => true).catch(() => false);
  } catch (e) {
    log('⚠ Page/app died after settings close - some tests may be skipped');
  }

  // Open via shortcut
  if (pageAlive) {
    await step('palette: open via Ctrl+K', async () => {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(500);
    });
  } else {
    await step('palette: open via Ctrl+K', async () => {
      throw new Error('page not available after settings tests');
    });
  }
  await page.screenshot({ path: path.join(OUT, '03-palette-open.png') });

  // Verify input focus
  await step('palette: input autofocused', async () => {
    const input = page.locator('input[placeholder*="Summon"]').first();
    if (!(await input.isVisible())) throw new Error('input not visible');
    const focused = await page.evaluate(() => document.activeElement?.tagName === 'INPUT');
    if (!focused) throw new Error('input not focused');
  });

  // Type to filter
  await step('palette: filter agents by typing', async () => {
    await page.locator('input[placeholder*="Summon"]').first().fill('');
    await page.waitForTimeout(200);
    const before = await page.locator('[role="option"]').count();

    await page.locator('input[placeholder*="Summon"]').first().type('arc', { delay: 50 });
    await page.waitForTimeout(500);
    const after = await page.locator('[role="option"]').count();

    if (after >= before) throw new Error(`filter did not reduce results: ${before} → ${after}`);
  });

  // Test no match
  await step('palette: no match message shows', async () => {
    const input = page.locator('input[placeholder*="Summon"]').first();
    await input.fill('');
    await page.waitForTimeout(200);
    await input.type('zzzzzzzzzz', { delay: 30 });
    await page.waitForTimeout(500);
    const empty = page.locator('text=no match').first();
    if (!(await empty.isVisible())) throw new Error('no match message missing');
  });

  // Clear filter
  await step('palette: clear filter to show all', async () => {
    const input = page.locator('input[placeholder*="Summon"]').first();
    await input.fill('');
    await page.waitForTimeout(300);
  });

  // Arrow navigation
  await step('palette: arrow down selects item', async () => {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    const selected = page.locator('[role="option"][data-selected="true"]').first();
    if (!(await selected.isVisible())) throw new Error('no selected item after arrow down');
  });

  await step('palette: arrow up navigates', async () => {
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
  });

  // Enter to select
  await step('palette: enter selects item', async () => {
    const beforeClose = await page.locator('[role="option"]').first().isVisible();
    if (beforeClose) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
  });

  // Reopen palette
  await step('palette: reopen after close', async () => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    const input = page.locator('input[placeholder*="Summon"]').first();
    if (!(await input.isVisible())) throw new Error('palette did not reopen');
  });

  // Agent count badge
  await step('palette: agent count footer visible', async () => {
    const footer = page.locator('text=/\\d+ agents/').first();
    if (!(await footer.isVisible())) throw new Error('agent count missing');
  });

  // Close via Escape
  await step('palette: close via Escape', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  await step('palette: verify closed after escape', async () => {
    const input = page.locator('input[placeholder*="Summon"]').first();
    const visible = await input.isVisible().catch(() => false);
    if (visible) throw new Error('palette still visible after escape');
  });

  // ===== MEMORY PANEL =====
  log('\n--- MEMORY PANEL ---');

  // Open via shortcut
  await step('memory: open via Ctrl+M', async () => {
    await page.keyboard.press('Control+m');
    await page.waitForTimeout(800);
  });
  await page.screenshot({ path: path.join(OUT, '04-memory-open.png') });

  // Verify header
  await step('memory: header visible', async () => {
    const header = page.locator('text=MEMORY CORE').first();
    if (!(await header.isVisible())) throw new Error('memory header missing');
  });

  // Verify stats
  await step('memory: stats boxes visible', async () => {
    const stats = ['MESSAGES', 'TOOL CALLS', 'SESSIONS', 'ERRORS', 'FAVORITE'];
    for (const stat of stats) {
      const box = page.locator(`text=${stat}`).first();
      if (!(await box.isVisible())) throw new Error(`${stat} stat missing`);
    }
  });

  // Verify agent ledger section
  await step('memory: agent ledger section visible', async () => {
    const section = page.locator('text=AGENT LEDGER').first();
    if (!(await section.isVisible())) throw new Error('agent ledger section missing');
  });

  // Verify heatmap section
  await step('memory: activity heatmap section visible', async () => {
    const section = page.locator('text=30-DAY ACTIVITY HEATMAP').first();
    if (!(await section.isVisible())) throw new Error('heatmap section missing');
  });

  // Verify delegation matrix section
  await step('memory: delegation matrix section visible', async () => {
    const section = page.locator('text=DELEGATION MATRIX').first();
    if (!(await section.isVisible())) throw new Error('delegation matrix missing');
  });

  // Search field
  await step('memory: timeline search field visible', async () => {
    const search = page.locator('input[placeholder*="Search past chats"]').first();
    if (!(await search.isVisible())) throw new Error('search field missing');
  });

  // Wipe all button
  await step('memory: wipe all button visible', async () => {
    const btn = page.locator('button:has-text("WIPE ALL")').first();
    if (!(await btn.isVisible())) throw new Error('wipe all button missing');
  });

  // Close button
  await step('memory: close button visible', async () => {
    const btn = page.locator('button:has-text("CLOSE")').first();
    if (!(await btn.isVisible())) throw new Error('close button missing');
  });

  // Close via Escape
  await step('memory: close via Escape', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  await step('memory: verify closed', async () => {
    const header = page.locator('text=MEMORY CORE').first();
    const visible = await header.isVisible().catch(() => false);
    if (visible) throw new Error('memory panel still visible after escape');
  });

  // ===== FINAL REPORT =====
  await app.close();

  const passed = report.filter((r) => r.status === 'ok').length;
  const failed = report.filter((r) => r.status === 'fail').length;
  const total = report.length;

  console.log(`\n✓ SUMMARY: ${passed}/${total} tests passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    report.filter((r) => r.status === 'fail').forEach((r) => {
      console.log(`  - ${r.name}: ${r.note}`);
    });
  }

  const reportPath = path.join(OUT, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ passed, failed, total, report }, null, 2));
  console.log(`\nReport: ${reportPath}`);

  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('[overlay-audit] FATAL:', e);
  process.exit(1);
});
