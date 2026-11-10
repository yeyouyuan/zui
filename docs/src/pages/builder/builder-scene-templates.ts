import type { BuilderData } from './builder-model';
import type { BuilderStyles } from './builder-design';
import { demoProjectSource, type BuilderDataSource } from './builder-data-sources';
import type { BuilderNode } from './builder-tree';

let serial = 0;
const n = (
  type: string,
  props: Record<string, unknown> = {},
  styles?: BuilderStyles,
  mobile?: BuilderStyles
): BuilderNode => ({
  type,
  props: {
    id: `scene-${type}-${++serial}`,
    ...props,
    ...(styles ? { _design: { desktop: styles, ...(mobile ? { mobile } : {}) } } : {}),
  },
});
const text = (children: string, styles: BuilderStyles = {}) =>
  n(
    'Typography_Text',
    { children, strong: false },
    { color: 'var(--z-color-fg-muted)', fontSize: 13, lineHeight: 1.8, ...styles }
  );
const title = (value: string, size = 28) =>
  n(
    'Heading',
    { text: value, level: 'h1', align: 'left' },
    { fontSize: size, letterSpacing: -0.8, fontWeight: '600', lineHeight: 1.3 },
    { fontSize: Math.min(size, 28) }
  );
const stack = (content: BuilderNode[], styles: BuilderStyles = {}, mobile?: BuilderStyles) =>
  n(
    'Container',
    { content },
    { display: 'flex', flexDirection: 'column', gap: 20, ...styles },
    mobile
  );
const grid = (content: BuilderNode[], columns = 'repeat(2, minmax(0, 1fr))') =>
  stack(
    content,
    { display: 'grid', gridTemplateColumns: columns, gap: 20 },
    { gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }
  );
const heading = (name: string, description: string) =>
  stack(
    [
      text('WORKSPACE / OVERVIEW', { fontSize: 10, letterSpacing: 1.8 }),
      title(name),
      text(description),
    ],
    { gap: 7, marginBottom: 6 }
  );
const metric = (name: string, patch: Record<string, unknown> = {}) =>
  n('DataMetric', {
    title: name,
    source: 'projects',
    operation: 'count',
    caption: '根据项目台账实时计算',
    ...patch,
  });
const chart = (name: string, patch: Record<string, unknown> = {}) =>
  n('DataChart', {
    title: name,
    source: 'projects',
    chart: 'bar',
    groupField: 'owner',
    operation: 'sum',
    valueField: 'budget',
    height: 240,
    ...patch,
  });
const table = (patch: Record<string, unknown> = {}) =>
  n('DataTable', {
    title: '项目列表',
    source: 'projects',
    columns: 'name,owner,status,budget,due',
    filterField: 'status',
    pageSize: 5,
    editable: true,
    searchable: true,
    downloadable: true,
    density: 'comfortable',
    ...patch,
  });
const view = (value: string, name: string, content: BuilderNode[]) =>
  n('AppView', { value, title: name, content });
const shell = (content: BuilderNode[], patch: Record<string, unknown> = {}) =>
  n('AppShell', {
    brand: 'Forma',
    subtitle: '让每一份工作，都有进展',
    navigation: 'overview|工作概览\nprojects|项目管理\ncontent|项目档案\ncreate|新建项目',
    initialView: 'overview',
    layout: 'sidebar',
    sidebarWidth: 210,
    content,
    ...patch,
  });
const page = (
  name: string,
  content: BuilderNode[],
  datasets: BuilderDataSource[] = [],
  patch: Record<string, unknown> = {}
): BuilderData => ({
  root: {
    props: {
      title: name,
      description: '',
      theme: 'light',
      maxWidth: 1920,
      padding: 0,
      contentGap: 0,
      visualPreset: 'indigo',
      radius: 10,
      datasets,
      ...patch,
    },
  },
  content,
});

const overview = [
  heading('每一份进展，都清晰可见。', '从这里了解项目全貌，找到团队下一步的重点。'),
  grid(
    [
      metric('全部项目'),
      metric('进行中', {
        filterField: 'status',
        filterValue: '进行中',
        caption: '正在推进的重点工作',
      }),
      metric('项目总预算', {
        operation: 'sum',
        field: 'budget',
        prefix: '¥',
        caption: '全部项目预算合计',
      }),
      metric('已完成', {
        filterField: 'status',
        filterValue: '已完成',
        caption: '每一份交付，都值得记录',
      }),
    ],
    'repeat(4, minmax(0, 1fr))'
  ),
  grid(
    [
      chart('团队资源分配'),
      chart('项目状态', {
        chart: 'donut',
        groupField: 'status',
        operation: 'count',
        valueField: '',
      }),
    ],
    'minmax(0, 1.5fr) minmax(0, 1fr)'
  ),
  table(),
];
const createForm = () =>
  n('RecordForm', {
    title: '项目信息',
    source: 'projects',
    columns: 2,
    submitLabel: '创建项目',
    successMessage: '项目已创建，项目列表与统计已同时更新。',
  });

