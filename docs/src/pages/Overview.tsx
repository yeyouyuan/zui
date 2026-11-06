import CodeBlock from '../components/CodeBlock';
import { usePageTitle } from '../components/usePageTitle';

const INSTALL_CODE = `# 安装（推荐 pnpm）
pnpm add @zui/react`;

const USAGE_CODE = `// 1. 引入组件库样式（内含令牌 + 重置样式，只引一次）
import '@zui/react/styles.css';

// 2. 直接使用组件（React 19 原生 ref 透传）
import { Button } from '@zui/react';

export function App() {
  return <Button variant="primary">开始使用</Button>;
}`;

const ARCH_DIAGRAM = `┌──────────────────────────────────────────────────────────┐
│  应用层  App / 业务页面                                    │
│    · 只消费组件与语义令牌                                    │
│    · 换肤 = 覆盖 CSS 变量，零构建改动                        │
└───────────────▲──────────────────────────────────────────┘
                │  import { Button, Input … } from '@zui/react'
┌───────────────┴──────────────────────────────────────────┐
│  组件层  @zui/react（57 个组件）                            │
│    · 零运行时样式：纯 CSS 文件 + CSS 变量                     │
│    · 无障碍优先：键盘可达 / 焦点管理 / ARIA 一票否决            │
│    · 定制出口三件套：data-part + classNames + --z-<name>-*   │
└───────────────▲──────────────────────────────────────────┘
                │  var(--z-color-primary) / var(--z-radius) …
┌───────────────┴──────────────────────────────────────────┐
│  令牌层  @zui/tokens（三层令牌）                            │
│    base：原始色阶（neutral/brand/danger/success/warning/info）│
│    semantic：语义变量（组件唯一消费入口）                      │
│    dark：暗色映射（data-theme="dark" / 跟随系统）             │
└──────────────────────────────────────────────────────────┘`;

export default function Overview(): React.ReactNode {
  usePageTitle('概览');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">ZUI 组件库</h1>
      <p className="doc-lead">
        ZUI 是一套令牌驱动、零运行时样式、无障碍优先且对 AI 友好的现代 React 19 组件库。
        样式全部由 CSS 变量令牌承载，组件只暴露语义化定制出口，不泄露任何内部实现细节。
      </p>

      <h2 className="doc-h2">核心理念</h2>
      <ul className="doc-features">
        <li className="doc-feature">
          <p className="doc-feature-title">令牌驱动</p>
          <p className="doc-feature-desc">
            三层令牌（base / semantic / dark）是唯一视觉事实来源。换肤只覆盖语义变量，组件零改动。
          </p>
        </li>
        <li className="doc-feature">
          <p className="doc-feature-title">零运行时</p>
          <p className="doc-feature-desc">
            纯 CSS 文件 + CSS 变量，无 CSS-in-JS 运行时、无样式注入开销，构建产物即最终样式。
          </p>
        </li>
        <li className="doc-feature">
          <p className="doc-feature-title">无障碍优先</p>
          <p className="doc-feature-desc">
            键盘可达、可见焦点、语义 ARIA 是一票否决项，所有键盘交互均按 WAI-ARIA APG 实现并测试。
          </p>
        </li>
        <li className="doc-feature">
          <p className="doc-feature-title">AI 友好</p>
          <p className="doc-feature-desc">
            props 契约稳定、定制出口语义化，配套 llms.txt 速查，让 AI 一次生成正确的 ZUI 代码。
          </p>
        </li>
      </ul>

      <h2 className="doc-h2">设计原则</h2>
      <ul className="doc-principles">
        <li className="doc-principle">
          <p className="doc-principle-title">简洁中性</p>
          <p className="doc-principle-desc">
            默认外观克制中性，不喧宾夺主；视觉重点由内容与语义色决定，而不是组件自身的装饰。
          </p>
        </li>
        <li className="doc-principle">
          <p className="doc-principle-title">组合式 API</p>
          <p className="doc-principle-desc">
            复杂组件（Modal / Tabs / Table）以复合组件组合搭建，结构即语义，而不是堆叠布尔 props。
          </p>
        </li>
        <li className="doc-principle">
          <p className="doc-principle-title">语义化定制出口</p>
          <p className="doc-principle-desc">
            data-part + classNames + 组件级 CSS 变量三件套。永不暴露内部类名，定制永不与实现耦合。
          </p>
        </li>
        <li className="doc-principle">
          <p className="doc-principle-title">键盘可达一票否决</p>
          <p className="doc-principle-desc">
            任何组件若键盘不可达、焦点不可见或 ARIA 语义缺失，直接判定不合格，不允许上线。
          </p>
        </li>
      </ul>

      <h2 className="doc-h2">快速开始</h2>
      <p className="doc-p">安装组件库：</p>
      <CodeBlock code={INSTALL_CODE} />
      <p className="doc-p">引入样式并使用 Button：</p>
      <CodeBlock code={USAGE_CODE} />
      <div className="doc-note">
        样式文件 <code className="doc-code-inline">@zui/react/styles.css</code> 内含令牌、重置样式与全部组件样式，
        应用中只需引入一次。暗色模式切换{' '}
        <code className="doc-code-inline">document.documentElement.dataset.theme = &#39;dark&#39;</code>{' '}
        即可生效（跟随系统为默认行为）。
      </div>

      <h2 className="doc-h2">架构</h2>
      <p className="doc-p">
        自下而上三层：令牌层提供视觉事实来源，组件层只消费语义令牌并暴露定制出口，应用层按需组合。
      </p>
      <CodeBlock code={ARCH_DIAGRAM} />
    </div>
  );
}
