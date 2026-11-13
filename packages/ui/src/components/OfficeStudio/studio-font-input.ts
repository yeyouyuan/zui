export interface StudioFontOption {
  value: string;
  label: string;
}

/** Accept font names that can be saved unchanged in XML document formats. */
export function studioFontFamilyInput(input: string, options: readonly StudioFontOption[] = []) {
  const value = input.trim();
  const match = options.find(
    (option) =>
      option.value.toLocaleLowerCase() === value.toLocaleLowerCase() ||
      option.label.toLocaleLowerCase() === value.toLocaleLowerCase()
  );
  const family = match?.value ?? value;
  if (
    family.length < 1 ||
    family.length > 255 ||
    [...family].some((character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff;
    })
  )
    return null;
  return family;
}

/** Font sizes are points; keep decimal values rather than truncating imported styles. */
export function studioFontSizeInput(input: string, maximum = 409, step?: number) {
  const value = input
    .trim()
    .replace(/\s*pt$/i, '')
    .trim();
  if (!/^\+?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)) return null;
  const size = Number(value.replace(',', '.'));
  if (!Number.isFinite(size) || size < 1 || size > maximum) return null;
  return String(step ? Math.round(size / step) * step : size);
}

/** Escape names that have CSS punctuation while preserving the persisted font name. */
export function studioFontFamilyCss(value: string) {
  if (/^[\p{L}\p{N} _-]+$/u.test(value)) return value;
  return `"${value.replace(/["\\\n\r\f]/g, (character) => `\\${character.charCodeAt(0).toString(16)} `)}"`;
}
