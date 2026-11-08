import { Suspense, Component, useEffect, useRef, useState } from 'react';

import PageToc from './components/PageToc';
import { useHashRoute, hrefFor } from './router';
import { GROUP_LABELS, GROUP_ORDER, navItems, routeComponents, type NavItem } from './nav';

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
  const [dark, setDark] = useState<boolean>(getEffectiveDarkTheme);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const navSearchRef = useRef<HTMLInputElement | null>(null);
  const focusPageOnRouteRef = useRef(false);

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
    if (!focusPageOnRouteRef.current) return undefined;

    focusPageOnRouteRef.current = false;
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

    // 已缓存的页面可能同步挂载；首次加载的 lazy 页面则等待 Suspense 内容真正进入 DOM。
    if (focusHeading()) return cleanup;
    headingObserver.observe(main, { childList: true, subtree: true });
    focusTimeout = window.setTimeout(cleanup, 10_000);
    return cleanup;
  }, [route]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      if (document.documentElement.dataset.theme) return;
      setDark(media.matches);
    };
    media.addEventListener('change', syncSystemTheme);
    return () => media.removeEventListener('change', syncSystemTheme);
  }, []);

  // ⌘K / Ctrl+K 聚焦侧栏搜索（与搜索框 placeholder 提示一致）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        navSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 移动端菜单：Esc 关闭
  useEffect(() => {
    if (!menuOpen) return;
    const focusFrame = window.requestAnimationFrame(() => navSearchRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // 侧栏搜索过滤：按名称即时过滤导航项
  const keyword = query.trim().toLowerCase();
  const filtered: NavItem[] = keyword
    ? navItems.filter((item) => item.title.toLowerCase().includes(keyword))
    : navItems;

  const groups = GROUP_ORDER.map((group) => ({
    group,
    title: GROUP_LABELS[group],
    items: filtered.filter((item) => item.group === group),
  })).filter((entry) => entry.items.length > 0);

  // 路由映射走 nav.ts 注册表
  const current = navItems.find((item) => item.path === route);
  const Page = current ? routeComponents[route] : undefined;
  const isBuilderRoute = route === '/builder';

  return (
    <div className={isBuilderRoute ? 'doc-shell doc-shell--builder' : 'doc-shell'}>
      <header className="doc-topbar">
        <div className="doc-topbar-left">
          <button
            ref={menuButtonRef}
            type="button"
            className="doc-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="doc-sidebar"
            aria-label={menuOpen ? '关闭文档菜单' : '打开文档菜单'}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            菜单
          </button>
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

      {menuOpen ? (
        <div
          className="doc-sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <nav
        id="doc-sidebar"
        className={menuOpen ? 'doc-sidebar doc-sidebar--open' : 'doc-sidebar'}
        aria-label="文档导航"
      >
        <div className="doc-nav-search">
          <input
            ref={navSearchRef}
            type="search"
            className="doc-nav-search-input"
            placeholder="搜索文档… ⌘K"
            aria-label="按名称过滤导航项"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {groups.length === 0 ? (
          <p className="doc-nav-empty">没有匹配「{query.trim()}」的页面</p>
        ) : (
          groups.map((entry) => (
            <div className="doc-nav-group" key={entry.group}>
              <div className="doc-nav-group-title">{entry.title}</div>
              <ul className="doc-nav-list">
                {entry.items.map((item) => (
                  <li key={item.path}>
                    <a
                      className={
                        item.path === route ? 'doc-nav-link doc-nav-link--active' : 'doc-nav-link'
                      }
                      href={hrefFor(item.path)}
                      aria-current={item.path === route ? 'page' : undefined}
                      onClick={() => {
                        if (!menuOpen) return;
                        setMenuOpen(false);
                        if (item.path === route) {
                          window.requestAnimationFrame(() => {
                            const heading =
                              mainRef.current?.querySelector<HTMLHeadingElement>('h1');
                            if (!heading) return;
                            heading.tabIndex = -1;
                            heading.focus();
                          });
                        } else {
                          focusPageOnRouteRef.current = true;
                        }
                      }}
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>

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
    </div>
  );
}
