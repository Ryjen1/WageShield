import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Cinematic Privacy palette.
        // Background + foreground use CSS variables (set in globals.css) so the
        // theme can be flipped between light + dark without a class-name rewrite.
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        card: "var(--card)",

        // Ink scale — keep for components that still want explicit shades.
        ink: {
          50: "#f6f7f9",
          100: "#e9ebf0",
          200: "#cbd0db",
          300: "#9aa3b6",
          500: "#5a6378",
          700: "#2c3346",
          900: "#0f1320",
          950: "#080a14",
        },
        // Seal (action accent — used sparingly).
        seal: {
          400: "#7c8df0",
          500: "#5168e3",
          600: "#3a4fc9",
          700: "#2c3da3",
        },
        // Evidence (decryption / "money revealed").
        evidence: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        // Alarm (errors / k=1 warning).
        alarm: {
          500: "#ef4444",
          600: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.3em",
      },
      animation: {
        "fade-up": "fadeUp 0.7s ease-out forwards",
        "ambient-spin": "ambientSpin 18s linear infinite",
        "ambient-pulse": "ambientPulse 6s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        ambientSpin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        ambientPulse: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
