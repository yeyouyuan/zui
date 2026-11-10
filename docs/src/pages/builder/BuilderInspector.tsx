import { useEffect, useId, useState, type ReactNode } from 'react';
import { Puck } from '@puckeditor/core';
import { Eye, EyeOff, Lock, Unlock, Copy, Trash, ArrowUp, ArrowDown, RotateCcw } from '@zui/icons';
import { useBuilderEditor } from './builder-editor-context';
import { builderConfig } from './builder-config';
import { flattenNodes, type BuilderNode } from './builder-tree';
import {
  breakpointLabels,
  effectiveStyles,
  styleSchema,
  validateDesign,
  type BuilderBreakpoint,
  type BuilderDesign,
  type BuilderNodeMeta,
  type BuilderStyles,
  type BuilderStateDesign,
  type BuilderInteractionState,
  interactionStateLabels,
  builderStyleKey,
} from './builder-design';
import type { BuilderData } from './builder-model';
import { BuilderCssField } from './BuilderCssField';
import { catalogDefinitions } from './builder-catalog-data';
import { BuilderLogicPanel, BuilderVariablesPanel } from './BuilderLogicPanel';

function NumericControl({
  label,
  ariaLabel,
  value,
  inherited,
  min = 0,
  max = 200,
  step = 1,
  onChange,
}: {
  label: string;
  ariaLabel?: string;
  value?: number | string;
  inherited?: number | string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value?: number) => void;
}) {
  const [draft, setDraft] = useState(typeof value === 'number' ? String(value) : '');
  useEffect(() => setDraft(typeof value === 'number' ? String(value) : ''), [value]);
  return (
    <label className="studio-control">
      <span>{label}</span>
      <input
        type="number"
        aria-label={ariaLabel}
        value={draft}
        min={min}
        max={max}
        step={step}
        placeholder={inherited === undefined ? '自动' : String(inherited)}
        data-inherited={value === undefined || undefined}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (!raw) onChange(undefined);
          else if (Number.isFinite(+raw) && +raw >= min && +raw <= max) onChange(+raw);
        }}
        onBlur={() => {
          if (draft && Number.isFinite(+draft)) {
            const next = Math.max(min, Math.min(max, +draft));
            setDraft(String(next));
            onChange(next);
          }
        }}
      />
      {typeof value === 'string' && <small className="studio-token-binding">{value}</small>}
    </label>
  );
}

function TextStyleControl({
  label,
  value,
  inherited,
  property,
  onChange,
  color = false,
}: {
  label: string;
  value?: string;
  inherited?: string;
  property: keyof BuilderStyles;
  onChange: (value?: string) => void;
  color?: boolean;
}) {
  const controlId = useId();
  const [draft, setDraft] = useState(value || '');
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(value || '');
    setError('');
  }, [value]);
  const valid = (text: string) => {
    try {
      validateDesign({ desktop: { [property]: text } });
      return true;
    } catch {
      return false;
    }
  };
  return (
    <div className="studio-control">
      <label htmlFor={controlId}>
        <span>{label}</span>
      </label>
      <span className="studio-color-control">
        {color && (
          <input
            type="color"
            aria-label={`${label}取色`}
            value={
              /^#[a-f\d]{6}$/i.test(draft || inherited || '') ? (draft || inherited)! : '#4f46e5'
            }
            onChange={(event) => {
              setDraft(event.target.value);
              onChange(event.target.value);
              setError('');
            }}
          />
        )}
        <input
          id={controlId}
          type="text"
          aria-label={label}
          value={draft}
          placeholder={inherited || (color ? '继承 / #FFFFFF' : '自动 / 100% / 320px')}
          aria-invalid={!!error}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            setError('');
            if (!text) onChange(undefined);
            else if (valid(text)) onChange(text);
          }}
          onBlur={() => {
            if (draft && !valid(draft)) {
              setError(
                color
                  ? '请输入十六进制颜色或 transparent。'
                  : '请输入此属性支持的 CSS 值，例如 100%、20rem 或 calc(100% - 24px)。'
              );
              setDraft(value || '');
            }
          }}
        />
      </span>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

