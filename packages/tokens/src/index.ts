/**
 * ZUI 设计令牌 — TypeScript 常量导出
 *
 * 值均为 CSS 变量引用（'var(--z-…)'），供文档站点 / 内联样式（style={{…}}）使用，
 * 与 base.css / semantic.css / dark.css 保持一致（换肤自动生效，无 DOM API）。
 */

/** 语义层令牌（组件消费入口）——与 semantic.css 逐字对应 */
export const tokens = {
  color: {
    bg: 'var(--z-color-bg)',
    bgSubtle: 'var(--z-color-bg-subtle)',
    bgMuted: 'var(--z-color-bg-muted)',
    bgElevated: 'var(--z-color-bg-elevated)',
    bgInverse: 'var(--z-color-bg-inverse)',
    fg: 'var(--z-color-fg)',
    fgMuted: 'var(--z-color-fg-muted)',
    fgSubtle: 'var(--z-color-fg-subtle)',
    fgInverse: 'var(--z-color-fg-inverse)',
    fgOnPrimary: 'var(--z-color-fg-on-primary)',
    border: 'var(--z-color-border)',
    borderSubtle: 'var(--z-color-border-subtle)',
    borderStrong: 'var(--z-color-border-strong)',
    borderFocus: 'var(--z-color-border-focus)',
    primary: 'var(--z-color-primary)',
    primaryHover: 'var(--z-color-primary-hover)',
    primaryActive: 'var(--z-color-primary-active)',
    primaryFg: 'var(--z-color-primary-fg)',
    primarySubtle: 'var(--z-color-primary-subtle)',
    primarySubtleFg: 'var(--z-color-primary-subtle-fg)',
    danger: 'var(--z-color-danger)',
    dangerHover: 'var(--z-color-danger-hover)',
    dangerFg: 'var(--z-color-danger-fg)',
    dangerSubtle: 'var(--z-color-danger-subtle)',
    dangerSubtleFg: 'var(--z-color-danger-subtle-fg)',
    success: 'var(--z-color-success)',
    successHover: 'var(--z-color-success-hover)',
    successFg: 'var(--z-color-success-fg)',
    successSubtle: 'var(--z-color-success-subtle)',
    successSubtleFg: 'var(--z-color-success-subtle-fg)',
    warning: 'var(--z-color-warning)',
    warningHover: 'var(--z-color-warning-hover)',
    warningFg: 'var(--z-color-warning-fg)',
    warningSubtle: 'var(--z-color-warning-subtle)',
    warningSubtleFg: 'var(--z-color-warning-subtle-fg)',
    info: 'var(--z-color-info)',
    infoHover: 'var(--z-color-info-hover)',
    infoFg: 'var(--z-color-info-fg)',
    infoSubtle: 'var(--z-color-info-subtle)',
    infoSubtleFg: 'var(--z-color-info-subtle-fg)',
    link: 'var(--z-color-link)',
    linkHover: 'var(--z-color-link-hover)',
    focusRing: 'var(--z-color-focus-ring)',
    overlay: 'var(--z-color-overlay)',
    disabledBg: 'var(--z-color-disabled-bg)',
    disabledFg: 'var(--z-color-disabled-fg)',
    disabledBorder: 'var(--z-color-disabled-border)',
  },
  radius: {
    default: 'var(--z-radius)',
    sm: 'var(--z-radius-sm)',
    md: 'var(--z-radius-md)',
    lg: 'var(--z-radius-lg)',
    xl: 'var(--z-radius-xl)',
    full: 'var(--z-radius-full)',
  },
  space: {
    1: 'var(--z-space-1)',
    2: 'var(--z-space-2)',
    3: 'var(--z-space-3)',
    4: 'var(--z-space-4)',
    5: 'var(--z-space-5)',
    6: 'var(--z-space-6)',
    7: 'var(--z-space-7)',
    8: 'var(--z-space-8)',
    9: 'var(--z-space-9)',
    10: 'var(--z-space-10)',
    11: 'var(--z-space-11)',
    12: 'var(--z-space-12)',
  },
  text: {
    xs: 'var(--z-text-xs)',
    sm: 'var(--z-text-sm)',
    md: 'var(--z-text-md)',
    lg: 'var(--z-text-lg)',
    xl: 'var(--z-text-xl)',
    '2xl': 'var(--z-text-2xl)',
    leadingTight: 'var(--z-leading-tight)',
    leadingNormal: 'var(--z-leading-normal)',
    leadingRelaxed: 'var(--z-leading-relaxed)',
    weightRegular: 'var(--z-weight-regular)',
    weightMedium: 'var(--z-weight-medium)',
    weightSemibold: 'var(--z-weight-semibold)',
  },
  font: {
    sans: 'var(--z-font-sans)',
    mono: 'var(--z-font-mono)',
  },
  shadow: {
    xs: 'var(--z-shadow-xs)',
    sm: 'var(--z-shadow-sm)',
    md: 'var(--z-shadow-md)',
    lg: 'var(--z-shadow-lg)',
  },
  duration: {
    fast: 'var(--z-duration-fast)',
    normal: 'var(--z-duration-normal)',
    slow: 'var(--z-duration-slow)',
    easeStandard: 'var(--z-ease-standard)',
    easeEntrance: 'var(--z-ease-entrance)',
    easeExit: 'var(--z-ease-exit)',
  },
  z: {
    base: 'var(--z-z-base)',
    sticky: 'var(--z-z-sticky)',
    dropdown: 'var(--z-z-dropdown)',
    overlay: 'var(--z-z-overlay)',
    modal: 'var(--z-z-modal)',
    toast: 'var(--z-z-toast)',
  },
} as const;

