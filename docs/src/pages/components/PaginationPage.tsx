import { useState } from 'react';
import { Pagination } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const CONTROLLED_CODE = `const [page, setPage] = useState(1);

<Pagination total={50} page={page} onPageChange={setPage} />`;

const UNCONTROLLED_CODE = `<Pagination total={50} defaultPage={3} onPageChange={(p) => console.log(p)} />`;

const COLLAPSE_CODE = `<Pagination total={100} defaultPage={5} siblings={1} />
<Pagination total={100} defaultPage={5} siblings={0} />`;

const JUMPER_CODE = `<Pagination total={200} pageSize={10} showJumper />`;

const DISABLED_CODE = `<Pagination total={50} disabled />
<Pagination total={5} />`;

export default function PaginationPage(): React.ReactNode {
  usePageTitle('Pagination 分页');
  const [page, setPage] = useState(1);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Pagination 分页</h1>
      <p className="doc-lead">
        数据列表的分页导航：页码 1 起始，受控 / 非受控（page / defaultPage / onPageChange），
        siblings 折叠省略号，可选跳页输入框（数字 + Enter），上一页 / 下一页在边界自动禁用。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="受控 / 非受控"
        description="page / defaultPage / onPageChange 受控范式；当前页以 aria-current=&quot;page&quot; 标记。"
        code={CONTROLLED_CODE}
      >
        <div className="doc-pg-preview-row">
          <Pagination total={50} page={page} onPageChange={setPage} />
          <span className="doc-code-inline">受控当前第 {page} 页</span>
        </div>
      </Demo>

      <Demo
        title="非受控初始页"
        description="defaultPage 指定初始页（默认 1）；点击页码切换并回调 onPageChange。"
        code={UNCONTROLLED_CODE}
      >
        <Pagination total={50} defaultPage={3} onPageChange={() => undefined} />
      </Demo>

      <Demo
        title="折叠省略号"
        description="siblings 为当前页两侧相邻页码数（默认 1），范围外折叠为 …，首尾页固定。"
        code={COLLAPSE_CODE}
        stack
      >
        <Pagination total={100} defaultPage={5} siblings={1} />
        <Pagination total={100} defaultPage={5} siblings={0} />
      </Demo>

      <Demo
        title="跳页"
        description="showJumper 显示跳页输入框：输入数字按 Enter 跳转，越界自动收敛到 1 或最后一页。"
        code={JUMPER_CODE}
      >
        <Pagination total={200} pageSize={10} showJumper />
      </Demo>

      <Demo
        title="禁用与边界"
        description="disabled 禁用全部交互；仅一页或处于边界时上一页 / 下一页自动禁用。"
        code={DISABLED_CODE}
        stack
      >
        <Pagination total={50} disabled />
        <Pagination total={5} />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'page',
            type: 'number',
            description: '当前页（受控），1 起始。',
          },
          {
            name: 'defaultPage',
            type: 'number',
            defaultValue: '1',
            description: '初始页（非受控），1 起始。',
          },
          {
            name: 'onPageChange',
            type: '(page: number) => void',
            description: '页码变化回调（1 起始）。',
          },
          {
            name: 'pageSize',
            type: 'number',
            defaultValue: '10',
            description: '每页条数。',
          },
          {
            name: 'total',
            type: 'number',
            description: '总条数（必填），决定总页数。',
          },
          {
            name: 'siblings',
            type: 'number',
            defaultValue: '1',
            description: '当前页两侧相邻页码数，范围外折叠为 …。',
          },
          {
            name: 'showJumper',
            type: 'boolean',
            defaultValue: 'false',
            description: '显示跳页输入框（数字 + Enter 跳页）。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '整体禁用（页码 / 上下页 / 跳页）。',
          },
          {
            name: 'classNames',
            type: '{ root?; item?; jumper? }',
            description: 'slot 级类名追加（root / item / jumper）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'nav'>",
            description: "原生 nav 属性透传到根元素（'children' 除外）。",
          },
        ]}
      />
      <p className="doc-p">
        语义：容器 <code className="doc-code-inline">nav[role=&quot;navigation&quot;]</code>，aria-label
        「分页」；当前页 <code className="doc-code-inline">aria-current=&quot;page&quot;</code>；
        省略号 aria-hidden。根元素 data 属性：
        <code className="doc-code-inline">data-disabled</code>。
      </p>

      <CustomizeOutlet
        name="Pagination"
        parts={['root', 'item', 'jumper']}
        vars={[
          '--z-pagination-gap',
          '--z-pagination-item-size',
          '--z-pagination-item-font-size',
          '--z-pagination-item-font-weight',
          '--z-pagination-item-radius',
          '--z-pagination-item-bg',
          '--z-pagination-item-fg',
          '--z-pagination-item-hover-bg',
          '--z-pagination-item-hover-fg',
          '--z-pagination-item-active-bg',
          '--z-pagination-current-bg',
          '--z-pagination-current-fg',
          '--z-pagination-current-hover-bg',
          '--z-pagination-current-font-weight',
          '--z-pagination-disabled-bg',
          '--z-pagination-disabled-fg',
          '--z-pagination-focus-ring',
          '--z-pagination-jumper-gap',
          '--z-pagination-jumper-font-size',
          '--z-pagination-jumper-fg',
          '--z-pagination-jumper-input-width',
          '--z-pagination-jumper-input-height',
          '--z-pagination-jumper-input-padding-x',
          '--z-pagination-jumper-input-radius',
          '--z-pagination-jumper-input-border',
          '--z-pagination-jumper-input-bg',
          '--z-pagination-jumper-input-fg',
          '--z-pagination-jumper-input-focus-border',
          '--z-pagination-transition',
        ]}
      />
    </div>
  );
}
