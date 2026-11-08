import * as React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SideNav } from './index';
import type { SideNavSection } from './index';

afterEach(cleanup);

// jsdom 没有布局：原型实现用 getClientRects 判定可聚焦目标，这里给出假盒模型
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', {
    configurable: true,
    value() {
      return [{ width: 10, height: 10, top: 0, left: 0, bottom: 10, right: 10 }];
    },
  });
});

function TestIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="5" />
    </svg>
  );
}

const sections: SideNavSection[] = [
  {
    key: 'workspace',
    label: '工作区',
    items: [
      { key: 'overview', label: '概览', href: '#/overview', icon: <TestIcon /> },
      {
        key: 'projects',
        label: '项目',
        icon: <TestIcon />,
        children: [
          { key: 'projects-active', label: '进行中', href: '#/projects/active' },
          { key: 'projects-archived', label: '已归档', href: '#/projects/archived' },
        ],
      },
    ],
  },
  {
    key: 'operations',
    label: '治理',
    items: [
      { key: 'reports', label: '报告', href: '#/reports', icon: <TestIcon /> },
      { key: 'export', label: '导出', href: '#/export', icon: <TestIcon />, disabled: true },
    ],
  },
];

function getNav(): HTMLElement {
  return screen.getByRole('navigation', { name: '主导航' });
}

describe('SideNav 渲染与 ARIA', () => {
  it('不可收窄且未配置图标时不渲染占位方块', () => {
    render(
      <SideNav
        aria-label="纯文字导航"
        collapsible={false}
        sections={[
          {
            key: 'text-only',
            items: [{ key: 'plain', label: '纯文字', href: '#/plain' }],
          },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: '纯文字' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '纯文字导航' })).not.toContainElement(
      document.querySelector('[data-part="icon"]')
    );
  });

  it('渲染 nav/section/list/link 语义与 data-part，section 用 group + aria-labelledby', () => {
    render(<SideNav sections={sections} aria-label="主导航" />);
    const nav = getNav();
    expect(nav).toHaveAttribute('data-part', 'root');
    expect(nav.querySelector('[data-part="viewport"]')).toBeInTheDocument();
    const section = nav.querySelector('[data-part="section"]');
    expect(section).toHaveAttribute('role', 'group');
    const label = section?.querySelector('[data-part="section-label"]');
    expect(section).toHaveAttribute('aria-labelledby', label?.id);
    expect(nav.querySelector('[data-part="list"]')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: '概览' });
    expect(link).toHaveAttribute('data-part', 'link');
    expect(link).toHaveAttribute('data-key', 'overview');
    expect(link).toHaveAttribute('href', '#/overview');
  });

  it('aria-label 缺省时取 locale.sideNav.navigation，显式 aria-labelledby 优先', () => {
    render(<SideNav sections={sections} />);
    expect(screen.getByRole('navigation', { name: '导航' })).toBeInTheDocument();
    cleanup();
    render(<SideNav sections={sections} aria-label="忽略" aria-labelledby="custom-heading" />);
    // 显式 aria-labelledby 优先：不输出 aria-label，name 由 labelledby 元素决定
    const nav = document.querySelector('nav[aria-labelledby="custom-heading"]');
    expect(nav).toBeInTheDocument();
    expect(nav).not.toHaveAttribute('aria-label');
  });

  it('currentKey 叶子输出 aria-current=page，父分组仅 data-current-descendant', () => {
    render(
      <SideNav
        sections={sections}
        currentKey="projects-active"
        defaultExpandedKeys={['projects']}
        aria-label="主导航"
      />
    );
    const link = screen.getByRole('link', { name: '进行中' });
    expect(link).toHaveAttribute('aria-current', 'page');
    const groupItem = document.querySelector(
      '[data-part="item"]:has([data-key="projects"])'
    ) as HTMLElement;
    expect(groupItem).toHaveAttribute('data-current-descendant', 'true');
    const groupToggle = within(groupItem).getByRole('button');
    expect(groupToggle).not.toHaveAttribute('aria-current');
  });

  it('disabled 叶子渲染 aria-disabled span 且不输出链接', () => {
    render(<SideNav sections={sections} aria-label="主导航" />);
    const disabled = document.querySelector('[data-part="link"][data-key="export"]');
    expect(disabled).toBeInTheDocument();
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect(disabled?.tagName).toBe('SPAN');
    expect(screen.queryByRole('link', { name: '导出' })).not.toBeInTheDocument();
  });
});

