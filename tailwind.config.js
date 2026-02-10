/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#F28C28",      // Primary Button / Accent
        secondary: "#1F3C68",    // Secondary Button / Headings
        background: "#F8FAFC",   // App background
        card: "#FFFFFF",         // Card background
        text: {
          primary: "#1E293B",    // Body text
          heading: "#1F3C68",    // Headings
        },
      },
    },
  },
  plugins: [],
};
