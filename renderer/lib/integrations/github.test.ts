import { describe, it, expect } from "vitest";
import {
  parseRepoRef,
  formatStaleness,
} from "./github";

describe("parseRepoRef", () => {
  it("parses slug form", () => {
    const r = parseRepoRef("vercel/next.js");
    expect(r).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("parses HTTPS URL", () => {
    const r = parseRepoRef("https://github.com/anthropics/anthropic-sdk-python");
    expect(r).toEqual({ owner: "anthropics", repo: "anthropic-sdk-python" });
  });

  it("parses HTTPS URL with .git suffix", () => {
    const r = parseRepoRef("https://github.com/facebook/react.git");
    expect(r).toEqual({ owner: "facebook", repo: "react" });
  });

  it("throws on invalid input", () => {
    expect(() => parseRepoRef("not-a-repo")).toThrow();
  });

  it("handles underscores and dots in names", () => {
    const r = parseRepoRef("my_org/my.repo");
    expect(r).toEqual({ owner: "my_org", repo: "my.repo" });
  });
});

describe("formatStaleness", () => {
  it("formats just now", () => {
    expect(formatStaleness(30)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(formatStaleness(300)).toBe("5m ago");
  });

  it("formats hours", () => {
    expect(formatStaleness(7200)).toBe("2h ago");
  });

  it("formats days", () => {
    expect(formatStaleness(86400 * 3)).toBe("3d ago");
  });

  it("formats months", () => {
    expect(formatStaleness(86400 * 45)).toBe("1mo ago");
  });

  it("handles unknown (-1)", () => {
    expect(formatStaleness(-1)).toBe("unknown");
  });
});
