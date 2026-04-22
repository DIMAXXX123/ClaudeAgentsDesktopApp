// Sidebar + Voice comprehensive audit
// Tests: Listener panel (no START/STOP buttons), VoiceButton hotkey, CapabilitiesPanel,
// SuggestionsPanel (click→agent launch), ConductorPanel (IPC calls).
/* eslint-disable */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = path.join(__dirname, '..', '.overnight-plan', 'sidebar-audit');
fs.mkdirSync(OUT, { recursive: true });

function log(...a) {
  console.log('[sidebar-audit]', ...a);
}

(async () => {
  const userData = path.join(os.tmpdir(), `ultronos-sidebar-${Date.now()}`);
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
    console.error('[sidebar-audit] FAIL: no app window');
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

  await page.waitForLoadState('networkidle');
  log('✓ App loaded');

  // Wait a bit for UI to settle
  await page.waitForTimeout(2000);

  const checks = [];
  const failed = [];

  // 1. ListenerPanel: Check if START/STOP buttons exist
  log('\n[CHECK 1] ListenerPanel: START/STOP button presence');
  try {
    const startBtn = await page.locator('button:has-text("START")').first();
    const stopBtn = await page.locator('button:has-text("STOP")').first();
    const startVisible = await startBtn.isVisible().catch(() => false);
    const stopVisible = await stopBtn.isVisible().catch(() => false);

    if (!startVisible && !stopVisible) {
      failed.push('ListenerPanel: No START/STOP buttons found — BUG!');
      log('✗ No START/STOP buttons');
      checks.push({ pass: false, msg: 'ListenerPanel: No START/STOP buttons' });
    } else {
      log(`✓ Found buttons: START=${startVisible}, STOP=${stopVisible}`);
      checks.push({ pass: true, msg: 'ListenerPanel: Buttons present' });
    }
  } catch (e) {
    failed.push(`ListenerPanel check error: ${e.message}`);
    checks.push({ pass: false, msg: `ListenerPanel error: ${e.message}` });
  }

  // 2. VoiceButton: Check hotkey binding (Ctrl+` should trigger record)
  log('\n[CHECK 2] VoiceButton: Hotkey binding (Ctrl+`)');
  try {
    const voiceBtn = await page.locator('button').filter({ has: page.locator('svg[class*="lucide"]') }).first();
    if (await voiceBtn.isVisible()) {
      log('✓ VoiceButton found, simulating Ctrl+` hotkey');
      // Send hotkey
      await page.keyboard.press('Control+Backquote');
      await page.waitForTimeout(500);

      // Check if recording state changed (button bg-red-500 when recording)
      const recordingButton = await page.locator('button[class*="bg-red-500"]').first();
      const isRecording = await recordingButton.isVisible().catch(() => false);
      if (isRecording) {
        log('✓ Hotkey triggered recording');
        checks.push({ pass: true, msg: 'VoiceButton: Hotkey works' });
      } else {
        log('✗ Hotkey did not trigger recording');
        failed.push('VoiceButton: Hotkey (Ctrl+`) not triggering recording');
        checks.push({ pass: false, msg: 'VoiceButton: Hotkey not working' });
      }

      // Stop recording if active
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
    } else {
      log('✗ VoiceButton not visible');
      failed.push('VoiceButton: Component not visible');
      checks.push({ pass: false, msg: 'VoiceButton: Not visible' });
    }
  } catch (e) {
    failed.push(`VoiceButton hotkey check error: ${e.message}`);
    checks.push({ pass: false, msg: `VoiceButton error: ${e.message}` });
  }

  // 3. CapabilitiesPanel: Check section headers + quick actions
  log('\n[CHECK 3] CapabilitiesPanel: Sections and quick actions');
  try {
    const quickActionsSection = await page.locator('text="Quick Actions"').first();
    const agentsSection = await page.locator('text="Agents"').first();
    const servicesSection = await page.locator('text="Services"').first();

    const hasQuick = await quickActionsSection.isVisible().catch(() => false);
    const hasAgents = await agentsSection.isVisible().catch(() => false);
    const hasServices = await servicesSection.isVisible().catch(() => false);

    if (hasQuick && hasAgents && hasServices) {
      log('✓ All sections visible: Quick, Agents, Services');
      checks.push({ pass: true, msg: 'CapabilitiesPanel: All sections present' });

      // Try clicking a quick action (e.g., "Palette")
      const paletteBtn = await page.locator('button:has-text("Palette")').first();
      if (await paletteBtn.isVisible()) {
        log('  Testing click on Palette button...');
        await paletteBtn.click();
        await page.waitForTimeout(300);
        const paletteVisible = await page.locator('[class*="command"]').first().isVisible().catch(() => false);
        if (paletteVisible) {
          log('  ✓ Palette opened');
        }
        // Close palette
        await page.keyboard.press('Escape');
      }
    } else {
      log(`✗ Missing sections: Quick=${hasQuick}, Agents=${hasAgents}, Services=${hasServices}`);
      failed.push(`CapabilitiesPanel: Missing sections`);
      checks.push({ pass: false, msg: 'CapabilitiesPanel: Missing sections' });
    }
  } catch (e) {
    failed.push(`CapabilitiesPanel check error: ${e.message}`);
    checks.push({ pass: false, msg: `CapabilitiesPanel error: ${e.message}` });
  }

  // 4. SuggestionsPanel: Check card presence and click behavior
  log('\n[CHECK 4] SuggestionsPanel: Suggestion cards and click handler');
  try {
    const suggestionSection = await page.locator('text="[SUGGESTIONS]"').first();
    if (await suggestionSection.isVisible()) {
      log('✓ Suggestions section found');

      // Look for suggestion cards (buttons with tone colors)
      const cards = await page.locator('button[class*="border"][class*="bg-white"]').all();
      if (cards.length > 0) {
        log(`✓ Found ${cards.length} suggestion cards`);
        checks.push({ pass: true, msg: `SuggestionsPanel: ${cards.length} cards present` });

        // Try clicking first card
        const firstCard = cards[0];
        log('  Testing click on first card...');
        await firstCard.click();
        await page.waitForTimeout(500);
        log('  ✓ Card click completed (no error thrown)');
      } else {
        log('✗ No suggestion cards found');
        failed.push('SuggestionsPanel: No cards found');
        checks.push({ pass: false, msg: 'SuggestionsPanel: No cards' });
      }
    } else {
      log('✗ Suggestions section not visible');
      failed.push('SuggestionsPanel: Section not visible');
      checks.push({ pass: false, msg: 'SuggestionsPanel: Not visible' });
    }
  } catch (e) {
    failed.push(`SuggestionsPanel check error: ${e.message}`);
    checks.push({ pass: false, msg: `SuggestionsPanel error: ${e.message}` });
  }

  // 5. ConductorPanel: Check IPC handler calls (mock or observe)
  log('\n[CHECK 5] ConductorPanel: Control buttons and IPC integration');
  try {
    const conductorTab = await page.locator('text="CONDUCTOR"').first();
    if (await conductorTab.isVisible()) {
      log('✓ Conductor panel found');

      const planBtn = await page.locator('button:has-text("PLAN")').first();
      const tickBtn = await page.locator('button:has-text("TICK")').first();

      if (await planBtn.isVisible()) {
        log('✓ PLAN button visible');
        checks.push({ pass: true, msg: 'ConductorPanel: Buttons present' });

        // Check if button is disabled (expected when idle)
        const isDisabled = await planBtn.evaluate((el) => el.disabled);
        if (isDisabled) {
          log('  ✓ PLAN button correctly disabled when idle');
        } else {
          log('  Testing PLAN button click...');
          await planBtn.click().catch(() => {});
          await page.waitForTimeout(300);
          log('  ✓ Button click completed');
        }
      } else {
        log('✗ PLAN button not visible');
        failed.push('ConductorPanel: PLAN button not visible');
        checks.push({ pass: false, msg: 'ConductorPanel: Button missing' });
      }
    } else {
      log('✗ Conductor panel tab not visible');
      failed.push('ConductorPanel: Tab not visible');
      checks.push({ pass: false, msg: 'ConductorPanel: Not visible' });
    }
  } catch (e) {
    failed.push(`ConductorPanel check error: ${e.message}`);
    checks.push({ pass: false, msg: `ConductorPanel error: ${e.message}` });
  }

  // Summary
  log('\n════════════════════════════════════════');
  log('AUDIT RESULTS');
  log('════════════════════════════════════════');

  const passing = checks.filter((c) => c.pass).length;
  const total = checks.length;

  checks.forEach((c, i) => {
    const icon = c.pass ? '✓' : '✗';
    log(`${icon} ${i + 1}. ${c.msg}`);
  });

  log(`\nPassed: ${passing}/${total}`);

  if (failed.length > 0) {
    log('\nFailed checks:');
    failed.forEach((f) => log(`  • ${f}`));
  }

  log('\nConsole errors:');
  errors.forEach((e) => log(`  ! ${e}`));

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    passed: passing,
    total: total,
    checks: checks,
    errors: errors,
    warnings: warnings.slice(0, 10),
    failures: failed,
  };

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  log(`\nReport written to ${path.join(OUT, 'report.json')}`);

  await app.close();
  process.exit(passing === total ? 0 : 1);
})().catch((e) => {
  console.error('[sidebar-audit] Fatal:', e);
  process.exit(1);
});
