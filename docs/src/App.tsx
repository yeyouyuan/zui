import { Suspense, Component, useEffect, useRef, useState } from 'react';

import { useHashRoute, hrefFor } from './router';
import { GROUP_LABELS, GROUP_ORDER, navItems, routeComponents, type NavItem } from './nav';

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
  const [dark, setDark] = useState<boolean>(
    () => document.documentElement.dataset.theme === 'dark'
  );
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  // 暗色切换：写 data-theme，文档 chrome 自身复用 z 令牌（docs.css 全部走 var(--z-*)）
  const toggleDark = () => {
    const next = !(document.documentElement.dataset.theme === 'dark');
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
  };

  // 路由变化：同步主题状态（主题调参页也会写 data-theme）、关移动端菜单、回到顶部
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [route]);

  // 移动端菜单：Esc 关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  return (
    <div className="doc-shell">
      <header className="doc-topbar">
        <div className="doc-topbar-left">
          <button
            type="button"
            className="doc-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="doc-sidebar"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            菜单
          </button>
          <a className="doc-brand" href={hrefFor('/')}>
            <span className="doc-brand-mark">Z</span>
            <span className="doc-brand-name">ZUI</span>
            <span className="doc-brand-tag">文档</span>
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
            type="search"
            className="doc-nav-search-input"
            placeholder="搜索文档…"
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

      <main className="doc-main" id="doc-main" ref={mainRef}>
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
      </main>
    </div>
  );
}
