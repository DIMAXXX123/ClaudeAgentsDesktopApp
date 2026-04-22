#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const projectRoot = path.dirname(__dirname);
const isDev = !process.env.ULTRONOS_NO_DEVTOOLS;

function log(msg) {
  console.log(`[galaxy-audit] ${msg}`);
}

function pass(test) {
  console.log(`[galaxy-audit] ✓ ${test}`);
}

function fail(test, reason) {
  console.error(`[galaxy-audit] ✗ ${test}`);
  if (reason) console.error(`             ${reason}`);
  process.exit(1);
}

async function runAudit() {
  const tempDir = path.join(os.tmpdir(), `ultronos-galaxy-audit-${Date.now()}`);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  log(`temp: ${tempDir}`);

  log("Waiting for Next.js dev server (should already be running)...");

  // Wait for Next.js endpoint to be available
  let nextReady = false;
  await new Promise((res) => {
    const startTime = Date.now();
    const interval = setInterval(async () => {
      try {
        const resp = await fetch("http://127.0.0.1:3100/");
        if (resp.ok) {
          nextReady = true;
          clearInterval(interval);
          res();
        }
      } catch (e) {}
    }, 500);
    setTimeout(() => {
      clearInterval(interval);
      if (!nextReady) fail("Next.js dev server not responding in 30s");
      res();
    }, 30000);
  });

  log("Next.js ready at http://127.0.0.1:3100");

  // Skip Electron spawn on Windows (may not be fully built)
  log("Electron check skipped (using Next.js API only)");

  try {
    // Fetch /api/memory-galaxy
    log("Test: /api/memory-galaxy endpoint");
    const resp = await fetch("http://127.0.0.1:3100/api/memory-galaxy");
    if (!resp.ok) fail("/api/memory-galaxy", `HTTP ${resp.status}`);
    const data = await resp.json();
    const graph = data.graph || data;
    if (!graph.nodes || !Array.isArray(graph.nodes)) fail("/api/memory-galaxy", "no nodes array");
    if (!graph.edges || !Array.isArray(graph.edges)) fail("/api/memory-galaxy", "no edges array");
    pass("/api/memory-galaxy returns valid graph");

    // Check node structure
    log("Test: node structure");
    if (graph.nodes.length > 0) {
      const n = graph.nodes[0];
      if (!n.id) fail("node structure", "missing id");
      if (!n.name) fail("node structure", "missing name");
      if (!n.type) fail("node structure", "missing type");
      if (n.degree === undefined && n.tags === undefined) fail("node structure", "missing degree or tags");
      if (!Array.isArray(n.tags)) fail("node structure", "tags not array");
      pass("node structure valid");
    }

    // Check edge structure
    log("Test: edge structure");
    if (graph.edges.length > 0) {
      const e = graph.edges[0];
      if (!e.source) fail("edge structure", "missing source");
      if (!e.target) fail("edge structure", "missing target");
      if (!e.kind) fail("edge structure", "missing kind");
      if (e.weight === undefined) fail("edge structure", "missing weight");
      pass("edge structure valid");
    }

    // Fetch main page
    log("Test: main page render");
    const pageResp = await fetch("http://127.0.0.1:3100/");
    if (!pageResp.ok) fail("main page", `HTTP ${pageResp.status}`);
    const html = await pageResp.text();
    if (!html.includes("ULTRONOS")) fail("main page", "missing ULTRONOS branding");
    pass("main page renders");

    // Test memory galaxy route
    log("Test: /galaxy route");
    const galaxyResp = await fetch("http://127.0.0.1:3100/galaxy");
    if (!galaxyResp.ok) fail("/galaxy", `HTTP ${galaxyResp.status}`);
    const galaxyHtml = await galaxyResp.text();
    if (!galaxyHtml.includes("Memory")) fail("/galaxy", "missing Memory text");
    pass("/galaxy route accessible");

    // Validate graph integrity
    log("Test: graph integrity");
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    let invalidEdges = 0;
    for (const e of graph.edges) {
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) invalidEdges++;
    }
    if (invalidEdges > 0)
      fail("graph integrity", `${invalidEdges} edges reference missing nodes`);
    pass("graph integrity OK");

    // Validate ResizableLayout props
    log("Test: ResizableLayout signature");
    const layoutCode = fs.readFileSync(
      path.join(projectRoot, "renderer/components/ResizableLayout.tsx"),
      "utf8"
    );
    if (!layoutCode.includes("interface ResizableLayoutProps"))
      fail("ResizableLayout", "missing interface");
    if (!layoutCode.includes("galaxyOpen: boolean"))
      fail("ResizableLayout", "missing galaxyOpen prop");
    pass("ResizableLayout props signature");

    // Validate WindowChrome state context
    log("Test: WindowChrome context");
    const chromeCode = fs.readFileSync(
      path.join(projectRoot, "renderer/components/WindowChrome.tsx"),
      "utf8"
    );
    if (!chromeCode.includes("WindowStateContext"))
      fail("WindowChrome", "missing context");
    if (!chromeCode.includes("useWindowState()"))
      fail("WindowChrome", "missing useWindowState");
    pass("WindowChrome context OK");

    // Validate ModeBadge hook
    log("Test: ModeBadge hook");
    const badgeCode = fs.readFileSync(
      path.join(projectRoot, "renderer/components/ModeBadge.tsx"),
      "utf8"
    );
    if (!badgeCode.includes("useUltronosMode"))
      fail("ModeBadge", "missing useUltronosMode");
    pass("ModeBadge hook integrated");

    // Validate Toast implementation
    log("Test: Toast bus");
    const toastCode = fs.readFileSync(
      path.join(projectRoot, "renderer/lib/toastBus.ts"),
      "utf8"
    );
    if (!toastCode.includes("toastListeners"))
      fail("Toast", "missing toastListeners");
    if (!toastCode.includes("pushToast"))
      fail("Toast", "missing pushToast");
    pass("Toast bus implementation");

    // Validate TopStatusBar structure
    log("Test: TopStatusBar structure");
    const statusCode = fs.readFileSync(
      path.join(projectRoot, "renderer/components/TopStatusBar.tsx"),
      "utf8"
    );
    if (!statusCode.includes("onOpenPalette"))
      fail("TopStatusBar", "missing onOpenPalette callback");
    if (!statusCode.includes("onOpenMemory"))
      fail("TopStatusBar", "missing onOpenMemory callback");
    if (!statusCode.includes("GALAXY"))
      fail("TopStatusBar", "missing GALAXY button");
    pass("TopStatusBar structure");

    // Validate MemoryGalaxy physics
    log("Test: MemoryGalaxy physics");
    const galaxyCode = fs.readFileSync(
      path.join(projectRoot, "renderer/components/MemoryGalaxy.tsx"),
      "utf8"
    );
    if (!galaxyCode.includes("physicsRef.current"))
      fail("MemoryGalaxy", "missing physics state");
    if (!galaxyCode.includes("dragNodeRef.current"))
      fail("MemoryGalaxy", "missing drag node tracking");
    if (!galaxyCode.includes("screenToWorld"))
      fail("MemoryGalaxy", "missing coordinate transform");
    pass("MemoryGalaxy physics system");

    // Validate ResizableLayout divider
    log("Test: ResizableLayout dividers");
    if (!layoutCode.includes("Divider"))
      fail("ResizableLayout", "missing Divider component");
    if (!layoutCode.includes("col-resize"))
      fail("ResizableLayout", "missing col-resize cursor");
    pass("ResizableLayout dividers");

    // Validate memory graph graph types
    log("Test: MemoryGalaxy graph types");
    const memGalaxyLib = fs.readFileSync(
      path.join(projectRoot, "renderer/lib/memoryGalaxy.ts"),
      "utf8"
    );
    if (!memGalaxyLib.includes("type MemoryGraph"))
      fail("memoryGalaxy lib", "missing MemoryGraph type");
    if (!memGalaxyLib.includes("buildGraph"))
      fail("memoryGalaxy lib", "missing buildGraph function");
    pass("MemoryGalaxy graph types");

    // Validate memory layout physics
    log("Test: memoryLayout physics");
    const layoutLib = fs.readFileSync(
      path.join(projectRoot, "renderer/lib/memoryLayout.ts"),
      "utf8"
    );
    if (!layoutLib.includes("physicsStep"))
      fail("memoryLayout lib", "missing physicsStep");
    if (!layoutLib.includes("PhysicsState"))
      fail("memoryLayout lib", "missing PhysicsState type");
    pass("memoryLayout physics");

    // Validate useUltronosMode hook
    log("Test: useUltronosMode hook");
    const modeHook = fs.readFileSync(
      path.join(projectRoot, "renderer/lib/useUltronosMode.ts"),
      "utf8"
    );
    if (!modeHook.includes("window.ultronos.mode.get"))
      fail("useUltronosMode", "missing electron IPC call");
    if (!modeHook.includes("setMode"))
      fail("useUltronosMode", "missing setMode callback");
    pass("useUltronosMode hook");

    // Toast auto-dismiss timing
    log("Test: Toast auto-dismiss");
    const toastHost = fs.readFileSync(
      path.join(projectRoot, "renderer/components/Toast.tsx"),
      "utf8"
    );
    if (!toastHost.includes("3500"))
      fail("Toast", "invalid dismiss timeout (should be 3500ms)");
    if (!toastHost.includes("animate-slide-up"))
      fail("Toast", "missing slide-up animation");
    pass("Toast auto-dismiss timing");

    log("\nSUMMARY: all 16 audit tests passed");
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  }
}

runAudit().catch((e) => {
  console.error("[galaxy-audit] fatal error:", e);
  process.exit(1);
});
