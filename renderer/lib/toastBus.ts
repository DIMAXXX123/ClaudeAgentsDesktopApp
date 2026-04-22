export type Toast = { id: number; text: string; tone: "info" | "error" | "success" };

let counter = 0;
export const toastListeners = new Set<(t: Toast) => void>();

export function pushToast(text: string, tone: Toast["tone"] = "info") {
  const t: Toast = { id: ++counter, text, tone };
  toastListeners.forEach((l) => l(t));
}
