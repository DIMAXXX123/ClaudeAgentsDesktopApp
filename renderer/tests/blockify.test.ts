import { describe, it, expect } from "vitest";
import { blockifyTranscript } from "@/lib/blockify";
import type { TranscriptEvent } from "@/types/ultronos";

describe("blockifyTranscript", () => {
  it("should return empty array for empty transcript", () => {
    const result = blockifyTranscript([]);
    expect(result).toEqual([]);
  });

  it("should group input with following outputs", () => {
    const transcript: TranscriptEvent[] = [
      { ts: 1, kind: "input", data: "ls -la", role: "user" },
      { ts: 2, kind: "stdout", data: "file1.txt" },
      { ts: 3, kind: "status", data: "command idle" },
      { ts: 4, kind: "input", data: "echo hello", role: "user" },
      { ts: 5, kind: "stdout", data: "hello" },
    ];

    const result = blockifyTranscript(transcript);
    expect(result).toHaveLength(2);

    // First block
    expect(result[0].userInput).toBe("ls -la");
    expect(result[0].outputs).toHaveLength(2);
    expect(result[0].status).toBe("done");

    // Second block
    expect(result[1].userInput).toBe("echo hello");
    expect(result[1].outputs).toHaveLength(1);
    expect(result[1].status).toBe("pending");
  });

  it("should mark status as error when status contains error", () => {
    const transcript: TranscriptEvent[] = [
      { ts: 1, kind: "input", data: "bad command", role: "user" },
      { ts: 2, kind: "stderr", data: "error occurred" },
      { ts: 3, kind: "status", data: "error in execution" },
    ];

    const result = blockifyTranscript(transcript);
    expect(result[0].status).toBe("error");
  });

  it("should handle stdout/stderr/event outputs", () => {
    const transcript: TranscriptEvent[] = [
      { ts: 1, kind: "input", data: "test", role: "user" },
      { ts: 2, kind: "stdout", data: "line1" },
      { ts: 3, kind: "stderr", data: "warning" },
      { ts: 4, kind: "event", data: "event data" },
    ];

    const result = blockifyTranscript(transcript);
    expect(result[0].outputs).toHaveLength(3);
  });

  it("should start new block on each input", () => {
    const transcript: TranscriptEvent[] = [
      { ts: 1, kind: "input", data: "cmd1", role: "user" },
      { ts: 2, kind: "stdout", data: "out1" },
      { ts: 3, kind: "input", data: "cmd2", role: "user" },
      { ts: 4, kind: "stdout", data: "out2" },
    ];

    const result = blockifyTranscript(transcript);
    expect(result).toHaveLength(2);
    expect(result[0].userInput).toBe("cmd1");
    expect(result[1].userInput).toBe("cmd2");
  });
});