describe('SideNav 分组与展开', () => {
  it('defaultExpandedKeys 控制初始展开；点击 toggle 收起并回调 reason=toggle', async () => {
    const user = userEvent.setup();
    const onExpandedKeysChange = vi.fn();
    render(
      <SideNav
        sections={sections}
        defaultExpandedKeys={['projects']}
        onExpandedKeysChange={onExpandedKeysChange}
        aria-label="主导航"
      />
    );
    const toggle = screen.getByRole('button', { name: '项目' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: '进行中' })).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: '进行中' })).not.toBeInTheDocument();
    expect(onExpandedKeysChange).toHaveBeenCalledWith([], {
      reason: 'toggle',
      key: 'projects',
    });
  });

  it('非受控展开：current 父组在首次渲染同步并入，不等待 effect', () => {
    render(<SideNav sections={sections} currentKey="projects-active" aria-label="主导航" />);
    expect(screen.getByRole('link', { name: '进行中' })).toBeVisible();
    expect(screen.getByRole('button', { name: '项目' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('current 变化补入新父组并回调一次 reason=current', () => {
    const onExpandedKeysChange = vi.fn();
    const { rerender } = render(
      <SideNav
        sections={sections}
        currentKey="overview"
        onExpandedKeysChange={onExpandedKeysChange}
        aria-label="主导航"
      />
    );
    rerender(
      <SideNav
        sections={sections}
        currentKey="projects-active"
        onExpandedKeysChange={onExpandedKeysChange}
        aria-label="主导航"
      />
    );
    expect(screen.getByRole('button', { name: '项目' })).toHaveAttribute('aria-expanded', 'true');
    const calls = onExpandedKeysChange.mock.calls.filter(
      ([, details]) => details.reason === 'current'
    );
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ reason: 'current', key: 'projects' });
  });

  it('sections 删除分组时非受控状态裁剪并回调 items-change', () => {
    const onExpandedKeysChange = vi.fn();
    const { rerender } = render(
      <SideNav
        sections={sections}
        defaultExpandedKeys={['projects']}
        onExpandedKeysChange={onExpandedKeysChange}
        aria-label="主导航"
      />
    );
    const trimmed: SideNavSection[] = [
      { key: 'workspace', label: '工作区', items: [sections[0].items[0]] },
      sections[1],
    ];
    rerender(
      <SideNav
        sections={trimmed}
        defaultExpandedKeys={['projects']}
        onExpandedKeysChange={onExpandedKeysChange}
        aria-label="主导航"
      />
    );
    expect(onExpandedKeysChange).toHaveBeenCalledWith([], {
      reason: 'items-change',
      removedKeys: ['projects'],
    });
  });
});

describe('SideNav onNavigate 规则', () => {
  it('普通主键点击触发 onNavigate，不改写 currentKey', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <SideNav
        sections={sections}
        currentKey="overview"
        onNavigate={onNavigate}
        aria-label="主导航"
      />
    );
    await user.click(screen.getByRole('link', { name: '报告' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toBe('reports');
    // currentKey 仍由调用方控制
    expect(screen.getByRole('link', { name: '概览' })).toHaveAttribute('aria-current', 'page');
  });

  it('修饰键点击与被 linkProps.onClick 取消的点击不触发 onNavigate', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<SideNav sections={sections} onNavigate={onNavigate} aria-label="主导航" />);
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: '报告' }));
    await user.keyboard('{/Control}');
    expect(onNavigate).not.toHaveBeenCalled();

    const cancelled: SideNavSection[] = [
      {
        key: 'workspace',
        items: [
          {
            key: 'reports',
            label: '报告',
            href: '#/reports',
            icon: <TestIcon />,
            linkProps: {
              onClick: (event) => event.preventDefault(),
            },
          },
        ],
      },
    ];
    cleanup();
    render(<SideNav sections={cancelled} onNavigate={onNavigate} aria-label="主导航" />);
    await user.click(screen.getByRole('link', { name: '报告' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('与 React Router 集成时先执行链接回调和 onNavigate，再由 Router 接管导航', async () => {
    const user = userEvent.setup();
    const sequence: string[] = [];
    const routerSections: SideNavSection[] = [
      {
        key: 'workspace',
        items: [
          {
            key: 'reports',
            label: '报告',
            href: '/reports',
            icon: <TestIcon />,
            linkProps: {
              onClick: (event) => sequence.push(`link:${event.defaultPrevented}`),
            },
          },
        ],
      },
    ];
    const onNavigate = vi.fn(
      (_key: string, _item: unknown, event: React.MouseEvent<HTMLAnchorElement>) => {
        sequence.push(`sidenav:${event.defaultPrevented}`);
      }
    );
    const onDocumentClick = (event: MouseEvent) => {
      if ((event.target as Element).closest('[data-key="reports"]')) {
        sequence.push(`router:${event.defaultPrevented}`);
      }
    };

    function LocationProbe() {
      return <output data-testid="router-location">{useLocation().pathname}</output>;
    }

    document.addEventListener('click', onDocumentClick);
    try {
      render(
        <MemoryRouter initialEntries={['/']}>
          <SideNav
            sections={routerSections}
            aria-label="主导航"
            onNavigate={onNavigate}
            renderLink={(_item, { href, ...props }) => <Link {...props} to={href} />}
          />
          <LocationProbe />
        </MemoryRouter>
      );

      await user.click(screen.getByRole('link', { name: '报告' }));

      expect(sequence).toEqual(['link:false', 'sidenav:false', 'router:true']);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('router-location')).toHaveTextContent('/reports');
    } finally {
      document.removeEventListener('click', onDocumentClick);
    }
  });
});

describe('SideNav 收窄态', () => {
  function collapsedSections(): SideNavSection[] {
    return sections.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        'children' in item ? { ...item, icon: <span>📁</span> } : { ...item, icon: <span>📄</span> }
      ),
    }));
  }

  it('收窄按钮切换 aria-expanded 与 locale 名称，宽态 children 随 collapsed 隐藏', async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    render(
      <SideNav
        sections={collapsedSections()}
        defaultExpandedKeys={['projects']}
        onCollapsedChange={onCollapsedChange}
        aria-label="主导航"
      />
    );
    const toggle = screen.getByRole('button', { name: '收窄导航' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', expect.any(String));
    await user.click(toggle);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: '展开导航' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('收窄态分组打开 flyout：键盘打开聚焦首个子链接，Escape 关闭并回触发器', async () => {
    const user = userEvent.setup();
    render(<SideNav sections={collapsedSections()} defaultCollapsed aria-label="主导航" />);
    const groupToggle = screen.getByRole('button', { name: '项目' });
    groupToggle.focus();
    await user.keyboard('{Enter}');
    // 键盘打开：焦点移动到首个可用子链接
    const firstChild = screen.getByRole('link', { name: '进行中' });
    expect(firstChild).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: '进行中' })).not.toBeInTheDocument();
    expect(groupToggle).toHaveFocus();
  });

  it('收窄再恢复不丢失 expanded 状态', async () => {
    const user = userEvent.setup();
    render(
      <SideNav
        sections={collapsedSections()}
        defaultExpandedKeys={['projects']}
        aria-label="主导航"
      />
    );
    await user.click(screen.getByRole('button', { name: '收窄导航' }));
    await user.click(screen.getByRole('button', { name: '展开导航' }));
    expect(screen.getByRole('button', { name: '项目' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: '进行中' })).toBeInTheDocument();
  });
});

