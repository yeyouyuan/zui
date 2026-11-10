import { useState } from 'react';
import { auditBuilderDesign } from './builder-audit';
import { saveDownload, type BuilderData } from './builder-model';
import type { BuilderSymbol } from './builder-symbols';
export function BuilderAuditPanel({
  data,
  pages,
  symbols,
  onSelect,
}: {
  data: BuilderData;
  pages: { id: string; name: string }[];
  symbols: BuilderSymbol[];
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
  const issues = auditBuilderDesign(data, pages, symbols),
    errors = issues.filter((issue) => issue.severity === 'error').length;
  return (
    <div className="studio-design-audit">
      <div className="studio-audit-summary">
        <strong>{errors ? '设计仍有待修复项' : '未发现配置错误'}</strong>
        <p>
          <b>{errors}</b> 个错误 · {issues.length - errors} 个设计建议
        </p>
        <span>静态检查持续更新。实际视觉与可访问性仍需在各设备预览确认。</span>
      </div>
      <div role="group" aria-label="检查结果筛选" className="studio-segmented">
        {(
          [
            ['all', '全部'],
            ['error', '错误'],
            ['warning', '建议'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="studio-audit-items">
        {issues
          .filter((issue) => filter === 'all' || issue.severity === filter)
          .map((issue) => (
            <article className="studio-audit-issue" data-severity={issue.severity} key={issue.id}>
              <span>{issue.severity === 'error' ? '!' : 'i'}</span>
              <div>
                <strong>{issue.title}</strong>
                <p>{issue.detail}</p>
                {issue.nodeId && (
                  <button type="button" onClick={() => onSelect(issue.nodeId!)}>
                    定位组件 →
                  </button>
                )}
              </div>
            </article>
          ))}
      </div>
      {!issues.length && (
        <p className="studio-empty">本页配置已通过检查，可以继续检查交互与响应式表现。</p>
      )}
      <button
        type="button"
        className="studio-secondary-button"
        onClick={() =>
          saveDownload(
            JSON.stringify(
              {
                checkedAt: new Date().toISOString(),
                title: data.root.props?.title || '未命名页面',
                errors,
                issues,
              },
              null,
              2
            ),
            'ZUI-页面设计检查.json'
          )
        }
      >
        导出检查报告
      </button>
    </div>
  );
}
