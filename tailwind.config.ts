import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8f9fa",
        surface: "#f8f9fa",
        "surface-container": "#edeeef",
        "surface-container-low": "#f3f4f5",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#e7e8e9",
        "surface-container-highest": "#e1e3e4",
        "on-background": "#191c1d",
        "on-surface": "#191c1d",
        "on-surface-variant": "#414844",
        primary: "#012d1d",
        "on-primary": "#ffffff",
        "primary-container": "#1b4332",
        "on-primary-container": "#86af99",
        "primary-fixed": "#c1ecd4",
        secondary: "#3f665c",
        "on-secondary": "#ffffff",
        "secondary-container": "#bee8dc",
        "secondary-fixed": "#c1ebdf",
        "on-secondary-fixed-variant": "#274e45",
        tertiary: "#4f0e00",
        "tertiary-container": "#6d230f",
        "on-tertiary-container": "#f3896d",
        outline: "#717973",
        "outline-variant": "#c1c8c2",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "brand-highlight": "#fde68a",
        "inverse-surface": "#2e3132",
        "inverse-on-surface": "#f0f1f2",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
