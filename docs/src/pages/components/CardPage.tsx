import { Card } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Card title="卡片标题" extra={<a href="#">更多</a>}>
  卡片内容区域，承载主要信息。
</Card>`;

const COVER_CODE = `<Card
  cover={<img src="https://picsum.photos/seed/zui/480/200" alt="封面" />}
  title="带封面的卡片"
  footer={<span>底部操作区</span>}
>
  封面在顶部媒体区，底部操作区自带分隔线。
</Card>`;

const STYLE_CODE = `<Card bordered={false}>无边框卡片</Card>
<Card hoverable>悬停上浮 + 阴影</Card>`;

export default function CardPage(): React.ReactNode {
  usePageTitle('Card 卡片');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Card 卡片</h1>
      <p className="doc-lead">
        信息容器：标题 + 右侧插槽 + 封面 + 内容 + 底部的 props 式组合，白底圆角、可选边框与悬停效果。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础卡片"
        description="title 与 extra 组成 48px 高的头部，children 为内容区（20px 内边距）。"
        code={BASIC_CODE}
      >
        <Card title="卡片标题" extra={<a href="#">更多</a>}>
          卡片内容区域，承载主要信息。
        </Card>
      </Demo>

      <Demo
        title="封面与底部"
        description="cover 顶部媒体区自动裁切到卡片圆角；footer 底部操作区自带顶部分隔线。"
        code={COVER_CODE}
        stack
      >
        <Card
          cover={<img src="https://picsum.photos/seed/zui/480/200" alt="封面" />}
          title="带封面的卡片"
          footer={<span>底部操作区</span>}
        >
          封面在顶部媒体区，底部操作区自带分隔线。
        </Card>
      </Demo>

      <Demo
        title="无边框与悬停"
        description="bordered={false} 去掉描边；hoverable 在 hover 时上浮并加深阴影（reduced-motion 自动降级）。"
        code={STYLE_CODE}
        stack
      >
        <Card bordered={false}>无边框卡片</Card>
        <Card hoverable>悬停上浮 + 阴影</Card>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'title',
            type: 'React.ReactNode',
            description: '卡片标题（头部左侧）。',
          },
          {
            name: 'extra',
            type: 'React.ReactNode',
            description: '头部右侧插槽。',
          },
          {
            name: 'cover',
            type: 'React.ReactNode',
            description: '顶部媒体区。',
          },
          {
            name: 'footer',
            type: 'React.ReactNode',
            description: '底部内容，自带顶部分隔线。',
          },
          {
            name: 'bordered',
            type: 'boolean',
            defaultValue: 'true',
            description: '是否显示描边。',
          },
          {
            name: 'hoverable',
            type: 'boolean',
            defaultValue: 'false',
            description: 'hover 时阴影加深并上浮。',
          },
          {
            name: 'classNames',
            type: '{ root?; header?; title?; extra?; cover?; body?; footer? }',
            description: 'slot 级类名追加（root / header / title / extra / cover / body / footer）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素（className、style、aria-*、事件等；title 除外）。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-bordered</code>、
        <code className="doc-code-inline">data-hoverable</code>。header / title / extra / cover / body / footer
        各结构元素均带 <code className="doc-code-inline">data-part</code>，仅在对应 props 存在时渲染。
      </p>

      <CustomizeOutlet
        name="Card"
        parts={['root', 'header', 'title', 'extra', 'cover', 'body', 'footer']}
        vars={[
          '--z-card-bg',
          '--z-card-border',
          '--z-card-border-width',
          '--z-card-radius',
          '--z-card-padding',
          '--z-card-header-height',
          '--z-card-header-gap',
          '--z-card-title-font-size',
          '--z-card-title-font-weight',
          '--z-card-title-fg',
          '--z-card-extra-font-size',
          '--z-card-extra-fg',
          '--z-card-shadow',
          '--z-card-hover-shadow',
          '--z-card-hover-translate-y',
          '--z-card-transition',
        ]}
      />
    </div>
  );
}
