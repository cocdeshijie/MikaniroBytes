import type { Config } from "tailwindcss";
import { generateColorPalette } from "./src/utils/themeColor";

const theme_color = "#F08300";
const theme_color_hue_shift = 20;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
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
