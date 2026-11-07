import { Typography } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const TITLES_CODE = `<Typography.Title>一级标题</Typography.Title>
<Typography.Title level={2}>二级标题</Typography.Title>
<Typography.Title level={3}>三级标题</Typography.Title>
<Typography.Title level={4}>四级标题</Typography.Title>
<Typography.Title level={5}>五级标题</Typography.Title>`;

const PARAGRAPH_CODE = `<Typography.Paragraph>
  段落渲染为 &lt;p&gt;，行高走 --z-leading-normal；ellipsis 折行用 -webkit-line-clamp 实现。
</Typography.Paragraph>
<div style={{ maxWidth: 360 }}>
  <Typography.Paragraph ellipsis={{ rows: 2 }}>
    超出两行的长文本会被截断并显示省略号，鼠标悬停仍可查看完整标题属性提示……
  </Typography.Paragraph>
</div>`;

const TEXT_CODE = `<Typography.Text>默认文本</Typography.Text>
<Typography.Text code>const x = 1</Typography.Text>
<Typography.Text keyboard>Ctrl + C</Typography.Text>
<Typography.Text mark>高亮标注</Typography.Text>
<Typography.Text strong>加粗</Typography.Text>
<Typography.Text underline>下划线</Typography.Text>
<Typography.Text delete>已废弃</Typography.Text>`;

const TYPES_CODE = `<Typography.Text type="secondary">次要文本</Typography.Text>
<Typography.Text type="success">成功文本</Typography.Text>
<Typography.Text type="warning">警告文本</Typography.Text>
<Typography.Text type="danger">危险文本</Typography.Text>
<Typography.Title level={3} type="danger">危险标题</Typography.Title>`;

const COPYABLE_CODE = `<Typography.Text copyable>点击图标复制整段文本</Typography.Text>
<Typography.Text copyable={{ text: '自定义被复制内容' }}>
  复制内容与展示文本可以不同
</Typography.Text>
<Typography.Title level={3} copyable>标题也支持复制</Typography.Title>`;

