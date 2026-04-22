import { describe, it, expect } from "vitest";
import { AGENTS, agentForRoom } from "@/lib/agents";

describe("agentForRoom", () => {
  it("matches COMMAND BRIDGE → ultron", () => {
    expect(agentForRoom("COMMAND BRIDGE").id).toBe("ultron");
  });
  it("matches multi-word 'CODEX ARCHIVE' → nova", () => {
    expect(agentForRoom("CODEX ARCHIVE").id).toBe("nova");
  });
  it("matches 'WAR DECK' → ares", () => {
    expect(agentForRoom("WAR DECK").id).toBe("ares");
  });
  it("matches 'DATA VAULT' → midas", () => {
    expect(agentForRoom("DATA VAULT").id).toBe("midas");
  });
  it("matches 'SIGNAL RELAY' → echo", () => {
    expect(agentForRoom("SIGNAL RELAY").id).toBe("echo");
  });
  it("matches 'CODE FOUNDRY' → forge", () => {
    expect(agentForRoom("CODE FOUNDRY").id).toBe("forge");
  });
  it("unknown room falls back to ultron", () => {
    expect(agentForRoom("NONEXISTENT").id).toBe("ultron");
  });
  it("case and spacing insensitive", () => {
    expect(agentForRoom("command bridge").id).toBe("ultron");
    expect(agentForRoom("  COMMAND BRIDGE  ").id).toBe("ultron");
  });

  it("every agent has required fields", () => {
    for (const a of Object.values(AGENTS)) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.systemPrompt.length).toBeGreaterThan(50);
      expect(Array.isArray(a.allowedTools)).toBe(true);
      expect(a.allowedTools.length).toBeGreaterThan(0);
    }
  });
});
