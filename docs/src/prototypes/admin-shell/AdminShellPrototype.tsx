import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  Building,
  Clipboard,
  FileText,
  Folder,
  Home,
  Menu,
  Shield,
  Users,
} from '@zui/icons';
import { CommandPalette, Drawer, type CommandPaletteCommand } from '@zui/react';
import { usePageTitle } from '../../components/usePageTitle';
import {
  SideNav,
  type SideNavLinkItem,
  type SideNavLinkRenderProps,
  type SideNavSection,
} from '@zui/react';
import { ADMIN_SHELL_ROUTE_PREFIX } from './routes';
import './AdminShellPrototype.css';

interface AdminLocation {
  hash: string;
  path: string;
  search: URLSearchParams;
}

function readLocation(): AdminLocation {
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  const raw = hash.replace(/^#/, '');
  const queryIndex = raw.indexOf('?');
  return {
    hash,
    path: (queryIndex === -1 ? raw : raw.slice(0, queryIndex)).replace(/\/+$/, '') || '/',
    search: new URLSearchParams(queryIndex === -1 ? '' : raw.slice(queryIndex + 1)),
  };
}

function useAdminLocation(): AdminLocation {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const update = () => setLocation(readLocation());
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    update();
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return location;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function href(path = '', query = ''): string {
  return `#${ADMIN_SHELL_ROUTE_PREFIX}${path}${query ? `?${query}` : ''}`;
}

const PAGES: Record<string, { key: string; title: string; description: string }> = {
  '': {
    key: 'overview',
    title: '工作台',
    description: '早上好，林晓。这里是星河团队今天的工作进展。',
  },
  '/overview': {
    key: 'overview',
    title: '工作台',
    description: '早上好，林晓。这里是星河团队今天的工作进展。',
  },
  '/projects/active': {
    key: 'projects-active',
    title: '进行中的项目',
    description: '跟踪交付计划、负责人和团队协作进度。',
  },
  '/projects/archived': {
    key: 'projects-archived',
    title: '已归档项目',
    description: '保留已交付项目的资料和决策记录。',
  },
  '/team/members': {
    key: 'team-members',
    title: '团队成员',
    description: '管理成员、所属部门和加入状态。',
  },
  '/team/roles': {
    key: 'team-roles',
    title: '跨区域团队成员访问权限与审批规则',
    description: '为不同区域的成员配置角色与审批范围。',
  },
  '/reports': {
    key: 'reports',
    title: '交付报告',
    description: '查看一段时间内的交付趋势与资源投入。',
  },
  '/activity': {
    key: 'activity',
    title: '操作记录',
    description: '查看项目、成员与权限的最近变更。',
  },
  '/export': { key: 'export', title: '数据导出', description: '当前套餐暂未开通自动导出。' },
};

// The adapter is deliberately just a native anchor: the complete SideNav props,
// including its ref and composed click handler, are forwarded exactly once.
function renderNativeLink(_item: SideNavLinkItem, props: SideNavLinkRenderProps) {
  return <a {...props} />;
}

function NavBadge({ children }: { children: ReactNode }) {
  return <span className="admin-prototype-badge">{children}</span>;
}

const PROJECTS = [
  { name: '客户门户升级', owner: '林晓', progress: 78, date: '11 月 18 日', status: '按计划' },
  { name: '秋季产品发布', owner: '陈雨', progress: 54, date: '11 月 24 日', status: '待评审' },
  { name: '区域服务中心', owner: '周航', progress: 36, date: '12 月 02 日', status: '按计划' },
];

function ProjectList({ archived = false }: { archived?: boolean }) {
  return (
    <div className="admin-prototype-projects">
      {(archived ? PROJECTS.slice(0, 2) : PROJECTS).map((project) => (
        <article className="admin-prototype-project" key={project.name}>
          <div className="admin-prototype-project-heading">
            <div>
              <h3>{project.name}</h3>
              <p>
                {project.owner} · {archived ? '已于 10 月交付' : `计划交付 ${project.date}`}
              </p>
            </div>
            <span className="admin-prototype-status">{archived ? '已归档' : project.status}</span>
          </div>
          <progress
            value={archived ? 100 : project.progress}
            max={100}
            aria-label={`${project.name}完成进度`}
          />
          <span className="admin-prototype-muted">{archived ? 100 : project.progress}% 已完成</span>
        </article>
      ))}
    </div>
  );
}

function PageContent({ currentKey, range }: { currentKey: string | null; range: string }) {
  if (currentKey === 'team-members' || currentKey === 'team-roles') {
    return (
      <section className="admin-prototype-panel">
        <h2>{currentKey === 'team-members' ? '团队目录' : '角色与访问范围'}</h2>
        <div className="admin-prototype-table-wrap">
          <table>
            <caption className="admin-prototype-sr-only">成员访问权限</caption>
            <thead>
              <tr>
                <th scope="col">成员</th>
                <th scope="col">团队</th>
                <th scope="col">角色</th>
                <th scope="col">状态</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['林晓', '产品设计', '管理员', '已加入'],
                ['陈雨', '产品研发', '项目负责人', '已加入'],
                ['周航', '区域运营', '成员', '已加入'],
                ['许文', '客户成功', '成员', '邀请中'],
              ].map(([name, team, role, status]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{team}</td>
                  <td>{role}</td>
                  <td>
                    <span className="admin-prototype-status">{status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  if (currentKey === 'activity') {
    return (
      <section className="admin-prototype-panel">
        <h2>最近变更</h2>
        <ol className="admin-prototype-activity">
          <li>
            <strong>林晓更新了客户门户升级的里程碑</strong>
            <span>今天 09:42 · 项目管理</span>
          </li>
          <li>
            <strong>陈雨提交了秋季产品发布的评审</strong>
            <span>今天 09:18 · 项目管理</span>
          </li>
          <li>
            <strong>周航邀请许文加入客户成功团队</strong>
            <span>昨天 17:30 · 团队管理</span>
          </li>
        </ol>
      </section>
    );
  }
  if (currentKey === 'projects-active' || currentKey === 'projects-archived') {
    return <ProjectList archived={currentKey === 'projects-archived'} />;
  }
  if (currentKey === 'export') {
    return (
      <section className="admin-prototype-panel">
        <h2>导出暂不可用</h2>
        <p>联系团队管理员了解套餐支持的导出方式。</p>
      </section>
    );
  }
  if (!currentKey) {
    return (
      <section className="admin-prototype-panel">
        <p>此地址没有对应页面。</p>
        <a href={href('/overview')}>回到工作台</a>
      </section>
    );
  }
  return (
    <>
      {currentKey === 'reports' && (
        <nav className="admin-prototype-period" aria-label="报告时间范围">
          <a href={href('/reports', 'range=7')} aria-current={range === '7' ? 'page' : undefined}>
            最近 7 天
          </a>
          <a href={href('/reports', 'range=30')} aria-current={range === '30' ? 'page' : undefined}>
            最近 30 天
          </a>
        </nav>
      )}
      <div className="admin-prototype-metrics">
        {[
          ['进行中的项目', '12', '+2 个本周新增'],
          ['本月已交付', range === '7' && currentKey === 'reports' ? '6' : '28', '交付率 96%'],
          ['团队成员', '48', '4 个协作部门'],
        ].map(([label, value, detail]) => (
          <article className="admin-prototype-metric" key={label}>
            <h2>{label}</h2>
            <strong>{value}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </div>
      <section className="admin-prototype-panel">
        <div className="admin-prototype-panel-heading">
          <h2>关注的项目</h2>
          <a href={href('/projects/active')}>查看全部项目</a>
        </div>
        <ProjectList />
      </section>
    </>
  );
}

/* ---------------------- RFC-004 迁移原型 2：异步命令入口 ---------------------- */

/** 模拟服务端命令池：分组会随 query 变化重排，含权限禁用项 */
const COMMAND_POOL: Array<CommandPaletteCommand> = [
  { key: 'nav-projects', label: '跳转：项目管理', group: '导航', keywords: ['项目', 'projects'], onSelect: () => {} },
  { key: 'nav-team', label: '跳转：团队管理', group: '导航', keywords: ['团队', 'team'], onSelect: () => {} },
  { key: 'nav-reports', label: '跳转：交付报告', group: '导航', keywords: ['报告', 'reports'], onSelect: () => {} },
  { key: 'create-ticket', label: '新建工单', group: '操作', shortcut: '⌘T', keywords: ['工单', '新建', 'create', '操作'], onSelect: () => {} },
  { key: 'invite-member', label: '邀请成员', group: '操作', keywords: ['邀请', '成员', 'invite', '操作'], onSelect: () => {} },
  {
    key: 'export-all',
    label: '导出全部数据（需要管理员权限）',
    group: '数据',
    keywords: ['导出', 'export'],
    disabled: true,
    onSelect: () => {},
  },
  {
    key: 'copy-link',
    label: '复制当前页链接',
    group: '数据',
    keywords: ['复制', '链接', 'copy'],
    // preventDefault 保持打开的动作：执行后可继续执行其他命令
    onSelect: (event) => event.preventDefault(),
  },
];

function AdminCommandEntry(): ReactNode {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandPaletteCommand[]>(COMMAND_POOL.slice(0, 4));
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const requestRef = useRef(0);

  // 模拟服务端搜索：260ms debounce + 单调 request id 丢弃竞态结果
  useEffect(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      if (requestId !== requestRef.current) return;
      const keyword = query.trim().toLowerCase();
      const matched = COMMAND_POOL.filter(
        (command) =>
          String(command.label).toLowerCase().includes(keyword) ||
          (command.keywords ?? []).some((item) => item.toLowerCase().includes(keyword))
      );
      // 分组重排：含"操作"关键字的 query 把操作组提前
      const ordered = keyword.includes('操作')
        ? [...matched].sort(
            (a, b) => Number(b.group === '操作') - Number(a.group === '操作')
          )
        : matched;
      setResults(ordered);
      setLoading(false);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <>
      <button
        type="button"
        className="admin-prototype-command"
        aria-label="搜索命令…（快捷键 Ctrl+Shift+P）"
        onClick={() => setOpen(true)}
      >
        搜索命令…
      </button>
      <CommandPalette
        commands={results}
        open={open}
        onOpenChange={setOpen}
        hotkey="ctrl+shift+p"
        query={query}
        onQueryChange={setQuery}
        filter={false}
        loading={loading}
        aria-label="星河管理平台命令搜索"
        onCommandSelect={(command) => {
          if (command.key === 'copy-link') {
            setNotice(`已复制：${window.location.hash}`);
            return;
          }
          if (command.key.startsWith('nav-')) {
            const target = command.key.replace('nav-', '');
            window.location.hash = `${ADMIN_SHELL_ROUTE_PREFIX}/${target === 'projects' ? 'projects/active' : target}`;
          }
          setNotice('');
        }}
      />
      <p role="status" className="admin-prototype-command-notice">
        {notice}
      </p>
    </>
  );
}

export default function AdminShellPrototype(): ReactNode {
  usePageTitle('SideNav 原型：后台壳');
  const location = useAdminLocation();
  const mobile = useMediaQuery('(max-width: 767px)');
  const compactDesktop = useMediaQuery('(min-width: 768px) and (max-width: 1099px)');
  const [collapsed, setCollapsed] = useState(compactDesktop);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['projects', 'team']);
  const [controlledExpanded, setControlledExpanded] = useState(true);
  const [showArchived, setShowArchived] = useState(true);
  const [rtl, setRtl] = useState(false);
  const [cancelReports, setCancelReports] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousHashRef = useRef(location.hash);
  const record = useCallback(
    (message: string) => setEvents((previous) => [...previous.slice(-4), message]),
    []
  );

  const relativePath =
    location.path === ADMIN_SHELL_ROUTE_PREFIX
      ? ''
      : location.path.startsWith(`${ADMIN_SHELL_ROUTE_PREFIX}/`)
        ? location.path.slice(ADMIN_SHELL_ROUTE_PREFIX.length)
        : null;
  const page = relativePath === null ? undefined : PAGES[relativePath];
  // Selection always follows the committed location, including back/forward,
  // unknown paths and a selected route temporarily removed from sections.
  const currentKey = page?.key ?? null;
  const range = location.search.get('range') === '7' ? '7' : '30';

  useEffect(() => setCollapsed(compactDesktop), [compactDesktop]);
  useEffect(() => {
    if (!mobile) setMobileOpen(false);
  }, [mobile]);
  useEffect(() => {
    if (previousHashRef.current === location.hash) return;
    previousHashRef.current = location.hash;
    setMobileOpen(false);
    record(`location → ${location.hash}`);
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, record]);

  const sections = useMemo<SideNavSection[]>(
    () => [
      {
        key: 'workspace',
        label: '工作空间',
        items: [
          {
            key: 'overview',
            label: '工作台',
            href: href('/overview'),
            icon: <Home aria-hidden="true" />,
          },
          {
            key: 'projects',
            label: '项目管理',
            icon: <Folder aria-hidden="true" />,
            badge: <NavBadge>12</NavBadge>,
            children: [
              {
                key: 'projects-active',
                label: '进行中的项目',
                href: href('/projects/active'),
                badge: <NavBadge>12</NavBadge>,
              },
              ...(showArchived
                ? [
                    {
                      key: 'projects-archived',
                      label: '已归档项目',
                      href: href('/projects/archived'),
                    },
                  ]
                : []),
            ],
          },
          {
            key: 'team',
            label: '团队管理',
            icon: <Users aria-hidden="true" />,
            children: [
              {
                key: 'team-members',
                label: '团队成员',
                href: href('/team/members'),
                badge: <NavBadge>48</NavBadge>,
              },
              {
                key: 'team-roles',
                label: '跨区域团队成员访问权限与审批规则',
                href: href('/team/roles'),
              },
            ],
          },
        ],
      },
      {
        key: 'operations',
        label: '分析与治理',
        items: [
          {
            key: 'reports',
            label: '交付报告',
            href: href('/reports', 'range=30'),
            icon: <FileText aria-hidden="true" />,
            linkProps: {
              onClick: (event: MouseEvent<HTMLAnchorElement>) => {
                record('linkProps.onClick → reports');
                if (cancelReports) {
                  event.preventDefault();
                  record('已取消：location 保持不变');
                }
              },
            },
          },
          {
            key: 'activity',
            label: '操作记录',
            href: href('/activity'),
            icon: <Clipboard aria-hidden="true" />,
            badge: <NavBadge>3</NavBadge>,
          },
          {
            key: 'export',
            label: '数据导出',
            href: href('/export'),
            icon: <Shield aria-hidden="true" />,
            disabled: true,
            badge: <NavBadge>未开通</NavBadge>,
          },
        ],
      },
    ],
    [showArchived, cancelReports, record]
  );

  const navigation = (inDrawer: boolean) => (
    <SideNav
      key={`${inDrawer ? 'mobile' : 'desktop'}-${controlledExpanded ? 'controlled' : 'uncontrolled'}`}
      aria-label="星河管理平台主导航"
      sections={sections}
      currentKey={currentKey}
      expandedKeys={controlledExpanded ? expandedKeys : undefined}
      defaultExpandedKeys={expandedKeys}
      onExpandedKeysChange={setExpandedKeys}
      collapsed={inDrawer ? false : collapsed}
      onCollapsedChange={setCollapsed}
      collapsible={!inDrawer}
      renderLink={renderNativeLink}
      onNavigate={(key: string) => {
        record(`onNavigate → ${key}`);
        if (inDrawer) setMobileOpen(false);
      }}
    />
  );

  return (
    <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
      <div
        className="admin-prototype"
        dir={rtl ? 'rtl' : 'ltr'}
        data-collapsed={!mobile && collapsed ? '' : undefined}
      >
        <header className="admin-prototype-header">
          <div className="admin-prototype-brand">
            <Building aria-hidden="true" size={24} />
            <span>星河管理平台</span>
          </div>
          <div className="admin-prototype-header-actions">
            <AdminCommandEntry />
            <a href="#/" className="admin-prototype-back">
              <ArrowLeft aria-hidden="true" />
              返回文档
            </a>
            {mobile && (
              <Drawer.Trigger className="admin-prototype-menu" aria-label="打开主导航">
                <Menu aria-hidden="true" />
              </Drawer.Trigger>
            )}
            <span className="admin-prototype-avatar" aria-label="当前用户：林晓">
              林
            </span>
          </div>
        </header>
        <div className="admin-prototype-layout">
          {!mobile && (
            <aside className="admin-prototype-sidebar">
              <div className="admin-prototype-workspace">
                {collapsed ? '星' : '星河团队 · 企业版'}
              </div>
              {navigation(false)}
              <a className="admin-prototype-sidebar-footer" href="#/">
                {collapsed ? <ArrowLeft aria-label="返回文档" /> : '返回组件文档'}
              </a>
            </aside>
          )}
          <main className="admin-prototype-main" id="admin-prototype-main">
            <div className="admin-prototype-page-heading">
              <p className="admin-prototype-eyebrow">
                星河团队 /{' '}
                {relativePath?.startsWith('/team/')
                  ? '团队管理'
                  : relativePath?.startsWith('/projects/')
                    ? '项目管理'
                    : '管理中心'}
              </p>
              <h1 ref={headingRef} tabIndex={-1}>
                {page?.title ?? '页面不存在'}
              </h1>
              <p>{page?.description ?? '请检查地址，或从主导航选择一个页面。'}</p>
            </div>
            <PageContent currentKey={currentKey} range={range} />
            <details className="admin-prototype-controls">
              <summary>导航原型验证</summary>
              <div className="admin-prototype-control-fields">
                <label>
                  <input
                    type="checkbox"
                    checked={controlledExpanded}
                    onChange={(event) => setControlledExpanded(event.target.checked)}
                  />
                  受控分组展开
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) => setShowArchived(event.target.checked)}
                  />
                  显示已归档项目
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={rtl}
                    onChange={(event) => setRtl(event.target.checked)}
                  />
                  RTL 方向
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={cancelReports}
                    onChange={(event) => setCancelReports(event.target.checked)}
                  />
                  取消“交付报告”导航
                </label>
                {!mobile && (
                  <label>
                    <input
                      type="checkbox"
                      checked={collapsed}
                      onChange={(event) => setCollapsed(event.target.checked)}
                    />
                    桌面收窄
                  </label>
                )}
              </div>
              <p>浏览器前进 / 后退及报告时间链接会改变实际地址。修饰键和新窗口保留原生链接行为。</p>
              <p>
                当前地址：<code>{location.hash || '(空 hash)'}</code>；当前项：
                <code>{currentKey ?? '无'}</code>
              </p>
              <p>
                “交付报告”点击顺序：linkProps.onClick → onNavigate → 原生 hash
                导航。勾选取消后只有前置处理发生。
              </p>
              <ol className="admin-prototype-events" aria-label="最近导航事件">
                {events.map((event, index) => (
                  <li key={`${index}-${event}`}>{event}</li>
                ))}
              </ol>
            </details>
          </main>
        </div>
      </div>
      {mobile && (
        <Drawer.Content
          placement={rtl ? 'right' : 'left'}
          size="min(20rem, 100vw)"
          className="admin-prototype-drawer"
          dir={rtl ? 'rtl' : 'ltr'}
        >
          <Drawer.Header>
            <Drawer.Title>星河团队主导航</Drawer.Title>
            <Drawer.Close />
          </Drawer.Header>
          <Drawer.Body>{navigation(true)}</Drawer.Body>
          <Drawer.Footer>
            <a href="#/">返回组件文档</a>
          </Drawer.Footer>
        </Drawer.Content>
      )}
    </Drawer>
  );
}
