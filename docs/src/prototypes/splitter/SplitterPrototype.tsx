import { useEffect, useRef, useState } from 'react';
import { Splitter } from '@zui/react';
import type { SplitterResizeEndDetails, SplitterSizesChangeDetails } from '@zui/react';
import { usePageTitle } from '../../components/usePageTitle';
import { SPLITTER_DETAIL_ROUTE, SPLITTER_IDE_ROUTE, type SplitterPrototypeVariant } from './routes';
import './SplitterPrototype.css';

interface SplitterPrototypeProps {
  variant: SplitterPrototypeVariant;
}

type Direction = 'ltr' | 'rtl';

function rounded(values: readonly number[]): string {
  return values.map((value) => value.toFixed(1)).join(' / ');
}

function PrototypeHeader({
  variant,
  dark,
  direction,
  onThemeChange,
  onDirectionChange,
}: {
  variant: SplitterPrototypeVariant;
  dark: boolean;
  direction: Direction;
  onThemeChange: () => void;
  onDirectionChange: () => void;
}) {
  return (
    <header className="splitter-prototype-header">
      <div>
        <p className="splitter-prototype-eyebrow">Splitter RFC-003 · 隐藏迁移原型</p>
        <h1>{variant === 'ide' ? 'IDE 三栏工作区' : '客户主从详情'}</h1>
      </div>
      <div className="splitter-prototype-header-actions">
        <nav aria-label="Splitter 原型切换">
          <a href={`#${SPLITTER_IDE_ROUTE}`} aria-current={variant === 'ide' ? 'page' : undefined}>
            IDE
          </a>
          <a
            href={`#${SPLITTER_DETAIL_ROUTE}`}
            aria-current={variant === 'detail' ? 'page' : undefined}
          >
            主从详情
          </a>
        </nav>
        <button type="button" onClick={onThemeChange} aria-pressed={dark}>
          {dark ? '使用浅色' : '使用暗色'}
        </button>
        <button type="button" onClick={onDirectionChange} aria-pressed={direction === 'rtl'}>
          {direction === 'rtl' ? '使用 LTR' : '使用 RTL'}
        </button>
      </div>
    </header>
  );
}

function EventSummary({ event }: { event: string }) {
  return (
    <output className="splitter-prototype-event" aria-live="polite" data-testid="splitter-event">
      {event}
    </output>
  );
}

function IdePrototype() {
  const [sizes, setSizes] = useState([22, 48, 30]);
  const [rejectChanges, setRejectChanges] = useState(false);
  const [zeroMeasure, setZeroMeasure] = useState(false);
  const [event, setEvent] = useState('等待调整');
  const [resizeEndCount, setResizeEndCount] = useState(0);

  const reportChange = (next: number[], details: SplitterSizesChangeDetails) => {
    setEvent(`${details.reason} 请求 ${rounded(next)}${rejectChanges ? '（受控父级拒绝）' : ''}`);
    if (!rejectChanges) setSizes(next);
  };

  const reportEnd = (actual: number[], details: SplitterResizeEndDetails) => {
    setResizeEndCount((count) => count + 1);
    setEvent(
      `${details.input} ${details.cancelled ? '取消' : '提交'}：实际 ${rounded(actual)}；请求 ${rounded(details.requestedSizes)}`
    );
  };

  return (
    <main className="splitter-prototype-main splitter-prototype-main--ide">
      <div className="splitter-prototype-toolbar" aria-label="IDE 原型控制">
        <label>
          <input
            type="checkbox"
            checked={rejectChanges}
            onChange={(changeEvent) => setRejectChanges(changeEvent.target.checked)}
          />
          拒绝受控尺寸更新
        </label>
        <label>
          <input
            type="checkbox"
            checked={zeroMeasure}
            onChange={(changeEvent) => setZeroMeasure(changeEvent.target.checked)}
          />
          模拟零可用宽度
        </label>
        <button
          type="button"
          onClick={() => {
            setSizes([22, 48, 30]);
            setEvent('已恢复默认布局');
          }}
        >
          恢复布局
        </button>
        <span data-testid="splitter-sizes">Panel：{rounded(sizes)}</span>
        <span data-testid="resize-end-count">结束回调：{resizeEndCount}</span>
        <EventSummary event={event} />
      </div>

      <div
        className="splitter-prototype-stage"
        data-zero-measure={zeroMeasure ? 'true' : 'false'}
        data-testid="ide-stage"
      >
        <Splitter
          aria-label="IDE 工作区"
          sizes={sizes}
          onSizesChange={reportChange}
          onResizeEnd={reportEnd}
          handleProps={({ index }) =>
            index === 0
              ? { 'aria-label': '调整文件树与编辑器', collapseTarget: 'before' }
              : { 'aria-label': '调整编辑器与预览' }
          }
          data-testid="ide-splitter"
        >
          <Splitter.Panel
            key="files"
            label="文件树"
            minSize={12}
            maxSize={40}
            collapsible
            collapsedSize={0}
          >
            <aside className="splitter-prototype-pane splitter-prototype-files">
              <h2>资源管理器</h2>
              <button type="button">src</button>
              <button type="button">components</button>
              <button type="button" className="is-active">
                Dashboard.tsx
              </button>
              <button type="button">tokens.css</button>
            </aside>
          </Splitter.Panel>
          <Splitter.Panel key="editor" label="编辑器" minSize={28}>
            <section className="splitter-prototype-pane splitter-prototype-editor">
              <div className="splitter-prototype-tab">Dashboard.tsx</div>
              <pre aria-label="示例代码">
                <code>{`export function Dashboard() {\n  return <Workspace />;\n}`}</code>
              </pre>
              <label>
                跳转到行
                <input type="number" defaultValue={18} min={1} />
              </label>
            </section>
          </Splitter.Panel>
          <Splitter.Panel key="preview" label="预览" minSize={18} maxSize={50}>
            <section className="splitter-prototype-pane splitter-prototype-preview">
              <h2>实时预览</h2>
              <article>
                <strong>本月收入</strong>
                <span>¥ 286,400</span>
                <small>较上月增长 12.8%</small>
              </article>
              <button type="button">刷新预览</button>
            </section>
          </Splitter.Panel>
        </Splitter>
      </div>
    </main>
  );
}