describe('SideNav renderLink 与样式槽位', () => {
  it('renderLink 接收 href/data-part/ref 等完整 props 并渲染自定义元素', () => {
    const linkRef = vi.fn();
    const renderLink = vi.fn((item, props) => {
      expect(props.href).toBe(item.href);
      expect(props['data-part']).toBe('link');
      expect(props['data-key']).toBe(item.key);
      expect(typeof props.ref).toBe('function');
      return (
        <a
          {...props}
          ref={(element) => {
            props.ref(element);
            linkRef(element);
          }}
          data-testid={`custom-${item.key}`}
        />
      );
    });
    render(
      <SideNav
        sections={sections}
        aria-label="主导航"
        renderLink={renderLink}
        classNames={{ root: 'cls-root', link: 'cls-link' }}
      />
    );
    expect(renderLink).toHaveBeenCalled();
    const custom = screen.getByTestId('custom-overview');
    expect(custom).toHaveAttribute('href', '#/overview');
    expect(custom).toHaveClass('z-sidenav-link', 'cls-link');
    // SideNav 提供的 ref 被转发到最终 <a>（注册内部焦点登记表）
    expect(linkRef).toHaveBeenCalledWith(expect.any(HTMLAnchorElement));
  });

  it('nav 级 ref 转发到根元素', () => {
    const navRef = React.createRef<HTMLElement>();
    const { container } = render(<SideNav sections={sections} ref={navRef} aria-label="主导航" />);
    expect(navRef.current).toBe(container.querySelector('nav'));
  });

  it('className 与 classNames 透传到 root 与 slots', () => {
    const { container } = render(
      <SideNav
        sections={sections}
        aria-label="主导航"
        className="my-nav"
        classNames={{ root: 'cls-root', viewport: 'cls-viewport', list: 'cls-list' }}
      />
    );
    expect(container.querySelector('nav')).toHaveClass('z-sidenav', 'my-nav', 'cls-root');
    expect(container.querySelector('[data-part="viewport"]')).toHaveClass('cls-viewport');
    expect(container.querySelector('[data-part="list"]')).toHaveClass('cls-list');
  });
});

