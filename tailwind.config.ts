import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#231816",
        sand: "#f5efe7",
        clay: "#d7b49e",
        blush: "#f0d7cf",
        ember: "#a64f3c",
        pine: "#31534a",
        mist: "#f9f6f2",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "serif"]
      },
      boxShadow: {
        soft: "0 24px 80px rgba(35, 24, 22, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
