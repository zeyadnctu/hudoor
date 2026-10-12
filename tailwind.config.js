/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1F2A33",
        inkdeep: "#141B22",
        inksurface: "#222E38",
        chalk: "#EEF0EA",
        paper: "#FFFFFF",
        register: { DEFAULT: "#2F5D8A", dark: "#24506F", light: "#E4EDF4" },
        stamp: { DEFAULT: "#2E9B5F", dark: "#227346", light: "#E2F2E8" },
        brick: { DEFAULT: "#B5432E", dark: "#93341F", light: "#F7E4DE" },
        hi: { DEFAULT: "#D9A21B", dark: "#A87B0E", light: "#F9EED3" }
      },
      fontFamily: {
        display: ['"Readex Pro"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        body: ['"IBM Plex Sans Arabic"', '"Readex Pro"', "system-ui", "sans-serif"]
      },
      borderRadius: {
        sm2: "6px",
        md2: "10px",
        lg2: "16px",
        frame: "4px"
      }
    }
  },
  plugins: []
};
