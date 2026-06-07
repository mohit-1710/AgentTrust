import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        // Editorial light system, mirrored from the marketing site.
        bg: "var(--bg)",
        "bg-elev": "var(--bg-elev)",
        "bg-neutral": "var(--bg-neutral)",
        "bg-dark": "var(--bg-dark)",
        "bg-dark-card": "var(--bg-dark-card)",
        ink: "var(--ink)",
        "ink-dim": "var(--ink-dim)",
        rule: "var(--border)",
        "rule-dark": "var(--border-dark)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        // Tailwind aliases used across the app.
        background: "var(--bg)",
        foreground: "var(--ink)",
        border: "var(--border)",
        muted: {
          DEFAULT: "var(--bg-neutral)",
          foreground: "var(--ink-dim)",
        },
        card: {
          DEFAULT: "var(--bg-elev)",
          foreground: "var(--ink)",
        },
        // Monad purple ramp.
        monad: {
          DEFAULT: "#836EF9",
          50: "#EEEBFF",
          100: "#E0DBFF",
          200: "#C7BCFF",
          300: "#A892FF",
          400: "#9580FF",
          500: "#836EF9",
          600: "#6B54E8",
          700: "#5840C4",
          800: "#3B2A8A",
          900: "#221C3D",
          ink: "#0E0B1A",
        },
        // Verdict tones tuned for a light surface.
        allow: "var(--success)",
        deny: "var(--danger)",
        warn: "var(--warning)",
      },
      letterSpacing: {
        display: "-0.04em",
        body: "-0.01em",
        "mono-label": "0.15em",
      },
      borderRadius: {
        lg: "10px",
        md: "8px",
        sm: "6px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scan": {
          "0%": { transform: "translateY(-120%)" },
          "100%": { transform: "translateY(520%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "route-pulse": {
          from: { transform: "translate3d(-110%, 0, 0)" },
          to: { transform: "translate3d(270%, 0, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "scan": "scan 2.2s linear infinite",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        "route-pulse": "route-pulse 2.6s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