function DetailPrototype() {
  const [collapsed, setCollapsed] = useState(false);
  const [event, setEvent] = useState('等待调整');
  const detailsButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <main className="splitter-prototype-main splitter-prototype-main--detail">
      <div className="splitter-prototype-toolbar" aria-label="主从详情原型控制">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-pressed={collapsed}
        >
          {collapsed ? '展开客户详情' : '外部折叠客户详情'}
        </button>
        <span>在详情按钮聚焦时外部折叠，用于验证焦点回退。</span>
        <EventSummary event={event} />
      </div>

      <div className="splitter-prototype-stage" data-testid="detail-stage">
        <Splitter
          aria-label="客户主从详情"
          defaultSizes={[38, 62]}
          onSizesChange={(next, details) => setEvent(`${details.reason} 请求 ${rounded(next)}`)}
          onResizeEnd={(actual, details) =>
            setEvent(
              `${details.input} ${details.cancelled ? '取消' : '提交'}：实际 ${rounded(actual)}`
            )
          }
          handleProps={() => ({
            'aria-label': '调整客户列表与客户详情',
            collapseTarget: 'after',
          })}
          data-testid="detail-splitter"
        >
          <Splitter.Panel key="customers" label="客户列表" minSize={28}>
            <section className="splitter-prototype-pane splitter-prototype-master">
              <label className="splitter-prototype-search">
                搜索客户
                <input type="search" defaultValue="星河" />
              </label>
              <button type="button" className="is-active">
                <strong>星河科技</strong>
                <span>企业版 · 华东区</span>
              </button>
              <button type="button">
                <strong>远景制造</strong>
                <span>标准版 · 华南区</span>
              </button>
              <button type="button">
                <strong>山岚零售</strong>
                <span>企业版 · 西南区</span>
              </button>
            </section>
          </Splitter.Panel>
          <Splitter.Panel
            key="customer-details"
            label="客户详情"
            minSize={36}
            collapsible
            collapsedSize={0}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
          >
            <section className="splitter-prototype-pane splitter-prototype-detail">
              <div>
                <p className="splitter-prototype-eyebrow">客户详情</p>
                <h2>星河科技（上海）有限公司的跨区域协作与权限配置</h2>
                <p>企业版 · 148 位成员 · 合同续期 2027-03-31</p>
              </div>
              <div className="splitter-prototype-detail-grid">
                <label>
                  客户负责人
                  <input defaultValue="林晓" />
                </label>
                <label>
                  服务区域
                  <select defaultValue="east">
                    <option value="east">华东区</option>
                    <option value="south">华南区</option>
                  </select>
                </label>
              </div>
              <textarea
                aria-label="跟进备注"
                defaultValue="安排数据迁移演练，并确认跨区域审批规则。"
              />
              <div className="splitter-prototype-detail-actions">
                <button ref={detailsButtonRef} type="button">
                  保存客户详情
                </button>
                <button type="button">发起续约评审</button>
              </div>
            </section>
          </Splitter.Panel>
        </Splitter>
      </div>
    </main>
  );
}

export default function SplitterPrototype({ variant }: SplitterPrototypeProps) {
  usePageTitle(variant === 'ide' ? 'Splitter IDE 三栏原型' : 'Splitter 主从详情原型');
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const [direction, setDirection] = useState<Direction>('ltr');

  useEffect(() => {
    document.documentElement.dir = direction;
    return () => {
      document.documentElement.removeAttribute('dir');
    };
  }, [direction]);

  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
  };

  return (
    <div className="splitter-prototype" data-prototype={variant} dir={direction}>
      <PrototypeHeader
        variant={variant}
        dark={dark}
        direction={direction}
        onThemeChange={toggleTheme}
        onDirectionChange={() => setDirection((value) => (value === 'ltr' ? 'rtl' : 'ltr'))}
      />
      {variant === 'ide' ? <IdePrototype /> : <DetailPrototype />}
    </div>
  );
}
