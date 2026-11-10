import { useState, type CSSProperties } from 'react';
import {
  DashboardBlock,
  DataScreenBlock,
  ErrorPagesBlock,
  FormPageBlock,
  KanbanBlock,
  ListDetailBlock,
  LoginBlock,
  OrderListBlock,
  PermissionBlock,
  ProfileEditBlock,
  SearchResultBlock,
  SettingsBlock,
  TablePageBlock,
  TimelineFeedBlock,
  UserCenterBlock,
  WizardBlock,
  DEMO_COLUMNS,
  DEMO_DATA,
  DEMO_DETAIL_ITEMS,
  DEMO_FEED_ENTRIES,
  DEMO_MEMBERS,
  DEMO_ORDERS,
  DEMO_PERMISSION_TREE,
  DEMO_PREFERENCES,
  DEMO_PROFILE,
  DEMO_SEARCH_RESULTS,
  DEMO_SETTINGS_VALUES,
  DEMO_USER,
  DEMO_WIZARD_VALUES,
} from '@zui/blocks';
import { Button, Drawer, Input, Tabs, Tag } from '@zui/react';
import {
  Archive,
  CheckCircle,
  ChevronRight,
  Clock,
  Code,
  Database,
  Edit,
  Eye,
  FileText,
  Layers,
  Lock,
  LogIn,
  Monitor,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Smartphone,
  User,
  Users,
} from '@zui/icons';

import CodeBlock from '../../components/CodeBlock';
import { usePageTitle } from '../../components/usePageTitle';
import './blocks-page.css';

const BLOCKS = [
  {
    key: 'dashboard',
    title: '仪表盘',
    component: 'DashboardBlock',
    group: '数据展示',
    description: '统计卡、访问趋势、渠道明细和最近动态组成的运营概览。',
  },
  {
    key: 'data-screen',
    title: '数据大屏',
    component: 'DataScreenBlock',
    group: '数据展示',
    description: '深色统计卡、分时柱状图和资源监控，支持时间维度与刷新回调。',
  },
  {
    key: 'table-page',
    title: '表格页',
    component: 'TablePageBlock',
    group: '数据展示',
    description: '搜索、状态筛选、行选择和分页，适合商品与资源管理。',
  },
  {
    key: 'order-list',
    title: '订单列表',
    component: 'OrderListBlock',
    group: '数据展示',
    description: '按状态筛选订单，通过确认弹层取消待支付或已支付订单。',
  },
  {
    key: 'search-result',
    title: '搜索结果',
    component: 'SearchResultBlock',
    group: '数据展示',
    description: '搜索文档、产品和工单，切换结果类型并处理空状态。',
  },
  {
    key: 'list-detail',
    title: '列表详情',
    component: 'ListDetailBlock',
    group: '数据展示',
    description: '选择左侧项目，右侧同步展示状态与详情；窄屏上下排列。',
  },
  {
    key: 'timeline-feed',
    title: '时间线信息流',
    component: 'TimelineFeedBlock',
    group: '数据展示',
    description: '团队事件、作者头像和信息卡，支持加载更多与键盘激活。',
  },
  {
    key: 'kanban',
    title: '项目看板',
    component: 'KanbanBlock',
    group: '数据展示',
    description: '按处理阶段分组任务，点击或用键盘选中卡片。当前不支持拖拽。',
  },
  {
    key: 'login',
    title: '登录页',
    component: 'LoginBlock',
    group: '表单与账户',
    description: '账号、密码、记住我、第三方登录和注册入口组成的登录页面。',
  },
  {
    key: 'form-page',
    title: '表单页',
    component: 'FormPageBlock',
    group: '表单与账户',
    description: '项目基本信息、联系方式、日期和偏好设置，含必填校验。',
  },
  {
    key: 'wizard',
    title: '分步向导',
    component: 'WizardBlock',
    group: '表单与账户',
    description: '填写基本信息、选择项目配置，再核对并完成创建。',
  },
  {
    key: 'user-center',
    title: '个人中心',
    component: 'UserCenterBlock',
    group: '表单与账户',
    description: '个人资料、安全设置与偏好管理，可切换二次验证和消息偏好。',
  },
  {
    key: 'profile-edit',
    title: '资料编辑',
    component: 'ProfileEditBlock',
    group: '表单与账户',
    description: '响应式资料表单、头像上传和任职时间范围选择。',
  },
  {
    key: 'permission',
    title: '权限管理',
    component: 'PermissionBlock',
    group: '系统管理',
    description: '勾选角色权限、展开权限树并切换成员的启用状态。',
  },
  {
    key: 'settings',
    title: '系统设置',
    component: 'SettingsBlock',
    group: '系统管理',
    description: '站点信息、通知渠道、安全策略的分组设置与保存操作。',
  },
  {
    key: 'error-pages',
    title: '错误页',
    component: 'ErrorPagesBlock',
    group: '系统管理',
    description: '403、404、500 三种结果页面，支持自定义文案和返回操作。',
  },
] as const;

