import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1360px" },
    },
    extend: {
      colors: {
        // Shiraz Beauty — elegant blue on crisp white.
        azure: {
          DEFAULT: "hsl(var(--azure))",
          light: "hsl(var(--azure-light))",
          dark: "hsl(var(--azure-dark))",
          tint: "hsl(var(--azure-tint))",
          foreground: "hsl(var(--azure-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          strong: "hsl(var(--surface-strong))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          muted: "hsl(var(--ink-muted))",
        },
        mint: "hsl(var(--mint))",
        amber: "hsl(var(--amber))",

        // Shadcn-compatible semantic aliases.
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        vazirmatn: ["var(--font-vazirmatn)", "Tahoma", "sans-serif"],
        sans: ["var(--font-vazirmatn)", "Tahoma", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        // Cool-toned shadows so cards never look muddy against white.
        soft: "0 18px 44px -24px hsl(219 45% 24% / 0.20), 0 3px 12px -6px hsl(219 45% 24% / 0.08)",
        "soft-sm": "0 8px 24px -14px hsl(219 45% 24% / 0.16)",
        elevated: "0 34px 80px -32px hsl(219 45% 24% / 0.26)",
        azure: "0 14px 32px -14px hsl(var(--azure) / 0.55)",
      },
      backgroundImage: {
        "gradient-azure":
          "linear-gradient(120deg, hsl(var(--azure-dark)) 0%, hsl(var(--azure)) 48%, hsl(var(--azure-light)) 100%)",
        "gradient-surface":
          "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--surface)) 100%)",
        "gradient-tint":
          "linear-gradient(135deg, hsl(var(--azure-tint)) 0%, hsl(var(--surface)) 100%)",
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 6s linear infinite",
        float: "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
