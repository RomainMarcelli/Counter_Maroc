import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        morocco: "#1E4A3A",
        terra: "#B5543C",
        sand: "#E9D6B5",
        ivory: "#FFF8EC",
      },
      boxShadow: {
        card: "0 12px 30px rgba(30, 74, 58, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
