import type { Config } from "tailwindcss";
import { generateColorPalette } from "./src/utils/themeColor";

const theme_color = "#FFAAA7";
const theme_color_hue_shift = 30;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      "colors": {
        "theme": generateColorPalette(theme_color, theme_color_hue_shift)
      }
    }
  },
  plugins: [
      require("@tailwindcss/line-clamp"),
  ],
};
export default config;
