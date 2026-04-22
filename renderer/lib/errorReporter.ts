let installed = false;

async function ship(payload: {
  source: "client";
  kind: "error" | "warn";
  message: string;
  stack?: string;
}) {
  try {
    await fetch("/api/bugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Network/offline — swallow, nothing we can do from the browser
  }
}

export function installErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    const err = ev.error as Error | undefined;
    ship({
      source: "client",
      kind: "error",
      message: err?.message || ev.message || "Unknown error",
      stack: err?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : JSON.stringify(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    ship({
      source: "client",
      kind: "error",
      message: `UnhandledRejection: ${msg}`,
      stack,
    });
  });

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    const text = args
      .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    ship({ source: "client", kind: "error", message: text.slice(0, 2000) });
  };
}