/** 令牌路径字面量联合（可选使用，便于文档/工具做键名校验） */
export type TokenPath = {
  [K in keyof typeof tokens]: {
    [P in keyof (typeof tokens)[K]]: `${K & string}.${P & string}`;
  }[keyof (typeof tokens)[K]];
}[keyof typeof tokens];

/** 色阶刻度（50..950 / 50..900） */
type NeutralScaleStep =
  | '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950';
type StatusScaleStep =
  | '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

/**
 * 原始色阶（primitive 层）var() 引用，供文档画色板：
 * 每个色系的 50..950（状态色 50..900）。
 */
export const colorScales = {
  neutral: {
    50: 'var(--z-neutral-50)',
    100: 'var(--z-neutral-100)',
    200: 'var(--z-neutral-200)',
    300: 'var(--z-neutral-300)',
    400: 'var(--z-neutral-400)',
    500: 'var(--z-neutral-500)',
    600: 'var(--z-neutral-600)',
    700: 'var(--z-neutral-700)',
    800: 'var(--z-neutral-800)',
    900: 'var(--z-neutral-900)',
    950: 'var(--z-neutral-950)',
  },
  brand: {
    50: 'var(--z-brand-50)',
    100: 'var(--z-brand-100)',
    200: 'var(--z-brand-200)',
    300: 'var(--z-brand-300)',
    400: 'var(--z-brand-400)',
    500: 'var(--z-brand-500)',
    600: 'var(--z-brand-600)',
    700: 'var(--z-brand-700)',
    800: 'var(--z-brand-800)',
    900: 'var(--z-brand-900)',
    950: 'var(--z-brand-950)',
  },
  danger: {
    50: 'var(--z-danger-50)',
    100: 'var(--z-danger-100)',
    200: 'var(--z-danger-200)',
    300: 'var(--z-danger-300)',
    400: 'var(--z-danger-400)',
    500: 'var(--z-danger-500)',
    600: 'var(--z-danger-600)',
    700: 'var(--z-danger-700)',
    800: 'var(--z-danger-800)',
    900: 'var(--z-danger-900)',
  },
  success: {
    50: 'var(--z-success-50)',
    100: 'var(--z-success-100)',
    200: 'var(--z-success-200)',
    300: 'var(--z-success-300)',
    400: 'var(--z-success-400)',
    500: 'var(--z-success-500)',
    600: 'var(--z-success-600)',
    700: 'var(--z-success-700)',
    800: 'var(--z-success-800)',
    900: 'var(--z-success-900)',
  },
  warning: {
    50: 'var(--z-warning-50)',
    100: 'var(--z-warning-100)',
    200: 'var(--z-warning-200)',
    300: 'var(--z-warning-300)',
    400: 'var(--z-warning-400)',
    500: 'var(--z-warning-500)',
    600: 'var(--z-warning-600)',
    700: 'var(--z-warning-700)',
    800: 'var(--z-warning-800)',
    900: 'var(--z-warning-900)',
  },
  info: {
    50: 'var(--z-info-50)',
    100: 'var(--z-info-100)',
    200: 'var(--z-info-200)',
    300: 'var(--z-info-300)',
    400: 'var(--z-info-400)',
    500: 'var(--z-info-500)',
    600: 'var(--z-info-600)',
    700: 'var(--z-info-700)',
    800: 'var(--z-info-800)',
    900: 'var(--z-info-900)',
  },
} as const satisfies {
  neutral: Record<NeutralScaleStep, string>;
  brand: Record<NeutralScaleStep, string>;
  danger: Record<StatusScaleStep, string>;
  success: Record<StatusScaleStep, string>;
  warning: Record<StatusScaleStep, string>;
  info: Record<StatusScaleStep, string>;
};

export type ColorScaleName = keyof typeof colorScales;
