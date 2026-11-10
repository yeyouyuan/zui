export type BuilderBreakpoint = 'desktop' | 'tablet' | 'mobile';
export type BuilderStyles = Partial<Record<keyof typeof styleSchema, string | number>>;
export type BuilderDesign = Partial<Record<BuilderBreakpoint, BuilderStyles>>;
export type BuilderInteractionState = 'hover' | 'focus' | 'active' | 'disabled';
export type BuilderStateDesign = Partial<Record<BuilderInteractionState, BuilderDesign>>;
export const interactionStateLabels = {
  hover: '悬停',
  focus: '聚焦',
  active: '按下',
  disabled: '禁用',
} as const;
export interface BuilderNodeMeta {
  label?: string;
  hidden?: boolean;
  locked?: boolean;
  htmlId?: string;
  title?: string;
  ariaLabel?: string;
}

export const styleSchema = {
  width: 'length',
  minWidth: 'length',
  maxWidth: 'length',
  height: 'length',
  minHeight: 'length',
  maxHeight: 'length',
  aspectRatio: 'ratio',
  display: 'block|inline-block|flex|inline-flex|grid|none',
  flexDirection: 'row|column|row-reverse|column-reverse',
  flexWrap: 'nowrap|wrap',
  justifyContent: 'flex-start|center|flex-end|space-between|space-around',
  alignItems: 'stretch|flex-start|center|flex-end',
  gap: '0:160',
  gridTemplateColumns: 'columns',
  gridTemplateRows: 'tracks',
  gridColumn: 'gridPosition',
  gridRow: 'gridPosition',
  flexGrow: '0:100',
  flexShrink: '0:100',
  flexBasis: 'length',
  order: '-100:100',
  alignSelf: 'auto|stretch|flex-start|center|flex-end|baseline',
  position: 'static|relative|absolute|sticky|fixed',
  top: 'length',
  right: 'length',
  bottom: 'length',
  left: 'length',
  zIndex: '-100:9999',
  overflow: 'visible|hidden|clip|auto|scroll',
  overflowX: 'visible|hidden|clip|auto|scroll',
  overflowY: 'visible|hidden|clip|auto|scroll',
  paddingTop: '0:200',
  paddingRight: '0:200',
  paddingBottom: '0:200',
  paddingLeft: '0:200',
  marginTop: '-100:200',
  marginRight: '-100:200',
  marginBottom: '-100:200',
  marginLeft: '-100:200',
  fontSize: '8:144',
  fontWeight: '400|500|600|700|800|900',
  fontFamily: 'font',
  fontStyle: 'normal|italic',
  textDecoration: 'none|underline|line-through',
  whiteSpace: 'normal|nowrap|pre-wrap|pre-line',
  lineHeight: '0.8:3',
  letterSpacing: '-5:20',
  textAlign: 'left|center|right|justify',
  color: 'color',
  backgroundColor: 'color',
  backgroundImage: 'image',
  backgroundGradient: 'gradient',
  backgroundSize: 'auto|cover|contain',
  backgroundPosition: 'center|top|bottom|left|right',
  borderColor: 'color',
  borderWidth: '0:20',
  borderStyle: 'solid|dashed|dotted',
  borderRadius: '0:200',
  boxShadow: 'none|sm|md|lg',
  opacity: '0:1',
  rotate: '-360:360',
  scale: '0.1:3',
  cursor: 'auto|pointer|default|grab',
  customCss: 'css',
  wrapperCss: 'css',
  hoverCss: 'css',
} as const;

