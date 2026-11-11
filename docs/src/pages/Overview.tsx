import { useState } from 'react';
import { Avatar, Button, Input, Progress, Segmented, Switch, Tag } from '@zui/react';

import CodeBlock from '../components/CodeBlock';
import { usePageTitle } from '../components/usePageTitle';
import { hrefFor } from '../router';
import { catalog } from '../site';

const USAGE_CODE = `import '@zui/react/styles.css';
import { Button } from '@zui/react';

export function App() {
  return <Button variant="primary">开始使用</Button>;
}`;

const FEATURES = [
  {
    mark: '{ }',
    title: '令牌驱动',
    desc: '从色彩、间距到暗色主题，三层 CSS 变量提供一致的视觉语言。覆盖语义令牌，即可完成换肤。',
    link: '/tokens',
    label: '探索设计令牌',
  },
  {
    mark: '↗',
    title: '零运行时样式',
    desc: '纯 CSS 与 CSS 变量直接交付样式，无样式注入与 CSS-in-JS 运行时，融入现有构建流程。',
    link: '/components/button',
    label: '查看组件用法',
  },
  {
    mark: '⌘',
    title: '无障碍优先',
    desc: '语义、焦点与键盘交互共同构成组件契约。示例支持直接操作，也支持使用键盘体验。',
    link: '/components/command-palette',
    label: '体验命令面板',
  },
  {
    mark: '✳',
    title: '面向 AI 协作',
    desc: '稳定的 props、语义化定制出口，以及 Registry、CLI 与 MCP，让生成的代码遵循同一套规范。',
    link: '/design',
    label: '了解设计资源',
  },
] as const;

function scrollToStart(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById('快速开始')
    ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

function ComponentPreview(): React.ReactNode {
  const [period, setPeriod] = useState('week');
  const [notify, setNotify] = useState(true);
  const [created, setCreated] = useState(false);
  const [name, setName] = useState('设计系统');
  return (
    <div className="doc-preview" role="region" aria-label="交互组件预览">
      <div className="doc-preview-bar">
        <span className="doc-preview-dot" /> 实时组件预览 <span>LIVE</span>
      </div>
      <div className="doc-preview-body">
        <div className="doc-preview-heading">
          <div>
            <p className="doc-eyebrow">WORKSPACE</p>
            <div className="doc-preview-title">项目概览</div>
          </div>
          <Avatar name="ZUI" size="sm" />
        </div>
        <Segmented
          aria-label="预览统计周期"
          block
          size="sm"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: '本周' },
            { value: 'month', label: '本月' },
            { value: 'all', label: '全部' },
          ]}
        />
        <div className="doc-preview-metric">
          <div>
            <span>已完成任务</span>
            <strong>
              {period === 'week' ? '24' : period === 'month' ? '86' : '128'}
              <small> / {period === 'week' ? '32' : period === 'month' ? '100' : '160'}</small>
            </strong>
          </div>
          <Tag color="success">进行顺利</Tag>
        </div>
        <Progress
          aria-label="项目完成进度"
          percent={period === 'week' ? 75 : period === 'month' ? 86 : 80}
          showInfo={false}
          size="sm"
        />
        <div className="doc-preview-setting">
          <div>
            <strong>动态通知</strong>
            <span>及时了解项目的最新进展</span>
          </div>
          <Switch size="sm" aria-label="项目动态通知" checked={notify} onChange={setNotify} />
        </div>
        <label className="doc-preview-label" htmlFor="overview-project-name">
          项目名称
        </label>
        <Input
          id="overview-project-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setCreated(false);
          }}
        />
        <div className="doc-preview-bottom">
          <div className="doc-preview-avatars">
            <Avatar name="林" size="sm" />
            <Avatar name="Alex" size="sm" />
            <Avatar name="Mia" size="sm" />
            <span>协作中</span>
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={!name.trim()}
            onClick={() => setCreated(true)}
          >
            创建项目
          </Button>
        </div>
        <p className="doc-preview-status" role="status">
          {created ? `已创建「${name.trim()}」` : '试试切换周期、修改名称或创建项目'}
        </p>
      </div>
    </div>
  );
}

