import { Suspense, Component, lazy, useEffect, useRef, useState } from 'react';

import PageToc from './components/PageToc';
import { useHashRoute, hrefFor } from './router';
import { GROUP_LABELS, GROUP_ORDER, navItems, routeComponents, type NavItem } from './nav';
import { ADMIN_SHELL_ROUTE_PREFIX } from './prototypes/admin-shell/routes';
import { SPLITTER_DETAIL_ROUTE, SPLITTER_IDE_ROUTE } from './prototypes/splitter/routes';
import { DATAGRID_ROUTE } from './prototypes/datagrid/routes';
import {
  CommandPalette,
  type CommandPaletteCommand,
  type SideNavSection,
} from '@zui/react';

const AdminShellPrototype = lazy(() => import('./prototypes/admin-shell/AdminShellPrototype'));
const SplitterPrototype = lazy(() => import('./prototypes/splitter/SplitterPrototype'));
const DataGridPrototype = lazy(() => import('./prototypes/datagrid/DataGridPrototype'));
const DocsNavigationDrawer = lazy(() => import('./components/DocsNavigationDrawer'));
const SideNav = lazy(async () => {
  const module = await import('@zui/react');
  return { default: module.SideNav };
});

/** 站点展示版本（后续可改为从 package.json 读取） */
const SITE_VERSION = 'v0.2.0';

