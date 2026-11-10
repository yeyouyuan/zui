import { catalogDefinitions } from './builder-catalog-data';
import type { BuilderData as Data } from './builder-model';
import { sceneTemplates } from './builder-scene-templates';

const node = (
  type: string,
  id: string,
  props: Record<string, unknown>
): Data['content'][number] => ({ type, props: { id, ...props } });
const page = (title: string, content: Data['content']): Data => ({
  root: { props: { title, description: '', theme: 'light', maxWidth: 1120, padding: 32 } },
  content,
});

const catalogNode = (type: string, id: string, props: Record<string, unknown> = {}) =>
  node(type, id, {
    ...Object.fromEntries(
      Object.entries(catalogDefinitions[type].fields).map(([key, field]) => [
        key,
        structuredClone(field.value),
      ])
    ),
    ...props,
  });

export const builderTemplates = [
  {
    id: 'blank',
    name: '空白页面',
    label: '从零开始',
    description: '用容器、内容和交互组件自由组合。',
    data: page('未命名页面', []),
  },
  ...sceneTemplates,
  {
    id: 'product',
    name: '产品介绍',
    label: 'LANDING PAGE',
    description: '品牌首屏、功能分栏、行动按钮和页内跳转。',
    data: page('让团队的好想法，开始发生', [
      node('Section', 'product-hero', {
        tone: 'brand',
        title: '',
        anchor: 'intro',
        padding: 40,
        content: [
          node('Tag', 'product-tag', { children: 'BUILT WITH ZUI', color: 'primary' }),
          node('Heading', 'product-title', {
            text: '让团队的好想法，\n开始发生。',
            level: 'h1',
            align: 'left',
          }),
          node('Typography_Text', 'product-description', {
            children: '一个清晰、从容的工作空间。连接你的内容、项目与团队，让每一次协作都有进展。',
            strong: false,
          }),
          node('Button', 'product-action', {
            children: '探索我们的功能',
            href: '#features',
            variant: 'primary',
            size: 'lg',
            action: 'button',
          }),
        ],
      }),
      node('Section', 'product-features', {
        title: '把复杂，变简单。',
        anchor: 'features',
        tone: 'plain',
        padding: 24,
        content: [
          node('Columns', 'product-grid', {
            columns: 3,
            gap: 20,
            content: [
              node('Card', 'product-card-one', {
                title: '01 / 有序的内容',
                children: '集中管理每一份文档、计划与灵感。让信息触手可及。',
                hoverable: true,
              }),
              node('Card', 'product-card-two', {
                title: '02 / 流畅的协作',
                children: '在同一个空间讨论、编辑、推进，让团队保持同步。',
                hoverable: true,
              }),
              node('Card', 'product-card-three', {
                title: '03 / 可见的进展',
                children: '看见每一个里程碑，把目标转化为清晰的下一步。',
                hoverable: true,
              }),
            ],
          }),
        ],
      }),
      node('Divider', 'product-divider', {}),
      node('Typography_Text', 'product-footer', {
        children: '用自己的内容替换这里，让下一页从你开始。',
        strong: false,
      }),
    ]),
  },
  {
    id: 'contact',
    name: '联系与收集',
    label: 'CONTACT FORM',
    description: '带必填和邮箱校验的表单，提交后下载数据。',
    data: page('聊聊你的下一个项目', [
      node('Heading', 'contact-heading', {
        text: '聊聊你的下一个项目。',
        level: 'h1',
        align: 'left',
      }),
      node('Typography_Text', 'contact-intro', {
        children: '填写后可在页面下载本次提交数据，内容仅在当前浏览器处理。',
        strong: false,
      }),
      node('Form', 'contact-form', {
        title: '项目需求',
        successMessage: '填写完成！请下载本次提交数据并交给项目负责人。',
        content: [
          node('Columns', 'contact-grid', {
            columns: 2,
            gap: 20,
            content: [
              node('Input', 'contact-name', {
                label: '姓名',
                name: 'name',
                placeholder: '如何称呼你',
                type: 'text',
                required: true,
                size: 'md',
              }),
              node('Input', 'contact-email', {
                label: '工作邮箱',
                name: 'email',
                placeholder: 'you@example.com',
                type: 'email',
                required: true,
                size: 'md',
              }),
            ],
          }),
          node('Input', 'contact-request', {
            label: '项目需求',
            name: 'request',
            placeholder: '描述你希望实现的目标',
            type: 'text',
            required: true,
            size: 'lg',
          }),
          node('Switch', 'contact-updates', {
            label: '接收项目更新',
            name: 'updates',
            defaultChecked: true,
            size: 'md',
          }),
          node('Button', 'contact-submit', {
            children: '提交并生成数据',
            variant: 'primary',
            action: 'submit',
            size: 'md',
          }),
        ],
      }),
    ]),
  },
  {
    id: 'project',
    name: '项目概览',
    label: 'PROJECT OVERVIEW',
    description: '项目说明、状态卡片、进度和交付信息。',
    data: page('把下一步，看清楚', [
      node('Tag', 'project-tag', { children: 'PROJECT / 2026', color: 'primary' }),
      node('Heading', 'project-title', { text: '把下一步，看清楚。', level: 'h1', align: 'left' }),
      node('Typography_Text', 'project-description', {
        children: '把里程碑、交付物与关键链接放在一页，让每个人知道项目走到了哪里。',
        strong: false,
      }),
      node('Columns', 'project-grid', {
        columns: 2,
        gap: 20,
        content: [
          node('Card', 'project-card-one', {
            title: '本周目标',
            children: '完成第一轮设计评审，并整理下一阶段的产品反馈。',
          }),
          node('Card', 'project-card-two', {
            title: '团队约定',
            children: '每周更新一次进展；所有交付物统一归档，重要决定保留记录。',
          }),
        ],
      }),
      node('Section', 'project-progress', {
        title: '交付进度',
        anchor: 'progress',
        tone: 'muted',
        padding: 24,
        content: [
          node('Progress', 'project-bar', { percent: 72, status: 'active' }),
          node('Typography_Text', 'project-progress-note', {
            children: '72% · 已完成核心流程，下一步进入联调和验收。',
            strong: false,
          }),
        ],
      }),
      node('Alert', 'project-notice', {
        type: 'info',
        title: '下一次评审',
        children: '在这里填写评审安排、交付要求与负责人。',
        closable: true,
      }),
    ]),
  },
  {
    id: 'workspace',
    name: '交互工作台',
    label: 'ZUI WORKSPACE',
    description: '用真实表格、统计、标签面板、弹窗与表单组成业务页面。',
    data: {
      root: {
        props: {
          title: '项目协作工作台',
          theme: 'light',
          maxWidth: 1200,
          padding: 24,
          contentGap: 24,
          background: '#f5f6fa',
          primaryColor: '#635bff',
        },
      },
      content: [
        node('Section', 'workspace-header', {
          title: '',
          tone: 'plain',
          padding: 32,
          content: [
            node('Tag', 'workspace-tag', { children: 'YOUR TEAM, IN SYNC', color: 'primary' }),
            node('Heading', 'workspace-heading', {
              text: '每个好想法，都在向前。',
              level: 'h1',
              _design: { desktop: { fontSize: 36 }, mobile: { fontSize: 26 } },
            }),
            node('Typography_Text', 'workspace-intro', {
              children: '把项目进展、团队协作与工作安排，放在一个清晰的空间里。',
            }),
            catalogNode('Modal', 'workspace-create', {
              label: '创建项目',
              title: '开启新的项目',
              content: [
                node('Form', 'workspace-form', {
                  title: '项目信息',
                  successMessage: '项目信息已准备好，可下载保存。',
                  content: [
                    catalogNode('FormItem', 'workspace-name', {
                      label: '项目名称',
                      name: 'project',
                      required: true,
                    }),
                    catalogNode('Select', 'workspace-team', { label: '负责团队', name: 'team' }),
                    node('Button', 'workspace-save', {
                      children: '保存项目',
                      action: 'submit',
                      variant: 'primary',
                      size: 'md',
                    }),
                  ],
                }),
              ],
            }),
          ],
          _design: { desktop: { borderRadius: 20, backgroundColor: '#ffffff' } },
        }),
        node('Container', 'workspace-metrics', {
          _design: {
            desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 },
            mobile: { gridTemplateColumns: '1fr' },
          },
          content: [
            ...[
              ['进行中的项目', 12, '个'],
              ['本周完成任务', 38, '项'],
              ['交付完成率', 92, '%'],
            ].map(([title, value, suffix], index) =>
              node('Card', `workspace-stat-card-${index}`, {
                title: '',
                children: '',
                content: [
                  catalogNode('Statistic', `workspace-stat-${index}`, {
                    title,
                    value,
                    suffix,
                    prefix: '',
                    precision: 0,
                  }),
                ],
                _design: { desktop: { borderRadius: 16 } },
              })
            ),
          ],
        }),
        catalogNode('Tabs', 'workspace-tabs', {
          items: [
            { value: 'projects', label: '项目总览' },
            { value: 'activity', label: '团队动态' },
          ],
          defaultValue: 'projects',
          content: [
            catalogNode('TabPanel', 'workspace-project-panel', {
              value: 'projects',
              title: '项目总览',
              content: [
                node('Card', 'workspace-project-card', {
                  title: '值得专注的事',
                  children: '',
                  content: [
                    catalogNode('Table', 'workspace-project-table', { caption: '团队项目' }),
                  ],
                  _design: { desktop: { borderRadius: 16 } },
                }),
                catalogNode('Splitter', 'workspace-splitter', {
                  height: 280,
                  content: [
                    node('Card', 'workspace-progress', {
                      title: '本周目标',
                      children: '',
                      content: [
                        node('Typography_Text', 'workspace-goal', {
                          children: '完成设计评审与核心体验验证。',
                        }),
                        node('Progress', 'workspace-progress-bar', {
                          percent: 72,
                          status: 'active',
                        }),
                        node('Button', 'workspace-feedback', {
                          children: '查看进展',
                          action: 'message',
                          payload: '本周目标已完成 72%，继续保持。',
                          variant: 'outline',
                          size: 'sm',
                        }),
                      ],
                    }),
                    node('Card', 'workspace-brief', {
                      title: '项目速览',
                      children: '',
                      content: [
                        catalogNode('Descriptions', 'workspace-description', { column: 1 }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            catalogNode('TabPanel', 'workspace-activity-panel', {
              value: 'activity',
              title: '团队动态',
              content: [
                node('Card', 'workspace-timeline-card', {
                  title: '每一步，都有进展',
                  children: '',
                  content: [catalogNode('Timeline', 'workspace-timeline')],
                }),
              ],
            }),
          ],
        }),
      ],
    },
  },
];

export const initialBuilderData: Data = sceneTemplates[0].data;
