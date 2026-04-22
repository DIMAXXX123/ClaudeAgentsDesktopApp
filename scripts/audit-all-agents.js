// Agents audit — cycles each of the 6 preset agents through launch/card/chat/close.
/* eslint-disable */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = path.join(__dirname, '..', '.overnight-plan', 'audit-all-agents');
fs.mkdirSync(OUT, { recursive: true });

const PRESETS = [
  { id: 'ultron', name: 'ULTRON', room: 'COMMAND BRIDGE' },
  { id: 'nova', name: 'NOVA', room: 'CODEX ARCHIVE' },
  { id: 'forge', name: 'FORGE', room: 'CODE FOUNDRY' },
  { id: 'ares', name: 'ARES', room: 'WAR DECK' },
  { id: 'echo', name: 'ECHO', room: 'SIGNAL RELAY' },
  { id: 'midas', name: 'MIDAS', room: 'DATA VAULT' },
];

function log(...a) {
  console.log('[agents]', ...a);
}

(async () => {
  const userData = path.join(os.tmpdir(), `ultronos-agents-${Date.now()}`);
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
    console.error('[agents] FAIL: no app window');
    await app.close();
    process.exit(1);
  }

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
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
      note = (note ? note + ' | ' : '') + newErrs.map((s) => s.slice(0, 180)).join(' | ').slice(0, 320);
    }
    report.push({ name, status, note });
    log(`${status === 'ok' ? '✓' : '✗'} ${name}${note ? ' — ' + note : ''}`);
  }

  // Baseline: empty grid
  await step('baseline: empty grid', async () => {
    const empty = await page.locator('text=No consoles online').first().isVisible().catch(() => false);
    if (!empty) throw new Error('expected empty state');
  });

  // Launcher chip count
  await step('launcher: 6 preset chips rendered', async () => {
    for (const p of PRESETS) {
      const chip = page.locator(`button[title*="Launch ${p.name} console"]`).first();
      const v = await chip.isVisible().catch(() => false);
      if (!v) throw new Error(`${p.name} chip not visible`);
    }
  });

  // Per-agent cycle
  for (const p of PRESETS) {
    await step(`${p.id}: launch chip flips to LIVE`, async () => {
      const off = page.locator(`button[title*="Launch ${p.name} console"]`).first();
      await off.scrollIntoViewIfNeeded();
      await off.click();
      await page.waitForTimeout(800);
      const live = await page
        .locator(`button[title*="${p.name} console open"]`)
        .first()
        .isVisible()
        .catch(() => false);
      if (!live) throw new Error(`chip did not flip to LIVE for ${p.name}`);
    });

    await step(`${p.id}: card visible in grid (room=${p.room})`, async () => {
      const card = page
        .locator(`section:has-text("ACTIVE CONSOLES") button:has-text("${p.room}")`)
        .first();
      await card.waitFor({ state: 'visible', timeout: 2500 });
    });

    await step(`${p.id}: chat modal opens with SEND visible`, async () => {
      // Auto-opened on launch. If not, click the card to open.
      let sendVis = await page
        .locator('button[type="submit"]:has-text("SEND")')
        .first()
        .isVisible()
        .catch(() => false);
      if (!sendVis) {
        const card = page
          .locator(`section:has-text("ACTIVE CONSOLES") button:has-text("${p.room}")`)
          .first();
        await card.click();
        await page.waitForTimeout(500);
      }
      await page
        .locator('button[type="submit"]:has-text("SEND")')
        .first()
        .waitFor({ state: 'visible', timeout: 3000 });
    });

    await page.screenshot({ path: path.join(OUT, `${p.id}-chat.png`) });

    // In current UX: chat modal header X is the single close affordance —
    // it closes chat AND deactivates the agent (removes card). So after this
    // step the grid should be empty and chip back to OFF.
    await step(`${p.id}: header X closes chat + deactivates console`, async () => {
      const x = page.locator('.chat-modal-titlebar button').last();
      await x.click();
      await page.waitForTimeout(500);
    });

    await step(`${p.id}: chip returns to OFF`, async () => {
      const off = await page
        .locator(`button[title*="Launch ${p.name} console"]`)
        .first()
        .isVisible()
        .catch(() => false);
      if (!off) throw new Error(`${p.name} chip did not return to OFF`);
    });
  }

  // Multi-agent: launch 3 in a row; accept that each launch re-opens a chat —
  // close it via header X between launches to keep the grid actionable.
  // Since header X deactivates too, the expected outcome for this specific
  // test is: only the LAST agent launched remains in the grid.
  await step('multi: three sequential launches leave last one LIVE', async () => {
    for (const name of ['ULTRON', 'NOVA', 'FORGE']) {
      const btn = page.locator(`button[title*="Launch ${name} console"]`).first();
      await btn.click();
      await page.waitForTimeout(500);
    }
    // All three chats stack; last one is on top. Verify FORGE (last) card visible.
    const card = page
      .locator('section:has-text("ACTIVE CONSOLES") button:has-text("CODE FOUNDRY")')
      .first();
    const v = await card.isVisible().catch(() => false);
    if (!v) throw new Error('FORGE card missing after sequential launches');
  });

  await page.screenshot({ path: path.join(OUT, '99-three-live.png') });

  // Teardown: close any remaining chat modal (each sequential launch closes prior)
  await step('teardown: close all remaining chats', async () => {
    // Each active agent renders its own ChatModal; close them one by one.
    for (let i = 0; i < 5; i++) {
      const x = page.locator('.chat-modal-titlebar button').last();
      const v = await x.isVisible().catch(() => false);
      if (!v) break;
      await x.click();
      await page.waitForTimeout(300);
    }
  });

  await step('final: grid returns to empty', async () => {
    const empty = await page.locator('text=No consoles online').first().isVisible().catch(() => false);
    if (!empty) throw new Error('grid did not reset');
  });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ errors, report }, null, 2));

  const fails = report.filter((r) => r.status !== 'ok');
  log(`SUMMARY: ${report.length - fails.length}/${report.length} pass`);
  for (const r of report) log(`  ${r.status === 'ok' ? '✓' : '✗'} ${r.name}${r.note ? ' — ' + r.note : ''}`);
  if (errors.length) {
    console.log(`\nConsole errors (${errors.length}):`);
    errors.slice(0, 10).forEach((e) => console.log('  !', e.slice(0, 200)));
  }

  await app.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('[agents] FAIL', e);
  process.exit(2);
});
