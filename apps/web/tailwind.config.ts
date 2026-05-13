import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Cinematic Privacy palette — readable on both pale + dark backgrounds.
        ink: {
          50: "#f6f7f9",
          100: "#e9ebf0",
          200: "#cbd0db",
          300: "#9aa3b6",
          500: "#5a6378",
          700: "#2c3346",
          900: "#0f1320",
        },
        seal: {
          50: "#eef2ff",
          100: "#e0e7ff",
          400: "#7c8df0",
          500: "#5168e3",
          600: "#3a4fc9",
          700: "#2c3da3",
        },
        evidence: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        alarm: {
          500: "#ef4444",
          600: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
