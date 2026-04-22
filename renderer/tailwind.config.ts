import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: "#22e8ff",
          green: "#22ff88",
          magenta: "#ff4adf",
          orange: "#ffae3a",
          red: "#ff3a5e",
          purple: "#9a5cff",
          yellow: "#f5d64a",
        },
        bg: {
          base: "#0a0520",
          panel: "#13082b",
          panel2: "#1b0f3a",
          grid: "#1e1240",
        },
      },
      fontFamily: {
        pixel: ["var(--font-pixel)", "ui-monospace", "monospace"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "neon-cyan": "0 0 12px #22e8ff, 0 0 28px rgba(34,232,255,0.35)",
        "neon-green": "0 0 12px #22ff88, 0 0 28px rgba(34,255,136,0.35)",
        "neon-magenta": "0 0 12px #ff4adf, 0 0 28px rgba(255,74,223,0.35)",
        "neon-red": "0 0 12px #ff3a5e, 0 0 28px rgba(255,58,94,0.35)",
      },
      animation: {
        "marquee": "marquee 60s linear infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "scanlines": "scanlines 8s linear infinite",
        "twinkle": "twinkle 4s ease-in-out infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        scanlines: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 100px" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
