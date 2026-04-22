export type TaskStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface SwarmTask {
  id: string;
  title: string;
  agentId: string; // ULTRON|NOVA|FORGE|ARES|ECHO|MIDAS
  prompt: string;
  deps: string[]; // ids of tasks this depends on
  status: TaskStatus;
  startedAt?: number;
  finishedAt?: number;
  output?: string;
  error?: string;
  sessionId?: string; // связка с agentRegistry
}

export interface SwarmPlan {
  id: string;
  goal: string;
  createdAt: number;
  tasks: SwarmTask[];
  status: "planning" | "running" | "done" | "failed" | "aborted";
}
