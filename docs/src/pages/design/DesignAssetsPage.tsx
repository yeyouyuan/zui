import { useState } from 'react';
import { Button, Checkbox, ConfigProvider, Radio, RadioGroup, Select, Steps, Switch } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CodeBlock from '../../components/CodeBlock';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

/* ------------------------------ 代码示例文案 ------------------------------ */

const TOKENS_JSON_CODE = `{
  "zui": {
    "primitives": {
      "brand": {
        "50": { "$type": "color", "$value": "oklch(0.970 0.015 264)" },
        "600": { "$type": "color", "$value": "oklch(0.530 0.205 264)" },
        "700": { "$type": "color", "$value": "oklch(0.465 0.180 264)" }
      }
    },
    "semantic": {
      "color": {
        "primary": { "$type": "color", "$value": "{zui.primitives.brand.600}" },
        "primary-hover": { "$type": "color", "$value": "{zui.primitives.brand.700}" }
      }
    }
  }
}`;

const STEPS_CODE = `const [current, setCurrent] = useState(0);

<Steps
  current={current}
  onChange={setCurrent}
  items={[
    { title: '打开 Tokens Studio', description: 'Figma 插件菜单启动 Tokens Studio for Figma' },
    { title: '粘贴 tokens.json', description: 'Settings → Load from file → JSON 粘贴' },
    { title: '生成两层 Token Set', description: 'primitives 与 semantic 自动导入' },
    { title: '绑定 semantic 令牌', description: '组件样式按语义层取值' },
  ]}
/>`;

const SKIN_CSS_CODE = `/* 第一步：新建 brand-skin.css —— 只覆盖 semantic 层，
   $value 一律引用既有 primitive 色阶（如 --z-success-600），禁止出现裸色值 */
.brand-spring {
  --z-color-primary: var(--z-success-600);
  --z-color-primary-hover: var(--z-success-700);
  --z-color-primary-active: var(--z-success-800);
  --z-color-primary-fg: var(--z-neutral-50);
  --z-color-primary-subtle: var(--z-success-50);
  --z-color-primary-subtle-fg: var(--z-success-700);
  --z-color-border-focus: var(--z-success-600);
  --z-color-link: var(--z-success-600);
  --z-color-link-hover: var(--z-success-700);
  --z-color-focus-ring: var(--z-success-600);
}`;

const SKIN_TSX_CODE = `// 第二步：在 @zui/react/styles.css 之后引入皮肤，挂到容器（或 :root 全局）上。
// ConfigProvider 只管内置文案（locale / translate），与 CSS 换肤互不干扰。
import '@zui/react/styles.css';
import './brand-skin.css';
import { ConfigProvider, Button, Select } from '@zui/react';

export function App() {
  return (
    <ConfigProvider locale={{ select: { placeholder: '请挑选框架' } }}>
      <div className="brand-spring">
        <Button variant="primary">提交订单</Button>
        <Select options={[{ value: 'react', label: 'React' }, { value: 'vue', label: 'Vue' }]} />
      </div>
    </ConfigProvider>
  );
}`;

const SKIN_DARK_CODE = `/* 第三步：补暗色取值。规则与 dark.css 完全一致：
   色阶 600 → 500、fg 反转（neutral-50 ↔ neutral-950）、subtle 底 → 900 / 300 */
[data-theme='dark'] .brand-spring {
  --z-color-primary: var(--z-success-500);
  --z-color-primary-hover: var(--z-success-400);
  --z-color-primary-active: var(--z-success-300);
  --z-color-primary-fg: var(--z-neutral-950);
  --z-color-primary-subtle: var(--z-success-900);
  --z-color-primary-subtle-fg: var(--z-success-300);
  --z-color-border-focus: var(--z-success-500);
  --z-color-link: var(--z-success-500);
  --z-color-link-hover: var(--z-success-400);
  --z-color-focus-ring: var(--z-success-500);
}

/* 跟随系统（未显式设置 data-theme='light' 时）再补一条，镜像 dark.css 的 media 查询 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .brand-spring {
    /* 同上，略 */
  }
}`;

const CDN_BUILD_CODE = `pnpm --filter @zui/react build:browser
# 产物：packages/ui/dist/browser/zui.global.js + zui.css + LICENSE.txt
# 同时自动同步到 docs/dist/cdn/v0.2.0/（版本号取自 package.json）`;