describe('SideNav 开发警告', () => {
  it('重复 key / 复杂 label 缺 textValue / expandedKeys 指向叶子时警告一次', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad: SideNavSection[] = [
      {
        key: 's',
        items: [
          { key: 'a', label: <strong>复杂</strong>, href: '#a' },
          { key: 'a', label: '重复', href: '#a2' },
          { key: 'b', label: '好', href: '#b' },
        ],
      },
    ];
    render(<SideNav sections={bad} expandedKeys={['b']} aria-label="主导航" />);
    await Promise.resolve();
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('Duplicate key: a'))).toBe(true);
    expect(
      messages.some((message) => message.includes('Complex label requires textValue: a'))
    ).toBe(true);
    expect(messages.some((message) => message.includes('expandedKeys contains a link: b'))).toBe(
      true
    );
    warn.mockRestore();
  });
});

describe('SideNav SSR', () => {
  it('服务端渲染不抛错，初始父组展开结果与客户端一致', async () => {
    const { renderToString } = await import('react-dom/server');
    const html = renderToString(
      <SideNav sections={sections} currentKey="projects-active" aria-label="主导航" />
    );
    expect(html).toContain('z-sidenav');
    expect(html).toContain('aria-current="page"');
    // 非受控初值在 SSR 阶段已并入父组，不出现"先收起再展开"
    expect(html).not.toContain('hidden=""');
    expect(html).toContain('data-part="children"');
  });
});
