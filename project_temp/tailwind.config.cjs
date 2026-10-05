/** @type {import('tailwindcss').Config} */
    module.exports = {
      darkMode: ["class"],
      content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./App.tsx"
      ],
      theme: {
        extend: {
          colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: {
              DEFAULT: '#4a0a13',
              foreground: '#fff6e2'
            },
            secondary: {
              DEFAULT: '#fbbf24',
              foreground: '#4a0a13'
            },
            accent: {
              DEFAULT: '#7a1320',
              foreground: '#fff6e2'
            },
            ivory: '#fff6e2'
          },
          fontFamily: {
            sans: ["'Inter'", "sans-serif"],
            serif: ["'Lora'", "serif"],
            devanagari: ["'Noto Sans Devanagari'", "sans-serif"]
          },
          borderRadius: {
            '3xl': '1.5rem',
            '4xl': '2rem'
          }
        }
      },
      plugins: [require("tailwindcss-animate")],
    };