function StyleSection({
  title,
  children,
  open = true,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="studio-inspector-section" open={open}>
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

let copiedDesign: BuilderDesign | null = null;

export function BuilderInspector({
  breakpoint,
  onBreakpoint,
  onDuplicate,
  onDelete,
  onMove,
  onNotice,
  pages,
}: {
  breakpoint: BuilderBreakpoint;
  onBreakpoint: (value: BuilderBreakpoint) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: number) => void;
  onNotice: (message: string) => void;
  pages: { id: string; name: string }[];
}) {
  const api = useBuilderEditor((state) => state);
  const [tab, setTab] = useState<'content' | 'style' | 'logic'>('content');
  const [interactionState, setInteractionState] = useState<'base' | BuilderInteractionState>(
    'base'
  );
  const entries = flattenNodes(api.appState.data.content);
  const entry = entries.find(({ node }) => node.props.id === api.selectedItem?.props.id);
  const selected = entry?.node;
  const meta = (selected?.props._editor || {}) as BuilderNodeMeta;
  const baseDesign = (selected?.props._design || {}) as BuilderDesign;
  const states = (selected?.props._states || {}) as BuilderStateDesign;
  const design = interactionState === 'base' ? baseDesign : states[interactionState] || {};
  const previewId = selected?.props.id;
  useEffect(() => {
    const frame = document.querySelector<HTMLIFrameElement>('#preview-frame');
    const target = previewId
      ? frame?.contentDocument?.querySelector<HTMLElement>(
          `[data-builder-node="${builderStyleKey(previewId)}"]`
        )
      : null;
    if (target && tab === 'style' && interactionState !== 'base')
      target.dataset.builderPreviewState = interactionState;
    return () => {
      target?.removeAttribute('data-builder-preview-state');
    };
  }, [previewId, interactionState, tab, selected]);
  let parent = entry?.parent;
  let locked = !!meta.locked;
  while (parent) {
    locked ||= !!(parent.props._editor as BuilderNodeMeta | undefined)?.locked;
    parent = entries.find(({ node }) => node.props.id === parent!.props.id)?.parent || null;
  }
  const parentLocked = locked && !meta.locked;
  const label = selected
    ? builderConfig.components[selected.type].label || selected.type
    : '页面设置';
  const updateProps = (patch: Record<string, unknown>) => {
    if (!selected || !entry) return;
    const props = { ...selected.props, ...patch };
    if (JSON.stringify(props) === JSON.stringify(selected.props)) return;
    api.dispatch({
      type: 'replace',
      destinationZone: entry.zone,
      destinationIndex: entry.index,
      data: { ...selected, props },
      recordHistory: true,
    });
  };
  const setVisualPreset = (visualPreset: string) => {
    const data = api.appState.data as BuilderData;
    const next: BuilderData = {
      ...data,
      root: { ...data.root, props: { ...data.root.props, visualPreset, primaryColor: '' } },
    };
    api.dispatch({ type: 'setData', data: next, recordHistory: true });
  };
  const setMeta = (patch: Partial<BuilderNodeMeta>) => {
    updateProps({ _editor: { ...meta, ...patch } });
    api.refreshPermissions();
  };
  const setStyle = (key: keyof BuilderStyles, value?: string | number) => {
    const styles = { ...design[breakpoint] };
    if (value === undefined) delete styles[key];
    else styles[key] = value;
    const next = { ...design, [breakpoint]: styles };
    updateProps(
      interactionState === 'base'
        ? { _design: next }
        : { _states: { ...states, [interactionState]: next } }
    );
  };
  const own = design[breakpoint] || {};
  const inherited = {
    ...effectiveStyles(baseDesign, breakpoint),
    ...effectiveStyles(design, breakpoint),
  };
  const numeric = (key: keyof BuilderStyles, label: string, ariaLabel?: string) => {
    const [min, max] = styleSchema[key].split(':').map(Number);
    return (
      <NumericControl
        key={key}
        label={label}
        ariaLabel={ariaLabel}
        value={own[key] as number | undefined}
        inherited={inherited[key] as number | undefined}
        min={min}
        max={max}
        step={['lineHeight', 'opacity', 'letterSpacing'].includes(key) ? 0.1 : 1}
        onChange={(value) => setStyle(key, value)}
      />
    );
  };
  const select = (key: keyof BuilderStyles, label: string, options: [string, string][]) => (
    <label className="studio-control" key={key}>
      <span>{label}</span>
      <select
        value={own[key] ?? ''}
        data-inherited={own[key] === undefined || undefined}
        onChange={(event) => setStyle(key, event.target.value || undefined)}
      >
        <option value="">
          继承
          {inherited[key]
            ? ` · ${options.find(([value]) => value === inherited[key])?.[1] || inherited[key]}`
            : ' / 默认'}
        </option>
        {options.map(([value, text]) => (
          <option value={value} key={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const color = (key: keyof BuilderStyles, label: string) => (
    <TextStyleControl
      key={key}
      label={label}
      property={key}
      value={own[key] as string | undefined}
      inherited={inherited[key] as string | undefined}
      onChange={(value) => setStyle(key, value)}
      color
    />
  );
  const text = (key: keyof BuilderStyles, label: string) => (
    <TextStyleControl
      key={key}
      label={label}
      property={key}
      value={own[key] as string | undefined}
      inherited={inherited[key] as string | undefined}
      onChange={(value) => setStyle(key, value)}
    />
  );
  const slotNodes = entry?.parent
    ? (entry.parent.props.content as BuilderNode[])
    : (api.appState.data as BuilderData).content;

  return (
    <div className="studio-inspector">
      <div className="studio-inspector-heading">
        <span className="studio-panel-kicker">{selected ? 'COMPONENT' : 'PAGE'}</span>
        <h2>{label}</h2>
        <p>
          {selected
            ? '编辑内容与外观，让设计成为你的作品。'
            : '设置浏览器标题、页面主题与内容宽度。'}
        </p>
      </div>
      {selected && (
        <>
          <div className="studio-layer-meta">
            <label className="studio-control">
              <span>图层名称</span>
              <input
                aria-label="图层名称"
                value={meta.label ?? ''}
                maxLength={80}
                placeholder={label}
                disabled={parentLocked}
                onChange={(event) => setMeta({ label: event.target.value })}
              />
            </label>
            <div role="group" aria-label="图层状态" className="studio-layer-state">
              <button
                type="button"
                onClick={() => setMeta({ hidden: !meta.hidden })}
                aria-pressed={!!meta.hidden}
                disabled={parentLocked}
              >
                {meta.hidden ? <EyeOff /> : <Eye />}
                {meta.hidden ? '已隐藏' : '可见'}
              </button>
              <button
                type="button"
                onClick={() => setMeta({ locked: !meta.locked })}
                aria-pressed={!!meta.locked}
                disabled={parentLocked}
              >
                {meta.locked ? <Lock /> : <Unlock />}
                {meta.locked ? '已锁定' : parentLocked ? '父层锁定' : '可编辑'}
              </button>
            </div>
          </div>
          <div className="studio-segmented" role="group" aria-label="属性面板模式">
            <button
              type="button"
              aria-pressed={tab === 'content'}
              onClick={() => setTab('content')}
            >
              内容
            </button>
            <button type="button" aria-pressed={tab === 'style'} onClick={() => setTab('style')}>
              样式
            </button>
            <button type="button" aria-pressed={tab === 'logic'} onClick={() => setTab('logic')}>
              交互
            </button>
          </div>
        </>
      )}
      {locked && (
        <p className="studio-inspector-hint">
          {parentLocked ? '请先在图层面板解锁父级容器。' : '图层已锁定。解锁后可编辑、移动或删除。'}
        </p>
      )}
      {!selected && (
        <div className="studio-visual-presets">
          <span>全局视觉风格</span>
          <div>
            {[
              ['indigo', '鸢尾紫', '#6658d8'],
              ['ocean', '海洋蓝', '#2368cb'],
              ['forest', '松石绿', '#168375'],
              ['amber', '琥珀橙', '#b75c15'],
              ['rose', '蔷薇粉', '#b7446a'],
              ['graphite', '石墨灰', '#526178'],
            ].map(([value, label, color]) => (
              <button
                type="button"
                key={value}
                style={{ background: color }}
                aria-label={`应用${label}风格`}
                aria-pressed={(api.appState.data as BuilderData).root.props?.visualPreset === value}
                title={label}
                onClick={() => setVisualPreset(value)}
              />
            ))}
          </div>
          <small>统一组件主色、图表与交互状态；详细参数在下方继续调整。</small>
        </div>
      )}
      {!selected || tab === 'content' ? (
        <div className="studio-content-fields">
          {selected && catalogDefinitions[selected.type] && (
            <p className="studio-inspector-hint">{catalogDefinitions[selected.type].description}</p>
          )}
          <Puck.Fields />
          {!selected && (
            <details className="studio-inspector-section">
              <summary>页面状态与交互变量</summary>
              <div>
                <BuilderVariablesPanel
                  value={(api.appState.data as BuilderData).root.props?.variables || []}
                  onChange={(variables) => {
                    const data = api.appState.data as BuilderData;
                    const next: BuilderData = {
                      ...data,
                      root: { ...data.root, props: { ...data.root.props, variables } },
                    };
                    api.dispatch({ type: 'setData', data: next, recordHistory: true });
                    onNotice('页面状态已应用，可在组件交互中绑定和修改。');
                  }}
                />
              </div>
            </details>
          )}
          {selected && (
            <details className="studio-inspector-section">
              <summary>HTML 与辅助信息</summary>
              <div>
                {(['htmlId', 'title', 'ariaLabel'] as const).map((key) => (
                  <label className="studio-control" key={key}>
                    <span>
                      {{ htmlId: 'HTML ID / 锚点', title: '悬停说明', ariaLabel: '辅助名称' }[key]}
                    </span>
                    <input
                      value={meta[key] || ''}
                      maxLength={key === 'htmlId' ? 100 : 240}
                      disabled={locked}
                      onChange={(event) => {
                        const text = event.target.value;
                        if (key !== 'htmlId' || !text || /^[\w\u4e00-\u9fff-]+$/.test(text))
                          setMeta({ [key]: text });
                      }}
                    />
                  </label>
                ))}
              </div>
            </details>
          )}
          {selected?.type === 'Container' && (
            <p className="studio-inspector-hint">
              将组件拖入容器，或选中容器后点击组件卡片的加号。在“样式”中设置横排、栅格和响应式布局。
            </p>
          )}
          {selected?.type === 'Form' && (
            <p className="studio-inspector-hint">
              放入输入、选项和提交按钮即可使用。表单在浏览器中校验，提交后可下载 JSON 数据。
            </p>
          )}
          {selected?.type === 'Button' && (
            <p className="studio-inspector-hint">
              填写链接后按钮可跳转；使用 #锚点 可跳到同页内容分区。放入表单后可设置为提交按钮。
            </p>
          )}
        </div>
      ) : tab === 'logic' ? (
        <BuilderLogicPanel
          key={selected.props.id}
          node={selected}
          data={api.appState.data as BuilderData}
          pages={pages}
          disabled={locked}
          onChange={(logic) => {
            updateProps({ _logic: logic });
            onNotice('交互设计已应用，在交互预览或导出 HTML 中操作。');
          }}
        />
      ) : (
        <fieldset className="studio-style-fields" disabled={locked}>
          <legend className="doc-sr-only">组件样式</legend>
          <label className="studio-control studio-state-picker">
            <span>设计交互状态</span>
            <select
              aria-label="设计交互状态"
              value={interactionState}
              onChange={(event) =>
                setInteractionState(event.target.value as typeof interactionState)
              }
            >
              <option value="base">默认状态</option>
              {Object.entries(interactionStateLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {interactionState !== 'base' && (
            <p className="studio-inspector-hint">
              正在设计{interactionStateLabels[interactionState]}
              状态，画布强制预览；导出后按真实鼠标、键盘和禁用状态触发。
            </p>
          )}
          <div className="studio-breakpoint-picker">
            <label htmlFor="style-breakpoint">编辑设备</label>
            <select
              id="style-breakpoint"
              value={breakpoint}
              onChange={(event) => onBreakpoint(event.target.value as BuilderBreakpoint)}
            >
              {Object.entries(breakpointLabels).map(([value, text]) => (
                <option value={value} key={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
          <p className="studio-inspector-hint">
            {breakpoint === 'desktop'
              ? '桌面为基础样式，小屏可单独覆盖。'
              : `${breakpointLabels[breakpoint]}继承较大设备样式；留空恢复继承。`}
          </p>
          <StyleSection title="布局与尺寸">
            <div className="studio-controls-grid">
              {select('display', '布局', [
                ['block', '普通流'],
                ['flex', '弹性布局'],
                ['grid', '栅格布局'],
                ['inline-block', '行内块'],
                ['none', '隐藏当前设备'],
              ])}
              {select('flexDirection', '方向', [
                ['row', '横向'],
                ['column', '纵向'],
                ['row-reverse', '横向反序'],
                ['column-reverse', '纵向反序'],
              ])}
              {select('justifyContent', '主轴对齐', [
                ['flex-start', '起点'],
                ['center', '居中'],
                ['flex-end', '终点'],
                ['space-between', '两端对齐'],
                ['space-around', '均匀分布'],
              ])}
              {select('alignItems', '交叉轴', [
                ['stretch', '拉伸'],
                ['flex-start', '起点'],
                ['center', '居中'],
                ['flex-end', '终点'],
              ])}
              {numeric('gap', '组件间距')}
              {select('flexWrap', '换行', [
                ['nowrap', '不换行'],
                ['wrap', '自动换行'],
              ])}
              {select(
                'gridTemplateColumns',
                '栅格列数',
                [1, 2, 3, 4, 6, 12].map((n) => [`repeat(${n}, minmax(0, 1fr))`, `${n} 列`])
              )}
              {(['width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight'] as const).map(
                (key) => (
                  <TextStyleControl
                    key={key}
                    property={key}
                    label={
                      {
                        width: '宽度',
                        minWidth: '最小宽度',
                        maxWidth: '最大宽度',
                        height: '高度',
                        minHeight: '最小高度',
                        maxHeight: '最大高度',
                      }[key]
                    }
                    value={own[key] as string | undefined}
                    inherited={inherited[key] as string | undefined}
                    onChange={(value) => setStyle(key, value)}
                  />
                )
              )}
              {text('aspectRatio', '宽高比')}
              {text('gridTemplateColumns', '自定义栅格列')}
              {text('gridTemplateRows', '自定义栅格行')}
              {text('gridColumn', '占据列（如 span 2）')}
              {text('gridRow', '占据行（如 1 / 3）')}
              {numeric('flexGrow', '弹性增长')}
              {numeric('flexShrink', '弹性收缩')}
              {text('flexBasis', '弹性基础尺寸')}
              {numeric('order', '排列顺序')}
              {select('alignSelf', '单项对齐', [
                ['auto', '自动'],
                ['stretch', '拉伸'],
                ['flex-start', '起点'],
                ['center', '居中'],
                ['flex-end', '终点'],
              ])}
            </div>
          </StyleSection>
          <StyleSection title="定位与溢出" open={false}>
            <div className="studio-controls-grid">
              {select('position', '定位方式', [
                ['static', '文档流'],
                ['relative', '相对定位'],
                ['absolute', '绝对定位'],
                ['sticky', '滚动吸附'],
                ['fixed', '窗口固定'],
              ])}
              {numeric('zIndex', '叠放层级')}
              {text('top', '距顶部')}
              {text('right', '距右侧')}
              {text('bottom', '距底部')}
              {text('left', '距左侧')}
              {select('overflow', '溢出处理', [
                ['visible', '显示'],
                ['hidden', '隐藏'],
                ['auto', '自动滚动'],
                ['scroll', '始终滚动'],
                ['clip', '裁剪'],
              ])}
              {select('cursor', '鼠标指针', [
                ['auto', '自动'],
                ['pointer', '手型'],
                ['default', '箭头'],
                ['grab', '抓取'],
              ])}
              {numeric('rotate', '旋转角度')}
              {numeric('scale', '缩放比例')}
            </div>
            <p className="studio-inspector-hint">
              绝对定位以最近的定位容器为参照。先将父容器设为相对定位，再设置子组件的四侧距离。
            </p>
          </StyleSection>
          <StyleSection title="间距">
            <div className="studio-spacing-box">
              <span>外边距 · px</span>
              <div className="studio-controls-grid">
                {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).map(
                  (key, index) =>
                    numeric(
                      key,
                      ['上', '右', '下', '左'][index],
                      `外边距 ${['上', '右', '下', '左'][index]}`
                    )
                )}
              </div>
              <div className="studio-spacing-inner">
                <span>内边距 · px</span>
                <div className="studio-controls-grid">
                  {(['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const).map(
                    (key, index) =>
                      numeric(
                        key,
                        ['上', '右', '下', '左'][index],
                        `内边距 ${['上', '右', '下', '左'][index]}`
                      )
                  )}
                </div>
              </div>
            </div>
          </StyleSection>
          <StyleSection title="文字排版">
            <div className="studio-controls-grid">
              {numeric('fontSize', '字号 · px')}
              {numeric('lineHeight', '行高')}
              {select('fontWeight', '字重', [
                ['400', '常规'],
                ['500', '中等'],
                ['600', '半粗'],
                ['700', '加粗'],
                ['800', '特粗'],
                ['900', '黑体'],
              ])}
              {select('textAlign', '文字对齐', [
                ['left', '左对齐'],
                ['center', '居中'],
                ['right', '右对齐'],
                ['justify', '两端对齐'],
              ])}
              {numeric('letterSpacing', '字间距 · px')}
              {text('fontFamily', '字体族')}
              {select('fontStyle', '字形', [
                ['normal', '正常'],
                ['italic', '斜体'],
              ])}
              {select('textDecoration', '文字装饰', [
                ['none', '无'],
                ['underline', '下划线'],
                ['line-through', '删除线'],
              ])}
              {select('whiteSpace', '文字换行', [
                ['normal', '自动'],
                ['nowrap', '不换行'],
                ['pre-wrap', '保留空格换行'],
                ['pre-line', '保留换行'],
              ])}
            </div>
            {color('color', '文字颜色')}
          </StyleSection>
          <StyleSection title="背景与边框">
            {color('backgroundColor', '背景颜色')}
            <div className="studio-color-presets" aria-label="常用背景色">
              {['#ffffff', '#f8fafc', '#eef2ff', '#ecfdf5', '#fff7ed', '#0f172a'].map((value) => (
                <button
                  type="button"
                  key={value}
                  style={{ background: value }}
                  aria-label={`背景色 ${value}`}
                  onClick={() => setStyle('backgroundColor', value)}
                />
              ))}
            </div>
            <div className="studio-controls-grid">
              {numeric('borderWidth', '边框宽度')}
              {numeric('borderRadius', '圆角')}
              {select('borderStyle', '边框样式', [
                ['solid', '实线'],
                ['dashed', '虚线'],
                ['dotted', '点线'],
              ])}
              {select('boxShadow', '阴影', [
                ['none', '无'],
                ['sm', '轻柔'],
                ['md', '悬浮'],
                ['lg', '强调'],
              ])}
              {numeric('opacity', '不透明度 · 0–1')}
            </div>
            {color('borderColor', '边框颜色')}
            {text('backgroundImage', '背景图片地址')}
            {text('backgroundGradient', '背景渐变')}
            <div className="studio-controls-grid">
              {select('backgroundSize', '背景尺寸', [
                ['cover', '填满'],
                ['contain', '完整'],
                ['auto', '原始'],
              ])}
              {select('backgroundPosition', '背景位置', [
                ['center', '居中'],
                ['top', '顶部'],
                ['bottom', '底部'],
                ['left', '左侧'],
                ['right', '右侧'],
              ])}
            </div>
          </StyleSection>
          <StyleSection title="自定义 CSS" open={false}>
            <p className="studio-inspector-hint">
              仅作用于当前组件和当前设备；支持 CSS
              变量。填写声明即可，无需选择器。设置背景图片请使用上方的图片地址。
            </p>
            <BuilderCssField
              label="内容 CSS"
              value={(own.customCss as string) || ''}
              onChange={(value) => setStyle('customCss', value || undefined)}
            />
            <BuilderCssField
              label="外层 CSS"
              value={(own.wrapperCss as string) || ''}
              onChange={(value) => setStyle('wrapperCss', value || undefined)}
            />
            <BuilderCssField
              label="悬停 CSS"
              value={(own.hoverCss as string) || ''}
              onChange={(value) => setStyle('hoverCss', value || undefined)}
            />
          </StyleSection>
          <div className="studio-style-tools">
            <button
              type="button"
              onClick={() => {
                copiedDesign = structuredClone(design);
                onNotice('已复制组件的全部设备样式。');
              }}
            >
              <Copy />
              复制样式
            </button>
            <button
              type="button"
              onClick={() => {
                if (copiedDesign) {
                  updateProps(
                    interactionState === 'base'
                      ? { _design: structuredClone(copiedDesign) }
                      : {
                          _states: { ...states, [interactionState]: structuredClone(copiedDesign) },
                        }
                  );
                  onNotice('已粘贴样式，可通过撤销恢复。');
                } else onNotice('请先复制一个组件的样式。');
              }}
            >
              粘贴样式
            </button>
            <button
              type="button"
              onClick={() => {
                const next = { ...design };
                delete next[breakpoint];
                updateProps(
                  interactionState === 'base'
                    ? { _design: next }
                    : { _states: { ...states, [interactionState]: next } }
                );
                onNotice(`已重置${breakpointLabels[breakpoint]}样式，可通过撤销恢复。`);
              }}
            >
              <RotateCcw />
              重置{breakpointLabels[breakpoint]}
            </button>
          </div>
        </fieldset>
      )}
      {selected && (
        <div className="studio-node-actions" role="group" aria-label="组件操作">
          <button
            type="button"
            title="上移组件"
            aria-label="上移组件"
            disabled={locked || entry?.index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </button>
          <button
            type="button"
            title="下移组件"
            aria-label="下移组件"
            disabled={locked || entry?.index === (slotNodes?.length || 1) - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </button>
          <button type="button" onClick={onDuplicate} disabled={locked}>
            <Copy />
            复制
          </button>
          <button type="button" onClick={onDelete} disabled={locked} className="studio-danger">
            <Trash />
            删除
          </button>
        </div>
      )}
    </div>
  );
}
