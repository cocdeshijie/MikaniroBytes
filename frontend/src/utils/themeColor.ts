export function hexToHSL(hex: string) {
    hex = hex.replace(/^#/, '');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;  // Initialize with default value
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

export function HSLToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c/2;
    let r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    const toHex = (n: number): string => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

type ColorScale = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

const LIGHTNESS_VALUES: Record<ColorScale, number> = {
    50: 95,
    100: 86,
    200: 77,
    300: 64,
    400: 56,
    500: 51,
    600: 42,
    700: 34,
    800: 24,
    900: 16,
    950: 10
};

const symmetricPairs: Record<ColorScale, { distance: number }> = {
    50: { distance: 450 },
    100: { distance: 400 },
    200: { distance: 300 },
    300: { distance: 200 },
    400: { distance: 100 },
    500: { distance: 0 },
    600: { distance: 100 },
    700: { distance: 200 },
    800: { distance: 300 },
    900: { distance: 400 },
    950: { distance: 450 }
};

const COLOR_SCALES: ColorScale[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export function generateColorPalette(mainColor: string, hueShift = 0): Record<ColorScale, string> {
    const mainHSL = hexToHSL(mainColor);
    const complementaryHue = (mainHSL.h + 180) % 360;

    const palette = {} as Record<ColorScale, string>;
    const saturationAdjustment = -0.75;

    COLOR_SCALES.forEach(key => {
        if (key === 500) {
            palette[key] = mainColor.toUpperCase();
            return;
        }

        const distance = symmetricPairs[key].distance;
        const normalizedDistance = (distance + 1) / 451;
        const calculatedShift = (Math.log(normalizedDistance + 1) / Math.log(2)) * hueShift;

        const distanceFactor = Math.pow(
            Math.log(normalizedDistance + 1) / Math.log(2),
            0.4
        );
        const innerDampening = Math.pow(normalizedDistance, 1.8);
        const combinedFactor = distanceFactor * (0.2 + 0.8 * innerDampening);
        const boost = normalizedDistance > 0.8 ? 1.2 : 1.0;
        const reductionFactor = Math.abs(saturationAdjustment) * combinedFactor * boost;
        const adjustedSaturation = mainHSL.s * (1 - reductionFactor);

        palette[key] = HSLToHex(
            complementaryHue + calculatedShift,
            adjustedSaturation,
            LIGHTNESS_VALUES[key]
        );
    });

    return palette;
}