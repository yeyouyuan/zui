'use client';

import * as React from 'react';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tag,
} from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export interface TableColumn<T> {
  key: string;
  title: React.ReactNode;
  /** 单元格渲染函数 */
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
}

export interface TablePageRow {
  key: string;
  [field: string]: unknown;
}

export interface TablePageFilter {
  /** 筛选字段名 */
  field: string;
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export interface TablePageBlockProps<T extends TablePageRow = TablePageRow> {
  title?: React.ReactNode;
  /** 搜索框占位（有值时渲染搜索框） */
  searchPlaceholder?: string;
  /** 下拉筛选器组 */
  filters?: TablePageFilter[];
  /** 工具栏右侧操作按钮 */
  actions?: React.ReactNode;
  columns: TableColumn<T>[];
  data: T[];
  /** 总条数（分页用）；默认取 data.length */
  total?: number;
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (keyword: string) => void;
  onFilterChange?: (field: string, value: string) => void;
  /** 行选择（不传则不渲染选择列） */
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  rowActions?: (row: T) => React.ReactNode;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; toolbar?: string; table?: string; footer?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_COLUMNS: TableColumn<TablePageRow>[] = [
  { key: 'name', title: '商品名称', width: 220 },
  { key: 'sku', title: 'SKU', width: 130 },
  {
    key: 'status',
    title: '状态',
    width: 110,
    render: (row) => {
      const status = String(row.status);
      const map: Record<
        string,
        { color: 'success' | 'warning' | 'neutral' | 'error'; text: string }
      > = {
        onSale: { color: 'success', text: '在售' },
        draft: { color: 'neutral', text: '草稿' },
        lowStock: { color: 'warning', text: '缺货' },
        offShelf: { color: 'error', text: '已下架' },
      };
      const item = map[status] ?? { color: 'neutral' as const, text: status };
      return <Tag color={item.color}>{item.text}</Tag>;
    },
  },
  { key: 'price', title: '单价', align: 'right', width: 110 },
  { key: 'stock', title: '库存', align: 'right', width: 100 },
  { key: 'updatedAt', title: '更新时间', width: 160 },
];

export const DEMO_DATA: TablePageRow[] = [
  {
    key: '1',
    name: '无线蓝牙耳机 Pro',
    sku: 'SKU-1001',
    status: 'onSale',
    price: '¥ 399',
    stock: 1280,
    updatedAt: '2026-11-03 14:22',
  },
  {
    key: '2',
    name: '便携式咖啡机',
    sku: 'SKU-1002',
    status: 'lowStock',
    price: '¥ 659',
    stock: 12,
    updatedAt: '2026-11-03 11:05',
  },
  {
    key: '3',
    name: '人体工学椅 旗舰款',
    sku: 'SKU-1003',
    status: 'onSale',
    price: '¥ 1,899',
    stock: 342,
    updatedAt: '2026-11-02 18:47',
  },
  {
    key: '4',
    name: '智能台灯 2S',
    sku: 'SKU-1004',
    status: 'draft',
    price: '¥ 259',
    stock: 0,
    updatedAt: '2026-11-02 09:30',
  },
  {
    key: '5',
    name: '机械键盘 87 键',
    sku: 'SKU-1005',
    status: 'offShelf',
    price: '¥ 499',
    stock: 76,
    updatedAt: '2026-11-01 16:12',
  },
  {
    key: '6',
    name: '4K 显示器 27 英寸',
    sku: 'SKU-1006',
    status: 'onSale',
    price: '¥ 2,299',
    stock: 519,
    updatedAt: '2026-11-01 10:08',
  },
  {
    key: '7',
    name: '移动固态硬盘 1TB',
    sku: 'SKU-1007',
    status: 'onSale',
    price: '¥ 729',
    stock: 886,
    updatedAt: '2026-10-31 15:55',
  },
  {
    key: '8',
    name: '桌面支架 铝合金',
    sku: 'SKU-1008',
    status: 'lowStock',
    price: '¥ 159',
    stock: 8,
    updatedAt: '2026-10-31 09:20',
  },
];

export const DEMO_FILTERS: TablePageFilter[] = [
  {
    field: 'status',
    label: '状态',
    options: [
      { value: 'onSale', label: '在售' },
      { value: 'draft', label: '草稿' },
      { value: 'lowStock', label: '缺货' },
      { value: 'offShelf', label: '已下架' },
    ],
  },
  {
    field: 'category',
    label: '分类',
    options: [
      { value: 'digital', label: '数码' },
      { value: 'home', label: '家居' },
      { value: 'office', label: '办公' },
    ],
    placeholder: '全部分类',
  },
];

/* ---------------------------------- 区块 ---------------------------------- */

/** 表格页区块：工具栏（搜索/筛选/操作）+ 表格 + 分页，典型 CRUD 列表页 */
export function TablePageBlock<T extends TablePageRow = TablePageRow>({
  title = '数据列表',
  searchPlaceholder = '搜索名称 / SKU',
  filters = [],
  actions,
  columns,
  data,
  total,
  pageSize = 8,
  page,
  onPageChange,
  onSearch,
  onFilterChange,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  rowActions,
  loading = false,
  className,
  style,
  classNames,
}: TablePageBlockProps<T>) {
  const [keyword, setKeyword] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>(selectedKeys ?? []);
  const effectiveSelected = selectedKeys ?? selected;
  const setEffectiveSelected = (next: string[]) => {
    if (selectedKeys === undefined) setSelected(next);
    onSelectionChange?.(next);
  };

  const rows = data;
  const allKeys = rows.map((row) => row.key);
  const allChecked = allKeys.length > 0 && allKeys.every((k) => effectiveSelected.includes(k));
  const someChecked = !allChecked && allKeys.some((k) => effectiveSelected.includes(k));

  const toggleAll = (checked: boolean) => {
    const pageKeySet = new Set(allKeys);
    if (checked) {
      const next = [...effectiveSelected];
      for (const key of allKeys) {
        if (!next.includes(key)) next.push(key);
      }
      setEffectiveSelected(next);
      return;
    }
    setEffectiveSelected(effectiveSelected.filter((key) => !pageKeySet.has(key)));
  };

  const toggleRow = (key: string, checked: boolean) => {
    setEffectiveSelected(
      checked ? [...effectiveSelected, key] : effectiveSelected.filter((k) => k !== key)
    );
  };

  return (
    <div
      data-part="root"
      className={className}
      style={{
        padding: 'clamp(var(--z-space-3), 3vw, var(--z-space-6))',
        background: 'var(--z-color-bg-muted)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--z-space-4)',
        ...style,
      }}
    >
      <Card className={classNames?.root}>
        {/* 工具栏 */}
        <div
          data-part="toolbar"
          className={classNames?.toolbar}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--z-space-4)',
            flexWrap: 'wrap',
            marginBottom: 'var(--z-space-4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--z-space-3)',
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--z-text-lg)',
                fontWeight: 'var(--z-weight-semibold)',
                color: 'var(--z-color-fg)',
              }}
            >
              {title}
            </h2>
            {searchPlaceholder != null ? (
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSearch?.(keyword);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                style={{ width: 220, maxWidth: '100%' }}
              />
            ) : null}
            {filters.map((filter) => (
              <span key={filter.field} style={{ display: 'inline-block', width: 140 }}>
                <Select
                  options={filter.options}
                  placeholder={filter.placeholder ?? `全部${filter.label ?? ''}`}
                  aria-label={filter.label ?? filter.field}
                  onChange={(value) => onFilterChange?.(filter.field, value)}
                />
              </span>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--z-space-3)',
              flexWrap: 'wrap',
            }}
          >
            {effectiveSelected.length > 0 ? (
              <span style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg-muted)' }}>
                已选 {effectiveSelected.length} 项
              </span>
            ) : null}
            {actions ?? (
              <>
                <Button variant="outline">批量导出</Button>
                <Button iconStart={<span aria-hidden="true">＋</span>}>新建</Button>
              </>
            )}
          </div>
        </div>

        {/* 表格 */}
        <div
          className={classNames?.table}
          style={{
            opacity: loading ? 0.6 : 1,
            overflowX: 'auto',
            transition: 'opacity var(--z-duration-fast) var(--z-ease-standard)',
          }}
          aria-busy={loading || undefined}
        >
          <Table>
            <TableHead>
              <TableRow>
                {selectable ? (
                  <TableHeaderCell style={{ width: 44 }}>
                    <Checkbox
                      aria-label="全选"
                      checked={allChecked}
                      indeterminate={someChecked}
                      onChange={toggleAll}
                    />
                  </TableHeaderCell>
                ) : null}
                {columns.map((col) => (
                  <TableHeaderCell key={col.key} align={col.align} style={{ width: col.width }}>
                    {col.title}
                  </TableHeaderCell>
                ))}
                {rowActions != null ? (
                  <TableHeaderCell align="right" style={{ width: 120 }}>
                    操作
                  </TableHeaderCell>
                ) : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    align="center"
                    colSpan={columns.length + (selectable ? 1 : 0) + (rowActions != null ? 1 : 0)}
                    style={{ padding: 'var(--z-space-9)', color: 'var(--z-color-fg-subtle)' }}
                  >
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => (
                  <TableRow key={row.key} selected={effectiveSelected.includes(row.key)}>
                    {selectable ? (
                      <TableCell>
                        <Checkbox
                          aria-label={`选择第 ${index + 1} 行`}
                          checked={effectiveSelected.includes(row.key)}
                          onChange={(checked) => toggleRow(row.key, checked)}
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((col) => (
                      <TableCell key={col.key} align={col.align}>
                        {col.render ? col.render(row, index) : String(row[col.key] ?? '')}
                      </TableCell>
                    ))}
                    {rowActions != null ? (
                      <TableCell align="right">{rowActions(row)}</TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div
          data-part="footer"
          className={classNames?.footer}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'var(--z-space-4)',
            flexWrap: 'wrap',
            gap: 'var(--z-space-3)',
          }}
        >
          <span style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg-muted)' }}>
            共 {total ?? data.length} 条记录
          </span>
          <Pagination
            total={total ?? data.length}
            pageSize={pageSize}
            page={page}
            onPageChange={onPageChange}
            showJumper
          />
        </div>
      </Card>
    </div>
  );
}

export default TablePageBlock;
