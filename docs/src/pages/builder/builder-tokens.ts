import type { CSSProperties } from 'react';
export interface BuilderToken {
  key: string;
  label: string;
  type: 'color' | 'space' | 'radius' | 'fontSize';
  value: string | number;
}
export const tokenTypes = {
  color: '颜色',
  space: '间距',
  radius: '圆角',
  fontSize: '字号',
} as const;
export function validateTokens(value: unknown): BuilderToken[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('每页最多 100 个设计变量。');
  const keys = new Set<string>();
  return value.map((entry) => {
    const token = entry as BuilderToken;
    if (
      !token ||
      typeof token !== 'object' ||
      Object.keys(token).some((key) => !['key', 'label', 'type', 'value'].includes(key)) ||
      !/^[a-z][a-z-]{0,39}$/.test(token.key) ||
      keys.has(token.key)
    )
      throw new Error('设计变量名需唯一，使用小写字母和短横线，最多 40 个字符。');
    keys.add(token.key);
    if (
      typeof token.label !== 'string' ||
      !token.label.trim() ||
      token.label.length > 80 ||
      !Object.hasOwn(tokenTypes, token.type)
    )
      throw new Error('设计变量名称或类型不正确。');
    if (token.type === 'color') {
      if (typeof token.value !== 'string' || !/^#[a-f\d]{6}$/i.test(token.value))
        throw new Error('颜色变量需为 6 位十六进制颜色。');
    } else {
      const range =
        token.type === 'fontSize' ? [8, 144] : token.type === 'radius' ? [0, 200] : [0, 160];
      if (
        typeof token.value !== 'number' ||
        !Number.isFinite(token.value) ||
        token.value < range[0] ||
        token.value > range[1]
      )
        throw new Error(`${tokenTypes[token.type]}变量需在 ${range[0]}–${range[1]} 之间。`);
    }
    return { key: token.key, label: token.label, type: token.type, value: token.value };
  });
}
export const tokenVariable = (token: BuilderToken) =>
  token.type === 'color' ? `--z-color-token-${token.key}` : `--z-token-${token.type}-${token.key}`;
export const tokenReference = (token: BuilderToken) => `var(${tokenVariable(token)})`;
export const tokenStyles = (tokens: BuilderToken[] = []): CSSProperties =>
  Object.fromEntries(
    validateTokens(tokens).map((token) => [
      tokenVariable(token),
      token.type === 'color' ? token.value : `${token.value}px`,
    ])
  );
export const tokenProperties = {
  color: [
    ['color', '文字颜色'],
    ['backgroundColor', '背景颜色'],
    ['borderColor', '边框颜色'],
  ],
  space: [
    ['gap', '组件间距'],
    ['paddingTop', '上内边距'],
    ['paddingRight', '右内边距'],
    ['paddingBottom', '下内边距'],
    ['paddingLeft', '左内边距'],
    ['marginTop', '上外边距'],
    ['marginBottom', '下外边距'],
  ],
  radius: [['borderRadius', '圆角']],
  fontSize: [['fontSize', '字号']],
} as const;
export const starterTokens: BuilderToken[] = [
  { key: 'brand', label: '品牌主色', type: 'color', value: '#6051d6' },
  { key: 'text', label: '正文颜色', type: 'color', value: '#253047' },
  { key: 'surface', label: '卡片背景', type: 'color', value: '#ffffff' },
  { key: 'section', label: '分区间距', type: 'space', value: 24 },
  { key: 'control', label: '控件圆角', type: 'radius', value: 8 },
  { key: 'body', label: '正文字号', type: 'fontSize', value: 14 },
];
