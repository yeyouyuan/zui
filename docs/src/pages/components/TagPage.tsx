import { Button, Tag } from '@zui/react';
import { useState } from 'react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const COLOR_CODE = `<Tag>中性标签</Tag>
<Tag color="primary">主色标签</Tag>
<Tag color="success">成功标签</Tag>
<Tag color="warning">警告标签</Tag>
<Tag color="error">危险标签</Tag>`;

const CLOSE_CODE = `const [tags, setTags] = useState(['前端', '设计', '后端']);

{tags.map((tag) => (
  <Tag key={tag} closable onClose={() => setTags(tags.filter((t) => t !== tag))}>
    {tag}
  </Tag>
))}`;

const ICON_CODE = `<Tag icon={<span>★</span>} color="warning">精选</Tag>
<Tag icon={<span>✓</span>} color="success">已通过</Tag>
<Tag closable onClose={() => {}} icon={<span>◆</span>} color="primary">
  可关闭带图标
</Tag>`;

export default function TagPage(): React.ReactNode {
  usePageTitle('Tag 标签');
  const [tags, setTags] = useState(['前端', '设计', '后端']);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Tag 标签</h1>
      <p className="doc-lead">
        24px 高的小块标签：5 种语义颜色（浅底 + 状态字色），可选图标与关闭钮（× aria-label=移除标签），
        用于分类、筛选与属性标记。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="颜色"
        description="color 提供 primary / success / warning / error / neutral，默认 neutral（中性灰底）。"
        code={COLOR_CODE}
      >
        <div className="doc-pg-preview-row">
          <Tag>中性标签</Tag>
          <Tag color="primary">主色标签</Tag>
          <Tag color="success">成功标签</Tag>
          <Tag color="warning">警告标签</Tag>
          <Tag color="error">危险标签</Tag>
        </div>
      </Demo>

      <Demo
        title="可关闭"
        description="closable 渲染 × 关闭钮（aria-label=移除标签），点击触发 onClose（携带 MouseEvent）并移除标签。"
        code={CLOSE_CODE}
      >
        <div className="doc-pg-preview-row">
          {tags.map((tag) => (
            <Tag key={tag} closable onClose={() => setTags(tags.filter((t) => t !== tag))}>
              {tag}
            </Tag>
          ))}
          {tags.length === 0 ? (
            <Button variant="secondary" onClick={() => setTags(['前端', '设计', '后端'])}>
              重置
            </Button>
          ) : null}
        </div>
      </Demo>

      <Demo
        title="带图标"
        description="icon 放置于标签左侧（aria-hidden），可与 closable 组合使用。"
        code={ICON_CODE}
      >
        <div className="doc-pg-preview-row">
          <Tag icon={<span aria-hidden="true">★</span>} color="warning">
            精选
          </Tag>
          <Tag icon={<span aria-hidden="true">✓</span>} color="success">
            已通过
          </Tag>
          <Tag closable onClose={() => undefined} icon={<span aria-hidden="true">◆</span>} color="primary">
            可关闭带图标
          </Tag>
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'color',
            type: "'primary' | 'success' | 'warning' | 'error' | 'neutral'",
            defaultValue: "'neutral'",
            description: '语义颜色（浅底 + 状态字色）。',
          },
          {
            name: 'closable',
            type: 'boolean',
            defaultValue: 'false',
            description: '显示关闭钮 ×（aria-label=移除标签）。',
          },
          {
            name: 'onClose',
            type: '(e: React.MouseEvent) => void',
            description: '关闭回调（携带 MouseEvent）；点击后标签移除。',
          },
          {
            name: 'icon',
            type: 'React.ReactNode',
            description: '左侧图标（aria-hidden）。',
          },
          {
            name: 'classNames',
            type: '{ root?; icon?; close? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'span'>",
            description: "原生 span 属性透传到根元素（className、style、aria-*、事件等；'color' 除外）。",
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-color</code>；关闭后组件自行移除（非受控）。
      </p>

      <CustomizeOutlet
        name="Tag"
        parts={['root', 'icon', 'close']}
        vars={[
          '--z-tag-height',
          '--z-tag-padding-x',
          '--z-tag-gap',
          '--z-tag-radius',
          '--z-tag-font-size',
          '--z-tag-line-height',
          '--z-tag-icon-size',
          '--z-tag-close-size',
          '--z-tag-close-gap',
          '--z-tag-bg',
          '--z-tag-fg',
          '--z-tag-border',
          '--z-tag-hover-bg',
          '--z-tag-focus-ring',
          '--z-tag-transition',
        ]}
      />
    </div>
  );
}
