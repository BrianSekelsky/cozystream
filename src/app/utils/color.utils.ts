export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }

export interface ContrastResult {
  darkSurfaceRatio: number
  lightSurfaceRatio: number
  whiteOnAccentRatio: number
  passesAll: boolean
  worstRatio: number
  worstContext: string
}

const DARK_SURFACE: RGB = { r: 10, g: 10, b: 10 }
const LIGHT_SURFACE: RGB = { r: 245, g: 245, b: 245 }
const WHITE: RGB = { r: 255, g: 255, b: 255 }
const MIN_CONTRAST = 3.0

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return { h: h * 360, s, l }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  h /= 360
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  }
}

function linearize(c: number): number {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

export function contrastRatio(c1: RGB, c2: RGB): number {
  const l1 = relativeLuminance(c1)
  const l2 = relativeLuminance(c2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function checkContrast(hex: string): ContrastResult {
  const rgb = hexToRgb(hex)
  const darkSurfaceRatio = contrastRatio(rgb, DARK_SURFACE)
  const lightSurfaceRatio = contrastRatio(rgb, LIGHT_SURFACE)
  const whiteOnAccentRatio = contrastRatio(WHITE, rgb)

  const checks = [
    { ratio: darkSurfaceRatio, context: 'hard to see on dark backgrounds' },
    { ratio: lightSurfaceRatio, context: 'hard to see on light backgrounds' },
    { ratio: whiteOnAccentRatio, context: 'white text hard to read on this color' },
  ]
  const worst = checks.reduce((a, b) => a.ratio < b.ratio ? a : b)

  return {
    darkSurfaceRatio,
    lightSurfaceRatio,
    whiteOnAccentRatio,
    passesAll: checks.every(c => c.ratio >= MIN_CONTRAST),
    worstRatio: worst.ratio,
    worstContext: worst.context,
  }
}

export function suggestBetterColors(hex: string, count = 5): string[] {
  const hsl = rgbToHsl(hexToRgb(hex))
  const candidates: { hex: string; dist: number }[] = []

  for (let l = 0.1; l <= 0.9; l += 0.02) {
    const candidate = rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l }))
    const result = checkContrast(candidate)
    if (result.passesAll) {
      candidates.push({ hex: candidate, dist: Math.abs(l - hsl.l) })
    }
  }

  // Fallback: reduce saturation if nothing passes
  if (candidates.length === 0) {
    const reducedS = hsl.s * 0.7
    for (let l = 0.1; l <= 0.9; l += 0.02) {
      const candidate = rgbToHex(hslToRgb({ h: hsl.h, s: reducedS, l }))
      const result = checkContrast(candidate)
      if (result.passesAll) {
        candidates.push({ hex: candidate, dist: Math.abs(l - hsl.l) })
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist)

  // Deduplicate and pick spread-out suggestions
  const seen = new Set<string>()
  const result: string[] = []
  for (const c of candidates) {
    if (!seen.has(c.hex)) {
      seen.add(c.hex)
      result.push(c.hex)
      if (result.length >= count) break
    }
  }
  return result
}
