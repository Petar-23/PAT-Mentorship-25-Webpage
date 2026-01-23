import type { Config } from "tailwindcss";
import svgToDataUri from "mini-svg-data-uri";
import animatePlugin from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";
import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette";

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
  			display: ['var(--font-sora)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
  		},
  		keyframes: {
  			'toast-progress': {
  				from: {
  					transform: 'scaleX(1)'
  				},
  				to: {
  					transform: 'scaleX(0)'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			shine: {
  				from: {
  					backgroundPosition: '200% 0'
  				},
  				to: {
  					backgroundPosition: '-200% 0'
  				}
  			},
  			'text-shine': {
  				'0%, 100%': {
  					'background-position': '200% center'
  				},
  				'50%': {
  					'background-position': '0% center'
  				}
  			},
  			'gradient-xy': {
  				'0%, 100%': {
  					'background-size': '400% 400%',
  					'background-position': '0% 0%'
  				},
  				'25%': {
  					'background-size': '400% 400%',
  					'background-position': '100% 0%'
  				},
  				'50%': {
  					'background-size': '400% 400%',
  					'background-position': '100% 100%'
  				},
  				'100%': {
  					'background-size': '400% 400%',
  					'background-position': '0% 100%'
  				}
  			},
  			'gradient-x': {
  				'0%, 100%': {
  					'background-size': '200% 100%',
  					'background-position': 'left center'
  				},
  				'50%': {
  					'background-size': '200% 100%',
  					'background-position': 'right center'
  				}
  			},
  			aurora: {
  				from: {
  					backgroundPosition: '50% 50%, 50% 50%'
  				},
  				to: {
  					backgroundPosition: '350% 50%, 350% 50%'
  				}
  			},
  			'draw-x': {
  				'0%': {
  					transform: 'scaleX(0)',
  					opacity: '0'
  				},
  				'50%': {
  					opacity: '0.9'
  				},
  				'100%': {
  					transform: 'scaleX(1)',
  					opacity: '0.8'
  				}
  			},
  			'draw-y': {
  				'0%': {
  					transform: 'scaleY(0)',
  					opacity: '0'
  				},
  				'50%': {
  					opacity: '0.9'
  				},
  				'100%': {
  					transform: 'scaleY(1)',
  					opacity: '0.8'
  				}
  			}
  		},
  		animation: {
  			'toast-progress': 'toast-progress var(--toast-duration, 6s) linear forwards',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			shine: 'shine 8s ease-in-out infinite',
  			'text-shine': 'text-shine 3s linear infinite',
  			'gradient-xy': 'gradient-xy 3s linear infinite',
  			'gradient-x': 'gradient-x 3s linear infinite',
  			aurora: 'aurora 60s linear infinite',
  			'draw-x': 'draw-x 200ms ease-out forwards',
  			'draw-y': 'draw-y 200ms ease-out forwards'
  		}
  	}
  },
  plugins: [
    animatePlugin,
    plugin(function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'bg-dot-thick': (value) => {
            const colorValue = typeof value === 'function' ? value({}) : value;
            return {
              backgroundImage: `url("${svgToDataUri(
                `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16"><path fill="${colorValue}" d="M0 0h4v4H0V0zm6 6h4v4H6V6zm6-6h4v4h-4V0zm6 6h4v4h-4V6zm0 6h4v4h-4v-4zm-6 0h4v4h-4v-4zm-6 0h4v4H6v-4zM0 6h4v4H0V6zm0 6h4v4H0v-4z"/></svg>`
              )}")`,
            };
          },
        },
        { values: theme('colors') }
      );
    }),
    // Plugin für Aurora-Background: Fügt alle Tailwind-Farben als CSS-Variablen hinzu
    plugin(function ({ addBase, theme }) {
      const allColors = flattenColorPalette(theme("colors"));
      const newVars = Object.fromEntries(
        Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
      );
      addBase({
        ":root": newVars,
      });
    }),
  ],
} satisfies Config;

export default config;