export default function Overview(): React.ReactNode {
  usePageTitle('概览');
  return (
    <div className="doc-page doc-overview">
      <section className="doc-hero">
        <p className="doc-eyebrow">DESIGNED FOR YOUR NEXT IDEA</p>
        <h1 className="doc-hero-title">ZUI 组件库</h1>
        <p className="doc-hero-sub">
          从一个组件，
          <br />
          到一致的产品体验。
        </p>
        <p className="doc-hero-desc">
          为 React 19
          打造的现代组件库。以设计令牌连接设计与代码，让界面构建更清晰，让每一次交互都有章可循。
        </p>
        <div className="doc-hero-actions">
          <button type="button" className="doc-btn doc-btn--primary" onClick={scrollToStart}>
            快速开始 <span aria-hidden="true">↗</span>
          </button>
          <a className="doc-btn doc-btn--outline" href={hrefFor('/components/button')}>
            浏览组件 <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="doc-hero-install">
          <CodeBlock
            code={`pnpm add @zui/react@npm:@yeyouyuan/zui-react@${catalog.version}`}
            language="shell"
          />
        </div>
        <ComponentPreview />
      </section>

      <dl className="doc-catalog-stats" aria-label="当前源码资源">
        <div>
          <dt>React 组件</dt>
          <dd>
            {catalog.components}
            <span>个</span>
          </dd>
        </div>
        <div>
          <dt>业务区块</dt>
          <dd>
            {catalog.blocks}
            <span>个</span>
          </dd>
        </div>
        <div>
          <dt>矢量图标</dt>
          <dd>
            {catalog.icons}
            <span>枚</span>
          </dd>
        </div>
        <div>
          <dt>主题支持</dt>
          <dd className="doc-stat-theme">
            Light <span>/</span> Dark
          </dd>
        </div>
      </dl>

      <h2 className="doc-h2" id="核心理念">
        让构建回归简单
      </h2>
      <p className="doc-section-lead">一套连贯的基础，贯穿组件、主题与开发工作流。</p>
      <ul className="doc-features">
        {FEATURES.map((feature) => (
          <li className="doc-feature" key={feature.title}>
            <span className="doc-feature-mark" aria-hidden="true">
              {feature.mark}
            </span>
            <h3 className="doc-feature-title">{feature.title}</h3>
            <p className="doc-feature-desc">{feature.desc}</p>
            <a href={hrefFor(feature.link)}>
              {feature.label}
              <span aria-hidden="true"> →</span>
            </a>
          </li>
        ))}
      </ul>

      <h2 className="doc-h2" id="快速开始">
        快速开始
      </h2>
      <p className="doc-section-lead">安装、引入样式，然后写下你的第一个组件。</p>
      <ol className="doc-start-steps">
        <li>
          <span>01</span>
          <div>
            <h3>安装依赖</h3>
            <p>先登录 GitHub Packages，再在 React 19 项目中安装组件包。</p>
            <CodeBlock
              code={
                'npm config set @yeyouyuan:registry https://npm.pkg.github.com --location=project\nnpm login --scope=@yeyouyuan --auth-type=legacy --registry=https://npm.pkg.github.com'
              }
              language="shell"
            />
            <CodeBlock
              code={`pnpm add @zui/react@npm:@yeyouyuan/zui-react@${catalog.version}`}
              language="shell"
            />
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <h3>引入并使用</h3>
            <p>在应用入口引入一次样式，即可开始组合组件。</p>
            <CodeBlock code={USAGE_CODE} language="tsx" />
          </div>
        </li>
      </ol>
      <div className="doc-note">
        样式入口包含令牌、重置样式与组件样式。默认跟随系统主题；也可设置{' '}
        <code className="doc-code-inline">data-theme="dark"</code> 切换暗色。
        <a href={hrefFor('/theme')}>打开主题调参 →</a>
      </div>

      <h2 className="doc-h2" id="架构">
        由下而上，保持一致
      </h2>
      <p className="doc-section-lead">令牌定义视觉，组件承载交互，应用自由组合。</p>
      <ol className="doc-architecture">
        <li>
          <span>01</span>
          <div>
            <h3>设计令牌</h3>
            <p>基础色阶 → 语义变量 → 暗色映射，以 CSS 变量作为统一入口。</p>
          </div>
          <code>@zui/tokens</code>
        </li>
        <li>
          <span>02</span>
          <div>
            <h3>组件与区块</h3>
            <p>以组合式 API、键盘交互和语义化定制出口提供稳定契约。</p>
          </div>
          <code>@zui/react</code>
        </li>
        <li>
          <span>03</span>
          <div>
            <h3>你的应用</h3>
            <p>按需组合组件，通过 data-part、classNames 和 CSS 变量完成定制。</p>
          </div>
          <code>App</code>
        </li>
      </ol>

      <h2 className="doc-h2" id="探索组件">
        从这里继续
      </h2>
      <div className="doc-explore-grid">
        <a href={hrefFor('/components/input')}>
          <span className="doc-eyebrow">COMPONENTS</span>
          <strong>
            组合你的界面 <span aria-hidden="true">↗</span>
          </strong>
          <p>从基础输入到复杂交互，查看可操作的示例与完整 API。</p>
        </a>
        <a href={hrefFor('/blocks')}>
          <span className="doc-eyebrow">BLOCKS</span>
          <strong>
            更快搭好业务页面 <span aria-hidden="true">↗</span>
          </strong>
          <p>从登录、搜索到数据看板，使用可组合的业务区块。</p>
        </a>
        <a href={hrefFor('/tokens')}>
          <span className="doc-eyebrow">FOUNDATIONS</span>
          <strong>
            建立你的视觉语言 <span aria-hidden="true">↗</span>
          </strong>
          <p>探索色彩、间距、排版与圆角，调整产品的每个细节。</p>
        </a>
        <a href={hrefFor('/lab')}>
          <span className="doc-eyebrow">DESIGN LAB</span>
          <strong>
            探索组件创意工坊 <span aria-hidden="true">↗</span>
          </strong>
          <p>体验 10 个交互设计原型，从数据洞察、文件协作到团队效率与创作配置。</p>
        </a>
      </div>
      <footer className="doc-overview-footer">
        <span>ZUI · 以一致性连接设计与代码</span>
        <span>源码 v{catalog.version}</span>
      </footer>
    </div>
  );
}