const sales: BuilderDataSource = {
  id: 'sales',
  name: '月度经营数据 · 示例',
  mode: 'local',
  endpoint: '',
  path: '',
  fields: [
    { key: 'month', label: '月份', type: 'text', required: true },
    { key: 'revenue', label: '收入', type: 'number', required: true },
    { key: 'orders', label: '订单', type: 'number', required: true },
    { key: 'cost', label: '成本', type: 'number', required: true },
  ],
  rows: [
    ['6月', 92000, 146, 56000],
    ['7月', 108000, 172, 64000],
    ['8月', 99000, 159, 60000],
    ['9月', 136000, 206, 73000],
    ['10月', 152000, 231, 82000],
    ['11月', 184000, 279, 96000],
  ].map(([month, revenue, orders, cost], index) => ({
    _id: `sales-${index}`,
    month,
    revenue,
    orders,
    cost,
  })),
};
const articles: BuilderDataSource = {
  id: 'articles',
  name: '内容资源 · 示例',
  mode: 'local',
  endpoint: '',
  path: '',
  fields: [
    { key: 'title', label: '内容标题', type: 'text', required: true },
    {
      key: 'category',
      label: '分类',
      type: 'select',
      options: ['设计规范', '使用指南', '团队实践'],
      required: true,
    },
    { key: 'description', label: '内容摘要', type: 'text', required: true },
    { key: 'author', label: '作者', type: 'text', required: true },
    { key: 'date', label: '更新时间', type: 'date' },
  ],
  rows: [
    [
      '为产品建立一致的设计语言',
      '设计规范',
      '用色彩、文字与间距，构建可复用且有辨识度的产品体验。',
      '林知夏',
      '2026-11-06',
    ],
    [
      '从第一个项目开始',
      '使用指南',
      '从定义目标到拆解任务，用清晰的节奏推动你的第一个项目。',
      '周予安',
      '2026-11-05',
    ],
    [
      '一次更有效的团队评审',
      '团队实践',
      '将评审从主观意见变成有依据、有结果的设计决策。',
      '陈一诺',
      '2026-11-03',
    ],
    [
      '让数据讲清楚一个故事',
      '设计规范',
      '选择合适的图表，把复杂数据整理成简单而可靠的洞察。',
      '沈亦舟',
      '2026-11-02',
    ],
    [
      '内容发布前的检查清单',
      '使用指南',
      '照顾可读性、无障碍和多设备体验，让内容更容易被理解。',
      '林知夏',
      '2026-10-28',
    ],
    [
      '我们如何记录重要决定',
      '团队实践',
      '让讨论留下上下文，用持续积累的记录帮助团队向前。',
      '周予安',
      '2026-10-24',
    ],
  ].map(([title, category, description, author, date], index) => ({
    _id: `article-${index}`,
    title,
    category,
    description,
    author,
    date,
  })),
};

const link = (children: string, href: string, primary = false) =>
  n('Button', {
    children,
    href,
    variant: primary ? 'primary' : 'ghost',
    size: 'md',
    action: 'button',
  });
const websiteNav = () =>
  stack(
    [
      n(
        'Heading',
        { text: 'FORMA®', level: 'h3', align: 'left' },
        { fontSize: 22, letterSpacing: -1, fontWeight: '800' }
      ),
      stack(
        [
          link('产品能力', '#features'),
          link('联系我们', '#contact'),
          link('开启新篇章 ↗', '#contact', true),
        ],
        { display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }
      ),
    ],
    {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 20,
      paddingTop: 24,
      paddingBottom: 24,
    },
    { flexDirection: 'column', alignItems: 'flex-start' }
  );
