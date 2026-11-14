import { useState } from 'react';
import type { TableColumn, TableColumnState, TableSortState } from '@zui/react';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

interface DemoRow {
  name: string;
  role: string;
  dept: string;
  count: number;
}

const ROWS = [
  { name: '张三', role: '前端工程师', dept: '产品研发部', count: 12 },
  { name: '李四', role: '设计师', dept: '体验设计部', count: 8 },
  { name: '王五', role: '产品经理', dept: '平台产品部', count: 15 },
];

const DATA_ROWS = [
  { name: '张三', role: '前端工程师', dept: '产品研发部', count: 12 },
  { name: '李四', role: '设计师', dept: '体验设计部', count: 8 },
  { name: '王五', role: '产品经理', dept: '平台产品部', count: 15 },
  { name: '赵六', role: '测试工程师', dept: '质量保障部', count: 21 },
  { name: '孙七', role: '后端工程师', dept: '产品研发部', count: 9 },
];

const DATA_COLUMNS: TableColumn<DemoRow>[] = [
  { key: 'name', title: '姓名', sortable: true },
  { key: 'role', title: '职位', sortable: true },
  { key: 'dept', title: '部门' },
  { key: 'count', title: '任务数', sortable: true, align: 'right' },
];

const DATA_CODE = `const columns = [
  { key: 'name', title: '姓名', sortable: true },
  { key: 'role', title: '职位', sortable: true },
  { key: 'dept', title: '部门' },
  { key: 'count', title: '任务数', sortable: true, align: 'right' },
];

const [columnState, setColumnState] = useState<TableColumnState>({});
const [sortState, setSortState] = useState<TableSortState | null>(null);

<Table
  aria-label="团队任务"
  data={rows}
  columns={columns}
  rowKey="name"
  columnState={columnState}
  onColumnStateChange={setColumnState}
  sortState={sortState}
  onSortStateChange={setSortState}
/>;
// 「排序」菜单明确选择升序、降序或清除；
// 专用移动手柄支持拖拽与 Alt+方向/Home/End；
// 「字段管理」支持搜索、显隐、上下移、拖拽和恢复默认。`;

const BASIC_CODE = `<Table>
  <Table.Head>
    <Table.Row>
      <Table.HeaderCell>姓名</Table.HeaderCell>
      <Table.HeaderCell>职位</Table.HeaderCell>
      <Table.HeaderCell>部门</Table.HeaderCell>
    </Table.Row>
  </Table.Head>
  <Table.Body>
    <Table.Row>
      <Table.Cell>张三</Table.Cell>
      <Table.Cell>前端工程师</Table.Cell>
      <Table.Cell>产品研发部</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table>`;

const STYLE_CODE = `<Table density="compact" striped bordered>
  {/* density: 'comfortable' | 'compact'，默认 comfortable */}
  {/* striped / bordered 默认 false，行分隔线始终有 */}
</Table>`;

const SELECT_CODE = `<Table.Row selected>
  {/* selected 写入 data-selected，选中行使用 primary-subtle 底色 */}
</Table.Row>

<Table.HeaderCell align="right">数量</Table.HeaderCell>
<Table.Cell align="right">12</Table.Cell>`;