export default function TypographyPage(): React.ReactNode {
  usePageTitle('Typography 排版');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Typography 排版</h1>
      <p className="doc-lead">
        组合式排版组件：Title（h1-h5）/ Paragraph / Text 三个出口覆盖文章层级、行内语义与复制场景，
        type 只调色、语义标签自动切换、省略走 -webkit-line-clamp。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="标题" description="level 1-5 分别渲染 h1-h5，默认 level=1；字号字重全部走 --z-text-* / --z-weight-* 令牌。" code={TITLES_CODE} stack>
        <Typography.Title>一级标题</Typography.Title>
        <Typography.Title level={2}>二级标题</Typography.Title>
        <Typography.Title level={3}>三级标题</Typography.Title>
        <Typography.Title level={4}>四级标题</Typography.Title>
        <Typography.Title level={5}>五级标题</Typography.Title>
      </Demo>

      <Demo
        title="段落与省略"
        description="Paragraph 渲染为 p；ellipsis=true 折 1 行，ellipsis={{ rows: n }} 折 n 行（-webkit-line-clamp）。"
        code={PARAGRAPH_CODE}
        stack
      >
        <Typography.Paragraph>
          段落渲染为 p 元素，行高走 --z-leading-normal；ellipsis 折行用 -webkit-line-clamp 实现，
          行数以内联 CSS 变量 --z-typography-ellipsis-rows 提供。
        </Typography.Paragraph>
        <div style={{ maxWidth: 360 }}>
          <Typography.Paragraph ellipsis={{ rows: 2 }}>
            超出两行的长文本会被截断并显示省略号：ZUI 是一套零运行时 CSS
            的组件库，所有样式都由语义令牌驱动，暗色模式与主题定制无需重新编译，组件级
            CSS 变量可以逐个覆盖。
          </Typography.Paragraph>
        </div>
      </Demo>

      <Demo title="文本语义" description="Text 默认渲染 span；code/keyboard/mark/delete 自动切换语义标签，strong/underline 走样式。" code={TEXT_CODE} stack>
        <Typography.Text>默认文本</Typography.Text>
        <Typography.Text code>const x = 1</Typography.Text>
        <Typography.Text keyboard>Ctrl + C</Typography.Text>
        <Typography.Text mark>高亮标注</Typography.Text>
        <Typography.Text strong>加粗</Typography.Text>
        <Typography.Text underline>下划线</Typography.Text>
        <Typography.Text delete>已废弃</Typography.Text>
      </Demo>

      <Demo title="type 配色" description="type 只调色不改语义：secondary → --z-color-fg-muted，success / warning / danger → 同名语义色令牌。" code={TYPES_CODE} stack>
        <Typography.Text type="secondary">次要文本</Typography.Text>
        <Typography.Text type="success">成功文本</Typography.Text>
        <Typography.Text type="warning">警告文本</Typography.Text>
        <Typography.Text type="danger">危险文本</Typography.Text>
        <Typography.Title level={3} type="danger">
          危险标题
        </Typography.Title>
      </Demo>

      <Demo
        title="复制 copyable"
        description="内容后渲染复制按钮：clipboard API 优先、execCommand 回退；成功后图标变 CheckCircle 1.5s，并以 aria-live=polite 播报「已复制」。"
        code={COPYABLE_CODE}
        stack
      >
        <Typography.Text copyable>点击图标复制整段文本</Typography.Text>
        <Typography.Text copyable={{ text: '自定义被复制内容' }}>
          复制内容与展示文本可以不同
        </Typography.Text>
        <Typography.Title level={3} copyable>
          标题也支持复制
        </Typography.Title>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'level',
            type: '1 | 2 | 3 | 4 | 5',
            defaultValue: '1',
            description: 'Title 标题级别，渲染 h1-h5。',
          },
          {
            name: 'ellipsis',
            type: 'boolean | { rows: number }',
            defaultValue: 'false',
            description: 'Paragraph 省略：true 折 1 行；{ rows: n } 用 -webkit-line-clamp 折 n 行。',
          },
          {
            name: 'code',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Text 行内代码 → <code>。',
          },
          {
            name: 'keyboard',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Text 键盘按键 → <kbd>。',
          },
          {
            name: 'mark',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Text 高亮 → <mark>。',
          },
          {
            name: 'strong',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Text 加粗。',
          },
          {
            name: 'underline',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Text 下划线。',
          },
          {
            name: 'type',
            type: "'secondary' | 'success' | 'warning' | 'danger'",
            defaultValue: '—',
            description: '只调色：secondary → --z-color-fg-muted，其余映射同名语义色令牌。',
          },
          {
            name: 'copyable',
            type: 'boolean | { text?: string; onCopy?: () => void }',
            defaultValue: 'false',
            description:
              '内容后渲染复制按钮；clipboard 优先、textarea + execCommand 回退；成功态图标 1.5s；text 覆盖被复制内容（默认取 children 文本）。',
          },
          {
            name: 'delete',
            type: 'boolean',
            defaultValue: 'false',
            description: '删除线：Text 渲染 <del>；Title/Paragraph 走 data-delete 样式。',
          },
          {
            name: 'classNames',
            type: '{ root?; copy? }',
            defaultValue: '—',
            description: 'slot 级类名追加（root 根元素 / copy 复制按钮）。',
          },
          {
            name: '...rest',
            type: 'React.ComponentPropsWithRef<element>',
            description: '原生属性透传到各根元素（Title→h1-h5、Paragraph→p、Text→语义行内标签）。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-type</code>（type 配色）、
        <code className="doc-code-inline">data-ellipsis</code>、
        <code className="doc-code-inline">data-delete</code>，Text 额外有
        <code className="doc-code-inline">data-code</code>、
        <code className="doc-code-inline">data-keyboard</code>、
        <code className="doc-code-inline">data-mark</code>、
        <code className="doc-code-inline">data-strong</code>、
        <code className="doc-code-inline">data-underline</code>；复制按钮有
        <code className="doc-code-inline">data-copied</code> 成功态。
      </p>

      <CustomizeOutlet
        name="Typography"
        parts={['root', 'copy', 'copy-feedback']}
        vars={[
          '--z-typography-margin',
          '--z-typography-color',
          '--z-typography-h1-size',
          '--z-typography-h2-size',
          '--z-typography-h3-size',
          '--z-typography-h4-size',
          '--z-typography-h5-size',
          '--z-typography-paragraph-size',
          '--z-typography-code-bg',
          '--z-typography-code-fg',
          '--z-typography-code-border',
          '--z-typography-code-border-width',
          '--z-typography-code-radius',
          '--z-typography-kbd-bg',
          '--z-typography-kbd-border',
          '--z-typography-mark-bg',
          '--z-typography-mark-fg',
          '--z-typography-copy-color',
          '--z-typography-copy-hover-color',
          '--z-typography-copy-success-color',
          '--z-typography-copy-size',
          '--z-typography-copy-gap',
          '--z-typography-ellipsis-rows',
        ]}
      />
    </div>
  );
}
