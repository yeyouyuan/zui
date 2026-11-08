import { useState } from 'react';
import { Folder, Home, Users } from '@zui/icons';
import { SideNav, type SideNavSection } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CodeBlock from '../../components/CodeBlock';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [current, setCurrent] = useState('overview');

<SideNav
  aria-label="主导航"
  sections={sections}
  currentKey={current}
  collapsible={false}
  onNavigate={(key) => setCurrent(key)}
/>`;

const GROUP_CODE = `<SideNav
  aria-label="主导航"
  sections={sectionsWithGroups}
  currentKey={current}
  defaultExpandedKeys={['projects']}
  onNavigate={setCurrent}
/>`;

const REACT_ROUTER_CODE = `import { Link } from 'react-router-dom';
import type { SideNavProps } from '@zui/react';

const renderReactRouterLink: NonNullable<SideNavProps['renderLink']> = (
  _item,
  { href, ...props },
) => <Link {...props} to={href} />;

<SideNav
  sections={sections}
  currentKey={location.pathname}
  renderLink={renderReactRouterLink}
/>`;

const STATIC_SECTIONS: SideNavSection[] = [
  {
    key: 'workspace',
    label: '工作区',
    items: [
      { key: 'overview', label: '概览', href: '#/components/side-nav' },
      { key: 'reports', label: '交付报告', href: '#/components/side-nav' },
      { key: 'export', label: '数据导出', href: '#/components/side-nav', disabled: true },
    ],
  },
];

const GROUP_SECTIONS: SideNavSection[] = [
  {
    key: 'workspace',
    label: '工作区',
    items: [
      {
        key: 'overview',
        label: '概览',
        href: '#/components/side-nav',
        icon: <Home aria-hidden="true" />,
      },
      {
        key: 'projects',
        label: '项目管理',
        icon: <Folder aria-hidden="true" />,
        badge: 12,
        children: [
          { key: 'projects-active', label: '进行中的项目', href: '#/components/side-nav' },
          { key: 'projects-archived', label: '已归档项目', href: '#/components/side-nav' },
        ],
      },
      {
        key: 'team',
        label: '团队管理',
        icon: <Users aria-hidden="true" />,
        badge: 48,
        children: [
          { key: 'team-members', label: '团队成员', href: '#/components/side-nav' },
          { key: 'team-roles', label: '角色与权限', href: '#/components/side-nav' },
        ],
      },
    ],
  },
];

export default function SideNavPage(): React.ReactNode {
  usePageTitle('SideNav 侧边导航');
  const [current, setCurrent] = useState('overview');
  const [groupCurrent, setGroupCurrent] = useState('projects-active');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">SideNav 侧边导航</h1>
      <p className="doc-lead">
        原生 nav/ul/li/a 语义的持久侧栏：分区、分组 disclosure、当前页 aria-current 与桌面收窄
        flyout；路由无关，普通 href 直接工作，Router 经 renderLink 接入。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="叶子项渲染为链接；当前项由受控 currentKey 驱动（aria-current=page）；disabled 叶子不输出链接语义。"
        code={BASIC_CODE}
        stack
      >
        <SideNav
          aria-label="基础导航演示"
          sections={STATIC_SECTIONS}
          currentKey={current}
          collapsible={false}
          onNavigate={setCurrent}
        />
      </Demo>

      <Demo
        title="分组、徽标与桌面收窄"
        description="顶层项提供图标后可收窄为 rail；分组按钮保持 disclosure 语义，收窄态点击分组会打开可键盘访问的 flyout。"
        code={GROUP_CODE}
        stack
      >
        <SideNav
          aria-label="分组导航演示"
          sections={GROUP_SECTIONS}
          currentKey={groupCurrent}
          defaultExpandedKeys={['projects']}
          onNavigate={setGroupCurrent}
        />
      </Demo>

      <h2 className="doc-h2">React Router 适配</h2>
      <p className="doc-p">
        适配器只把 <code className="doc-code-inline">href</code> 映射为 Router 的
        <code className="doc-code-inline">to</code>，其余 props（包括 ref、ARIA、className、data 与
        SideNav 的 onClick）必须原样转发。下面代码由文档工程的 TypeScript 检查持续验证。
      </p>
      <CodeBlock code={REACT_ROUTER_CODE} language="tsx" />

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'sections',
            type: 'SideNavSection[]',
            description:
              '分区列表；叶子 { key, label, href, icon?, badge?, disabled?, linkProps? }，分组 { key, label, children }。',
          },
          {
            name: 'currentKey',
            type: 'string | null',
            description: '当前路由对应的叶子 key；受控，由 Router 或位置状态推导，点击不乐观改写。',
          },
          {
            name: 'onNavigate',
            type: '(key, item, event) => void',
            description: '同上下文普通导航意图；不调用 preventDefault，修饰键/新窗口/下载不触发。',
          },
          {
            name: 'expandedKeys / defaultExpandedKeys / onExpandedKeysChange',
            type: 'string[] / string[] / (keys, details) => void',
            description: '展开分组；details.reason 为 toggle / current / items-change。',
          },
          {
            name: 'collapsed / defaultCollapsed / onCollapsedChange / collapsible',
            type: 'boolean',
            description: '桌面收窄态；collapsible=false 隐藏内置收窄按钮。',
          },
          {
            name: 'renderLink',
            type: '(item, props) => ReactElement',
            description:
              '接入 Router 链接；必须返回落到原生 <a> 的元素并完整转发 ref、ARIA、className、onClick、data-part 与 data-key。',
          },
          {
            name: 'classNames',
            type: '{ root?; viewport?; section?; sectionLabel?; list?; item?; link?; groupToggle?; groupIndicator?; icon?; label?; badge?; children?; flyout?; tooltip?; collapseToggle? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'nav'>",
            description: '原生 nav 属性透传（aria-label / aria-labelledby / 事件等）。',
          },
        ]}
      />
      <p className="doc-p">
        结构：
        <code className="doc-code-inline">
          nav（root）&gt; viewport &gt; section（group）&gt; list（ul）&gt; item（li）&gt; link（a）
        </code>
        ；分组按钮为 disclosure 语义（aria-expanded + aria-controls），收窄态 flyout 经 Portal
        渲染并继承主题令牌。
      </p>

      <CustomizeOutlet
        name="SideNav"
        parts={[
          'root',
          'viewport',
          'section',
          'section-label',
          'list',
          'item',
          'link',
          'group-toggle',
          'group-indicator',
          'icon',
          'label',
          'badge',
          'children',
          'flyout',
          'tooltip',
          'collapse-toggle',
        ]}
        vars={[
          '--z-sidenav-width',
          '--z-sidenav-collapsed-width',
          '--z-sidenav-padding',
          '--z-sidenav-gap',
          '--z-sidenav-item-height',
          '--z-sidenav-item-padding-x',
          '--z-sidenav-child-indent',
          '--z-sidenav-radius',
          '--z-sidenav-bg',
          '--z-sidenav-fg',
          '--z-sidenav-muted-fg',
          '--z-sidenav-hover-bg',
          '--z-sidenav-active-bg',
          '--z-sidenav-active-fg',
          '--z-sidenav-indicator',
          '--z-sidenav-focus-ring',
          '--z-sidenav-flyout-width',
          '--z-sidenav-flyout-max-height',
          '--z-sidenav-animation-duration',
        ]}
      />
    </div>
  );
}
