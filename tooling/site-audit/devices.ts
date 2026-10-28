// The device set of ADR 0009 rule 5 and the widths the audit sweeps.
export interface Device {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  dpr: number;
}

export const DEVICES: readonly Device[] = [
  { name: 'small-phone', width: 320, height: 568, touch: true, dpr: 2 },
  { name: 'android-phone', width: 360, height: 800, touch: true, dpr: 3 },
  { name: 'iphone', width: 390, height: 844, touch: true, dpr: 3 },
  { name: 'large-phone', width: 414, height: 896, touch: true, dpr: 3 },
  { name: 'landscape-phone', width: 844, height: 390, touch: true, dpr: 3 },
  { name: 'portrait-tablet', width: 768, height: 1024, touch: true, dpr: 2 },
  { name: 'landscape-tablet', width: 1024, height: 768, touch: true, dpr: 2 },
  { name: 'desktop', width: 1440, height: 900, touch: false, dpr: 1 },
  { name: 'wide-desktop', width: 1920, height: 1080, touch: false, dpr: 1 },
  { name: 'ultrawide-desktop', width: 2560, height: 1440, touch: false, dpr: 1 },
];

/** Viewports that get a screenshot (ADR 0009 rule 5, manual visual check). */
const SCREENSHOT_SIZES: readonly string[] = ['390x844', '768x1024', '1024x768', '1440x900', '844x390'];

export function isScreenshotDevice(d: Device): boolean {
  return SCREENSHOT_SIZES.includes(`${d.width}x${d.height}`);
}

export const SWEEP_HEIGHT = 900;

/** 320, 336, ... 2560. */
export function sweepWidths(): number[] {
  const out: number[] = [];
  for (let w = 320; w <= 2560; w += 16) out.push(w);
  return out;
}
