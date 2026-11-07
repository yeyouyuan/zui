'use client';

import * as React from 'react';
import { Button, Empty, Input, List, Tabs, TabsList, TabsTrigger, useControllableState } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export interface SearchResultType {
  value: string;
  label: string;
}

export interface SearchResultItem {
  key: string;
  title: string;
  /** 摘要描述 */
  description?: React.ReactNode;
  /** 所属类型（对应 type.value） */
  type: string;
  /** 右侧附加内容（如时间、来源） */
  extra?: React.ReactNode;
  /** 点击跳转地址（渲染为链接 href） */
  href?: string;
}

export interface SearchResultBlockProps {
  title?: React.ReactNode;
  /** 搜索关键词（受控）；不传走非受控 */
  keyword?: string;
  defaultKeyword?: string;
  onKeywordChange?: (keyword: string) => void;
  /** 搜索占位文案 */
  searchPlaceholder?: string;
  /** 当前类型 Tab（受控）；不传走非受控 */
  type?: string;
  defaultType?: string;
  onTypeChange?: (type: string) => void;
  /** 类型 Tab 定义；空数组则不渲染 Tabs */
  types?: SearchResultType[];
  /** 结果数据（全部量，区块内按 keyword + type 过滤） */
  results?: SearchResultItem[];
  /** 按下回车或点击搜索按钮 */
  onSearch?: (keyword: string) => void;
  /** 结果点击回调 */
  onResultClick?: (item: SearchResultItem) => void;
  /** 无结果文案 */
  emptyText?: string;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; toolbar?: string; body?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_SEARCH_TYPES: SearchResultType[] = [
  { value: 'all', label: '全部' },
  { value: 'doc', label: '文档' },
  { value: 'product', label: '产品' },
  { value: 'issue', label: '工单' },
];

export const DEMO_SEARCH_RESULTS: SearchResultItem[] = [
  {
    key: 'r1',
    title: 'ZUI 设计系统接入指南',
    description: '介绍如何在前端项目中接入 ZUI 组件库、令牌与图标体系。',
    type: 'doc',
    extra: '2026-10-28',
    href: '#doc-1',
  },
  {
    key: 'r2',
    title: '数据大屏区块使用说明',
    description: 'Statistic 卡行 + CSS 柱状图 + Progress 指标的深色大屏区块。',
    type: 'doc',
    extra: '2026-11-02',
    href: '#doc-2',
  },
  {
    key: 'r3',
    title: '智能数据大屏 Pro',
    description: '面向运营团队的实时数据可视化产品，支持多端投放。',
    type: 'product',
    extra: '上架中',
  },
  {
    key: 'r4',
    title: '大屏图表导出图片失败',
    description: '工单 #20261104-118：客户反馈柱状图导出 PNG 为空白。',
    type: 'issue',
    extra: '处理中',
  },
  {
    key: 'r5',
    title: '看板任务卡片拖拽优化',
    description: '工单 #20261030-066：希望支持跨列拖拽与键盘操作。',
    type: 'issue',
    extra: '已排期',
  },
];

/* ---------------------------------- 区块 ---------------------------------- */

/** 搜索结果页区块：Input 搜索 + Tabs 类型切换 + List 结果 + Empty 无结果（客户端过滤演示） */
export function SearchResultBlock({
  title = '搜索结果',
  keyword,
  defaultKeyword = '',
  onKeywordChange,
  searchPlaceholder = '搜索文档 / 产品 / 工单',
  type,
  defaultType = 'all',
  onTypeChange,
  types = DEMO_SEARCH_TYPES,
  results = DEMO_SEARCH_RESULTS,
  onSearch,
  onResultClick,
  emptyText = '未找到相关结果',
  className,
  style,
  classNames,
}: SearchResultBlockProps) {
  const [currentKeyword, setCurrentKeyword] = useControllableState<string>({
    value: keyword,
    defaultValue: defaultKeyword,
    onChange: onKeywordChange,
  });
  const [currentType, setCurrentType] = useControllableState<string>({
    value: type,
    defaultValue: defaultType,
    onChange: onTypeChange,
  });

  const trimmed = currentKeyword.trim();
  const filtered = results.filter((item) => {
    const matchType = currentType === 'all' || item.type === currentType;
    const matchKeyword = trimmed === '' || item.title.toLowerCase().includes(trimmed.toLowerCase());
    return matchType && matchKeyword;
  });

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
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
      {/* 搜索工具栏 */}
      <div
        data-part="toolbar"
        className={classNames?.toolbar}
        style={{
          background: 'var(--z-color-bg-elevated)',
          border: '1px solid var(--z-color-border-subtle)',
          borderRadius: 'var(--z-radius-lg)',
          padding: 'var(--z-space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--z-space-4)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'var(--z-text-xl)', fontWeight: 'var(--z-weight-semibold)', color: 'var(--z-color-fg)' }}>
          {title}
        </h1>
        <div style={{ display: 'flex', gap: 'var(--z-space-3)', maxWidth: 640 }}>
          <Input
            type="search"
            value={currentKeyword}
            onChange={(e) => setCurrentKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch?.(currentKeyword);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            clearable
            onClear={() => setCurrentKeyword('')}
            style={{ flex: 1 }}
          />
          <Button onClick={() => onSearch?.(currentKeyword)}>搜索</Button>
        </div>
        {types.length > 0 ? (
          <Tabs value={currentType} onValueChange={setCurrentType}>
            <TabsList aria-label="结果类型">
              {types.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      {/* 结果区 */}
      <div data-part="body" className={classNames?.body}>
        {filtered.length === 0 ? (
          <Empty
            description={emptyText}
            style={{ background: 'var(--z-color-bg-elevated)', border: '1px solid var(--z-color-border-subtle)', borderRadius: 'var(--z-radius-lg)' }}
          >
            <Button
              variant="outline"
              onClick={() => {
                setCurrentKeyword('');
                setCurrentType('all');
              }}
            >
              清除筛选
            </Button>
          </Empty>
        ) : (
          <List
            bordered
            items={filtered.map((item) => ({
              key: item.key,
              title: (
                <a
                  href={item.href ?? '#'}
                  onClick={(e) => {
                    if (item.href == null) e.preventDefault();
                    onResultClick?.(item);
                  }}
                  style={{ color: 'var(--z-color-link)', textDecoration: 'none' }}
                >
                  {item.title}
                </a>
              ),
              description: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--z-text-xs)', padding: '0 var(--z-space-2)', borderRadius: 'var(--z-radius-full)', border: '1px solid var(--z-color-border-subtle)', color: 'var(--z-color-fg-muted)' }}>
                    {types.find((t) => t.value === item.type)?.label ?? item.type}
                  </span>
                  {item.description}
                </span>
              ),
              extra: item.extra != null ? (
                <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-subtle)', whiteSpace: 'nowrap' }}>{item.extra}</span>
              ) : undefined,
            }))}
          />
        )}
      </div>
    </div>
  );
}

export default SearchResultBlock;
