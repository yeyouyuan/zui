import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Database, Filter, Plus, Close } from '@zui/icons';
import { Choices, LabCard, Notice } from './shared';

const PERIODS = {
  week: {
    label: '本周',
    value: '24,860',
    growth: '+18.6%',
    bars: [2640, 3280, 2920, 4160, 3680, 4380, 3800],
    labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
  month: {
    label: '本月',
    value: '98,420',
    growth: '+24.2%',
    bars: [20200, 24580, 28780, 24860],
    labels: ['第1周', '第2周', '第3周', '第4周'],
  },
} as const;

export function MetricBoard() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [selected, setSelected] = useState<number | null>(null);
  const data = PERIODS[period];
  return (
    <LabCard
      number="01"
      name="MetricBoard"
      title="把趋势变成下一步"
      description="可探索的指标卡，让总览、趋势和明细留在同一张画布里。"
      category="insight"
      icon={Database}
      features={['周期切换', '键盘探索', '数值明细']}
    >
      <div className="lab-toolbar">
        <span className="lab-overline">工作空间访问量</span>
        <Choices
          label="指标周期"
          value={period}
          items={[
            { value: 'week', label: '本周' },
            { value: 'month', label: '本月' },
          ]}
          onChange={(next) => {
            setPeriod(next);
            setSelected(null);
          }}
        />
      </div>
      <div className="lab-metric-value">
        <strong>{data.value}</strong>
        <span className="lab-trend">
          <ArrowUpRight />
          {data.growth}
        </span>
      </div>
      <p className="lab-muted lab-small">与上一{period === 'week' ? '周' : '月'}相比 · 示例数据</p>
      <div className="lab-bars" role="group" aria-label="访问趋势明细">
        {data.bars.map((bar, index) => (
          <button
            type="button"
            key={`${period}-${index}`}
            aria-pressed={selected === index}
            aria-label={`${data.labels[index]}，${bar} 次访问`}
            onClick={() => setSelected(index)}
          >
            <span className="lab-bar-track">
              <span
                className="lab-bar-fill"
                style={{ height: `${(bar / Math.max(...data.bars)) * 100}%` }}
              />
            </span>
            <span>{data.labels[index]}</span>
          </button>
        ))}
      </div>
      <div className="lab-metric-bottom">
        <div>
          <span className="lab-dot" />
          自然访问 <strong>68%</strong>
        </div>
        <div>
          <span className="lab-dot lab-dot-soft" />
          团队分享 <strong>32%</strong>
        </div>
      </div>
      <Notice>
        {selected === null
          ? '点击柱条查看每个时段的访问量。'
          : `${data.labels[selected]}：${data.bars[selected]} 次访问`}
      </Notice>
    </LabCard>
  );
}

type Field = 'team' | 'status' | 'priority';
const FIELDS: Record<Field, { label: string; values: string[] }> = {
  team: { label: '所属团队', values: ['设计', '研发', '产品'] },
  status: { label: '任务状态', values: ['进行中', '待开始', '已完成'] },
  priority: { label: '优先级', values: ['高', '普通'] },
};
const RECORDS = [
  { name: '组件交互规范', team: '设计', status: '进行中', priority: '高' },
  { name: '文件预览适配', team: '研发', status: '进行中', priority: '高' },
  { name: '工作台布局', team: '设计', status: '已完成', priority: '普通' },
  { name: '迭代需求梳理', team: '产品', status: '待开始', priority: '普通' },
  { name: '暗色主题验收', team: '研发', status: '待开始', priority: '高' },
];
interface Rule {
  id: number;
  field: Field;
  operator: 'is' | 'not';
  value: string;
}

export function QueryBuilder() {
  const nextId = useRef(2);
  const [rules, setRules] = useState<Rule[]>([
    { id: 1, field: 'team', operator: 'is', value: '设计' },
  ]);
  const [mode, setMode] = useState<'all' | 'any'>('all');
  const [message, setMessage] = useState('条件会即时应用到下方任务。');
  const addRef = useRef<HTMLButtonElement>(null);
  const restoreAddFocus = useRef(false);
  useLayoutEffect(() => {
    if (!restoreAddFocus.current) return;
    addRef.current?.focus({ preventScroll: true });
    restoreAddFocus.current = false;
  }, [rules]);
  const matches = RECORDS.filter((record) => {
    const results = rules.map((rule) =>
      rule.operator === 'is' ? record[rule.field] === rule.value : record[rule.field] !== rule.value
    );
    return rules.length === 0 || (mode === 'all' ? results.every(Boolean) : results.some(Boolean));
  });
  const update = (id: number, change: Partial<Rule>) =>
    setRules((items) => items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  return (
    <LabCard
      number="02"
      name="QueryBuilder"
      title="复杂条件，清楚表达"
      description="用可读规则组合筛选条件，实时看到每一次调整的结果。"
      category="insight"
      icon={Filter}
      features={['AND / OR', '规则增删', '即时筛选']}
    >
      <div className="lab-toolbar">
        <span className="lab-overline">满足以下条件</span>
        <Choices
          label="条件组合方式"
          value={mode}
          items={[
            { value: 'all', label: '全部 AND' },
            { value: 'any', label: '任一 OR' },
          ]}
          onChange={setMode}
        />
      </div>
      <div className="lab-rules">
        {rules.map((rule, index) => (
          <div className="lab-rule" key={rule.id}>
            <span className="lab-rule-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <select
              aria-label={`条件 ${index + 1} 字段`}
              value={rule.field}
              onChange={(event) => {
                const field = event.target.value as Field;
                update(rule.id, { field, value: FIELDS[field].values[0] });
              }}
            >
              {Object.entries(FIELDS).map(([value, field]) => (
                <option key={value} value={value}>
                  {field.label}
                </option>
              ))}
            </select>
            <select
              aria-label={`条件 ${index + 1} 运算符`}
              value={rule.operator}
              onChange={(event) =>
                update(rule.id, { operator: event.target.value as Rule['operator'] })
              }
            >
              <option value="is">等于</option>
              <option value="not">不等于</option>
            </select>
            <select
              aria-label={`条件 ${index + 1} 值`}
              value={rule.value}
              onChange={(event) => update(rule.id, { value: event.target.value })}
            >
              {FIELDS[rule.field].values.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button
              type="button"
              className="lab-icon-button"
              aria-label={`删除条件 ${index + 1}`}
              onClick={() => {
                restoreAddFocus.current = true;
                setRules((items) => items.filter((item) => item.id !== rule.id));
              }}
            >
              <Close />
            </button>
          </div>
        ))}
      </div>
      <button
        ref={addRef}
        type="button"
        className="lab-text-button"
        disabled={rules.length >= 4}
        onClick={() => {
          setRules((items) => [
            ...items,
            { id: nextId.current++, field: 'status', operator: 'is', value: '进行中' },
          ]);
          setMessage('已增加条件，可选择字段、运算符和值。');
        }}
      >
        <Plus />
        添加条件 {rules.length}/4
      </button>
      <div className="lab-results">
        <div className="lab-toolbar">
          <strong>匹配任务</strong>
          <span className="lab-count">{matches.length}</span>
        </div>
        {matches.length ? (
          matches.map((record) => (
            <div key={record.name} className="lab-result-row">
              <span>{record.name}</span>
              <span className="lab-pill">
                {record.team} · {record.status}
              </span>
            </div>
          ))
        ) : (
          <p className="lab-empty">没有任务符合当前条件。</p>
        )}
      </div>
      <Notice>{message}</Notice>
    </LabCard>
  );
}
