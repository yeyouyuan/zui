import type { BuilderNode } from './builder-tree';
import type { BuilderStyles } from './builder-design';
import { sceneSnippets } from './builder-scene-templates';

const node = (type: string, props: Record<string, unknown>): BuilderNode => ({
  type,
  props: { id: 'snippet', ...props },
});
const styled = (type: string, props: Record<string, unknown>, styles: BuilderStyles) =>
  node(type, { ...props, _design: { desktop: styles } });
const heading = (text: string, level = 'h2') => node('Heading', { text, level, align: 'left' });
const text = (children: string) => node('Typography_Text', { children, strong: false });
const button = (children: string, href = '#contact') =>
  node('Button', {
    children,
    href,
    variant: 'primary',
    size: 'lg',
    action: 'button',
    disabled: false,
  });
const section = (content: BuilderNode[], styles: BuilderStyles) =>
  styled('Section', { title: '', anchor: '', tone: 'plain', padding: 32, content }, styles);

export const builderSnippets = [
  ...sceneSnippets,
  {
    id: 'hero',
    name: '品牌首屏',
    category: '介绍',
    description: '宣言、说明与行动按钮',
    accent: 'violet',
    data: section(
      [
        node('Tag', { children: '为新想法而生', color: 'primary', closable: false }),
        styled(
          'Heading',
          { text: '让好想法，\n拥有自己的页面。', level: 'h1', align: 'left' },
          { fontSize: 48, lineHeight: 1.2, letterSpacing: -1.5 }
        ),
        text('从灵感出发，将内容、设计和体验连接在一起。现在就开始创造你的下一件作品。'),
        button('开始探索'),
      ],
      { backgroundColor: '#eef2ff', borderRadius: 24, paddingTop: 48, paddingBottom: 48 }
    ),
  },
  {
    id: 'features',
    name: '功能亮点',
    category: '展示',
    description: '三列卡片，手机自动堆叠',
    accent: 'blue',
    data: section(
      [
        heading('每一步，都更简单。'),
        text('为日常工作打造的实用能力。'),
        node('Columns', {
          columns: 3,
          gap: 20,
          content: [
            node('Card', {
              title: '01 · 自由设计',
              children: '灵活布局、精细样式，让每个细节表达你的想法。',
              hoverable: true,
            }),
            node('Card', {
              title: '02 · 即时保存',
              children: '随时离开，再从上一次的灵感继续。',
              hoverable: true,
            }),
            node('Card', {
              title: '03 · 随处分享',
              children: '导出独立页面，轻松在浏览器中展示。',
              hoverable: true,
            }),
          ],
        }),
      ],
      { paddingTop: 40, paddingBottom: 40 }
    ),
  },
  {
    id: 'cta',
    name: '行动号召',
    category: '转化',
    description: '醒目的居中转化区块',
    accent: 'mint',
    data: section(
      [
        styled(
          'Heading',
          { text: '准备好开启下一步了吗？', level: 'h2', align: 'center' },
          { color: '#ffffff', fontSize: 32 }
        ),
        styled(
          'Typography_Text',
          { children: '把你的想法变成可以被看见的作品。', strong: false },
          { textAlign: 'center', color: '#d1fae5', display: 'block' }
        ),
        styled(
          'Button',
          {
            children: '与我们联系',
            href: '#contact',
            variant: 'primary',
            size: 'lg',
            action: 'button',
            disabled: false,
          },
          { backgroundColor: '#ffffff', color: '#064e3b', borderColor: '#ffffff' }
        ),
      ],
      {
        backgroundColor: '#065f46',
        borderRadius: 20,
        paddingTop: 40,
        paddingBottom: 40,
        textAlign: 'center',
      }
    ),
  },
  {
    id: 'contact',
    name: '完整联系表单',
    category: '转化',
    description: '姓名、邮箱、留言与必填校验',
    accent: 'rose',
    data: node('Form', {
      title: '聊聊你的想法',
      successMessage: '感谢你的留言，提交数据已准备好下载。',
      content: [
        node('Columns', {
          columns: 2,
          gap: 16,
          content: [
            node('Input', {
              label: '姓名',
              name: 'name',
              placeholder: '如何称呼你',
              type: 'text',
              required: true,
              size: 'md',
              status: 'default',
              clearable: false,
            }),
            node('Input', {
              label: '邮箱',
              name: 'email',
              placeholder: 'you@example.com',
              type: 'email',
              required: true,
              size: 'md',
              status: 'default',
              clearable: false,
            }),
          ],
        }),
        node('TextArea', {
          label: '留言',
          name: 'message',
          placeholder: '请告诉我们你的需求…',
          required: true,
          rows: 4,
        }),
        node('Checkbox', {
          label: '我同意将填写的信息用于本次沟通',
          name: 'agreement',
          required: true,
          defaultChecked: false,
        }),
        node('Button', {
          children: '发送留言',
          variant: 'primary',
          size: 'lg',
          href: '',
          action: 'submit',
          disabled: false,
        }),
      ],
    }),
  },
  {
    id: 'faq',
    name: '常见问题',
    category: '介绍',
    description: '清晰的问答内容分区',
    accent: 'sand',
    data: section(
      [
        heading('你可能还想了解'),
        node('Card', {
          title: '页面保存在哪里？',
          children: '草稿自动保存在当前浏览器中。你也可以导出 JSON，换个工作区继续编辑。',
          hoverable: false,
        }),
        node('Card', {
          title: '导出的页面可以独立使用吗？',
          children: 'HTML 包含样式和表单交互，可以直接用浏览器打开。外链图片仍需要网络。',
          hoverable: false,
        }),
      ],
      { backgroundColor: '#fafaf9', borderRadius: 20 }
    ),
  },
  {
    id: 'stats',
    name: '数据概览',
    category: '展示',
    description: '三个重点指标与说明',
    accent: 'blue',
    data: node('Columns', {
      columns: 3,
      gap: 20,
      content: [
        ['12k+', '灵感正在发生'],
        ['98%', '满意的使用体验'],
        ['24/7', '随时开始创造'],
      ].map(([number, caption]) =>
        section(
          [
            styled(
              'Heading',
              { text: number, level: 'h2', align: 'center' },
              { fontSize: 40, color: '#4f46e5' }
            ),
            styled(
              'Typography_Text',
              { children: caption, strong: false },
              { display: 'block', textAlign: 'center', color: '#64748b' }
            ),
          ],
          { borderRadius: 16, backgroundColor: '#f8fafc', paddingTop: 28, paddingBottom: 28 }
        )
      ),
    }),
  },
] as const;
