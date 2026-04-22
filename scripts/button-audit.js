// Button audit — opens the Next renderer in Chromium (no Electron) and clicks every visible button,
// collecting console errors and DOM changes. Produces a compact pass/fail report.
/* eslint-disable */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.ULTRONOS_URL || 'http://127.0.0.1:3100/';
const OUT = path.join(__dirname, '..', '.overnight-plan', 'button-audit');
fs.mkdirSync(OUT, { recursive: true });

function log(...a) {
  console.log('[audit]', ...a);
}

async function shoot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });

  // Stub Electron preload bridge so `window.ultronos` exists — lets handlers run without crashing.
  await ctx.addInitScript(() => {
    const noop = () => undefined;
    const ok = async () => ({ ok: true });
    const unsub = () => () => undefined;
    const idleRuntime = () => ({
      sessionId: 's1',
      agentId: 'ultron',
      status: 'idle',
      pid: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });
    window.ultronos = {
      windowControls: {
        minimize: noop,
        maximize: noop,
        close: noop,
        isMaximized: async () => false,
      },
      onMaximizedChange: unsub,
      notify: noop,
      setBadge: noop,
      tray: { setTooltip: noop, setStatus: noop },
      shell: { openExternal: noop, openPath: noop },
      settings: {
        get: async () => ({
          zoomFactor: 1,
          alwaysOnTop: false,
          theme: 'dark',
          sfx: true,
          voice: true,
        }),
        set: async () => ({}),
        reset: async () => ({}),
        defaults: async () => ({}),
      },
      zoom: {
        get: async () => 1,
        set: async () => 1,
        in: async () => 1,
        out: async () => 1,
        reset: async () => 1,
      },
      app: {
        info: async () => ({
          version: 'dev',
          name: 'ultronos',
          electronVersion: 'n/a',
          nodeVersion: 'stub',
          chromeVersion: 'n/a',
          platform: 'browser',
          arch: 'x64',
          userData: '/tmp',
        }),
        relaunch: noop,
      },
      platform: 'browser',
      getDataDir: async () => '/tmp',
      getFilePathForDrop: async () => undefined,
      agent: {
        spawn: async () => idleRuntime(),
        kill: ok,
        input: ok,
        list: async () => [],
        transcript: async () => [],
        clear: ok,
        restart: async () => idleRuntime(),
        onOutput: unsub,
        onStatus: unsub,
      },
      feed: { on: unsub },
      listener: {
        start: ok,
        stop: ok,
        restart: ok,
        getStatus: async () => ({ running: false, restartCount: 0 }),
        onLog: unsub,
        onStatus: unsub,
      },
      launcher: { hide: ok, execute: ok },
      mode: {
        get: async () => 'operator',
        set: ok,
        list: async () => ['operator', 'overnight', 'observer'],
        config: async () => ({}),
        onChange: unsub,
      },
      win11ai: {
        available: async () => false,
        ocr: async () => ({ text: '' }),
        summarize: async () => ({ text: '' }),
        describe: async () => ({ text: '' }),
        generate: async () => ({ text: '' }),
      },
      voice: {
        start: ok,
        stop: ok,
        transcribe: async () => ({ transcript: '' }),
        sendToAgent: ok,
        onPartial: unsub,
        onComplete: unsub,
        onError: unsub,
      },
      worktree: {
        create: async () => ({ worktreePath: '/tmp/w', branch: 'main' }),
        list: async () => [],
        remove: ok,
        prune: async () => 0,
        diff: async () => '',
      },
    };
  });

  const page = await ctx.newPage();

  const errors = [];
  const warnings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  log('goto', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  await shoot(page, '00-initial');

  const report = [];
  async function step(name, fn) {
    const before = errors.length;
    let status = 'ok';
    let note = '';
    try {
      await fn();
    } catch (e) {
      status = 'fail';
      note = String(e.message || e).slice(0, 200);
    }
    const after = errors.length;
    const newErrs = errors.slice(before, after);
    if (newErrs.length) {
      status = 'fail';
      note = (note ? note + ' | ' : '') + newErrs.join(' | ').slice(0, 300);
    }
    report.push({ name, status, note });
    log(`${status === 'ok' ? '✓' : '✗'} ${name}${note ? ' — ' + note : ''}`);
  }

  async function clickIfVisible(selector, timeout = 1500) {
    const l = page.locator(selector).first();
    await l.waitFor({ state: 'visible', timeout });
    await l.click();
  }

  // === TitleBar ===
  await step('titlebar: open Galaxy', async () => {
    await clickIfVisible('button[aria-label="Memory Galaxy"], button[title*="Galaxy"]');
    await page.waitForTimeout(400);
  });
  await shoot(page, '10-galaxy');

  await step('titlebar: close Galaxy (X)', async () => {
    await clickIfVisible('button[title^="Close (Ctrl+G"]');
    await page.waitForTimeout(300);
  });

  await step('titlebar: open Settings', async () => {
    await clickIfVisible('button[aria-label="Settings"]');
    await page.waitForTimeout(500);
  });
  await shoot(page, '11-settings');
  await step('titlebar: close Settings (Esc)', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });

  await step('titlebar: minimize', async () => {
    await clickIfVisible('button[title="Minimize"]');
  });
  await step('titlebar: maximize', async () => {
    await clickIfVisible('button[title="Maximize"], button[title="Restore"]');
  });
  await step('titlebar: close', async () => {
    await clickIfVisible('button[title="Close"]');
  });

  // === Shortcuts ===
  await step('shortcut: ⌘K CommandPalette', async () => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    const visible = await page.locator('input[placeholder*="Type a command"], [role="dialog"]').first().isVisible().catch(() => false);
    if (!visible) throw new Error('palette did not open');
  });
  await shoot(page, '12-palette');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await step('shortcut: ⌘M MemoryPanel', async () => {
    await page.keyboard.press('Control+m');
    await page.waitForTimeout(300);
  });
  await shoot(page, '13-memory');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await step('shortcut: ⌘, Settings', async () => {
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(300);
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await step('shortcut: ⌘G Galaxy toggle', async () => {
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(200);
  });

  // === Room grid ===
  await step('room grid: click ULTRON card', async () => {
    const card = page.locator('button:has-text("COMMAND BRIDGE")').first();
    await card.waitFor({ state: 'visible', timeout: 2000 });
    await card.click();
    await page.waitForTimeout(600);
  });
  await shoot(page, '20-chatmodal-ultron');

  await step('chat modal: send form rendered', async () => {
    await page.locator('button[type="submit"]:has-text("SEND")').first().waitFor({ state: 'visible', timeout: 3000 });
    const stopVisible = await page.locator('button[type="button"]:has-text("STOP")').first().isVisible().catch(() => false);
    if (stopVisible) throw new Error('STOP should be hidden in idle');
  });

  await step('chat modal: click NEW (reset)', async () => {
    await clickIfVisible('button[title="New session"]');
    await page.waitForTimeout(200);
  });

  await step('chat modal: close via X', async () => {
    const closeBtn = page.locator('.chat-modal-titlebar button').last();
    await closeBtn.click();
    await page.waitForTimeout(400);
  });

  // === Add Agent Modal ===
  await step('add agent modal: open', async () => {
    const addBtn = page.locator('button:has-text("Add Agent")').first();
    await addBtn.click();
    await page.waitForTimeout(400);
    const name = await page.locator('input[placeholder*="CIPHER"]').first().isVisible().catch(() => false);
    if (!name) throw new Error('add-agent form did not render');
  });
  await shoot(page, '21-addagent');
  await step('add agent modal: close X', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // === Listener / Conductor tabs ===
  await step('sidebar: switch to Listener tab', async () => {
    await clickIfVisible('button:has-text("Listener")');
    await page.waitForTimeout(300);
  });
  await step('sidebar: switch to Conductor tab', async () => {
    await clickIfVisible('button:has-text("Conductor")');
    await page.waitForTimeout(300);
  });
  await shoot(page, '22-sidebar-conductor');

  // === Final ===
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    JSON.stringify({ errors, warnings, report }, null, 2),
  );

  const fails = report.filter((r) => r.status !== 'ok');
  log(`SUMMARY: ${report.length - fails.length}/${report.length} pass`);
  for (const r of report) {
    console.log(`  ${r.status === 'ok' ? '✓' : '✗'} ${r.name}${r.note ? ' — ' + r.note : ''}`);
  }
  if (errors.length) {
    console.log(`\nConsole errors (${errors.length}):`);
    errors.slice(0, 20).forEach((e) => console.log('  !', e.slice(0, 300)));
  }

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('[audit] FAIL', e);
  process.exit(2);
});
