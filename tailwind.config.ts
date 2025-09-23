import { fontFamily } from "tailwindcss/defaultTheme";
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
	darkMode: ["class"],
	content: [
		"./src/**/*.{html,js,svelte}",
		"./src/**/*.ts",
		"!./src/**/*.d.ts",
		"!./node_modules/**"
	],
	safelist: ["dark"],
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px"
			}
		},
		extend: {
			colors: {
				border: "hsl(var(--border) / <alpha-value>)",
				input: "hsl(var(--input) / <alpha-value>)",
				ring: "hsl(var(--ring) / <alpha-value>)",
				background: "hsl(var(--background) / <alpha-value>)",
				foreground: "hsl(var(--foreground) / <alpha-value>)",
				primary: {
					DEFAULT: "hsl(var(--primary) / <alpha-value>)",
					foreground: "hsl(var(--primary-foreground) / <alpha-value>)"
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
					foreground: "hsl(var(--secondary-foreground) / <alpha-value>)"
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
					foreground: "hsl(var(--destructive-foreground) / <alpha-value>)"
				},
				muted: {
					DEFAULT: "hsl(var(--muted) / <alpha-value>)",
					foreground: "hsl(var(--muted-foreground) / <alpha-value>)"
				},
				accent: {
					DEFAULT: "hsl(var(--accent) / <alpha-value>)",
					foreground: "hsl(var(--accent-foreground) / <alpha-value>)"
				},
				popover: {
					DEFAULT: "hsl(var(--popover) / <alpha-value>)",
					foreground: "hsl(var(--popover-foreground) / <alpha-value>)"
				},
				card: {
					DEFAULT: "hsl(var(--card) / <alpha-value>)",
					foreground: "hsl(var(--card-foreground) / <alpha-value>)"
				},
				sidebar: {
					DEFAULT: "hsl(var(--sidebar-background))",
					foreground: "hsl(var(--sidebar-foreground))",
					primary: "hsl(var(--sidebar-primary))",
					"primary-foreground": "hsl(var(--sidebar-primary-foreground))",
					accent: "hsl(var(--sidebar-accent))",
					"accent-foreground": "hsl(var(--sidebar-accent-foreground))",
					border: "hsl(var(--sidebar-border))",
					ring: "hsl(var(--sidebar-ring))",
        		},
        		orange: {
        			DEFAULT: "#FF5C00",
        			50: "#fff7ed", 
        			100: "#ffedd5",
        			200: "#fed7aa",
        			300: "#fdba74",
        			400: "#fb923c",
        			500: "#FF5C00",
        			600: "#ea580c",
        			700: "#c2410c",
        			800: "#9a3412",
        			900: "#7c2d12",
        			950: "#431407",
        		},
			},
			borderRadius: {
				xl: "calc(var(--radius) + 4px)",
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)"
			},
			fontFamily: {
				sans: [...fontFamily.sans]
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--bits-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--bits-accordion-content-height)" },
					to: { height: "0" },
				},
				"caret-blink": {
					"0%,70%,100%": { opacity: "1" },
					"20%,50%": { opacity: "0" },
				},
				"orb-pulse": {
					"0%, 100%": { 
						transform: "scale(1)",
						boxShadow: "0 0 20px rgba(255, 92, 0, 0.3)"
					},
					"50%": { 
						transform: "scale(1.05)",
						boxShadow: "0 0 40px rgba(255, 92, 0, 0.6)"
					},
				},
				"orb-speaking": {
					"0%": { 
						transform: "scale(1)",
						boxShadow: "0 0 20px rgba(255, 92, 0, 0.3)"
					},
					"15%": { 
						transform: "scale(1.03)",
						boxShadow: "0 0 35px rgba(255, 92, 0, 0.5)"
					},
					"30%": { 
						transform: "scale(0.98)",
						boxShadow: "0 0 25px rgba(255, 92, 0, 0.4)"
					},
					"45%": { 
						transform: "scale(1.06)",
						boxShadow: "0 0 45px rgba(255, 92, 0, 0.6)"
					},
					"60%": { 
						transform: "scale(1.01)",
						boxShadow: "0 0 30px rgba(255, 92, 0, 0.45)"
					},
					"80%": { 
						transform: "scale(1.04)",
						boxShadow: "0 0 38px rgba(255, 92, 0, 0.55)"
					},
					"100%": { 
						transform: "scale(1)",
						boxShadow: "0 0 20px rgba(255, 92, 0, 0.3)"
					},
				},
				"orb-float": {
					"0%, 100%": { transform: "translateY(0)" },
					"50%": { transform: "translateY(-10px)" },
				},
			},
			animation: {
        		"accordion-down": "accordion-down 0.2s ease-out",
        		"accordion-up": "accordion-up 0.2s ease-out",
       			"caret-blink": "caret-blink 1.25s ease-out infinite",
       			"orb-pulse": "orb-pulse 2s ease-in-out infinite",
       			"orb-speaking": "orb-speaking 2.5s ease-in-out infinite",
       			"orb-float": "orb-float 3s ease-in-out infinite",
      		},
		},
	},
	plugins: [tailwindcssAnimate],
};

export default config;
