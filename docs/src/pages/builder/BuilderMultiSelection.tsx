import { useState } from 'react';
import type { BuilderBreakpoint, BuilderStyles } from './builder-design';
import type { AlignSelection } from './builder-selection';

export function BuilderMultiSelection({
  count,
  breakpoint,
  onStyle,
  onGroup,
  onAlign,
  onDuplicate,
  onDelete,
  onClear,
}: {
  count: number;
  breakpoint: BuilderBreakpoint;
  onStyle: (patch: BuilderStyles) => void;
  onGroup: (layout: 'row' | 'column' | 'grid' | 'free') => void;
  onAlign: (operation: AlignSelection) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [property, setProperty] = useState<keyof BuilderStyles>('borderRadius');
  const [value, setValue] = useState('12');
  const numeric = [
    'gap',
    'borderRadius',
    'fontSize',
    'opacity',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
  ].includes(property);
  return (
    <div className="studio-multi-inspector">
      <div className="studio-inspector-heading">
        <span className="studio-panel-kicker">MULTI SELECT</span>
        <h2>已选择 {count} 个组件</h2>
        <p>Shift 点击画布或图层可增减选择。同次批量操作可以一次撤销。</p>
      </div>
      <section>
        <h3>组合与布局</h3>
        <div className="studio-batch-grid">
          {(
            [
              ['column', '纵向布局组'],
              ['row', '横向布局组'],
              ['grid', '等分网格组'],
              ['free', '转为自由布局组'],
            ] as const
          ).map(([layout, label]) => (
            <button type="button" key={layout} onClick={() => onGroup(layout)}>
              {label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>对齐与分布</h3>
        <p className="studio-inspector-hint">
          自由布局组内的同级绝对定位组件可按坐标对齐，常规布局使用上方自动布局。
        </p>
        <div className="studio-batch-grid">
          {(
            [
              ['left', '左对齐'],
              ['centerX', '水平居中'],
              ['right', '右对齐'],
              ['top', '顶对齐'],
              ['centerY', '垂直居中'],
              ['bottom', '底对齐'],
              ['distributeX', '水平等距分布'],
              ['distributeY', '垂直等距分布'],
            ] as const
          ).map(([operation, label]) => (
            <button
              type="button"
              key={operation}
              disabled={operation.startsWith('distribute') && count < 3}
              onClick={() => onAlign(operation)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>批量样式 · {{ desktop: '桌面', tablet: '平板', mobile: '手机' }[breakpoint]}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (numeric && (!value.trim() || !Number.isFinite(Number(value)))) return;
            onStyle({ [property]: numeric ? Number(value) : value });
          }}
        >
          <label className="studio-control">
            <span>样式属性</span>
            <select
              aria-label="批量样式属性"
              value={property}
              onChange={(event) => {
                const key = event.target.value as keyof BuilderStyles;
                setProperty(key);
                setValue(
                  key.toLowerCase().includes('color')
                    ? '#6051d6'
                    : key === 'width' || key === 'height'
                      ? '160px'
                      : key === 'opacity'
                        ? '1'
                        : '12'
                );
              }}
            >
              {[
                ['borderRadius', '圆角'],
                ['backgroundColor', '背景色'],
                ['color', '文字色'],
                ['borderColor', '边框色'],
                ['width', '宽度'],
                ['height', '高度'],
                ['fontSize', '字号'],
                ['gap', '组件间距'],
                ['opacity', '不透明度'],
                ['paddingTop', '上内边距'],
                ['paddingRight', '右内边距'],
                ['paddingBottom', '下内边距'],
                ['paddingLeft', '左内边距'],
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="studio-control">
            <span>统一设置为</span>
            <input
              aria-label="批量样式值"
              type={
                numeric ? 'number' : property.toLowerCase().includes('color') ? 'color' : 'text'
              }
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <button type="submit" className="studio-secondary-button">
            应用到所选组件
          </button>
        </form>
      </section>
      <div className="studio-batch-grid">
        <button type="button" onClick={onDuplicate}>
          复制所选组件
        </button>
        <button type="button" className="studio-danger" onClick={onDelete}>
          删除所选组件
        </button>
        <button type="button" onClick={onClear}>
          取消多选
        </button>
      </div>
    </div>
  );
}