const brandHero = () =>
  grid(
    [
      stack(
        [
          text('MAKE SPACE FOR BETTER WORK', {
            fontSize: 11,
            letterSpacing: 1.8,
            color: 'var(--z-color-primary)',
          }),
          title('让好想法，\n成为下一件作品。', 58),
          text(
            '一个清晰、从容的工作空间。\n连接项目、内容与团队，把复杂留给工具，把专注留给创造。',
            { fontSize: 16 }
          ),
          stack(
            [
              link('开启你的工作空间 ↗', '#contact', true),
              text('为每一种工作方式而设计', { fontSize: 11 }),
            ],
            { gap: 12, alignItems: 'flex-start' }
          ),
        ],
        { gap: 24, paddingTop: 30, paddingBottom: 30 }
      ),
      stack(
        [
          text('YOUR WORK, IN FOCUS', { fontSize: 10, letterSpacing: 2 }),
          title('看见每一份进展', 25),
          grid([
            metric('全部项目'),
            metric('已完成', {
              filterField: 'status',
              filterValue: '已完成',
              caption: '从想法到交付',
            }),
          ]),
          chart('团队协作，一目了然', {
            chart: 'donut',
            operation: 'count',
            groupField: 'status',
            height: 180,
          }),
        ],
        {
          paddingTop: 28,
          paddingRight: 28,
          paddingBottom: 28,
          paddingLeft: 28,
          backgroundColor: 'var(--z-color-primary-subtle)',
          borderRadius: 20,
          gap: 18,
          rotate: 1,
        },
        { rotate: 0 }
      ),
    ],
    'minmax(0, 1fr) minmax(0, 1fr)'
  );
const contact = () =>
  n(
    'Section',
    {
      title: '',
      anchor: 'contact',
      tone: 'plain',
      padding: 32,
      content: [
        title('下一个好想法，从这里开始。', 32),
        text('告诉我们你的目标，让我们一起把它变成现实。'),
        n('Form', {
          title: '',
          successMessage: '信息已准备好，可下载并交给项目负责人。',
          content: [
            grid([
              n('Input', {
                label: '你的姓名',
                name: 'name',
                type: 'text',
                required: true,
                placeholder: '如何称呼你',
              }),
              n('Input', {
                label: '工作邮箱',
                name: 'email',
                type: 'email',
                required: true,
                placeholder: 'you@example.com',
              }),
            ]),
            n('TextArea', {
              label: '你的想法',
              name: 'message',
              rows: 4,
              required: true,
              placeholder: '描述你希望实现的目标…',
            }),
            n('Button', {
              children: '发送并生成数据',
              action: 'submit',
              variant: 'primary',
              size: 'lg',
            }),
          ],
        }),
      ],
    },
    { backgroundColor: 'var(--z-color-bg-muted)', borderRadius: 20, marginTop: 50 }
  );

