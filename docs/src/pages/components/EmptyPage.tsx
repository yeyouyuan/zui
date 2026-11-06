import { Empty } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Empty />`;

const DESC_CODE = `<Empty description="没有搜索结果" />
<Empty description={<span>网络异常，请稍后重试</span>} />`;

const CUSTOM_CODE = `<Empty
  image={<span style={{ fontSize: 48 }}>🗂</span>}
  description="还没有项目"
>
  <button>立即创建</button>
  <button>了解更多</button>
</Empty>`;

export default function EmptyPage(): React.ReactNode {
  usePageTitle('Empty 空状态');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Empty 空状态</h1>
      <p className="doc-lead">
        无数据时的占位提示：内置灰调简洁插图（两个矩形 + 圆）+ 描述文案 + 可选操作区，垂直居中排布。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="默认"
        description="不传任何 props 时渲染内置 SVG 插图与「暂无数据」描述。"
        code={BASIC_CODE}
      >
        <Empty />
      </Demo>

      <Demo
        title="自定义描述"
        description="description 支持任意节点；缺省为「暂无数据」。"
        code={DESC_CODE}
        stack
      >
        <Empty description="没有搜索结果" />
        <Empty description={<span>网络异常，请稍后重试</span>} />
      </Demo>

      <Demo
        title="自定义插图与操作区"
        description="image 覆盖内置插图；children 作为操作区（如按钮）放在描述下方。"
        code={CUSTOM_CODE}
      >
        <Empty
          image={<span style={{ fontSize: 48 }}>🗂</span>}
          description="还没有项目"
        >
          <button>立即创建</button>
          <button>了解更多</button>
        </Empty>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'image',
            type: 'React.ReactNode',
            description: '自定义插图，默认内置简洁 SVG（灰调两个矩形 + 圆）。',
          },
          {
            name: 'description',
            type: 'React.ReactNode',
            defaultValue: "'暂无数据'",
            description: '描述文案。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '操作区（如按钮）。',
          },
          {
            name: 'classNames',
            type: '{ root?; image?; description? }',
            description: 'slot 级类名追加（root / image / description）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素（className、style、aria-*、事件等）。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-part</code> 结构：root / image / description /
        actions（操作区仅在 children 存在时渲染）。
      </p>

      <CustomizeOutlet
        name="Empty"
        parts={['root', 'image', 'description', 'actions']}
        vars={[
          '--z-empty-gap',
          '--z-empty-image-size',
          '--z-empty-image-color',
          '--z-empty-description-font-size',
          '--z-empty-description-color',
          '--z-empty-description-line-height',
          '--z-empty-actions-gap',
        ]}
      />
    </div>
  );
}
