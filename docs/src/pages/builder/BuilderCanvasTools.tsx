import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Type, Layers, Copy } from '@zui/icons';
import { historyHasCurrentData, useBuilderEditor } from './builder-editor-context';
import { builderConfig } from './builder-config';
import { builderId, type BuilderData } from './builder-model';
import {
  builderStyleKey,
  type BuilderBreakpoint,
  type BuilderDesign,
  type BuilderNodeMeta,
  type BuilderStyles,
} from './builder-design';
import { checkedStructure, childNodes, flattenNodes, updateZone } from './builder-tree';

const textTargets: Record<string, [string, string]> = {
  Heading: ['text', '.z-builder-heading'],
  Typography_Text: ['children', '.z-typography-text'],
  Button: ['children', '.z-button,.z-builder-link-button'],
  Tag: ['children', '.z-tag'],
  Card: ['title', '.z-card-title'],
};
export const layoutPresets: { name: string; styles: BuilderStyles }[] = [
  {
    name: '纵向堆叠',
    styles: { display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'stretch' },
  },
  {
    name: '横向排列',
    styles: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 16,
    },
  },
  {
    name: '两列等分',
    styles: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: 20,
      alignItems: 'stretch',
    },
  },
  {
    name: '三列等分',
    styles: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: 20,
      alignItems: 'stretch',
    },
  },
  {
    name: '主栏 + 侧栏',
    styles: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
      gap: 24,
      alignItems: 'flex-start',
    },
  },
];