export const sceneTemplates = [
  {
    id: 'business-workspace',
    name: '项目业务工作台',
    label: 'BUSINESS WORKSPACE',
    description: '四个导航视图，实时统计、图表、项目增删改查和数据录入。',
    data: page(
      'Forma · 项目业务工作台',
      [
        shell([
          view('overview', '工作概览', overview),
          view('projects', '项目管理', [
            heading('把项目，有序推进。', '搜索、筛选和更新记录，让每个人知道下一步。'),
            table({ pageSize: 10 }),
          ]),
          view('content', '项目档案', [
            heading('每一件作品，都有记录。', '用卡片浏览项目，点击查看完整信息。'),
            n('RecordList', {
              title: '全部项目',
              source: 'projects',
              titleField: 'name',
              descriptionField: 'description',
              badgeField: 'status',
              layout: 'cards',
              searchable: true,
            }),
          ]),
          view('create', '新建项目', [
            heading('好的开始，来自清晰的信息。', '填写后，项目管理列表与概览会即时更新。'),
            createForm(),
          ]),
        ]),
      ],
      [demoProjectSource]
    ),
  },
  {
    id: 'analytics-studio',
    name: '运营分析看板',
    label: 'ANALYTICS STUDIO',
    description: '深色数据空间；经营指标、折线图、柱状图和可维护台账。',
    data: page(
      'Orbit · 运营分析',
      [
        shell(
          [
            view('overview', '经营概览', [
              heading('从数字，发现下一步。', '六个月的经营概况，让每一项决策都有依据。'),
              grid(
                [
                  metric('累计收入', {
                    source: 'sales',
                    operation: 'sum',
                    field: 'revenue',
                    prefix: '¥',
                    caption: '月度收入合计',
                  }),
                  metric('累计订单', {
                    source: 'sales',
                    operation: 'sum',
                    field: 'orders',
                    caption: '全部月份订单总量',
                  }),
                  metric('月均收入', {
                    source: 'sales',
                    operation: 'average',
                    field: 'revenue',
                    prefix: '¥',
                    caption: '按数据月份计算平均值',
                  }),
                ],
                'repeat(3, minmax(0, 1fr))'
              ),
              chart('收入变化', {
                source: 'sales',
                groupField: 'month',
                valueField: 'revenue',
                chart: 'line',
                height: 270,
              }),
              grid([
                chart('月度订单', {
                  source: 'sales',
                  groupField: 'month',
                  valueField: 'orders',
                  height: 220,
                }),
                chart('成本构成', {
                  source: 'sales',
                  groupField: 'month',
                  valueField: 'cost',
                  chart: 'bar',
                  height: 220,
                }),
              ]),
            ]),
            view('records', '经营台账', [
              heading('数据透明，管理从容。', '更新底层记录，所有分析图表会同步变化。'),
              table({
                title: '月度经营台账',
                source: 'sales',
                columns: '',
                filterField: '',
                pageSize: 10,
              }),
            ]),
          ],
          {
            brand: 'Orbit',
            subtitle: '经营分析空间',
            navigation: 'overview|经营概览\nrecords|经营台账',
            layout: 'topbar',
          }
        ),
      ],
      [sales],
      { theme: 'dark', visualPreset: 'ocean' }
    ),
  },
  {
    id: 'content-library',
    name: '内容资源中心',
    label: 'CONTENT LIBRARY',
    description: '知识库、资源目录与内容录入；复用数据驱动的卡片与表单。',
    data: page(
      'Index · 内容资源中心',
      [
        shell(
          [
            view('overview', '内容资源', [
              heading('让知识，流动起来。', '收集规范、指南和经验，为下一次创造提供起点。'),
              n('RecordList', {
                title: '发现团队的知识',
                source: 'articles',
                titleField: 'title',
                descriptionField: 'description',
                badgeField: 'category',
                layout: 'cards',
                searchable: true,
              }),
            ]),
            view('manage', '内容管理', [
              heading('让好内容，持续生长。', '整理、更新与发布你的内容目录。'),
              table({
                title: '内容台账',
                source: 'articles',
                columns: 'title,category,author,date',
                filterField: 'category',
                pageSize: 10,
              }),
            ]),
            view('create', '添加内容', [
              heading('分享你的下一份发现。', '添加一条内容，它会出现在内容资源与管理列表。'),
              n('RecordForm', {
                title: '内容信息',
                source: 'articles',
                columns: 2,
                submitLabel: '添加内容',
                successMessage: '内容已加入资源中心。',
              }),
            ]),
          ],
          {
            brand: 'Index',
            subtitle: '团队内容与灵感',
            navigation: 'overview|内容资源\nmanage|内容管理\ncreate|添加内容',
            layout: 'topbar',
          }
        ),
      ],
      [articles],
      { visualPreset: 'forest' }
    ),
  },
  {
    id: 'brand-website',
    name: '品牌产品官网',
    label: 'BRAND WEBSITE',
    description: '完整导航、双栏首屏、产品能力与联系表单；所有区块可逐层修改。',
    data: page(
      'Forma · 为下一件作品而生',
      [
        stack(
          [
            websiteNav(),
            brandHero(),
            n(
              'Section',
              {
                title: '',
                anchor: 'features',
                tone: 'plain',
                padding: 0,
                content: [
                  text('BUILT AROUND YOUR IDEAS', { fontSize: 11, letterSpacing: 1.6 }),
                  title('每一种工作方式，\n都值得更好的工具。', 38),
                  grid(
                    [
                      n(
                        'Card',
                        {
                          title: '01 / 保持清晰',
                          children: '项目、任务与进展各就其位。给复杂的信息一个有序的空间。',
                        },
                        { paddingTop: 22, paddingBottom: 22, borderRadius: 14 }
                      ),
                      n(
                        'Card',
                        {
                          title: '02 / 连接创作',
                          children: '让想法在团队之间流动，把文档、讨论和交付放在一起。',
                        },
                        { paddingTop: 22, paddingBottom: 22, borderRadius: 14 }
                      ),
                      n(
                        'Card',
                        {
                          title: '03 / 看见进展',
                          children: '用直观的数据与记录，了解你正在创造的价值。',
                        },
                        { paddingTop: 22, paddingBottom: 22, borderRadius: 14 }
                      ),
                    ],
                    'repeat(3, minmax(0, 1fr))'
                  ),
                ],
              },
              { marginTop: 64 }
            ),
            contact(),
            stack(
              [title('FORMA®', 22), text('把专注留给创造。'), text('© 2026 Forma · 用 ZUI 构建')],
              { paddingTop: 32, paddingBottom: 32, gap: 8 }
            ),
          ],
          { gap: 30 }
        ),
      ],
      [demoProjectSource],
      { maxWidth: 1200, padding: 32, visualPreset: 'forest' }
    ),
  },
  {
    id: 'intake-workflow',
    name: '需求收集门户',
    label: 'INTAKE PORTAL',
    description: '面向服务申请、项目收集和内部反馈；提交后同步到管理视图。',
    data: page(
      'Flow · 需求收集',
      [
        shell(
          [
            view('overview', '提交需求', [
              heading('从一个需求，开启新的可能。', '填写清晰的项目资料，让团队了解你的目标。'),
              grid(
                [
                  stack(
                    [
                      n('Tag', { children: 'STEP 01 / 项目信息', color: 'primary' }),
                      title('让团队了解你的想法。', 26),
                      text('先描述项目名称与负责人，再补充交付日期、预算和项目说明。'),
                      n('Alert', {
                        type: 'info',
                        title: '提交说明',
                        children:
                          '数据在当前浏览器本地处理。若要多人共享，请进一步接入账号和服务端存储。',
                        closable: false,
                      }),
                    ],
                    { gap: 20 }
                  ),
                  createForm(),
                ],
                'minmax(0, 1fr) minmax(0, 1.5fr)'
              ),
            ]),
            view('requests', '需求管理', [
              heading('每一个需求，都有回应。', '筛选、查看和编辑已提交的需求。'),
              table({ title: '全部需求', pageSize: 10 }),
            ]),
          ],
          {
            brand: 'Flow',
            subtitle: '从需求到交付',
            navigation: 'overview|提交需求\nrequests|需求管理',
            layout: 'topbar',
          }
        ),
      ],
      [{ ...demoProjectSource, name: '项目申请', rows: [] }],
      { maxWidth: 1400, visualPreset: 'ocean' }
    ),
  },
];

