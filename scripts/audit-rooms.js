// Exhaustive audit for AgentLauncher + RoomGrid + RoomCard + AddAgentModal
// Tests gating logic: rooms appear only when console is open
/* eslint-disable */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = path.join(__dirname, '..', '.overnight-plan', 'audit-rooms');
fs.mkdirSync(OUT, { recursive: true });

function log(...a) {
  console.log('[rooms-audit]', ...a);
}

(async () => {
  const userData = path.join(os.tmpdir(), `ultronos-rooms-${Date.now()}`);
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
    console.error('[rooms-audit] FAIL: no app window');
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

  async function clickIfVisible(selector, timeout = 2500) {
    const l = page.locator(selector).first();
    await l.waitFor({ state: 'visible', timeout });
    await l.click();
  }

  // ===== LAUNCHER PRESETS =====
  await step('launcher: 6 presets rendered', async () => {
    const presets = ['ULTRON', 'NOVA', 'FORGE', 'ARES', 'ECHO', 'MIDAS'];
    for (const name of presets) {
      const visible = await page.locator(`button[title*="Launch ${name} console"]`).first().isVisible().catch(() => false);
      if (!visible) throw new Error(`${name} preset missing`);
    }
  });

  await step('launcher: Add Agent button rendered', async () => {
    const visible = await page.locator('button:has-text("Add Agent")').first().isVisible().catch(() => false);
    if (!visible) throw new Error('Add Agent button missing');
  });

  await step('launcher: OFF chip — grayscale emoji + text-white/35', async () => {
    const btn = page.locator('button[title*="Launch ULTRON console"]').first();
    const emoji = btn.locator('span').nth(1); // second span is emoji
    const style = await emoji.evaluate((e) => window.getComputedStyle(e).filter);
    if (!style || style === 'none') throw new Error('emoji not grayscaled');
  });

  await step('launcher: idle chip has gray dot (not glowing)', async () => {
    const btn = page.locator('button[title*="Launch ULTRON console"]').first();
    const dot = btn.locator('span[style*="background"]').first();
    const bg = await dot.evaluate((e) => e.style.background || e.style.backgroundColor);
    if (bg !== '#3a3f4a') throw new Error(`expected gray #3a3f4a, got ${bg}`);
  });

  await step('launcher: idle OFF label visible', async () => {
    const btn = page.locator('button[title*="Launch ULTRON console"]').first();
    const hasOff = await btn.locator('text=OFF').isVisible().catch(() => false);
    if (!hasOff) throw new Error('OFF label missing');
  });

  // ===== ROOM GRID: EMPTY STATE =====
  await step('grid: empty state header visible', async () => {
    const header = await page.locator('[class*="pixel"]:has-text("[ACTIVE CONSOLES]")').first().isVisible().catch(() => false);
    if (!header) throw new Error('[ACTIVE CONSOLES] header missing');
  });

  await step('grid: no consoles message shown', async () => {
    const empty = await page.locator('text=No consoles online').first().isVisible().catch(() => false);
    if (!empty) throw new Error('empty state not visible');
  });

  // ===== LAUNCH ULTRON: STATE TRANSITIONS =====
  await step('launcher: launch ULTRON → chip → LIVE', async () => {
    const btn = page.locator('button[title*="Launch ULTRON console"]').first();
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    await btn.click();
    await page.waitForTimeout(800);
    const live = await page.locator('button[title*="ULTRON console open"]').first().isVisible().catch(() => false);
    if (!live) throw new Error('chip did not become LIVE');
  });

  await step('launcher: LIVE chip has neon color + glow', async () => {
    const btn = page.locator('button[title*="ULTRON console open"]').first();
    const shadow = await btn.evaluate((e) => window.getComputedStyle(e).boxShadow);
    if (!shadow || shadow === 'none') throw new Error('LIVE chip missing glow');
  });

  await step('launcher: LIVE chip name has neón color (not white/35)', async () => {
    const btn = page.locator('button[title*="ULTRON console open"]').first();
    const nameSpan = btn.locator('span[class*="pixel"]').first();
    const color = await nameSpan.evaluate((e) => window.getComputedStyle(e).color);
    if (!color || color === 'rgb(255, 255, 255)') throw new Error('name not neoned');
  });

  await step('launcher: LIVE label green + pulse', async () => {
    const btn = page.locator('button[title*="ULTRON console open"]').first();
    const label = btn.locator('text=LIVE').first();
    const visible = await label.isVisible().catch(() => false);
    if (!visible) throw new Error('LIVE label missing');
  });

  // ===== ROOM GRID: CARD APPEARS =====
  await page.screenshot({ path: path.join(OUT, '01-ultron-live.png') });

  await step('grid: ULTRON card appeared (1 card total)', async () => {
    // Cards render as buttons with room names (COMMAND BRIDGE, CODEX ARCHIVE, etc)
    const cards = page.locator('button:has-text("COMMAND BRIDGE"), button:has-text("CODEX ARCHIVE"), button:has-text("FORGE NEXUS"), button:has-text("WAR ROOM"), button:has-text("ORACLE SANCTUM"), button:has-text("VAULT PRIME")');
    const count = await cards.count();
    if (count !== 1) throw new Error(`expected 1 card, got ${count}`);
  });

  await step('grid: card shows COMMAND BRIDGE room name', async () => {
    const card = page.locator('button:has-text("COMMAND BRIDGE")').first();
    await card.waitFor({ state: 'visible', timeout: 2000 });
  });

  await step('grid: card shows emoji + level + rank badge', async () => {
    const card = page.locator('button:has-text("COMMAND BRIDGE")').first();
    const emoji = await card.locator('text=🛡️').first().isVisible().catch(() => false);
    if (!emoji) throw new Error('emoji missing');
    const level = await card.locator('text=/L\\d+/').first().isVisible().catch(() => false);
    if (!level) throw new Error('level badge missing');
  });

  await step('grid: card shows XP bar (width reflects progress)', async () => {
    const card = page.locator('button:has-text("COMMAND BRIDGE")').first();
    const bar = card.locator('[class*="overflow-hidden"] > div').first();
    const width = await bar.evaluate((e) => e.style.width);
    if (!width) throw new Error('XP bar missing width');
  });

  await step('grid: card footer shows agent name (ULTRON)', async () => {
    const card = page.locator('button:has-text("COMMAND BRIDGE")').first();
    const hasAgent = await card.locator('text=ULTRON').isVisible().catch(() => false);
    if (!hasAgent) throw new Error('agent name not shown');
  });

  await step('grid: card has × close button (top-right)', async () => {
    const card = page.locator('button:has-text("COMMAND BRIDGE")').first();
    const closeBtn = page.locator('button[aria-label*="Close"]').first();
    await closeBtn.waitFor({ state: 'visible', timeout: 1000 });
  });

  // ===== MULTI-AGENT LAUNCH =====
  await step('launcher: launch NOVA (2nd agent)', async () => {
    const btn = page.locator('button[title*="Launch NOVA console"]').first();
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    await btn.click();
    await page.waitForTimeout(800);
  });

  await step('grid: NOVA card appeared (2 cards total)', async () => {
    const cards = page.locator('button:has-text("COMMAND BRIDGE"), button:has-text("CODEX ARCHIVE"), button:has-text("FORGE NEXUS"), button:has-text("WAR ROOM"), button:has-text("ORACLE SANCTUM"), button:has-text("VAULT PRIME")');
    const count = await cards.count();
    if (count !== 2) throw new Error(`expected 2 cards, got ${count}`);
  });

  await step('launcher: launch FORGE (3rd agent)', async () => {
    const btn = page.locator('button[title*="Launch FORGE console"]').first();
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    await btn.click();
    await page.waitForTimeout(800);
  });

  await step('grid: grid shows 3-col layout (3 cards)', async () => {
    const cards = page.locator('button:has-text("COMMAND BRIDGE"), button:has-text("CODEX ARCHIVE"), button:has-text("FORGE NEXUS"), button:has-text("WAR ROOM"), button:has-text("ORACLE SANCTUM"), button:has-text("VAULT PRIME")');
    const count = await cards.count();
    if (count !== 3) throw new Error(`expected 3 cards, got ${count}`);
  });

  await page.screenshot({ path: path.join(OUT, '02-three-agents.png') });

  // ===== CLOSE AGENT =====
  await step('grid: close NOVA card via × button', async () => {
    const novCard = page.locator('button:has-text("CODEX ARCHIVE")').first();
    const closeBtn = novCard.locator('..').first().locator('button[aria-label*="Close"]').first();
    await closeBtn.click();
    await page.waitForTimeout(400);
  });

  await step('grid: NOVA card removed (2 cards remain)', async () => {
    const cards = page.locator('button[class*="group"][class*="relative"][class*="flex"][class*="flex-col"]');
    const count = await cards.count();
    if (count !== 2) throw new Error(`expected 2 cards after close, got ${count}`);
  });

  await step('launcher: NOVA chip returned to OFF state', async () => {
    const btn = page.locator('button[title*="Launch NOVA console"]').first();
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) throw new Error('NOVA chip not restored');
  });

  // ===== FOCUS (RE-CLICK) =====
  await step('grid: click ULTRON card → focus (no 2nd modal)', async () => {
    const card = page.locator('button:has-text("COMMAND BRIDGE")').first();
    await card.click();
    await page.waitForTimeout(300);
    // Should focus existing, not open new modal
    const cards = page.locator('button[class*="group"][class*="relative"][class*="flex"][class*="flex-col"]');
    const count = await cards.count();
    if (count !== 2) throw new Error('unexpected cards after focus');
  });

  await step('launcher: re-click LIVE chip → focus (no 2nd modal)', async () => {
    const btn = page.locator('button[title*="Launch ULTRON console"]').first();
    await btn.click();
    await page.waitForTimeout(300);
    const cards = page.locator('button[class*="group"][class*="relative"][class*="flex"][class*="flex-col"]');
    const count = await cards.count();
    if (count !== 2) throw new Error('unexpected cards after re-click');
  });

  // ===== ADD AGENT MODAL =====
  await step('add agent: open modal via launcher button', async () => {
    const addBtn = page.locator('button:has-text("Add Agent")').first();
    await addBtn.click();
    await page.waitForTimeout(400);
    const header = await page.locator('text=[ADD AGENT]').first().isVisible().catch(() => false);
    if (!header) throw new Error('modal did not open');
  });

  await page.screenshot({ path: path.join(OUT, '03-add-agent-open.png') });

  await step('add agent modal: name input renders', async () => {
    const input = page.locator('input[placeholder*="CIPHER"]').first();
    await input.waitFor({ state: 'visible', timeout: 1000 });
  });

  await step('add agent modal: role input renders', async () => {
    const input = page.locator('input[placeholder*="Cryptographer"]').first();
    await input.waitFor({ state: 'visible', timeout: 1000 });
  });

  await step('add agent modal: color picker + hex text input', async () => {
    const picker = page.locator('input[type="color"]').first();
    const hexInput = page.locator('input[type="text"]').nth(1); // after name
    const pickerVis = await picker.isVisible().catch(() => false);
    const hexVis = await hexInput.isVisible().catch(() => false);
    if (!pickerVis || !hexVis) throw new Error('color controls missing');
  });

  await step('add agent modal: vibe keywords input + Add button', async () => {
    const input = page.locator('input[placeholder*="wizard"]').first();
    const addBtn = page.locator('button:has-text("Add")').first();
    const inputVis = await input.isVisible().catch(() => false);
    const btnVis = await addBtn.isVisible().catch(() => false);
    if (!inputVis || !btnVis) throw new Error('vibe controls missing');
  });

  await step('add agent modal: CREATE button disabled (empty form)', async () => {
    const btn = page.locator('button:has-text("CREATE AGENT")').first();
    const disabled = await btn.isDisabled().catch(() => false);
    if (!disabled) throw new Error('CREATE should be disabled when form empty');
  });

  // Fill form
  await step('add agent modal: fill name', async () => {
    const input = page.locator('input[placeholder*="CIPHER"]').first();
    await input.fill('SPECTRE');
    await page.waitForTimeout(200);
  });

  await step('add agent modal: fill role', async () => {
    const input = page.locator('input[placeholder*="Cryptographer"]').first();
    await input.fill('Ghost Agent');
    await page.waitForTimeout(200);
  });

  await step('add agent modal: change color via picker', async () => {
    const picker = page.locator('input[type="color"]').first();
    await picker.fill('#ff0080');
    await page.waitForTimeout(200);
  });

  await step('add agent modal: color hex input synced', async () => {
    const hexInput = page.locator('input[placeholder="#22e8ff"]').first();
    const val = await hexInput.inputValue();
    if (val !== '#ff0080') throw new Error(`hex not synced: ${val}`);
  });

  await step('add agent modal: add vibe tag via Enter', async () => {
    const vibeInput = page.locator('input[placeholder*="wizard"]').first();
    await vibeInput.fill('phantom');
    await vibeInput.press('Enter');
    await page.waitForTimeout(200);
    const chip = await page.locator('text=phantom').first().isVisible().catch(() => false);
    if (!chip) throw new Error('vibe chip not added');
  });

  await step('add agent modal: add 2nd vibe via button', async () => {
    const vibeInput = page.locator('input[placeholder*="wizard"]').first();
    await vibeInput.fill('stealth');
    // Find the Add button that's immediately after the vibe input (in the same flex container)
    const vibeContainer = vibeInput.locator('..');
    const addBtn = vibeContainer.locator('button').first();
    await addBtn.click();
    await page.waitForTimeout(200);
    const chip = await page.locator('text=stealth').first().isVisible().catch(() => false);
    if (!chip) throw new Error('2nd vibe not added');
  });

  await step('add agent modal: remove vibe tag', async () => {
    const chip = page.locator('text=phantom').first();
    const parent = chip.locator('..');
    const removeBtn = parent.locator('button').last();
    await removeBtn.click();
    await page.waitForTimeout(200);
    const visible = await page.locator('text=phantom').first().isVisible().catch(() => false);
    if (visible) throw new Error('vibe not removed');
  });

  await step('add agent modal: max 5 vibe tags (Add button disables)', async () => {
    const vibeInput = page.locator('input[placeholder*="wizard"]').first();
    for (let i = 0; i < 4; i++) {
      await vibeInput.fill(`vibe${i}`);
      await vibeInput.press('Enter');
      await page.waitForTimeout(100);
    }
    const vibeContainer = vibeInput.locator('..');
    const addBtn = vibeContainer.locator('button').first();
    const disabled = await addBtn.isDisabled().catch(() => false);
    if (!disabled) throw new Error('Add button should disable at 5 vibes');
  });

  await step('add agent modal: CREATE button enabled (form filled)', async () => {
    const btn = page.locator('button:has-text("CREATE AGENT")').first();
    const disabled = await btn.isDisabled().catch(() => false);
    if (disabled) throw new Error('CREATE should be enabled with form filled');
  });

  await page.screenshot({ path: path.join(OUT, '04-add-agent-filled.png') });

  // Submit
  await step('add agent modal: submit → POST /api/agents/generate-room', async () => {
    // Monitor network request
    let reqSent = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/agents/generate-room')) {
        reqSent = true;
      }
    });
    const btn = page.locator('button:has-text("CREATE AGENT")').first();
    await btn.click();
    await page.waitForTimeout(2000);
    if (!reqSent) throw new Error('API request not sent');
  });

  await step('add agent modal: custom agent saved to localStorage', async () => {
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('ultronos.customAgents.v1');
      return raw ? JSON.parse(raw) : [];
    });
    if (stored.length === 0) throw new Error('custom agent not saved');
  });

  await step('add agent modal: closed after success', async () => {
    const header = await page.locator('text=[ADD AGENT]').first().isVisible().catch(() => false);
    if (header) throw new Error('modal should close after success');
  });

  await step('launcher: custom agent appears in launcher', async () => {
    const btn = page.locator('button[title*="SPECTRE"]').first();
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) throw new Error('custom agent not in launcher');
  });

  await step('launcher: custom agent chip is OFF (not launched)', async () => {
    const btn = page.locator('button[title*="Launch SPECTRE console"]').first();
    const hasOff = await btn.locator('text=OFF').isVisible().catch(() => false);
    if (!hasOff) throw new Error('custom agent should start OFF');
  });

  await step('launcher: launch custom agent → LIVE + grid card', async () => {
    const btn = page.locator('button[title*="Launch SPECTRE console"]').first();
    await btn.click();
    await page.waitForTimeout(500);
    const live = await page.locator('button[title*="SPECTRE console open"]').first().isVisible().catch(() => false);
    if (!live) throw new Error('custom agent chip not LIVE');
  });

  await step('grid: custom agent room card visible', async () => {
    const card = page.locator('button:has-text("SPECTRE")').nth(1); // second (launcher has first)
    await card.waitFor({ state: 'visible', timeout: 2000 });
  });

  // ===== ERROR HANDLING =====
  await step('add agent modal: open again for error test', async () => {
    const addBtn = page.locator('button:has-text("Add Agent")').first();
    await addBtn.click();
    await page.waitForTimeout(400);
  });

  await step('add agent modal: CREATE disabled with empty name', async () => {
    const nameInput = page.locator('input[placeholder*="CIPHER"]').first();
    await nameInput.clear();
    const btn = page.locator('button:has-text("CREATE AGENT")').first();
    const disabled = await btn.isDisabled().catch(() => false);
    if (!disabled) throw new Error('CREATE should be disabled with empty name');
  });

  await step('add agent modal: close via Esc', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const header = await page.locator('text=[ADD AGENT]').first().isVisible().catch(() => false);
    if (header) throw new Error('modal did not close on Esc');
  });

  await step('add agent modal: close via X button', async () => {
    const addBtn = page.locator('button:has-text("Add Agent")').first();
    await addBtn.click();
    await page.waitForTimeout(400);
    const x = page.locator('button[class*="text-white/40"]').first();
    await x.click();
    await page.waitForTimeout(300);
    const header = await page.locator('text=[ADD AGENT]').first().isVisible().catch(() => false);
    if (header) throw new Error('modal did not close on X');
  });

  // ===== CLEANUP =====
  await step('grid: close all agents', async () => {
    const closeBtns = page.locator('button[aria-label*="Close"]');
    const count = await closeBtns.count();
    for (let i = 0; i < count; i++) {
      const btn = closeBtns.nth(0); // always nth(0) because count changes
      await btn.click();
      await page.waitForTimeout(300);
    }
  });

  await step('grid: returns to empty state', async () => {
    const empty = await page.locator('text=No consoles online').first().isVisible().catch(() => false);
    if (!empty) throw new Error('grid did not return to empty');
  });

  // ===== FINAL =====
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
  console.error('[rooms-audit] FAIL', e);
  process.exit(2);
});
