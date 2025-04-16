/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // Activamos el modo oscuro basado en clases
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#38bdf8", // Azul claro para modo claro
          dark: "#10b981", // Verde para modo oscuro
        },
        secondary: {
          light: "#0ea5e9", // Azul más oscuro para modo claro
          dark: "#059669", // Verde más oscuro para modo oscuro
        },
        background: {
          light: "#f3f4f6", // Gris muy claro para fondo en modo claro
          dark: "#1f2937", // Gris oscuro para fondo en modo oscuro
        },
        surface: {
          light: "#ffffff", // Blanco para superficies en modo claro
          dark: "#111827", // Casi negro para superficies en modo oscuro
        },
        border: {
          light: "#e5e7eb", // Gris muy claro para bordes en modo claro
          dark: "#374151", // Gris para bordes en modo oscuro
        },
        text: {
          light: "#111827", // Casi negro para texto en modo claro
          dark: "#f9fafb", // Blanco para texto en modo oscuro
        },
      },
    },
  },
  plugins: [],
};