export const breakpointLabels: Record<BuilderBreakpoint, string> = {
  desktop: '桌面',
  tablet: '平板',
  mobile: '手机',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Declarations only: keep CSS inside the selected element, without executable or remote resources. */
export function validateCssDeclarations(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 6000 ||
    /[<>{}@\\]|\/\*|url\s*\(|expression\s*\(/i.test(value)
  )
    throw new Error(
      '请输入 CSS 声明，不含选择器、@规则、url() 或脚本。背景图片请使用图片地址字段。'
    );
  const declarations: string[] = [];
  for (const raw of value.split(';')) {
    if (!raw.trim()) continue;
    const match = /^\s*((?:--z-[a-z\d-]+)|(?:-?[a-z][a-z-]*))\s*:\s*(.+?)\s*$/i.exec(raw);
    if (!match || ['behavior', '-moz-binding'].includes(match[1].toLowerCase()))
      throw new Error(`CSS 声明格式不正确：${raw.slice(0, 60)}`);
    let depth = 0;
    for (const character of match[2]) {
      if (character === '(') depth++;
      if (character === ')') depth--;
      if (depth < 0) throw new Error('CSS 括号不匹配。');
    }
    if (depth) throw new Error('CSS 括号不匹配。');
    declarations.push(`${match[1]}:${match[2]}`);
  }
  return declarations.join(';');
}

/** A closed style vocabulary keeps imported files safe to include in standalone HTML. */
export function validateDesign(value: unknown): BuilderDesign {
  if (!isRecord(value)) throw new Error('样式设置格式不正确。');
  const design: BuilderDesign = {};
  for (const [breakpoint, styles] of Object.entries(value)) {
    if (!Object.hasOwn(breakpointLabels, breakpoint) || !isRecord(styles))
      throw new Error('不支持的响应式样式设置。');
    const clean: BuilderStyles = {};
    for (const [key, entry] of Object.entries(styles)) {
      if (!Object.hasOwn(styleSchema, key)) throw new Error(`不支持的样式：${key}。`);
      const rule = styleSchema[key as keyof BuilderStyles];
      let valid = false;
      if (rule === 'length') {
        valid =
          typeof entry === 'string' &&
          entry.length <= 200 &&
          /^(auto|fit-content|min-content|max-content|none|0|-?\d{1,5}(?:\.\d{1,3})?(?:px|%|rem|em|vh|vw|dvh|svh)|(?:calc|min|max|clamp)\([\d\s.,()+*/%\-a-z]+\)|var\(--z-[\w-]+\))$/.test(
            entry
          ) &&
          !/url|expression/i.test(entry);
      } else if (rule === 'color') {
        valid =
          typeof entry === 'string' &&
          /^(#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|transparent|currentColor|white|black|(?:rgb|hsl)a?\([\d\s.,%/]+\)|var\(--z-color-[a-z-]+\))$/i.test(
            entry
          );
      } else if (rule === 'columns') {
        valid =
          typeof entry === 'string' &&
          entry.length <= 300 &&
          /^[\d\s.,()%a-z-]+$/.test(entry) &&
          !/url|expression/.test(entry);
      } else if (rule === 'tracks') {
        valid =
          typeof entry === 'string' &&
          entry.length <= 300 &&
          /^[\d\s.,()%a-z-]+$/.test(entry) &&
          !/url|expression/.test(entry);
      } else if (rule === 'gridPosition') {
        valid =
          typeof entry === 'string' &&
          /^(auto|span [1-9]\d?|[1-9]\d?(?:\s*\/\s*(?:[1-9]\d?|span [1-9]\d?))?)$/.test(entry);
      } else if (rule === 'ratio') {
        valid =
          typeof entry === 'string' &&
          /^(auto|[1-9]\d?(?:\.\d+)?\s*\/\s*[1-9]\d?(?:\.\d+)?)$/.test(entry);
      } else if (rule === 'font') {
        valid =
          typeof entry === 'string' &&
          entry.length <= 240 &&
          /^[\w\u4e00-\u9fff\s,'"-]+$/.test(entry);
      } else if (rule === 'gradient') {
        valid =
          typeof entry === 'string' &&
          entry.length <= 1000 &&
          /^(linear|radial|conic)-gradient\([#\da-z\s.,()%/+-]+\)$/i.test(entry) &&
          !/url|expression/.test(entry);
      } else if (rule === 'image') {
        valid =
          typeof entry === 'string' &&
          (/^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(entry) ||
            /^https?:\/\/[^<>\s"\\]+$/i.test(entry));
      } else if (rule === 'css') {
        validateCssDeclarations(entry);
        valid = true;
      } else if (rule.includes(':')) {
        const [min, max] = rule.split(':').map(Number);
        const tokenType =
          key === 'fontSize'
            ? 'fontSize'
            : key === 'borderRadius'
              ? 'radius'
              : /^(?:gap|padding|margin)/.test(key)
                ? 'space'
                : '';
        valid =
          (typeof entry === 'number' && Number.isFinite(entry) && entry >= min && entry <= max) ||
          (!!tokenType &&
            typeof entry === 'string' &&
            new RegExp(`^var\\(--z-token-${tokenType}-[a-z][a-z-]{0,39}\\)$`).test(entry));
      } else valid = typeof entry === 'string' && rule.split('|').includes(entry);
      if (!valid) throw new Error(`样式 ${key} 的值不正确。`);
      clean[key as keyof BuilderStyles] = entry as string | number;
    }
    design[breakpoint as BuilderBreakpoint] = clean;
  }
  return design;
}

export function validateStateDesign(value: unknown): BuilderStateDesign {
  if (!isRecord(value)) throw new Error('交互状态样式格式不正确。');
  const result: BuilderStateDesign = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(interactionStateLabels, key)) throw new Error('不支持此交互状态。');
    result[key as BuilderInteractionState] = validateDesign(entry);
  }
  return result;
}

export function validateNodeMeta(value: unknown): BuilderNodeMeta {
  if (!isRecord(value)) throw new Error('图层设置格式不正确。');
  const clean: BuilderNodeMeta = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'label' && typeof entry === 'string' && entry.length <= 80) clean.label = entry;
    else if (
      key === 'htmlId' &&
      typeof entry === 'string' &&
      entry.length <= 100 &&
      (!entry || /^[\w\u4e00-\u9fff-]+$/.test(entry))
    )
      clean.htmlId = entry;
    else if (
      (key === 'title' || key === 'ariaLabel') &&
      typeof entry === 'string' &&
      entry.length <= 240
    )
      clean[key] = entry;
    else if ((key === 'hidden' || key === 'locked') && typeof entry === 'boolean')
      clean[key] = entry;
    else throw new Error('图层名称或状态不正确。');
  }
  return clean;
}

const shadows = {
  none: 'none',
  sm: '0 2px 8px #0f172a0d',
  md: '0 8px 28px #0f172a14',
  lg: '0 20px 64px #0f172a24',
};
const unitless = new Set([
  'lineHeight',
  'opacity',
  'zIndex',
  'flexGrow',
  'flexShrink',
  'order',
  'scale',
]);
function declarations(styles: BuilderStyles) {
  return Object.entries(styles)
    .map(([property, value]) => {
      if (property === 'customCss' || property === 'wrapperCss' || property === 'hoverCss')
        return validateCssDeclarations(value);
      if (property === 'backgroundImage')
        return `background-image:url(${JSON.stringify(value)})!important`;
      if (property === 'backgroundGradient') return `background-image:${value}!important`;
      const key = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      const cssValue =
        property === 'boxShadow'
          ? shadows[value as keyof typeof shadows]
          : property === 'rotate'
            ? `${value}deg`
            : typeof value === 'number' && !unitless.has(property)
              ? `${value}px`
              : value;
      return `${key}:${cssValue}!important`;
    })
    .join(';');
}

export function builderStyleKey(id: string) {
  return `n-${Array.from(id)
    .map((char) => char.codePointAt(0)!.toString(36))
    .join('-')}`;
}

export function designCss(id: string, input?: BuilderDesign, inputStates?: BuilderStateDesign) {
  if ((!input || !Object.keys(input).length) && (!inputStates || !Object.keys(inputStates).length))
    return '';
  const design = validateDesign(input || {});
  const owner = `[data-builder-node="${builderStyleKey(id)}"]`;
  // Sizing and margins belong to the actual flex/grid item. Its visual child
  // fills that box; resolving percentages on both layers would apply them twice.
  const dimensions = new Set([
    'width',
    'height',
    'minWidth',
    'maxWidth',
    'maxHeight',
    'aspectRatio',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'zIndex',
    'flexGrow',
    'flexShrink',
    'flexBasis',
    'order',
    'alignSelf',
    'gridColumn',
    'gridRow',
    'wrapperCss',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
  ]);
  const layoutKeys = new Set([
    'display',
    'flexDirection',
    'flexWrap',
    'justifyContent',
    'alignItems',
    'gap',
    'gridTemplateColumns',
    'gridTemplateRows',
  ]);
  const rule = (styles: BuilderStyles = {}, target = owner) => {
    const selector = `${target} > :first-child`;
    const entries = Object.entries(styles);
    const outer = Object.fromEntries(entries.filter(([key]) => dimensions.has(key)));
    const appearance = Object.fromEntries(
      entries.filter(([key]) => !dimensions.has(key) && !layoutKeys.has(key) && key !== 'hoverCss')
    );
    const layout = Object.fromEntries(entries.filter(([key]) => layoutKeys.has(key)));
    // Content slots receive layout without moving section headings or card chrome.
    const layoutTarget = `${selector}:not(.z-builder-section,.z-builder-form,.z-builder-columns-container,.z-builder-app-view,.z-card),${selector} > :is(.z-builder-stack,.z-builder-columns),${selector}.z-card > .z-card-body > .z-builder-stack`;
    const fill =
      styles.width === undefined
        ? ''
        : `width:${styles.width === 'auto' ? 'auto' : '100%'}!important;`;
    const heightFill = styles.height === undefined ? '' : 'height:100%!important;';
    return `${target}{${declarations(outer)}}${selector}{${fill}${heightFill}${declarations(appearance)}}${Object.keys(layout).length ? `${layoutTarget}{${declarations(layout)}}` : ''}${styles.hoverCss ? `${selector}:hover{${validateCssDeclarations(styles.hoverCss)}}` : ''}`;
  };
  const responsive = (styles: BuilderDesign, target = owner) =>
    `${styles.desktop ? rule(styles.desktop, target) : ''}${styles.tablet ? `@container z-builder-page (max-width:900px){${rule(styles.tablet, target)}}` : ''}${styles.mobile ? `@container z-builder-page (max-width:600px){${rule(styles.mobile, target)}}` : ''}`;
  return (
    responsive(design) +
    Object.entries(validateStateDesign(inputStates || {}))
      .map(([state, styles]) => {
        const pseudo =
          state === 'focus'
            ? ':focus-within'
            : state === 'disabled'
              ? ':is([aria-disabled="true"],[inert],:has(> :disabled))'
              : `:${state}`;
        return responsive(
          styles,
          `:is(${owner}${pseudo},${owner}[data-builder-preview-state="${state}"])`
        );
      })
      .join('')
  );
}

export function effectiveStyles(
  design: BuilderDesign,
  breakpoint: BuilderBreakpoint
): BuilderStyles {
  return {
    ...design.desktop,
    ...(breakpoint !== 'desktop' ? design.tablet : {}),
    ...(breakpoint === 'mobile' ? design.mobile : {}),
  };
}
