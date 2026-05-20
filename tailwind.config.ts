import type { Config } from "tailwindcss";

/**
 * Design tokens are taken directly from DESIGN.md (PostHog-inspired system):
 * warm cream canvas, olive ink, single yellow-orange primary, flat hairline
 * cards, 4-8px radius vocabulary, IBM Plex Sans across every role.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand & accent
        primary: {
          DEFAULT: "#f7a501",
          pressed: "#dd9001",
          active: "#b17816",
          fg: "#23251d",
        },
        // Surfaces
        canvas: "#eeefe9",
        "surface-soft": "#e5e7e0",
        "surface-card": "#ffffff",
        "surface-doc": "#fcfcfa",
        "surface-dark": "#23251d",
        hairline: {
          DEFAULT: "#bfc1b7",
          soft: "#dcdfd2",
        },
        // Text
        ink: "#23251d",
        body: "#4d4f46",
        charcoal: "#33342d",
        mute: "#6c6e63",
        ash: "#9b9c92",
        stone: "#b6b7af",
        "on-dark": "#ffffff",
        // Semantic
        "link-blue": "#1d4ed8",
        "link-teal": "#1078a3",
        "accent-blue": "#2c84e0",
        "accent-blue-soft": "#dceaf6",
        "accent-red": "#cd4239",
        "accent-red-soft": "#f7d6d3",
        "accent-green": "#2c8c66",
        "accent-green-soft": "#d9eddf",
        "accent-purple": "#7c44a6",
        "accent-purple-soft": "#e7d8ee",
      },
      fontFamily: {
        sans: [
          "var(--font-plex)",
          "IBM Plex Sans",
          "-apple-system",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "Source Code Pro", "monospace"],
      },
      borderRadius: {
        none: "0px",
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        full: "9999px",
      },
      spacing: {
        section: "80px",
      },
      maxWidth: {
        content: "1280px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
