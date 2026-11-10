import { useState } from 'react';
import { ArrowUpRight, Search, Zap } from '@zui/icons';
import { usePageTitle } from '../../components/usePageTitle';
import { MetricBoard, QueryBuilder } from './InsightDemos';
import { DiffViewer, FileWorkbench } from './CollaborationDemos';
import { AccessControl, ActivityInbox, ApprovalFlow, TaskBoard } from './TeamDemos';
import { SchedulePicker, StyleConfigurator } from './CreationDemos';
import { CATEGORIES, type LabCategory } from './shared';
import './lab.css';

const DESIGNS = [
  { name: 'MetricBoard 指标卡 趋势', category: 'insight', Component: MetricBoard },
  { name: 'QueryBuilder 条件构建器 筛选', category: 'insight', Component: QueryBuilder },
  {
    name: 'FileWorkbench 文件工作台 搜索 预览 归档',
    category: 'collaboration',
    Component: FileWorkbench,
  },
  { name: 'DiffViewer 版本对比 差异', category: 'collaboration', Component: DiffViewer },
  { name: 'TaskBoard 任务看板 项目', category: 'team', Component: TaskBoard },
  { name: 'ApprovalFlow 审批流程', category: 'team', Component: ApprovalFlow },
  { name: 'ActivityInbox 通知中心 动态', category: 'team', Component: ActivityInbox },
  { name: 'AccessControl 权限面板 成员 角色', category: 'team', Component: AccessControl },
  { name: 'SchedulePicker 时段预约 日程', category: 'creation', Component: SchedulePicker },
  { name: 'StyleConfigurator 样式配置器 主题', category: 'creation', Component: StyleConfigurator },
] satisfies { name: string; category: LabCategory; Component: React.ComponentType }[];

export default function LabPage() {
  usePageTitle('组件创意工坊');
  const [category, setCategory] = useState<LabCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const matches = (design: (typeof DESIGNS)[number]) =>
    (category === 'all' || category === design.category) &&
    design.name.toLowerCase().includes(query.trim().toLowerCase());
  const count = DESIGNS.filter(matches).length;
  return (
    <div className="doc-page ui-lab">
      <div className="lab-eyebrow">
        <Zap aria-hidden="true" />
        ZUI DESIGN LAB<span>交互设计原型</span>
      </div>
      <h1 className="doc-h1">
        好看，也好用。
        <br />
        <span>让界面多一些可能。</span>
      </h1>
      <div className="lab-intro">
        <p>
          从一个清楚的指标，到一段顺畅的协作。
          <br />
          10 个可以亲手探索的设计，把实用功能放进有温度的界面。
        </p>
        <a href="#/collaboration">
          探索内容协作实验室
          <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
      <div className="lab-catalog-bar">
        <div className="lab-category-filters" role="group" aria-label="设计分组">
          <button
            type="button"
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            全部设计<span>10</span>
          </button>
          {(Object.entries(CATEGORIES) as [LabCategory, string][]).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {label}
              <span>{DESIGNS.filter((design) => design.category === value).length}</span>
            </button>
          ))}
        </div>
        <label className="lab-search lab-catalog-search">
          <Search aria-hidden="true" />
          <input
            aria-label="搜索设计"
            placeholder="搜索设计或功能…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="lab-catalog-caption">
        <span role="status">{count} 个交互设计</span>
        <span>演示数据 · 状态在刷新后重置</span>
      </div>
      <div className="lab-gallery">
        {DESIGNS.map(({ Component, ...design }) => (
          <div
            className="lab-gallery-item"
            key={design.name}
            hidden={!matches({ Component, ...design })}
          >
            <Component />
          </div>
        ))}
      </div>
      {count === 0 && (
        <div className="lab-no-designs">
          <Search aria-hidden="true" />
          <p>没有匹配的设计，换个关键词试试。</p>
          <button
            type="button"
            className="lab-text-button"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
          >
            查看全部设计
          </button>
        </div>
      )}
      <aside className="lab-endnote">
        <strong>从设计原型，走向正式组件。</strong>
        <p>
          本页展示可交互的组合方案。正式组件的
          API、异步数据与权限接入将在独立实现中完善；文件预览、编辑与评论可在内容协作实验室继续体验。
        </p>
      </aside>
    </div>
  );
}
