import type { TranscriptEvent } from "@/types/ultronos";

export interface ConsoleBlock {
  userInput?: string;
  outputs: TranscriptEvent[];
  status: "pending" | "done" | "error";
}

/**
 * Group transcript events into logical console blocks.
 * Each block = user input + its outputs until next input or status=idle.
 */
export function blockifyTranscript(transcript: TranscriptEvent[]): ConsoleBlock[] {
  if (transcript.length === 0) return [];

  const blocks: ConsoleBlock[] = [];
  let current: ConsoleBlock = {
    userInput: undefined,
    outputs: [],
    status: "pending",
  };

  for (const event of transcript) {
    if (event.kind === "input") {
      // Push previous block if not empty
      if (current.outputs.length > 0 || current.userInput) {
        blocks.push(current);
      }
      current = {
        userInput: event.data,
        outputs: [],
        status: "pending",
      };
    } else if (event.kind === "stdout" || event.kind === "stderr" || event.kind === "event") {
      current.outputs.push(event);
    } else if (event.kind === "status") {
      current.outputs.push(event);
      // Check if idle → mark as done
      if (event.data.toLowerCase().includes("idle")) {
        current.status = "done";
      } else if (event.data.toLowerCase().includes("error")) {
        current.status = "error";
      }
    }
  }

  // Push final block
  if (current.outputs.length > 0 || current.userInput) {
    blocks.push(current);
  }

  return blocks;
}