export const sceneSnippets = [
  {
    id: 'business-heading',
    name: '业务页面标题',
    category: '业务',
    description: '眉题、标题和说明，可直接双击修改',
    accent: 'violet',
    data: heading('把工作，安排得更清晰。', '为你的工作空间补充一段清晰的说明。'),
    sources: [],
  },
  {
    id: 'business-metrics',
    name: '实时数据指标',
    category: '数据',
    description: '四项统计，共享可替换数据源',
    accent: 'blue',
    data: overview[1],
    sources: [demoProjectSource],
  },
  {
    id: 'business-charts',
    name: '组合分析图表',
    category: '数据',
    description: '柱状图与环形图，跟随数据更新',
    accent: 'mint',
    data: overview[2],
    sources: [demoProjectSource],
  },
  {
    id: 'business-table',
    name: '数据管理列表',
    category: '业务',
    description: '搜索、筛选、排序、分页、增删改与导出',
    accent: 'blue',
    data: table(),
    sources: [demoProjectSource],
  },
  {
    id: 'business-form',
    name: '关联数据表单',
    category: '表单',
    description: '校验必填信息，提交后列表即时更新',
    accent: 'rose',
    data: createForm(),
    sources: [demoProjectSource],
  },
  {
    id: 'content-records',
    name: '内容集合卡片',
    category: '内容',
    description: '按数据生成卡片，支持搜索与详情',
    accent: 'sand',
    data: n('RecordList', {
      title: '团队内容',
      source: 'articles',
      titleField: 'title',
      descriptionField: 'description',
      badgeField: 'category',
      searchable: true,
      layout: 'cards',
    }),
    sources: [articles],
  },
  {
    id: 'app-scaffold',
    name: '应用导航框架',
    category: '框架',
    description: '导航联动内容视图，可继续自由搭建',
    accent: 'violet',
    data: shell(
      [
        view('overview', '工作概览', [
          heading('你的工作空间，从这里开始。', '拖入数据、表单或其他 ZUI 组件。'),
        ]),
      ],
      { navigation: 'overview|工作概览' }
    ),
    sources: [],
  },
  {
    id: 'website-navigation',
    name: '品牌网站导航',
    category: '官网',
    description: '品牌、导航链接与行动按钮',
    accent: 'mint',
    data: websiteNav(),
    sources: [],
  },
  {
    id: 'website-hero',
    name: '双栏产品首屏',
    category: '官网',
    description: '大标题与真实数据图表组成产品介绍',
    accent: 'mint',
    data: brandHero(),
    sources: [demoProjectSource],
  },
];

export function templateCategory(id: string) {
  if (['business-workspace', 'project', 'workspace'].includes(id)) return '业务系统';
  if (id === 'analytics-studio') return '数据分析';
  if (id === 'content-library') return '内容展示';
  if (['product', 'brand-website'].includes(id)) return '品牌官网';
  if (['contact', 'intake-workflow'].includes(id)) return '表单收集';
  return '基础';
}
