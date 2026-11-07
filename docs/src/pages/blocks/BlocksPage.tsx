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
import { Button, Input, Tag } from '@zui/react';

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
}: {
  blockKey: BlockKey;
  onFeedback: (message: string) => void;
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
          onEditProfile={() => onFeedback('可从左侧选择“资料编辑”查看编辑表单。')}
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
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState('');
  const current = BLOCKS.find((block) => block.key === selected)!;
  const matches = BLOCKS.filter((block) =>
    `${block.title} ${block.key} ${block.component} ${block.group}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const code = exampleCode(current);

  return (
    <div className="doc-page doc-blocks-page">
      <h1 className="doc-h1">业务区块</h1>
      <p className="doc-lead">
        16
        个可直接使用的页面级区块，覆盖数据展示、表单账户和系统管理。选择区块查看实际界面，体验筛选、表单与确认操作。
      </p>
      <div className="doc-blocks-layout">
        <aside className="doc-blocks-catalog" aria-label="区块目录">
          <Input
            type="search"
            aria-label="搜索业务区块"
            placeholder="搜索名称或组件"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            clearable
            onClear={() => setQuery('')}
          />
          <span className="doc-blocks-count" role="status">
            {matches.length} / {BLOCKS.length} 个区块
          </span>
          <nav aria-label="选择业务区块" className="doc-blocks-options">
            {GROUPS.map((group) => {
              const items = matches.filter((block) => block.group === group);
              return items.length > 0 ? (
                <div key={group} className="doc-blocks-group">
                  <p>{group}</p>
                  {items.map((block) => (
                    <button
                      key={block.key}
                      type="button"
                      aria-current={selected === block.key ? 'true' : undefined}
                      onClick={() => {
                        setSelected(block.key);
                        setFeedback('');
                      }}
                    >
                      <span>{block.title}</span>
                      <small>{block.component}</small>
                    </button>
                  ))}
                </div>
              ) : null;
            })}
            {matches.length === 0 ? (
              <p className="doc-blocks-empty">
                没有匹配的区块。
                <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                  清除搜索
                </Button>
              </p>
            ) : null}
          </nav>
        </aside>
        <section className="doc-blocks-detail" aria-labelledby="block-preview-title">
          <header className="doc-blocks-preview-head">
            <div>
              <h2 id="block-preview-title" className="doc-h2">
                {current.title} <Tag color="neutral">{current.group}</Tag>
              </h2>
              <p>{current.description}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRevision((previous) => previous + 1);
                setFeedback('演示已重置。');
              }}
            >
              重置演示
            </Button>
          </header>
          <div className="doc-blocks-preview" data-block={selected}>
            <BlockPreview
              key={`${selected}-${revision}`}
              blockKey={selected}
              onFeedback={setFeedback}
            />
          </div>
          <p className="doc-blocks-feedback" role="status" aria-live="polite">
            {feedback || '交互仅使用本地演示数据。'}
          </p>
          <h2 className="doc-h2">接入代码</h2>
          <CodeBlock language="tsx" code={code} />
          <p className="doc-p">
            受控区块需要由业务页面维护数据与回调。可从同名子路径（例如{' '}
            <code className="doc-code-inline">@zui/blocks/settings</code>
            ）引入组件及其类型、演示数据。
          </p>
        </section>
      </div>
      <h2 className="doc-h2">安装与定制</h2>
      <CodeBlock language="bash" code="pnpm add @zui/blocks @zui/react react react-dom" />
      <p className="doc-p">
        入口引入一次 <code className="doc-code-inline">@zui/react/styles.css</code>。区块通过{' '}
        <code className="doc-code-inline">style</code>、
        <code className="doc-code-inline">classNames</code> 和{' '}
        <code className="doc-code-inline">data-part</code>{' '}
        定制布局，随全局主题切换；数据大屏保留深色展示。
      </p>
    </div>
  );
}
