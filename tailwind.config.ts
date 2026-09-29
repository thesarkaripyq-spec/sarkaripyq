import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Matches sarkaripyq.com's live color scheme exactly (its CSS
          // uses stock Tailwind "blue"). Every button/link/hover/gradient
          // in the app is driven by this single scale, so redefining it
          // here restyles the whole site to match at once.
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb", // sarkaripyq.com's theme-color
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        success: {
          50: "#eefcf3",
          500: "#1f9d55",
          600: "#187a42",
        },
        danger: {
          50: "#fef2f2",
          500: "#dc2626",
          600: "#b91c1c",
        },
        ink: {
          900: "#101418",
          700: "#2c333a",
          500: "#5b6572",
          300: "#98a2ad",
          100: "#e6e9ec",
          50: "#f5f6f8",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "1120px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(16, 20, 24, 0.06)",
        card: "0 1px 3px rgba(16, 20, 24, 0.08)",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