function getEffectiveDarkTheme(): boolean {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function NotFound(): React.ReactNode {
  return (
    <div className="doc-page">
      <h1 className="doc-h1">页面不存在</h1>
      <p className="doc-p">
        请从左侧导航选择页面，或回到
        <a href={hrefFor('/')}>概览</a>。
      </p>
    </div>
  );
}

/** 页面级错误边界：单页崩溃被隔离在本页（key=route 切页自动恢复），其余路由不受影响 */
class PageErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="doc-page">
          <h1 className="doc-h1">页面出错了</h1>
          <p className="doc-p">
            该页面渲染时发生异常，已隔离在当前页，其余页面不受影响。可返回
            <a href={hrefFor('/')}>概览</a>。
          </p>
          <p className="doc-p">
            <code className="doc-code-inline">{error.message}</code>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(): React.ReactNode {
  const route = useHashRoute();
  const isBuilderRoute = route === '/builder';
  const mobileQuery = isBuilderRoute ? '(max-width: 900px)' : '(max-width: 767px)';
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileQuery).matches);
  const [dark, setDark] = useState<boolean>(getEffectiveDarkTheme);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const navSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);
  const focusPageOnRouteRef = useRef<string | null>(null);

  // 暗色切换：写 data-theme，文档 chrome 自身复用 z 令牌（docs.css 全部走 var(--z-*)）
  const toggleDark = () => {
    const next = !getEffectiveDarkTheme();
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
  };

  // 路由变化：同步主题状态（主题调参页也会写 data-theme）、关移动端菜单、回到顶部
  useEffect(() => {
    setDark(getEffectiveDarkTheme());
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [route]);

  // 导航关闭 Drawer 后，等其归还触发焦点，再把焦点交给已提交路由的标题。
  useEffect(() => {
    if (menuOpen || focusPageOnRouteRef.current !== route) return undefined;

    focusPageOnRouteRef.current = null;
    const main = mainRef.current;
    if (!main) return undefined;

    let focusFrame = 0;
    let focusTimeout = 0;
    const cleanup = () => {
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(focusTimeout);
      headingObserver.disconnect();
    };
    const focusHeading = (): boolean => {
      const heading = main.querySelector<HTMLHeadingElement>('h1');
      if (!heading) return false;
      heading.tabIndex = -1;
      heading.focus();
      cleanup();
      return true;
    };
    const scheduleFocus = () => {
      if (focusFrame !== 0) return;
      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = 0;
        focusHeading();
      });
    };
    const headingObserver = new MutationObserver(scheduleFocus);

    // 已缓存的页面也延后一帧；首次加载的 lazy 页面等待 Suspense 内容真正进入 DOM。
    headingObserver.observe(main, { childList: true, subtree: true });
    scheduleFocus();
    focusTimeout = window.setTimeout(cleanup, 10_000);
    return cleanup;
  }, [route, menuOpen]);

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const syncViewport = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMenuOpen(false);
    };
    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, [mobileQuery]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      if (document.documentElement.dataset.theme) return;
      setDark(media.matches);
    };
    media.addEventListener('change', syncSystemTheme);
    return () => media.removeEventListener('change', syncSystemTheme);
  }, []);

  // ⌘K 已由全局 CommandPalette 接管（RFC-004 迁移原型 1）；聚焦文档搜索
  // 成为面板中的一条命令，见 focusDocSearch。
  const focusDocSearch = () => {
    // resize 的媒体事件可能尚未提交；按当前视口选择搜索入口。
    const mobile = window.matchMedia(mobileQuery).matches;
    setIsMobile(mobile);
    if (mobile) {
      setMenuOpen(true);
      window.requestAnimationFrame(() => mobileSearchRef.current?.focus());
    } else {
      navSearchRef.current?.focus();
    }
  };

  const GITHUB_URL = 'https://github.com/yeyouyuan/zui';
  const paletteCommands: CommandPaletteCommand[] = (() => {
    const commands: CommandPaletteCommand[] = [
      { key: 'docs-search', label: '聚焦文档搜索', keywords: ['search', '查找'], onSelect: () => focusDocSearch() },
      {
        key: 'theme',
        label: dark ? '切换浅色主题' : '切换暗色主题',
        keywords: ['theme', 'dark', 'light', '主题'],
        onSelect: () => toggleDark(),
      },
      {
        key: 'github',
        label: '在 GitHub 打开仓库',
        keywords: ['repo', '源码'],
        meta: { href: GITHUB_URL },
        // 外链走根级回调：验证 preventDefault 取消自动关闭、由应用编排
        onSelect: () => {},
      },
    ];
    for (const item of navItems) {
      commands.push({
        key: `nav:${item.path}`,
        label: item.title,
        group: GROUP_LABELS[item.group],
        meta: { href: hrefFor(item.path) },
        onSelect: () => {
          // Router 接入：登记路由焦点策略（与侧栏导航一致），hash 导航后由
          // 既有路由 effect 聚焦页面标题（RFC-004 §10 的"应用焦点策略优先"）
          focusPageOnRouteRef.current = item.path;
          window.location.hash = hrefFor(item.path);
        },
      });
    }
    return commands;
  })();

  // 侧栏搜索过滤：按名称即时过滤导航项
  const keyword = query.trim().toLowerCase();
  const filtered: NavItem[] = keyword
    ? navItems.filter((item) => item.title.toLowerCase().includes(keyword))
    : navItems;

  const sections: SideNavSection[] = GROUP_ORDER.map((group) => ({
    key: group,
    label: GROUP_LABELS[group],
    items: filtered
      .filter((item) => item.group === group)
      .map((item) => ({ key: item.path, label: item.title, href: hrefFor(item.path) })),
  })).filter((entry) => entry.items.length > 0);

  // 公开文档路由走 nav.ts；SideNav 后台壳是隐藏直达原型，不进入公开导航。
  const isAdminShellRoute =
    route === ADMIN_SHELL_ROUTE_PREFIX || route.startsWith(`${ADMIN_SHELL_ROUTE_PREFIX}/`);
  const splitterPrototypeVariant =
    route === SPLITTER_IDE_ROUTE ? 'ide' : route === SPLITTER_DETAIL_ROUTE ? 'detail' : null;
  const isDatagridRoute = route === DATAGRID_ROUTE;
  const current = navItems.find((item) => item.path === route);
  const Page = current ? routeComponents[route] : undefined;

  const renderNavigation = (mobile: boolean) => (
    <>
      <div className="doc-nav-search" role="search" aria-label="搜索文档导航">
        <input
          ref={mobile ? mobileSearchRef : navSearchRef}
          data-autofocus={mobile ? '' : undefined}
          type="search"
          className="doc-nav-search-input"
          placeholder="搜索文档… ⌘K"
          aria-label="按名称过滤导航项"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {sections.length === 0 ? (
        <p className="doc-nav-empty">没有匹配「{query.trim()}」的页面</p>
      ) : null}
      <Suspense
        fallback={
          <div className="doc-nav-loading" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        }
      >
        <SideNav
          className="doc-sidenav"
          aria-label="文档导航"
          sections={sections}
          currentKey={route}
          collapsed={false}
          collapsible={false}
          classNames={{
            section: 'doc-nav-group',
            sectionLabel: 'doc-nav-group-title',
            list: 'doc-nav-list',
            link: 'doc-nav-link',
          }}
          onNavigate={
            mobile
              ? (key) => {
                  focusPageOnRouteRef.current = key;
                  setMenuOpen(false);
                }
              : undefined
          }
        />
      </Suspense>
    </>
  );

  if (isAdminShellRoute) {
    return (
      <PageErrorBoundary key="admin-shell-prototype">
        <Suspense
          fallback={
            <p className="doc-p" role="status">
              正在加载后台壳原型…
            </p>
          }
        >
          <AdminShellPrototype />
        </Suspense>
      </PageErrorBoundary>
    );
  }

  if (splitterPrototypeVariant) {
    return (
      <PageErrorBoundary key={`splitter-${splitterPrototypeVariant}-prototype`}>
        <Suspense
          fallback={
            <p className="doc-p" role="status">
              正在加载 Splitter 原型…
            </p>
          }
        >
          <SplitterPrototype variant={splitterPrototypeVariant} />
        </Suspense>
      </PageErrorBoundary>
    );
  }

  if (isDatagridRoute) {
    return (
      <PageErrorBoundary key="datagrid-prototype">
        <Suspense
          fallback={
            <p className="doc-p" role="status">
              正在加载 DataGrid 性能原型…
            </p>
          }
        >
          <DataGridPrototype />
        </Suspense>
      </PageErrorBoundary>
    );
  }

  return (
    <div className={isBuilderRoute ? 'doc-shell doc-shell--builder' : 'doc-shell'}>
      <header className="doc-topbar">
        <div className="doc-topbar-left">
          {isMobile ? (
            <Suspense
              fallback={
                <button
                  type="button"
                  className="doc-menu-btn"
                  disabled
                  aria-label="正在加载文档菜单"
                >
                  菜单
                </button>
              }
            >
              <DocsNavigationDrawer open={menuOpen} onOpenChange={setMenuOpen}>
                {renderNavigation(true)}
              </DocsNavigationDrawer>
            </Suspense>
          ) : null}
          <a className="doc-brand" href={hrefFor('/')}>
            <span className="doc-brand-mark">Z</span>
            <span className="doc-brand-name">ZUI</span>
            <span className="doc-version">{SITE_VERSION}</span>
          </a>
        </div>
        <div className="doc-topbar-actions">
          <button type="button" className="doc-chip-btn" onClick={toggleDark} aria-pressed={dark}>
            {dark ? '切换浅色' : '切换暗色'}
          </button>
          <a
            className="doc-chip-btn doc-chip-link"
            href="https://github.com/yeyouyuan/zui"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>

      <div id="doc-sidebar" className="doc-sidebar">
        {renderNavigation(false)}
      </div>

      <main
        className={isBuilderRoute ? 'doc-main doc-main--wide' : 'doc-main'}
        id="doc-main"
        ref={mainRef}
      >
        {Page ? (
          <PageErrorBoundary key={route}>
            <Suspense
              fallback={
                <p className="doc-p" role="status">
                  正在加载页面…
                </p>
              }
            >
              <Page />
            </Suspense>
          </PageErrorBoundary>
        ) : (
          <NotFound />
        )}
        {/* 页内目录：DOM 为 main > (.doc-page + nav.doc-toc)，供 docs.css 做 grid 多列布局 */}
        <PageToc containerRef={mainRef} />
      </main>

      {/* RFC-004 迁移原型 1：全局命令入口（⌘K）。原型阶段直接使用公共导出。 */}
      <CommandPalette
        commands={paletteCommands}
        aria-label="文档命令面板"
        placeholder="搜索页面或命令…"
        onCommandSelect={(command, event) => {
          if (command.key !== 'github') return;
          const href = (command.meta as { href?: string } | undefined)?.href;
          if (!href) return;
          event.preventDefault(); // 取消自动关闭：由应用编排外链与面板状态
          window.open(href, '_blank', 'noopener,noreferrer');
        }}
      />
    </div>
  );
}
