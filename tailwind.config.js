/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2B457B",     // Primary Button / Accent
        secondary: "#E97638",    // Secondary Button / Headings
        background: "#F2F2F2",   // App background
        card: "#FFFFFF",
        soft: "#F2F2F2",       // Card background
        text: {
          primary: "#1E293B",    // Body text
          heading: "#1F3C68",    // Headings
        },
      },
    },
  },
  plugins: [],
};