type BlockKey = (typeof BLOCKS)[number]['key'];
const GROUPS = ['数据展示', '表单与账户', '系统管理'] as const;
const BLOCK_ICONS = {
  dashboard: Database,
  'data-screen': Monitor,
  'table-page': FileText,
  'order-list': ShoppingCart,
  'search-result': Search,
  'list-detail': Archive,
  'timeline-feed': Clock,
  kanban: Layers,
  login: LogIn,
  'form-page': FileText,
  wizard: CheckCircle,
  'user-center': User,
  'profile-edit': Edit,
  permission: Shield,
  settings: Settings,
  'error-pages': Lock,
};
const PREVIEW_STYLE: CSSProperties = { minHeight: 0, width: '100%', maxWidth: '100%' };

function exampleCode(block: (typeof BLOCKS)[number]): string {
  const common = `import '@zui/react/styles.css';`;
  if (block.key === 'settings' || block.key === 'wizard' || block.key === 'profile-edit') {
    const initial = {
      settings: 'DEMO_SETTINGS_VALUES',
      wizard: 'DEMO_WIZARD_VALUES',
      'profile-edit': 'DEMO_PROFILE',
    }[block.key];
    const change =
      block.key === 'settings'
        ? 'onChange={(key, value) => setValues((previous) => ({ ...previous, [key]: value }))}'
        : `${block.key === 'wizard' ? 'onValuesChange' : 'onChange'}={(patch) => setValues((previous) => ({ ...previous, ...patch }))}`;
    return `import { useState } from 'react';\n${common}\nimport { ${block.component}, ${initial} } from '@zui/blocks';\n\nexport default function Example() {\n  const [values, setValues] = useState({ ...${initial} });\n  return (\n    <${block.component}\n      values={values}\n      ${change}\n    />\n  );\n}`;
  }
  const data: Partial<Record<BlockKey, { imports: string; props: string }>> = {
    'table-page': {
      imports: ', DEMO_COLUMNS, DEMO_DATA',
      props: ' columns={DEMO_COLUMNS} data={DEMO_DATA}',
    },
    'order-list': { imports: ', DEMO_ORDERS', props: ' orders={DEMO_ORDERS}' },
    permission: {
      imports: ', DEMO_PERMISSION_TREE, DEMO_MEMBERS',
      props:
        "\n    treeData={DEMO_PERMISSION_TREE}\n    members={DEMO_MEMBERS}\n    defaultExpandedKeys={['console']}",
    },
    'user-center': {
      imports: ', DEMO_USER, DEMO_PREFERENCES',
      props: ' user={DEMO_USER} preferences={DEMO_PREFERENCES}',
    },
    'error-pages': { imports: '', props: ' status="404"' },
  };
  const sample = data[block.key];
  return `${common}\nimport { ${block.component}${sample?.imports ?? ''} } from '@zui/blocks';\n\nexport default function Example() {\n  return <${block.component}${sample?.props ?? ''} />;\n}`;
}

