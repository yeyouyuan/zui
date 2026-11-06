import { useState } from 'react';
import { VirtualTable, type VirtualTableColumn } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

interface Row {
  id: number;
  name: string;
  dept: string;
  score: number;
}

const ROWS: Row[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `员工 ${i + 1}`,
  dept: ['研发', '设计', '市场', '运营'][i % 4],
  score: (i * 7) % 100,
}));

const COLUMNS: VirtualTableColumn<Row>[] = [
  { key: 'id', title: 'ID', width: 80, fixed: 'left' },
  { key: 'name', title: '姓名', width: 140 },
  { key: 'dept', title: '部门', width: 120 },
  {
    key: 'score',
    title: '评分',
    width: 100,
    render: (row: Row) => <strong>{row.score}</strong>,
  },
];

const BASIC_CODE = `const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: \`员工 \${i + 1}\` }));

<VirtualTable
  data={rows}
  columns={[
    { key: 'id', title: 'ID', width: 80, fixed: 'left' },
    { key: 'name', title: '姓名', width: 140 },
    { key: 'score', title: '评分', width: 100, render: (row) => <strong>{row.score}</strong> },
  ]}
  height={320}
  rowHeight={48}
/>`;

const FIXED_CODE = `columns={[
  { key: 'id', title: 'ID', width: 80, fixed: 'left' },
  { key: 'action', title: '操作', width: 120, fixed: 'right' },
  // ...
]}`;

const CLICK_CODE = `const [selected, setSelected] = useState<Row | null>(null);

<VirtualTable
  data={rows}
  columns={columns}
  height={320}
  onRowClick={(row) => setSelected(row)}
/>`;

export default function VirtualTablePage(): React.ReactNode {
  usePageTitle('VirtualTable 虚拟滚动表格');
  const [selected, setSelected] = useState<Row | null>(null);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">VirtualTable 虚拟滚动表格</h1>
      <p className="doc-lead">虚拟滚动表格：仅渲染可视区窗口行，万行级数据流畅滚动，支持固定列。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="1000 行数据"
        description="纯自研虚拟滚动：容器固定 height + 内部 spacer 撑总高度 + 可视区渲染 rows（滚动监听 rAF 优化），1000 行只渲染约 20 行 DOM。"
        code={BASIC_CODE}
        stack
      >
        <VirtualTable data={ROWS} columns={COLUMNS} height={320} rowHeight={48} />
      </Demo>

      <Demo title="固定列" description="column.fixed='left' / 'right' 用 sticky CSS 固定首尾列（本例 ID 列固定在左）。" code={FIXED_CODE}>
        <p className="doc-p">
          本页示例表格的 <code className="doc-code-inline">ID</code> 列已设{' '}
          <code className="doc-code-inline">fixed: left</code>，横向滚动时保持可见。
        </p>
      </Demo>

      <Demo title="行点击" description="onRowClick 回调被点击的行数据；行元素 role=row + aria-rowindex。" code={CLICK_CODE} stack>
        <VirtualTable
          data={ROWS}
          columns={COLUMNS}
          height={320}
          rowHeight={48}
          onRowClick={(row: Row) => setSelected(row)}
        />
        {selected ? (
          <p className="doc-p">{`选中：${selected.name}（部门 ${selected.dept}，评分 ${selected.score}）`}</p>
        ) : (
          <p className="doc-p">点击任意行查看数据</p>
        )}
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'data',
            type: 'T[]',
            description: '行数据。',
          },
          {
            name: 'columns',
            type: "Array<{ key: string; title: React.ReactNode; width?: number; render?: (row: T) => React.ReactNode; fixed?: 'left' | 'right' }>",
            description: '列配置（width 默认 120px）。',
          },
          {
            name: 'rowHeight',
            type: 'number',
            defaultValue: '48',
            description: '行高（px）。',
          },
          {
            name: 'height',
            type: 'number',
            description: '容器高度（px），必填。',
          },
          {
            name: 'overscan',
            type: 'number',
            defaultValue: '5',
            description: '可视区上下额外渲染行数。',
          },
          {
            name: 'onRowClick',
            type: '(row: T) => void',
            description: '行点击回调。',
          },
          {
            name: 'classNames',
            type: '{ root?; header?; body?; row?; cell? }',
            description: 'slot 级类名追加（root / header / body / row / cell）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="VirtualTable"
        parts={['root', 'header', 'body', 'row', 'cell']}
        vars={[
          '--z-virtual-table-font-size',
          '--z-virtual-table-line-height',
          '--z-virtual-table-radius',
          '--z-virtual-table-border',
          '--z-virtual-table-header-bg',
          '--z-virtual-table-header-fg',
          '--z-virtual-table-header-font-weight',
          '--z-virtual-table-header-height',
          '--z-virtual-table-row-bg',
          '--z-virtual-table-row-border',
          '--z-virtual-table-row-hover-bg',
          '--z-virtual-table-cell-padding-x',
          '--z-virtual-table-sticky-bg',
          '--z-virtual-table-sticky-header-bg',
          '--z-virtual-table-focus-ring',
        ]}
        note="与现有 Table 组件相互独立，专为大数据量滚动场景设计；可访问性使用 role=table / row / cell，行带 aria-rowindex。"
      />
    </div>
  );
}