export function BuilderCanvasTools({
  breakpoint,
  rootRef,
  stageRef,
  scale,
  interactive,
  onNotice,
  onSaveBlock,
}: {
  breakpoint: BuilderBreakpoint;
  rootRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  scale: number;
  interactive: boolean;
  onNotice: (message: string) => void;
  onSaveBlock: () => void;
}) {
  const api = useBuilderEditor((state) => state);
  const data = api.appState.data as BuilderData;
  const entries = flattenNodes(data.content),
    id = api.selectedItem?.props.id;
  const entry = entries.find(({ node }) => node.props.id === id),
    node = entry?.node;
  const [inline, setInline] = useState(false),
    [box, setBox] = useState<{
      left: number;
      top: number;
      width: number;
      height: number;
      actualWidth: number;
      actualHeight: number;
    } | null>(null);
  const stopEditing = useRef<((cancel?: boolean) => void) | null>(null);
  const pendingTextEdit = useRef<string | null>(null);
  const historyReady = historyHasCurrentData(api);
  const dragCleanup = useRef<(() => void) | null>(null);
  const latest = useRef({ api, data, entry, node, breakpoint, onNotice });
  latest.current = { api, data, entry, node, breakpoint, onNotice };
  let parent = entry;
  let locked = false;
  while (parent) {
    locked ||= !!(parent.node.props._editor as BuilderNodeMeta | undefined)?.locked;
    const parentId = parent.parent?.props.id;
    parent = parentId ? entries.find(({ node: item }) => item.props.id === parentId) : undefined;
  }
  const frameDocument = () =>
    rootRef.current?.querySelector<HTMLIFrameElement>('#preview-frame')?.contentDocument;
  const elementFor = (key: string) =>
    frameDocument()?.querySelector<HTMLElement>(`[data-builder-node="${builderStyleKey(key)}"]`);
  const replace = (patch: Record<string, unknown>) => {
    const current = latest.current;
    if (!current.entry || !current.node) return;
    current.api.dispatch({
      type: 'replace',
      destinationZone: current.entry.zone,
      destinationIndex: current.entry.index,
      data: { ...current.node, props: { ...current.node.props, ...patch } },
      recordHistory: true,
    });
  };
  const setStyle = (patch: BuilderStyles) => {
    const current = latest.current,
      design = (current.node?.props._design || {}) as BuilderDesign;
    replace({
      _design: { ...design, [current.breakpoint]: { ...design[current.breakpoint], ...patch } },
    });
  };
  const editText = () => {
    const current = latest.current,
      selected = current.node;
    if (!selected || !textTargets[selected.type] || locked || interactive) return;
    // Puck records after a debounce. Finish the previous operation before editing
    // so a fast insertion followed by a text edit remains two undoable steps.
    if (!historyHasCurrentData(current.api)) {
      pendingTextEdit.current = selected.props.id;
      current.api.dispatch({ type: 'setUi', ui: {}, recordHistory: true });
      return;
    }
    stopEditing.current?.();
    const [property, selector] = textTargets[selected.type],
      element = elementFor(selected.props.id)?.querySelector<HTMLElement>(selector);
    if (!element) {
      onNotice('请在内容面板编辑此文字。');
      return;
    }
    const original = String(selected.props[property] || ''),
      doc = element.ownerDocument;
    element.textContent = original;
    element.contentEditable = 'plaintext-only';
    element.setAttribute('data-builder-inline-edit', '');
    element.style.setProperty('pointer-events', 'auto', 'important');
    element.style.zIndex = '20000';
    element.style.position = 'relative';
    setInline(true);
    let cancelled = false,
      finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const text = element.innerText.replace(/\r\n/g, '\n');
      element.removeEventListener('blur', finish);
      element.removeEventListener('keydown', keydown);
      doc.removeEventListener('pointerdown', pointer, true);
      element.removeAttribute('contenteditable');
      element.removeAttribute('data-builder-inline-edit');
      element.style.removeProperty('pointer-events');
      element.style.removeProperty('z-index');
      element.style.removeProperty('position');
      stopEditing.current = null;
      setInline(false);
      if (!cancelled && text !== original && text.length <= 10000) {
        const location = flattenNodes(latest.current.data.content).find(
          ({ node: item }) => item.props.id === selected.props.id
        );
        if (location)
          latest.current.api.dispatch({
            type: 'replace',
            destinationZone: location.zone,
            destinationIndex: location.index,
            data: { ...location.node, props: { ...location.node.props, [property]: text } },
            recordHistory: true,
          });
        onNotice('文字已更新。Enter 完成，Shift + Enter 换行，Esc 取消。');
      } else element.textContent = original;
    };
    const keydown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault();
        cancelled = event.key === 'Escape';
        element.blur();
      }
    };
    const pointer = (event: Event) => {
      if (element.contains(event.target as Node)) event.stopPropagation();
    };
    element.addEventListener('blur', finish);
    element.addEventListener('keydown', keydown);
    doc.addEventListener('pointerdown', pointer, true);
    stopEditing.current = (cancel = false) => {
      cancelled = cancel;
      finish();
    };
    element.focus();
    const selection = doc.getSelection(),
      range = doc.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  const editRef = useRef(editText);
  editRef.current = editText;
  useEffect(() => {
    if (pendingTextEdit.current && pendingTextEdit.current !== id) pendingTextEdit.current = null;
    if (!pendingTextEdit.current || !historyReady) return;
    pendingTextEdit.current = null;
    editRef.current();
  }, [id, historyReady]);
  useEffect(() => {
    const attached = new Set<Document>();
    const handler = (event: MouseEvent) => {
      if (
        latest.current.api.appState.ui.previewMode === 'interactive' ||
        (event.target as Element)?.closest('input, textarea, select, [contenteditable]')
      )
        return;
      if (textTargets[latest.current.node?.type || '']) {
        event.preventDefault();
        editRef.current();
      }
    };
    const attach = () => {
      const doc = frameDocument();
      if (doc && !attached.has(doc)) {
        doc.addEventListener('dblclick', handler, true);
        attached.add(doc);
      }
    };
    attach();
    const timer = setInterval(attach, 400);
    return () => {
      clearInterval(timer);
      attached.forEach((doc) => doc.removeEventListener('dblclick', handler, true));
      stopEditing.current?.(true);
      dragCleanup.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    stopEditing.current?.();
    const measure = () => {
      const frame = rootRef.current?.querySelector<HTMLIFrameElement>('#preview-frame'),
        stage = stageRef.current,
        element = id && elementFor(id);
      if (!frame || !stage || !element || interactive || locked) {
        setBox(null);
        return;
      }
      const rect = element.getBoundingClientRect(),
        frameRect = frame.getBoundingClientRect(),
        stageRect = stage.getBoundingClientRect();
      const actualScale = frameRect.width / frame.offsetWidth;
      const next = {
        left: frameRect.left - stageRect.left + rect.left * actualScale,
        top: frameRect.top - stageRect.top + rect.top * actualScale,
        width: rect.width * actualScale,
        height: rect.height * actualScale,
        actualWidth: rect.width,
        actualHeight: rect.height,
      };
      setBox(
        rect.width && rect.height && next.top + next.height > 35 && next.top < stageRect.height - 20
          ? next
          : null
      );
    };
    measure();
    const timer = setInterval(measure, 200);
    return () => {
      clearInterval(timer);
      dragCleanup.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scale, interactive, locked]);
  const resize = (axis: 'width' | 'height', event: React.PointerEvent<HTMLButtonElement>) => {
    if (!node || !box || locked) return;
    event.preventDefault();
    const element = elementFor(node.props.id),
      child = element?.firstElementChild as HTMLElement | null;
    if (!element || !child) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const button = event.currentTarget,
      start = axis === 'width' ? event.clientX : event.clientY,
      initial = axis === 'width' ? box.actualWidth : box.actualHeight;
    const previous = element.style.getPropertyValue(axis),
      priority = element.style.getPropertyPriority(axis),
      childPrevious = child.style.getPropertyValue(axis),
      childPriority = child.style.getPropertyPriority(axis);
    let value = initial;
    const move = (next: PointerEvent) => {
      value = Math.max(
        24,
        Math.min(
          1920,
          Math.round(initial + ((axis === 'width' ? next.clientX : next.clientY) - start) / scale)
        )
      );
      element.style.setProperty(axis, `${value}px`, 'important');
      child.style.setProperty(axis, '100%', 'important');
    };
    const finish = (cancel = false) => {
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerup', end);
      button.removeEventListener('pointercancel', cancelDrag);
      if (previous) element.style.setProperty(axis, previous, priority);
      else element.style.removeProperty(axis);
      if (childPrevious) child.style.setProperty(axis, childPrevious, childPriority);
      else child.style.removeProperty(axis);
      dragCleanup.current = null;
      if (!cancel && value !== initial) {
        setStyle({ [axis]: `${value}px` });
        onNotice(
          `已设置${breakpoint === 'desktop' ? '桌面' : breakpoint === 'tablet' ? '平板' : '手机'}${axis === 'width' ? '宽度' : '高度'} ${value}px，可在样式中恢复自动。`
        );
      }
    };
    const end = () => finish(),
      cancelDrag = () => finish(true);
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', cancelDrag);
    dragCleanup.current = cancelDrag;
  };
  const wrap = () => {
    if (!entry || !node || locked) return;
    const wrapper = {
      type: 'Container',
      props: {
        ...structuredClone(builderConfig.components.Container.defaultProps),
        id: builderId('Container'),
        content: [node],
      },
    };
    try {
      const next = checkedStructure(
        updateZone(data, entry.zone, (nodes) =>
          nodes.map((item) => (item.props.id === id ? wrapper : item))
        )
      );
      api.dispatch({ type: 'setData', data: next, recordHistory: true });
      api.dispatch({
        type: 'setUi',
        ui: { itemSelector: { index: entry.index, zone: entry.zone } },
      });
      onNotice('已包裹为布局容器，原组件与样式保留。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '当前组件无法再包裹容器。');
    }
  };
  const unwrap = () => {
    if (!entry || node?.type !== 'Container' || locked) return;
    const next = updateZone(data, entry.zone, (nodes) =>
      nodes.flatMap((item) => (item.props.id === id ? childNodes(item) : [item]))
    );
    api.dispatch({ type: 'setData', data: next, recordHistory: true });
    api.dispatch({ type: 'setUi', ui: { itemSelector: null } });
    onNotice('已解散容器，子组件保留在原位置。');
  };
  const views = entries.filter(({ node: item }) => item.type === 'AppView');
  return (
    <>
      <div className="studio-context-toolbar" aria-label="画布快捷编辑">
        {node && !interactive ? (
          <>
            <span className="studio-context-label">
              {builderConfig.components[node.type].label}
            </span>
            {textTargets[node.type] && (
              <button type="button" disabled={locked} aria-pressed={inline} onClick={editText}>
                <Type />
                编辑文字
              </button>
            )}
            {['Container', 'Section', 'Columns', 'AppView', 'Card'].includes(node.type) && (
              <select
                aria-label="快速布局"
                value=""
                disabled={locked}
                onChange={(event) => {
                  const preset = layoutPresets.find((item) => item.name === event.target.value);
                  if (preset) {
                    const design = (node.props._design || {}) as BuilderDesign;
                    replace({
                      _design: {
                        ...design,
                        [breakpoint]: { ...design[breakpoint], ...preset.styles },
                        ...(breakpoint === 'desktop' &&
                        !design.mobile?.gridTemplateColumns &&
                        preset.styles.display === 'grid'
                          ? { mobile: { ...design.mobile, gridTemplateColumns: 'minmax(0, 1fr)' } }
                          : {}),
                      },
                    });
                    onNotice(`已应用${preset.name}，手机默认单列。`);
                  }
                }}
              >
                <option value="">快速布局…</option>
                {layoutPresets.map((preset) => (
                  <option value={preset.name} key={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
            )}
            <button type="button" disabled={locked} onClick={wrap}>
              <Layers />
              包裹容器
            </button>
            {node.type === 'Container' && (
              <button type="button" disabled={locked} onClick={unwrap}>
                解散容器
              </button>
            )}
            <button type="button" onClick={onSaveBlock}>
              <Copy />
              存为区块
            </button>
            {entry?.parent && (
              <button
                type="button"
                onClick={() =>
                  api.dispatch({
                    type: 'setUi',
                    ui: { itemSelector: api.getSelectorForId(entry.parent!.props.id) },
                  })
                }
              >
                选择父级
              </button>
            )}
          </>
        ) : (
          <span className="studio-context-hint">
            {interactive
              ? '操作运行数据；切回编辑可继续设计。'
              : '双击文字直接修改 · 选中组件可拖动边缘调整尺寸'}
          </span>
        )}
        {!!views.length && !interactive && (
          <select
            className="studio-view-picker"
            aria-label="编辑应用视图"
            value={
              views.find(
                ({ node: item }) =>
                  item.props.id === id ||
                  flattenNodes(childNodes(item)).some(({ node: child }) => child.props.id === id)
              )?.node.props.id || ''
            }
            onChange={(event) => {
              if (event.target.value)
                api.dispatch({
                  type: 'setUi',
                  ui: { itemSelector: api.getSelectorForId(event.target.value) },
                });
            }}
          >
            <option value="">切换内容视图…</option>
            {views.map(({ node: item }) => (
              <option key={item.props.id} value={item.props.id}>
                {String(item.props.title || item.props.value)}
              </option>
            ))}
          </select>
        )}
      </div>
      {box &&
        stageRef.current &&
        !inline &&
        !interactive &&
        createPortal(
          <>
            <button
              className="studio-resize-handle studio-resize-width"
              type="button"
              aria-label="调整选中组件宽度"
              title={`宽度 ${Math.round(box.actualWidth)}px，拖动或用方向键调整`}
              style={{
                left: box.left + box.width - 4,
                top: Math.max(
                  35,
                  Math.min(box.top + box.height / 2 - 12, stageRef.current.clientHeight - 35)
                ),
              }}
              onPointerDown={(event) => resize('width', event)}
              onKeyDown={(event) => {
                if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                  event.preventDefault();
                  setStyle({
                    width: `${Math.max(24, Math.round(box.actualWidth) + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 10))}px`,
                  });
                }
              }}
            />
            <button
              className="studio-resize-handle studio-resize-height"
              type="button"
              aria-label="调整选中组件高度"
              title={`高度 ${Math.round(box.actualHeight)}px，拖动或用方向键调整`}
              style={{
                left: box.left + box.width / 2 - 12,
                top: box.top + box.height - 4,
                display:
                  box.top + box.height > stageRef.current.clientHeight - 20 ? 'none' : undefined,
              }}
              onPointerDown={(event) => resize('height', event)}
              onKeyDown={(event) => {
                if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
                  event.preventDefault();
                  setStyle({
                    height: `${Math.max(24, Math.round(box.actualHeight) + (event.key === 'ArrowUp' ? -1 : 1) * (event.shiftKey ? 1 : 10))}px`,
                  });
                }
              }}
            />
          </>,
          stageRef.current
        )}
    </>
  );
}