export default function TablePage(): React.ReactNode {
  usePageTitle('Table 表格');
  const [columnState, setColumnState] = useState<TableColumnState>({});
  const [sortState, setSortState] = useState<TableSortState | null>(null);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Table 表格</h1>
      <p className="doc-lead">
        同时提供纯语义组合模式与专业数据模式。数据模式将数据排序、字段移动和字段显隐明确拆分，
        支持受控状态、本地或服务端排序，并保留原生 table 语义。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        scroll
        title="基础用法"
        description="Table.Head / Body / Row / HeaderCell / Cell 组合出语义化表格，th 自带 scope=col。"
        code={BASIC_CODE}
        stack
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>姓名</TableHeaderCell>
              <TableHeaderCell>职位</TableHeaderCell>
              <TableHeaderCell>部门</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.name}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell>{row.dept}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Demo>

      <Demo
        scroll
        title="密度、斑马纹与边框"
        description="density=compact 收紧行高；striped 斑马纹；bordered 加列分隔线（行分隔线始终存在）。"
        code={STYLE_CODE}
        stack
      >
        <Table density="compact" striped bordered>
          <TableHead>
            <TableRow>
              <TableHeaderCell>姓名</TableHeaderCell>
              <TableHeaderCell>职位</TableHeaderCell>
              <TableHeaderCell>部门</TableHeaderCell>
              <TableHeaderCell align="right">任务数</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.name}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell>{row.dept}</TableCell>
                <TableCell align="right">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Demo>

      <Demo
        scroll
        title="行选中与对齐"
        description="Table.Row 的 selected 写入 data-selected；Cell / HeaderCell 的 align 控制 left / center / right。"
        code={SELECT_CODE}
        stack
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>姓名</TableHeaderCell>
              <TableHeaderCell align="center">职位</TableHeaderCell>
              <TableHeaderCell align="right">任务数</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ROWS.map((row, index) => (
              <TableRow key={row.name} selected={index === 1}>
                <TableCell>{row.name}</TableCell>
                <TableCell align="center">{row.role}</TableCell>
                <TableCell align="right">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Demo>

      <Demo
        scroll
        title="数据驱动：明确排序与高级字段管理"
        description="「排序」菜单明确选择升序、降序或清除；只有专用手柄负责移动字段；工具栏持续显示当前排序，字段管理支持搜索、显隐、上下移、拖拽与恢复默认。"
        code={DATA_CODE}
        stack
      >
        <Table
          data={DATA_ROWS}
          columns={DATA_COLUMNS}
          rowKey="name"
          columnState={columnState}
          onColumnStateChange={setColumnState}
          sortState={sortState}
          onSortStateChange={setSortState}
          striped
        />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <h3 className="doc-h3">Table</h3>
      <ApiTable
        rows={[
          {
            name: 'density',
            type: "'comfortable' | 'compact'",
            defaultValue: "'comfortable'",
            description: '行高密度，写入 data-density。',
          },
          {
            name: 'bordered',
            type: 'boolean',
            defaultValue: 'false',
            description: '列分隔线（行分隔线始终存在），写入 data-bordered。',
          },
          {
            name: 'striped',
            type: 'boolean',
            defaultValue: 'false',
            description: '斑马纹，写入 data-striped。',
          },
          {
            name: 'data / columns',
            type: 'T[] / TableColumn<T>[]',
            description:
              '数据模式：columns 声明 key/title/width/align/sortable/sorter/render；sortable 字段通过显式菜单选择升序、降序或清除，字段由专用手柄移动。',
          },
          {
            name: 'rowKey',
            type: 'string | ((row, index) => Key)',
            description: '数据模式的行 key 字段名或取值函数。',
          },
          {
            name: 'columnState / defaultColumnState / onColumnStateChange',
            type: '{ order?: string[]; hidden?: string[] }',
            description:
              '字段状态受控/非受控与变更回调：order 为字段顺序，hidden 为隐藏字段；表头手柄、字段管理拖拽/上下移/显隐共享状态，始终至少保留一列。',
          },
          {
            name: 'sortState / defaultSortState / onSortStateChange',
            type: 'TableSortState | null',
            description: '单字段排序受控/非受控状态及变更回调；隐藏活动排序字段时自动清除。',
          },
          {
            name: 'sortMode',
            type: "'client' | 'manual'",
            defaultValue: "'client'",
            description: 'client 在本地重排行；manual 仅回调排序状态，适合服务端分页与查询。',
          },
          {
            name: 'classNames',
            type: '{ root? }',
            description: 'slot 级类名追加（root）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'table'>",
            description: "原生 table 属性透传（'size' 除外）。",
          },
        ]}
      />
      <h3 className="doc-h3">组合节点</h3>
      <ApiTable
        rows={[
          {
            name: 'Table.Head / Table.Body',
            type: '结构组件',
            description: 'thead / tbody 包装，属性透传。',
          },
          {
            name: 'Table.Row selected',
            type: 'boolean',
            defaultValue: 'false',
            description: '选中行，写入 data-selected。',
          },
          {
            name: 'Table.HeaderCell align',
            type: "'left' | 'center' | 'right'",
            defaultValue: "'left'",
            description: '表头单元格对齐（th 自带 scope="col"）。',
          },
          {
            name: 'Table.Cell align',
            type: "'left' | 'center' | 'right'",
            defaultValue: "'left'",
            description: '单元格对齐，写入 data-align。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Table"
        parts={['root', 'header-cell', 'cell']}
        vars={[
          '--z-table-font-size',
          '--z-table-header-font-size',
          '--z-table-header-fg',
          '--z-table-cell-padding-x',
          '--z-table-cell-padding-y',
          '--z-table-border-color',
          '--z-table-border-color-subtle',
          '--z-table-row-hover-bg',
          '--z-table-row-selected-bg',
          '--z-table-row-selected-fg',
          '--z-table-striped-bg',
        ]}
        note="Table.Row 以 data-selected 暴露选中态；Head / Body / Row 结构类名不属于公开契约。"
      />
    </div>
  );
}