function BlockPreview({
  blockKey,
  onFeedback,
  onSelectBlock,
}: {
  blockKey: BlockKey;
  onFeedback: (message: string) => void;
  onSelectBlock: (key: BlockKey) => void;
}) {
  const [settings, setSettings] = useState({ ...DEMO_SETTINGS_VALUES });
  const [wizard, setWizard] = useState({ ...DEMO_WIZARD_VALUES });
  const [profile, setProfile] = useState({ ...DEMO_PROFILE });
  const [preferences, setPreferences] = useState(DEMO_PREFERENCES.map((item) => ({ ...item })));
  const [twoFactor, setTwoFactor] = useState(true);
  const [members, setMembers] = useState(DEMO_MEMBERS.map((item) => ({ ...item })));
  const [orders, setOrders] = useState(DEMO_ORDERS.map((item) => ({ ...item })));
  const [entries, setEntries] = useState([...DEMO_FEED_ENTRIES]);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const filteredRows = DEMO_DATA.filter(
    (row) =>
      `${row.name} ${row.sku}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === '' || row.status === status)
  );

  switch (blockKey) {
    case 'dashboard':
      return (
        <DashboardBlock
          style={PREVIEW_STYLE}
          actions={
            <Button variant="outline" onClick={() => onFeedback('已请求导出运营报表（演示）。')}>
              导出报表
            </Button>
          }
        />
      );
    case 'data-screen':
      return (
        <DataScreenBlock
          style={PREVIEW_STYLE}
          subtitle="演示数据 · 可接入实时数据源"
          onRangeChange={() => onFeedback('已切换时间维度；演示数据保持不变。')}
          onRefresh={() => onFeedback('已请求刷新数据（演示）。')}
        />
      );
    case 'table-page':
      return (
        <TablePageBlock
          style={PREVIEW_STYLE}
          title="商品管理"
          columns={DEMO_COLUMNS}
          data={filteredRows.slice((page - 1) * 4, page * 4)}
          total={filteredRows.length}
          pageSize={4}
          page={page}
          onPageChange={setPage}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          filters={[
            {
              field: 'status',
              label: '商品状态',
              options: [
                { value: '', label: '全部状态' },
                { value: 'onSale', label: '在售' },
                { value: 'draft', label: '草稿' },
                { value: 'lowStock', label: '缺货' },
                { value: 'offShelf', label: '已下架' },
              ],
            },
          ]}
          onFilterChange={(_, value) => {
            setStatus(value);
            setPage(1);
          }}
          selectable
          actions={
            <Button onClick={() => onFeedback('已打开新建商品入口（演示）。')}>新建商品</Button>
          }
        />
      );
    case 'order-list':
      return (
        <OrderListBlock
          style={PREVIEW_STYLE}
          orders={orders}
          onCancelOrder={(order) => {
            setOrders((previous) =>
              previous.map((item) =>
                item.key === order.key ? { ...item, status: 'cancelled' } : item
              )
            );
            onFeedback(`订单 ${order.orderNo} 已取消（演示）。`);
          }}
        />
      );
    case 'search-result':
      return (
        <SearchResultBlock
          style={PREVIEW_STYLE}
          results={DEMO_SEARCH_RESULTS.map((item) => ({ ...item, href: undefined }))}
          onResultClick={(item) => onFeedback(`已选择“${item.title}”。`)}
          onSearch={(value) =>
            onFeedback(value.trim() ? `正在展示“${value}”的搜索结果。` : '正在展示全部结果。')
          }
        />
      );
    case 'list-detail':
      return <ListDetailBlock style={PREVIEW_STYLE} items={DEMO_DETAIL_ITEMS} />;
    case 'timeline-feed':
      return (
        <TimelineFeedBlock
          style={PREVIEW_STYLE}
          entries={entries}
          hasMore={hasMore}
          onEntryClick={(entry) => onFeedback(`已选择 ${entry.author} 的团队动态。`)}
          onLoadMore={() => {
            setEntries((previous) => [
              ...previous,
              {
                key: 'demo-more',
                time: '更早',
                author: '系统',
                title: '历史动态已加载',
                content: '实际项目中可在此回调请求下一页数据。',
                color: 'neutral',
              },
            ]);
            setHasMore(false);
            onFeedback('已加载历史动态，所有演示记录均已显示。');
          }}
        />
      );
    case 'kanban':
      return <KanbanBlock style={PREVIEW_STYLE} />;
    case 'login':
      return (
        <LoginBlock
          style={{ ...PREVIEW_STYLE, minHeight: 480 }}
          productName="ZUI 工作台"
          onSubmit={({ username }) => onFeedback(`已提交 ${username} 的登录信息（演示）。`)}
          onForgotPassword={() => onFeedback('已打开找回密码入口（演示）。')}
          onRegister={() => onFeedback('已打开注册入口（演示）。')}
          onSocialLogin={(provider) => onFeedback(`已选择 ${provider} 登录（演示）。`)}
        />
      );
    case 'form-page':
      return (
        <FormPageBlock
          style={PREVIEW_STYLE}
          onSubmit={(values) => onFeedback(`项目“${values.name}”已提交（演示）。`)}
          onCancel={() => onFeedback('已取消本次提交。')}
        />
      );
    case 'wizard':
      return (
        <WizardBlock
          style={PREVIEW_STYLE}
          values={wizard}
          onValuesChange={(patch) => setWizard((previous) => ({ ...previous, ...patch }))}
          onFinish={(values) => onFeedback(`项目“${values.name}”创建完成（演示）。`)}
        />
      );
    case 'user-center':
      return (
        <UserCenterBlock
          style={PREVIEW_STYLE}
          user={{ ...DEMO_USER, avatarSrc: undefined }}
          preferences={preferences}
          twoFactorEnabled={twoFactor}
          onTwoFactorChange={setTwoFactor}
          onPreferenceChange={(key, checked) =>
            setPreferences((previous) =>
              previous.map((item) => (item.key === key ? { ...item, checked } : item))
            )
          }
          onEditProfile={() => onSelectBlock('profile-edit')}
          onChangePassword={() => onFeedback('已打开修改密码入口（演示）。')}
        />
      );
    case 'profile-edit':
      return (
        <ProfileEditBlock
          style={PREVIEW_STYLE}
          values={profile}
          onChange={(patch) => setProfile((previous) => ({ ...previous, ...patch }))}
          onSave={(values) => onFeedback(`${values.name} 的资料已保存（演示）。`)}
        />
      );
    case 'permission':
      return (
        <PermissionBlock
          style={PREVIEW_STYLE}
          treeData={DEMO_PERMISSION_TREE}
          defaultExpandedKeys={['console', 'content', 'members']}
          members={members}
          onMemberToggle={(member, enabled) =>
            setMembers((previous) =>
              previous.map((item) => (item.key === member.key ? { ...item, enabled } : item))
            )
          }
        />
      );
    case 'settings':
      return (
        <SettingsBlock
          style={PREVIEW_STYLE}
          values={settings}
          onChange={(key, value) => setSettings((previous) => ({ ...previous, [key]: value }))}
          onSave={() => onFeedback('系统设置已保存（演示）。')}
        />
      );
    case 'error-pages':
      return (
        <ErrorPagesBlock
          style={{ ...PREVIEW_STYLE, minHeight: 400 }}
          showSwitcher
          onHome={() => onFeedback('已请求返回首页（演示）。')}
          onBack={() => onFeedback('已请求返回上一页（演示）。')}
        />
      );
  }
}

export default function BlocksPage(): React.ReactNode {
  usePageTitle('业务区块');
  const [selected, setSelected] = useState<BlockKey>('dashboard');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [visited, setVisited] = useState<BlockKey[]>(['dashboard']);
  const [revisions, setRevisions] = useState<Partial<Record<BlockKey, number>>>({});
  const [feedback, setFeedback] = useState<Partial<Record<BlockKey, string>>>({});
  const [view, setView] = useState('preview');
  const [width, setWidth] = useState<'auto' | 'mobile'>('auto');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const current = BLOCKS.find((block) => block.key === selected)!;
  const CurrentIcon = BLOCK_ICONS[selected];
  const matches = BLOCKS.filter(
    (block) =>
      (group === 'all' || block.group === group) &&
      `${block.title} ${block.key} ${block.component} ${block.group} ${block.description}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
  );
  const selectBlock = (key: BlockKey) => {
    setSelected(key);
    setVisited((previous) => (previous.includes(key) ? previous : [...previous, key]));
    setView('preview');
    setCatalogOpen(false);
  };
  const resetFilters = () => {
    setQuery('');
    setGroup('all');
  };
  const renderCatalog = (inDrawer = false) => (
    <>
      <div className="doc-blocks-catalog-search">
        <Input
          type="search"
          aria-label="搜索业务区块"
          placeholder="搜索名称或组件…"
          prefix={<Search aria-hidden="true" />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          clearable
          onClear={() => setQuery('')}
          data-autofocus={inDrawer ? '' : undefined}
        />
        <span className="doc-blocks-count" role="status">
          {matches.length} / {BLOCKS.length} 个区块
        </span>
      </div>
      <nav aria-label="选择业务区块" className="doc-blocks-options">
        {GROUPS.map((category) => {
          const items = matches.filter((block) => block.group === category);
          return items.length > 0 ? (
            <div key={category} className="doc-blocks-group">
              <p>
                {category}
                <span>{items.length}</span>
              </p>
              {items.map((block) => {
                const Icon = BLOCK_ICONS[block.key];
                return (
                  <button
                    key={block.key}
                    type="button"
                    aria-current={selected === block.key ? 'true' : undefined}
                    onClick={() => selectBlock(block.key)}
                  >
                    <span className="doc-blocks-option-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="doc-blocks-option-label">
                      <strong>{block.title}</strong>
                      <small>{block.component}</small>
                    </span>
                    {selected === block.key && (
                      <ChevronRight className="doc-blocks-option-arrow" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : null;
        })}
        {matches.length === 0 && (
          <div className="doc-blocks-empty">
            <Search aria-hidden="true" />
            <strong>没有找到匹配区块</strong>
            <p>试试名称、组件名或其他分类。</p>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              清除筛选
            </Button>
          </div>
        )}
      </nav>
      <p className="doc-blocks-catalog-note">切换区块会保留本页的演示状态。</p>
    </>
  );

  return (
    <div className="doc-page doc-blocks-page">
      <header className="doc-blocks-intro">
        <div>
          <div className="doc-blocks-eyebrow">
            <Layers aria-hidden="true" /> ZUI / PAGE BLOCKS
          </div>
          <h1 className="doc-h1">业务区块</h1>
          <p className="doc-lead">
            从一个区块，开始一张完整页面。
            <br />
            选择业务场景，体验真实交互，再带走接入代码。
          </p>
        </div>
        <dl className="doc-blocks-stats">
          <div>
            <dt>页面区块</dt>
            <dd>
              {BLOCKS.length}
              <span>个</span>
            </dd>
          </div>
          <div>
            <dt>业务场景</dt>
            <dd>
              {GROUPS.length}
              <span>类</span>
            </dd>
          </div>
        </dl>
      </header>
      <div className="doc-blocks-categories" role="group" aria-label="区块分类">
        {['all', ...GROUPS].map((category) => (
          <button
            type="button"
            key={category}
            aria-pressed={group === category}
            onClick={() => setGroup(category)}
          >
            {category === 'all' ? '全部区块' : category}
            <span>
              {category === 'all'
                ? BLOCKS.length
                : BLOCKS.filter((block) => block.group === category).length}
            </span>
          </button>
        ))}
      </div>
      <div className="doc-blocks-layout">
        <aside className="doc-blocks-catalog" aria-label="区块目录">
          <div className="doc-blocks-catalog-heading">
            <Layers aria-hidden="true" />
            区块目录
          </div>
          {renderCatalog()}
        </aside>
        <section className="doc-blocks-detail" aria-labelledby="block-preview-title">
          <header className="doc-blocks-preview-head">
            <span className="doc-blocks-detail-icon">
              <CurrentIcon aria-hidden="true" />
            </span>
            <div>
              <h2 id="block-preview-title" className="doc-h2">
                {current.title}
                <Tag color="neutral">{current.group}</Tag>
              </h2>
              <p>{current.description}</p>
            </div>
          </header>
          <Drawer open={catalogOpen} onOpenChange={setCatalogOpen}>
            <Drawer.Trigger className="doc-blocks-mobile-catalog">
              <Layers aria-hidden="true" />
              区块目录<span>{matches.length} 个可选区块</span>
              <ChevronRight aria-hidden="true" />
            </Drawer.Trigger>
            <Drawer.Content
              placement="left"
              size="min(360px, calc(100vw - 20px))"
              className="doc-blocks-drawer"
            >
              <Drawer.Header>
                <Drawer.Title>选择业务区块</Drawer.Title>
                <Drawer.Close />
              </Drawer.Header>
              <Drawer.Body>{renderCatalog(true)}</Drawer.Body>
            </Drawer.Content>
          </Drawer>
          <Tabs value={view} onValueChange={setView} className="doc-blocks-frame">
            <div className="doc-blocks-toolbar">
              <Tabs.List aria-label="区块展示方式">
                <Tabs.Trigger value="preview" icon={<Eye />}>
                  预览
                </Tabs.Trigger>
                <Tabs.Trigger value="code" icon={<Code />}>
                  代码
                </Tabs.Trigger>
              </Tabs.List>
              <div className="doc-blocks-preview-actions">
                <div className="doc-blocks-device" role="group" aria-label="预览宽度">
                  <button
                    type="button"
                    aria-label="自适应宽度"
                    title="自适应宽度"
                    aria-pressed={width === 'auto'}
                    disabled={view !== 'preview'}
                    onClick={() => setWidth('auto')}
                  >
                    <Monitor aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="手机宽度"
                    title="手机宽度（390px）"
                    aria-pressed={width === 'mobile'}
                    disabled={view !== 'preview'}
                    onClick={() => setWidth('mobile')}
                  >
                    <Smartphone aria-hidden="true" />
                  </button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  iconStart={<RotateCcw />}
                  onClick={() => {
                    setRevisions((previous) => ({
                      ...previous,
                      [selected]: (previous[selected] ?? 0) + 1,
                    }));
                    setFeedback((previous) => ({
                      ...previous,
                      [selected]: '当前区块已重置，其他区块的操作继续保留。',
                    }));
                  }}
                >
                  重置演示
                </Button>
              </div>
            </div>
            <Tabs.Panel value="preview" forceMount>
              <div className="doc-blocks-canvas-meta">
                <span>
                  <span className="doc-blocks-live-dot" />
                  可交互预览
                </span>
                <code>{current.component}</code>
              </div>
              <div className="doc-blocks-viewport" data-width={width}>
                <div
                  className="doc-blocks-preview"
                  data-block={selected}
                  aria-label="业务区块预览"
                  role="region"
                >
                  {visited.map((key) => (
                    <div key={key} hidden={key !== selected} className="doc-blocks-preview-panel">
                      <BlockPreview
                        key={`${key}-${revisions[key] ?? 0}`}
                        blockKey={key}
                        onFeedback={(message) =>
                          setFeedback((previous) => ({ ...previous, [key]: message }))
                        }
                        onSelectBlock={selectBlock}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Tabs.Panel>
            <Tabs.Panel value="code">
              <div className="doc-blocks-code-intro">
                <strong>接入 {current.component}</strong>
                <p>可复制的基础用法。业务数据与请求由页面回调接入。</p>
              </div>
              <CodeBlock key={selected} language="tsx" code={exampleCode(current)} />
              <p className="doc-blocks-code-note">
                支持按需引入：<code>@zui/blocks/{current.key}</code>
              </p>
            </Tabs.Panel>
          </Tabs>
          <p className="doc-blocks-feedback" role="status" aria-live="polite">
            <CheckCircle aria-hidden="true" />
            {feedback[selected] || '使用本地演示数据 · 可直接体验 · 切换保留本页状态'}
          </p>
        </section>
      </div>
      <section className="doc-blocks-integration" aria-labelledby="blocks-integration-title">
        <div>
          <div className="doc-blocks-eyebrow">
            <Code aria-hidden="true" /> READY TO BUILD
          </div>
          <h2 className="doc-h2" id="blocks-integration-title">
            接入你的项目
          </h2>
          <p>安装一次，组合使用。数据与样式由你掌控。</p>
        </div>
        <div className="doc-blocks-integration-content">
          <CodeBlock language="bash" code="pnpm add @zui/blocks @zui/react react react-dom" />
          <p>
            入口引入 <code>@zui/react/styles.css</code>。通过 <code>style</code>、
            <code>classNames</code> 与 <code>data-part</code>{' '}
            定制布局，随全局主题切换；数据大屏保留深色展示。
          </p>
          <span>
            <Users aria-hidden="true" />
            16 个正式区块 · TypeScript · 受控数据与回调
          </span>
        </div>
      </section>
    </div>
  );
}