const CDN_HTML_CODE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <!-- zui.css 已包含 tokens + reset + 全部组件样式 -->
    <link rel="stylesheet" href="cdn/v0.2.0/zui.css" />
  </head>
  <body>
    <main id="root"></main>
    <!-- zui.global.js 内置 React 19，全局命名空间为 ZUI -->
    <script src="cdn/v0.2.0/zui.global.js"></script>
    <script>
      const root = ZUI.createRoot(document.getElementById('root'));
      root.render(
        ZUI.React.createElement(ZUI.Button, { variant: 'primary' }, 'ZUI 按钮')
      );
    </script>
  </body>
</html>`;

/* ------------------------------ 令牌对照数据 ------------------------------ */

const LAYER_ROWS: { layer: string; dtcg: string; cssVar: string; note: string }[] = [
  {
    layer: '第 1 层 · primitive（原始刻度）',
    dtcg: 'zui.primitives.brand.600',
    cssVar: '--z-brand-600',
    note: '唯一定义色值 / 尺寸的地方（oklch 色阶、间距、字阶、阴影、动效），设计师只在这一层改数字。',
  },
  {
    layer: '第 2 层 · semantic（语义别名）',
    dtcg: 'zui.semantic.color.primary',
    cssVar: '--z-color-primary',
    note: '$value 全部是 {别名链} 指向 primitive；组件 CSS 只允许消费本层（dark.css 也只重映射本层）。',
  },
  {
    layer: '第 3 层 · 组件级',
    dtcg: '—（运行时派生）',
    cssVar: '--z-button-bg',
    note: '各组件自己的 --z-<name>-* 变量，默认取 semantic 层值；单组件微调时覆盖，不参与全局换肤。',
  },
];

const DTCG_MAP_ROWS: { figma: string; cssVar: string; note: string }[] = [
  { figma: 'zui.primitives.brand.600', cssVar: '--z-brand-600', note: '原始色阶（base.css 定义）' },
  { figma: 'zui.semantic.color.primary', cssVar: '--z-color-primary', note: '语义色（semantic.css 定义，dark.css 重映射）' },
  { figma: 'zui.semantic.radius.lg', cssVar: '--z-radius-lg', note: '圆角（单源 --z-radius，sm/md/lg/xl 按 calc 派生）' },
  { figma: 'zui.semantic.shadow.md', cssVar: '--z-shadow-md', note: '阴影（不分深浅色）' },
  { figma: 'zui.semantic.font.sans', cssVar: '--z-font-sans', note: '字体族' },
];

interface TokenRow {
  cssVar: string;
  usage: string;
  light: string;
  dark: string;
}

function TokenTable({ rows }: { rows: TokenRow[] }): React.ReactNode {
  return (
    <div className="doc-table-wrap">
      <table className="doc-api-table">
        <thead>
          <tr>
            <th scope="col">Semantic 变量</th>
            <th scope="col">用途</th>
            <th scope="col">浅色取值</th>
            <th scope="col">深色取值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cssVar}>
              <td>
                <code className="doc-code-inline">{row.cssVar}</code>
              </td>
              <td>{row.usage}</td>
              <td>
                <code className="doc-code-inline">var(--z-{row.light})</code>
              </td>
              <td>
                <code className="doc-code-inline">var(--z-{row.dark})</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BG_ROWS: TokenRow[] = [
  { cssVar: '--z-color-bg', usage: '页面底色', light: 'neutral-50', dark: 'neutral-950' },
  { cssVar: '--z-color-bg-subtle', usage: '次级背景：分区、斑马行', light: 'neutral-100', dark: 'neutral-900' },
  { cssVar: '--z-color-bg-muted', usage: '弱化填充：标签、代码块、禁用输入', light: 'neutral-200', dark: 'neutral-800' },
  { cssVar: '--z-color-bg-elevated', usage: '浮层表面：卡片、弹层、菜单', light: 'neutral-50', dark: 'neutral-900' },
  { cssVar: '--z-color-bg-inverse', usage: '反色表面：Tooltip、深色条', light: 'neutral-900', dark: 'neutral-50' },
];

const FG_ROWS: TokenRow[] = [
  { cssVar: '--z-color-fg', usage: '正文文字 / 图标', light: 'neutral-950', dark: 'neutral-50' },
  { cssVar: '--z-color-fg-muted', usage: '次要文字：说明、元信息', light: 'neutral-600', dark: 'neutral-300' },
  { cssVar: '--z-color-fg-subtle', usage: '弱化文字：占位符、时间戳', light: 'neutral-500', dark: 'neutral-400' },
  { cssVar: '--z-color-fg-inverse', usage: '反色表面上的文字', light: 'neutral-50', dark: 'neutral-950' },
  { cssVar: '--z-color-fg-on-primary', usage: '主色填充上的文字（与 primary-fg 同源）', light: 'neutral-50', dark: 'neutral-950' },
];

const BORDER_ROWS: TokenRow[] = [
  { cssVar: '--z-color-border', usage: '常规描边：输入框、卡片', light: 'neutral-300', dark: 'neutral-700' },
  { cssVar: '--z-color-border-subtle', usage: '极弱分隔：行分隔线', light: 'neutral-200', dark: 'neutral-800' },
  { cssVar: '--z-color-border-strong', usage: '强调描边：hover / 选中态（≥3:1）', light: 'neutral-500', dark: 'neutral-400' },
  { cssVar: '--z-color-border-focus', usage: '焦点描边', light: 'brand-600', dark: 'brand-500' },
];

const PRIMARY_ROWS: TokenRow[] = [
  { cssVar: '--z-color-primary', usage: '主按钮、选中态、主强调', light: 'brand-600', dark: 'brand-500' },
  { cssVar: '--z-color-primary-hover', usage: '悬停（加深）', light: 'brand-700', dark: 'brand-400' },
  { cssVar: '--z-color-primary-active', usage: '按下', light: 'brand-800', dark: 'brand-300' },
  { cssVar: '--z-color-primary-fg', usage: '主色上的文字 / 图标', light: 'neutral-50', dark: 'neutral-950' },
  { cssVar: '--z-color-primary-subtle', usage: '主色弱化底：浅色徽标、选中行', light: 'brand-50', dark: 'brand-900' },
  { cssVar: '--z-color-primary-subtle-fg', usage: '主色弱化底上的文字', light: 'brand-700', dark: 'brand-300' },
];

const STATUS_ROWS: TokenRow[] = [
  { cssVar: '--z-color-{role}', usage: '状态主色：danger / success / warning / info', light: '{role}-600', dark: '{role}-500' },
  { cssVar: '--z-color-{role}-hover', usage: '状态色悬停', light: '{role}-700', dark: '{role}-400' },
  { cssVar: '--z-color-{role}-fg', usage: '状态色填充上的文字', light: 'neutral-50', dark: 'neutral-950' },
  { cssVar: '--z-color-{role}-subtle', usage: '状态弱化底：浅色 Alert / Tag', light: '{role}-50', dark: '{role}-900' },
  { cssVar: '--z-color-{role}-subtle-fg', usage: '状态弱化底上的文字', light: '{role}-700', dark: '{role}-300' },
];

const LINK_ROWS: TokenRow[] = [
  { cssVar: '--z-color-link', usage: '正文中的链接（与 bg ≥ 4.5:1）', light: 'brand-600', dark: 'brand-500' },
  { cssVar: '--z-color-link-hover', usage: '链接悬停', light: 'brand-700', dark: 'brand-400' },
  { cssVar: '--z-color-focus-ring', usage: ':focus-visible 焦点圈（与 bg ≥ 3:1）', light: 'brand-600', dark: 'brand-500' },
];

const OVERLAY_ROWS: TokenRow[] = [
  { cssVar: '--z-color-overlay', usage: '弹层遮罩（color-mix 透明度）', light: 'neutral-950 45%', dark: 'neutral-950 65%' },
  { cssVar: '--z-color-disabled-bg', usage: '禁用底色', light: 'neutral-100', dark: 'neutral-800' },
  { cssVar: '--z-color-disabled-fg', usage: '禁用文字', light: 'neutral-400', dark: 'neutral-500' },
  { cssVar: '--z-color-disabled-border', usage: '禁用描边', light: 'neutral-200', dark: 'neutral-800' },
];

/* ------------------------------ 换肤演示数据 ------------------------------ */

type SkinPalette = 'blue' | 'success' | 'warning';

const SKIN_OPTIONS: { value: SkinPalette; label: string }[] = [
  { value: 'blue', label: '默认蓝' },
  { value: 'success', label: '品牌绿（success 色阶）' },
  { value: 'warning', label: '品牌橙（warning 色阶）' },
];

/** 与三步法规则一致：浅色 600/700/800 + subtle 50/700；深色 500/400/300 + subtle 900/300 */
function skinVars(palette: SkinPalette, dark: boolean): Record<string, string> {
  if (palette === 'blue') return {};
  if (dark) {
    return {
      '--z-color-primary': `var(--z-${palette}-500)`,
      '--z-color-primary-hover': `var(--z-${palette}-400)`,
      '--z-color-primary-active': `var(--z-${palette}-300)`,
      '--z-color-primary-fg': 'var(--z-neutral-950)',
      '--z-color-primary-subtle': `var(--z-${palette}-900)`,
      '--z-color-primary-subtle-fg': `var(--z-${palette}-300)`,
      '--z-color-border-focus': `var(--z-${palette}-500)`,
      '--z-color-link': `var(--z-${palette}-500)`,
      '--z-color-link-hover': `var(--z-${palette}-400)`,
      '--z-color-focus-ring': `var(--z-${palette}-500)`,
    };
  }
  return {
    '--z-color-primary': `var(--z-${palette}-600)`,
    '--z-color-primary-hover': `var(--z-${palette}-700)`,
    '--z-color-primary-active': `var(--z-${palette}-800)`,
    '--z-color-primary-fg': 'var(--z-neutral-50)',
    '--z-color-primary-subtle': `var(--z-${palette}-50)`,
    '--z-color-primary-subtle-fg': `var(--z-${palette}-700)`,
    '--z-color-border-focus': `var(--z-${palette}-600)`,
    '--z-color-link': `var(--z-${palette}-600)`,
    '--z-color-link-hover': `var(--z-${palette}-700)`,
    '--z-color-focus-ring': `var(--z-${palette}-600)`,
  };
}

const FRAMEWORK_OPTIONS = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
];

/* --------------------------------- 页面 --------------------------------- */

export default function DesignAssetsPage(): React.ReactNode {
  usePageTitle('设计资源');
  const [step, setStep] = useState(0);
  const [palette, setPalette] = useState<SkinPalette>('success');
  const [dark, setDark] = useState(false);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">设计资源</h1>
      <p className="doc-lead">
        面向设计师与品牌方的一站式对接页：Figma Tokens Studio 导入流程、三层令牌结构、品牌换肤三步法、
        CDN 免构建接入，以及设计侧令牌命名对照表。142 枚内置图标的可视化浏览见「图标库」页（左侧导航或 <a href="#/icons">#/icons</a>）。
      </p>

      {/* ============================ 1. Figma 导入 ============================ */}
      <h2 className="doc-h2">Figma Tokens Studio 导入</h2>
      <p className="doc-p">
        设计令牌的唯一来源是仓库里的{' '}
        <code className="doc-code-inline">packages/tokens/src/tokens.json</code>，它采用{' '}
        <strong>DTCG（Design Tokens Community Group）标准格式</strong>：<code className="doc-code-inline">$type</code>{' '}
        声明类型、<code className="doc-code-inline">$value</code> 承载取值，语义层的{' '}
        <code className="doc-code-inline">$value</code> 全部是 <code className="doc-code-inline">{'{别名链}'}</code>{' '}
        指向 primitive 层（例如 <code className="doc-code-inline">{'{zui.primitives.brand.600}'}</code>），不含裸色值。
        该文件同时供 Figma / Tokens Studio / Style Dictionary 消费。
      </p>

      <Demo
        title="导入流程"
        description="四步完成接入（点击步骤可回看）；完成后 Figma 中会出现 primitives 与 semantic 两套 Token Set。"
        code={STEPS_CODE}
      >
        <Steps
          current={step}
          onChange={setStep}
          items={[
            { title: '打开 Tokens Studio', description: 'Figma 插件菜单启动 Tokens Studio for Figma' },
            { title: '粘贴 tokens.json', description: 'Settings → Load from file → JSON 粘贴' },
            { title: '生成两层 Token Set', description: 'primitives 与 semantic 自动导入' },
            { title: '绑定 semantic 令牌', description: '组件样式按语义层取值' },
          ]}
        />
      </Demo>

      <h3 className="doc-h3">tokens.json 结构速览</h3>
      <CodeBlock code={TOKENS_JSON_CODE} language="json" />

      <h3 className="doc-h3">三层令牌：primitive → semantic → 组件级</h3>
      <div className="doc-table-wrap">
        <table className="doc-api-table">
          <thead>
            <tr>
              <th scope="col">层级</th>
              <th scope="col">DTCG 路径示例</th>
              <th scope="col">CSS 变量示例</th>
              <th scope="col">说明</th>
            </tr>
          </thead>
          <tbody>
            {LAYER_ROWS.map((row) => (
              <tr key={row.layer}>
                <td>{row.layer}</td>
                <td>
                  <code className="doc-code-inline">{row.dtcg}</code>
                </td>
                <td>
                  <code className="doc-code-inline">{row.cssVar}</code>
                </td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="doc-p">
        Figma 侧的 Token 路径与 CSS 变量按前缀机械对应（Token Set 名即路径前缀 <code className="doc-code-inline">zui.</code>）：
      </p>
      <div className="doc-table-wrap">
        <table className="doc-api-table">
          <thead>
            <tr>
              <th scope="col">Figma 路径（DTCG）</th>
              <th scope="col">CSS 变量</th>
              <th scope="col">说明</th>
            </tr>
          </thead>
          <tbody>
            {DTCG_MAP_ROWS.map((row) => (
              <tr key={row.figma}>
                <td>
                  <code className="doc-code-inline">{row.figma}</code>
                </td>
                <td>
                  <code className="doc-code-inline">{row.cssVar}</code>
                </td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================ 2. 品牌换肤 ============================ */}
      <h2 className="doc-h2">品牌换肤三步法</h2>
      <p className="doc-p">
        核心原则：<strong>只覆盖 semantic 层 CSS 变量，primitive 色阶与组件级变量一律不动</strong>。
        这样深浅色映射（dark.css）、组件样式全部自动跟随，且不会产生硬编码色值。
      </p>

      <Demo
        title="换肤预览"
        description="切换品牌色与深浅色，观察主按钮、链接、焦点圈与文案配置（ConfigProvider）的联动。演示用内联变量模拟容器 class，落地请用下方三步法代码。"
        stack
      >
        <div className="doc-pg-preview-row">
          <RadioGroup value={palette} onChange={(value) => setPalette(value as SkinPalette)} orientation="horizontal">
            {SKIN_OPTIONS.map((option) => (
              <Radio key={option.value} value={option.value} label={option.label} />
            ))}
          </RadioGroup>
          <Switch checked={dark} onChange={setDark} label="深色预览" />
        </div>
        <ConfigProvider locale={{ select: { placeholder: '请挑选框架' } }}>
          <section
            data-theme={dark ? 'dark' : 'light'}
            style={
              {
                ...skinVars(palette, dark),
                padding: 'var(--z-space-6)',
                background: 'var(--z-color-bg)',
                border: '1px solid var(--z-color-border)',
                borderRadius: 'var(--z-radius-lg)',
                width: '100%',
              } as React.CSSProperties
            }
          >
            <div className="doc-pg-preview-row">
              <Button variant="primary">主要按钮</Button>
              <Button variant="secondary">次要按钮</Button>
              <Button variant="outline">描边按钮</Button>
              <Button variant="ghost">幽灵按钮</Button>
              <Button variant="danger">危险按钮</Button>
            </div>
            <div className="doc-pg-preview-row">
              <Checkbox label="同意服务协议" defaultChecked />
              <Switch label="接收通知" defaultChecked />
              <div style={{ width: 180, maxWidth: '100%' }}>
                <Select options={FRAMEWORK_OPTIONS} />
              </div>
            </div>
          </section>
        </ConfigProvider>
      </Demo>

      <h3 className="doc-h3">第一步：只写 semantic 层覆盖</h3>
      <p className="doc-p">
        新建 <code className="doc-code-inline">brand-skin.css</code>，取值全部引用既有 primitive 色阶
        （换品牌只需换色阶名或改 primitive 数值，禁止出现裸色值）：
      </p>
      <CodeBlock code={SKIN_CSS_CODE} language="css" />

      <h3 className="doc-h3">第二步：挂载 + ConfigProvider</h3>
      <p className="doc-p">
        皮肤在 <code className="doc-code-inline">@zui/react/styles.css</code> 之后引入，挂在容器（或 <code className="doc-code-inline">:root</code>）上；
        <code className="doc-code-inline">ConfigProvider</code> 负责内置文案（locale / translate），与换肤正交、互不干扰：
      </p>
      <CodeBlock code={SKIN_TSX_CODE} language="tsx" />

      <h3 className="doc-h3">第三步：补暗色取值</h3>
      <p className="doc-p">
        规则与 <code className="doc-code-inline">dark.css</code> 一致：色阶 600 → 500、fg 反转、subtle 底 → 900 / 300；
        跟随系统的场景再补一条 media 查询：
      </p>
      <CodeBlock code={SKIN_DARK_CODE} language="css" />

      <h3 className="doc-h3">ConfigProvider API</h3>
      <ApiTable
        rows={[
          {
            name: 'locale',
            type: 'DeepPartial<ZuiLocale>',
            description: '与默认 zh-CN 深合并的内置文案覆盖（未提供的段 / 键保持默认）。',
          },
          {
            name: 'translate',
            type: 'TranslateConfig',
            description: 'AI 自动翻译配置（OpenAI / DeepL / Youdao / custom），配置后自动翻译组件内置文案。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '子树。多层嵌套逐层深合并，内层覆盖外层。',
          },
        ]}
      />

      {/* ============================ 3. CDN 接入 ============================ */}
      <h2 className="doc-h2">CDN 接入（免构建）</h2>
      <p className="doc-p">
        一条命令产出自带 React 19 的 IIFE 包与全量样式，适合内部系统、静态页与低代码平台直接挂脚本：
      </p>
      <CodeBlock code={CDN_BUILD_CODE} language="bash" />
      <CodeBlock code={CDN_HTML_CODE} language="html" />
      <p className="doc-p">
        全局命名空间 <code className="doc-code-inline">ZUI</code> 暴露全部组件与 <code className="doc-code-inline">ZUI.React</code>、
        <code className="doc-code-inline">ZUI.createRoot</code>、<code className="doc-code-inline">ZUI.hydrateRoot</code>，
        无需额外引入 React。完整可运行示例见{' '}
        <a className="doc-chip-link" href="/cdn-demo.html">
          /cdn-demo.html
        </a>{' '}
        （提示：示例当前引用 v0.1.0 产物，新版本请按上面的 v0.2.0 路径接入）。
      </p>

      {/* ============================ 4. 命名对照表 ============================ */}
      <h2 className="doc-h2">设计侧令牌命名对照表</h2>
      <p className="doc-p">
        下表给出 semantic 层 CSS 变量的标准取值映射（与 <code className="doc-code-inline">semantic.css</code> /{' '}
        <code className="doc-code-inline">dark.css</code> 逐条一致），深浅两套均指向 primitive 色阶{' '}
        <code className="doc-code-inline">--z-{'{色阶}'}-{'{阶号}'}</code>。换肤时在语义层重新指认即可；明暗对比度均按 WCAG AA 校准
        （正文 fg 与 bg ≥ 4.5:1，primary-fg 与 primary ≥ 4.5:1）。
      </p>

      <h3 className="doc-h3">背景</h3>
      <TokenTable rows={BG_ROWS} />

      <h3 className="doc-h3">前景（文字 / 图标）</h3>
      <TokenTable rows={FG_ROWS} />

      <h3 className="doc-h3">边框</h3>
      <TokenTable rows={BORDER_ROWS} />

      <h3 className="doc-h3">主色（品牌色）</h3>
      <TokenTable rows={PRIMARY_ROWS} />

      <h3 className="doc-h3">状态色（danger / success / warning / info 同构）</h3>
      <TokenTable rows={STATUS_ROWS} />
      <p className="doc-p">
        <code className="doc-code-inline">{'{role}'}</code> 可替换为 <code className="doc-code-inline">danger</code>、
        <code className="doc-code-inline">success</code>、<code className="doc-code-inline">warning</code>、
        <code className="doc-code-inline">info</code>，四组变量结构与取值规则完全同构。
      </p>

      <h3 className="doc-h3">链接与焦点</h3>
      <TokenTable rows={LINK_ROWS} />

      <h3 className="doc-h3">遮罩与禁用</h3>
      <TokenTable rows={OVERLAY_ROWS} />

      <p className="doc-p">
        尺寸类变量不分深浅色（dark.css 从不覆盖）：<code className="doc-code-inline">--z-radius</code>（单源，sm / md / lg / xl 按 calc 派生）、
        <code className="doc-code-inline">--z-space-1..12</code>、<code className="doc-code-inline">--z-text-xs..2xl</code>、
        <code className="doc-code-inline">--z-shadow-xs..lg</code>、<code className="doc-code-inline">--z-font-sans / mono</code>、
        <code className="doc-code-inline">--z-duration-*</code>、<code className="doc-code-inline">--z-z-*</code>（z-index 刻度）。
      </p>
    </div>
  );
}
