import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type DragEvent,
  type ReactNode,
} from 'react';
import { Drawer, Puck } from '@puckeditor/core';
import { Modal } from '@zui/react';
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  Copy,
  Download,
  Edit,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Lock,
  Maximize,
  Monitor,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Tablet,
  Trash,
  Type,
  Unlock,
  Sun,
  Moon,
  Database,
  Close as X,
} from '@zui/icons';
import { builderConfig } from './builder-config';
import { historyHasCurrentData, useBuilderEditor } from './builder-editor-context';
import { BuilderInspector } from './BuilderInspector';
import { BuilderInteractivePreview } from './BuilderInteractivePreview';
import {
  breakpointLabels,
  builderStyleKey,
  type BuilderBreakpoint,
  type BuilderNodeMeta,
  type BuilderStyles,
} from './builder-design';
import { BuilderMultiSelection } from './BuilderMultiSelection';
import { BuilderDesignSystemPanel } from './BuilderDesignSystemPanel';
import {
  alignSelection,
  deleteSelection,
  duplicateSelection,
  freeLayoutSelection,
  groupSelection,
  selectionRoots,
  styleSelection,
  type AlignSelection,
} from './builder-selection';
import type { BuilderToken } from './builder-tokens';
import { BuilderSymbolsPanel, type SymbolCommand } from './BuilderSymbolsPanel';
import type { BuilderSymbol } from './builder-symbols';
import { BuilderAuditPanel } from './BuilderAuditPanel';
import {
  checkedStructure,
  childNodes,
  cloneNode,
  containerTypes,
  flattenNodes,
  insertNode,
  nodeLabel,
  ROOT_ZONE,
  updateZone,
  type BuilderNode,
} from './builder-tree';
import { builderSnippets } from './builder-snippets';
import {
  builderId,
  safeImage,
  saveDownload,
  type BuilderData,
  type BuilderPageRecord,
} from './builder-model';
import { BuilderCanvasTools } from './BuilderCanvasTools';
import { BuilderSourcesPanel } from './BuilderSourcesPanel';
import {
  BLOCK_LIBRARY_KEY,
  createSavedBlock,
  mergeSavedBlockData,
  parseBlockLibrary,
  type SavedBuilderBlock,
} from './builder-library';

function ToolButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`studio-tool ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function ComponentIcon({ type }: { type: string }) {
  if (type === 'Image') return <ImageIcon />;
  if (['Heading', 'Typography_Text'].includes(type)) return <Type />;
  if (containerTypes.has(type)) return <Layers />;
  if (['Input', 'TextArea', 'FormSelect', 'Checkbox'].includes(type)) return <Edit />;
  return <Code />;
}

let componentClipboard: BuilderNode[] | null = null;
const devices: { id: BuilderBreakpoint; width: number; icon: ReactNode }[] = [
  { id: 'desktop', width: 1280, icon: <Monitor /> },
  { id: 'tablet', width: 768, icon: <Tablet /> },
  { id: 'mobile', width: 390, icon: <Smartphone /> },
];
type Panel = 'components' | 'layers' | 'pages' | 'assets' | 'data' | 'design' | 'symbols' | 'audit';
const panelNames: Record<Panel, string> = {
  components: '组件库',
  layers: '图层结构',
  pages: '页面管理',
  assets: '图片资源',
  data: '页面数据',
  design: '设计规范',
  symbols: '主组件与变体',
  audit: '页面设计检查',
};
function effectiveDarkTheme() {
  const theme = document.documentElement.dataset.theme;
  return theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export interface BuilderEditorProps {
  pages: BuilderPageRecord[];
  activeId: string;
  status: string;
  savedAt: string;
  notice: string;
  exporting: boolean;
  modalOpen: boolean;
  onPage: (id: string) => void;
  onNew: () => void;
  onRename: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
  onHistory: () => void;
  onSave: () => void;
  onPreview: () => void;
  onPrototype: (download: boolean) => void;
  onImport: () => void;
  onExportPage: () => void;
  onExportHtml: () => void;
  onBackup: () => void;
  onCode: () => void;
  onNotice: (message: string) => void;
  onDesignTokens: (tokens: BuilderToken[]) => void;
  symbols: BuilderSymbol[];
  onSymbol: (command: SymbolCommand, data: BuilderData) => BuilderData | false;
}

export function BuilderEditor(props: BuilderEditorProps) {
  const api = useBuilderEditor((state) => state);
  const data = api.appState.data as BuilderData;
  const historyReady = historyHasCurrentData(api);
  const entries = flattenNodes(data.content);
  const selectedId = api.selectedItem?.props.id;
  const selectedEntry = entries.find(({ node }) => node.props.id === selectedId);
  const selected = selectedEntry?.node;
  const [panel, setPanel] = useState<Panel>('components');
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const selectionIds = selectionRoots(
    data,
    multiIds.length ? multiIds : selectedId ? [selectedId] : []
  ).map(({ node }) => node.props.id);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1050px)').matches);
  const [mobilePanel, setMobilePanel] = useState<Panel | 'inspector' | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [search, setSearch] = useState('');
  const [libraryTab, setLibraryTab] = useState<'components' | 'blocks' | 'saved'>('components');
  const [savedBlocks, setSavedBlocks] = useState<SavedBuilderBlock[]>(() => {
    try {
      return parseBlockLibrary(localStorage.getItem(BLOCK_LIBRARY_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [saveBlockName, setSaveBlockName] = useState<string | null>(null);
  const blockImportRef = useRef<HTMLInputElement>(null);
  const [breakpoint, setBreakpoint] = useState<BuilderBreakpoint>(() =>
    window.innerWidth <= 600 ? 'mobile' : window.innerWidth <= 1050 ? 'tablet' : 'desktop'
  );
  const [customWidth, setCustomWidth] = useState(() =>
    window.innerWidth <= 600 ? 390 : window.innerWidth <= 1050 ? 768 : 1280
  );
  const [zoom, setZoom] = useState('auto');
  const [stageWidth, setStageWidth] = useState(800);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [help, setHelp] = useState(false);
  const [dark, setDark] = useState(effectiveDarkTheme);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: 'before' | 'inside' | 'after';
  } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const canvasScale =
    zoom === 'auto'
      ? Math.max(0.12, Math.min(1, (stageWidth - (compact ? 24 : 64)) / customWidth))
      : +zoom / 100;
  const interactive = api.appState.ui.previewMode === 'interactive';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1050px)');
    const change = () => {
      setCompact(media.matches);
      setMobilePanel(null);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const syncTheme = () => setDark(effectiveDarkTheme());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    media.addEventListener('change', syncTheme);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', syncTheme);
    };
  }, []);
  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const frame = rootRef.current?.querySelector<HTMLIFrameElement>('#preview-frame');
    frame?.setAttribute('title', '页面画布预览');
    frame?.contentDocument?.documentElement?.style.setProperty(
      '--studio-canvas-scale',
      String(canvasScale)
    );
  });

  const setDevice = (
    next: BuilderBreakpoint,
    width = devices.find((item) => item.id === next)!.width
  ) => {
    setBreakpoint(next);
    setCustomWidth(width);
    setZoom('auto');
    api.dispatch({
      type: 'setUi',
      ui: { viewports: { ...api.appState.ui.viewports, current: { width, height: 'auto' } } },
    });
  };
  const isLocked = (id: string) => {
    let entry = entries.find(({ node }) => node.props.id === id);
    while (entry) {
      if ((entry.node.props._editor as BuilderNodeMeta | undefined)?.locked) return true;
      const parentId = entry.parent?.props.id;
      entry = parentId ? entries.find(({ node }) => node.props.id === parentId) : undefined;
    }
    return false;
  };
  const select = (id: string | null, showInspector = false, additive = false) => {
    let targetId = id;
    if (additive && id) {
      const ids = multiIds.length ? multiIds : selectedId ? [selectedId] : [];
      const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
      setMultiIds(next);
      targetId = next.includes(id) ? id : next.at(-1) || null;
    } else setMultiIds(id ? [id] : []);
    api.dispatch({
      type: 'setUi',
      ui: {
        itemSelector: targetId ? (api.getSelectorForId(targetId) ?? null) : null,
        previewMode: 'edit',
      },
    });
    if (showInspector && compact) setMobilePanel('inspector');
    if (showInspector && !compact) setRightOpen(true);
  };
  useEffect(() => {
    setMultiIds((previous) =>
      previous.length > 1 && selectedId && previous.includes(selectedId)
        ? previous
        : selectedId
          ? [selectedId]
          : []
    );
  }, [selectedId]);
  const commit = (next: BuilderData, id?: string) => {
    try {
      checkedStructure(next);
      api.dispatch({ type: 'setData', data: next, recordHistory: true });
      if (id) {
        const entry = flattenNodes(next.content).find(({ node }) => node.props.id === id);
        if (entry)
          api.dispatch({
            type: 'setUi',
            ui: { itemSelector: { index: entry.index, zone: entry.zone }, previewMode: 'edit' },
          });
      }
      return true;
    } catch (error) {
      props.onNotice(error instanceof Error ? error.message : '操作失败，请检查页面结构。');
      return false;
    }
  };
  const selectionCommand = (
    change: () => { data: BuilderData; ids?: string[]; id?: string } | BuilderData
  ) => {
    try {
      const result = change();
      const next = 'data' in result ? result.data : result;
      const ids =
        'data' in result ? result.ids || (result.id ? [result.id] : selectionIds) : selectionIds;
      if (commit(next, ids[0])) {
        if (!ids.length) api.dispatch({ type: 'setUi', ui: { itemSelector: null } });
        setMultiIds(
          ids.filter((id) => flattenNodes(next.content).some(({ node }) => node.props.id === id))
        );
        props.onNotice('已完成批量操作，可以一次撤销。');
      }
    } catch (reason) {
      props.onNotice(reason instanceof Error ? reason.message : '未能完成操作。');
    }
  };
  const selectionRects = (relative: boolean) =>
    selectionIds.flatMap((id) => {
      const element = rootRef.current
        ?.querySelector<HTMLIFrameElement>('#preview-frame')
        ?.contentDocument?.querySelector<HTMLElement>(
          `[data-builder-node="${builderStyleKey(id)}"]`
        );
      if (!element || !element.getClientRects().length) return [];
      const rect = element.getBoundingClientRect();
      return [
        {
          id,
          x: relative ? element.offsetLeft : rect.left,
          y: relative ? element.offsetTop : rect.top,
          width: rect.width,
          height: rect.height,
        },
      ];
    });
  const selectionState = useRef({ data, selectedId, select });
  selectionState.current = { data, selectedId, select };
  useEffect(() => {
    const documents = new Set<Document>();
    const pointer = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        selectionState.current.data === undefined
      )
        return;
      const target = event.target as Element;
      if (
        target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-builder-inline-edit]'
        )
      )
        return;
      const element = target.closest('[data-builder-node]');
      if (!element) return;
      const id = flattenNodes(selectionState.current.data.content).find(
        ({ node }) => builderStyleKey(node.props.id) === element.getAttribute('data-builder-node')
      )?.node.props.id;
      if (!id) return;
      if (event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectionState.current.select(id, false, true);
      } else setMultiIds([id]);
    };
    const attach = () => {
      const doc =
        rootRef.current?.querySelector<HTMLIFrameElement>('#preview-frame')?.contentDocument;
      if (doc && !documents.has(doc)) {
        documents.add(doc);
        doc.addEventListener('pointerdown', pointer, true);
      }
    };
    attach();
    const timer = setInterval(attach, 250);
    return () => {
      clearInterval(timer);
      documents.forEach((doc) => doc.removeEventListener('pointerdown', pointer, true));
    };
  }, []);
  useEffect(() => {
    const doc =
      rootRef.current?.querySelector<HTMLIFrameElement>('#preview-frame')?.contentDocument;
    doc
      ?.querySelectorAll('[data-builder-multiselected]')
      .forEach((element) => element.removeAttribute('data-builder-multiselected'));
    if (selectionIds.length > 1)
      for (const id of selectionIds)
        doc
          ?.querySelector(`[data-builder-node="${builderStyleKey(id)}"]`)
          ?.setAttribute('data-builder-multiselected', 'true');
  }, [selectionIds]);
  const insertionTarget = () => {
    if (selected && containerTypes.has(selected.type) && !isLocked(selected.props.id))
      return { zone: `${selected.props.id}:content`, index: childNodes(selected).length };
    if (selectedEntry && !isLocked(selectedEntry.parent?.props.id || ''))
      return { zone: selectedEntry.zone, index: selectedEntry.index + 1 };
    return { zone: ROOT_ZONE, index: data.content.length };
  };
  const addNode = (node: BuilderNode) => {
    const target = insertionTarget();
    if (commit(insertNode(data, node, target.zone, target.index), node.props.id)) {
      props.onNotice(
        `已插入${builderConfig.components[node.type].label}。${target.zone === ROOT_ZONE ? '' : '已放入所选位置。'}`
      );
      if (selected && containerTypes.has(selected.type))
        setExpanded((previous) => ({ ...previous, [selected.props.id]: true }));
      if (compact) setMobilePanel('inspector');
    }
  };
  const persistBlocks = (blocks: SavedBuilderBlock[]) => {
    try {
      localStorage.setItem(BLOCK_LIBRARY_KEY, JSON.stringify(blocks));
      setSavedBlocks(blocks);
      return true;
    } catch {
      props.onNotice('区块库保存失败，请先导出区块库备份，或释放浏览器存储空间。');
      return false;
    }
  };
  const insertSaved = (block: SavedBuilderBlock) => {
    try {
      const node = cloneNode(block.node),
        merged = mergeSavedBlockData(block, node, data),
        target = insertionTarget();
      const next = insertNode(merged, node, target.zone, target.index);
      if (commit(next, node.props.id))
        props.onNotice(`已插入“${block.name}”，数据绑定与响应式样式已保留。`);
    } catch (error) {
      props.onNotice(error instanceof Error ? error.message : '区块无法插入。');
    }
  };
  const insertComponent = (type: string, patch: Record<string, unknown> = {}) =>
    addNode(
      cloneNode({
        type,
        props: {
          ...structuredClone(builderConfig.components[type].defaultProps),
          ...patch,
          id: builderId(type),
        },
      })
    );
  const removeSelected = () => {
    if (selectionIds.length > 1) {
      selectionCommand(() => ({ data: deleteSelection(data, selectionIds), ids: [] }));
      return;
    }
    if (!selectedEntry || isLocked(selectedEntry.node.props.id)) return;
    const parentId = selectedEntry.parent?.props.id;
    if (
      commit(
        updateZone(data, selectedEntry.zone, (nodes) =>
          nodes.filter((_, index) => index !== selectedEntry.index)
        )
      )
    ) {
      select(parentId || null);
      props.onNotice('组件已删除，可通过撤销恢复。');
    }
  };
  const duplicateSelected = () => {
    if (selectionIds.length > 1) {
      selectionCommand(() => duplicateSelection(data, selectionIds));
      return;
    }
    if (!selectedEntry || isLocked(selectedEntry.node.props.id)) return;
    const copy = cloneNode(selectedEntry.node);
    if (commit(insertNode(data, copy, selectedEntry.zone, selectedEntry.index + 1), copy.props.id))
      props.onNotice('已复制组件及其子组件。');
  };
  const moveNode = (id: string, zone: string, index: number) => {
    const source = entries.find(({ node }) => node.props.id === id);
    if (!source || isLocked(id)) return;
    const parentId = zone === ROOT_ZONE ? null : zone.slice(0, -':content'.length);
    if (parentId && isLocked(parentId)) {
      props.onNotice('目标容器已锁定。');
      return;
    }
    if (
      parentId &&
      (parentId === id ||
        flattenNodes(childNodes(source.node)).some(({ node }) => node.props.id === parentId))
    ) {
      props.onNotice('不能将容器移入自身或子组件。');
      return;
    }
    const destination = source.zone === zone && index > source.index ? index - 1 : index;
    const next = updateZone(data, source.zone, (nodes) =>
      nodes.filter((node) => node.props.id !== id)
    );
    if (commit(insertNode(next, source.node, zone, destination), id)) {
      if (parentId) setExpanded((previous) => ({ ...previous, [parentId]: true }));
      props.onNotice('已调整图层位置。');
    }
  };
  const moveSelected = (direction: number) => {
    if (!selectedEntry) return;
    const siblings = selectedEntry.parent ? childNodes(selectedEntry.parent) : data.content;
    const destination = selectedEntry.index + direction;
    if (destination < 0 || destination >= siblings.length) return;
    moveNode(
      selectedEntry.node.props.id,
      selectedEntry.zone,
      selectedEntry.index + (direction > 0 ? 2 : -1)
    );
  };
  const toggleMeta = (node: BuilderNode, key: 'hidden' | 'locked') => {
    const entry = entries.find(({ node: item }) => item.props.id === node.props.id)!;
    if (entry.parent && isLocked(entry.parent.props.id)) {
      props.onNotice('请先解锁父级容器。');
      return;
    }
    const meta = (node.props._editor || {}) as BuilderNodeMeta;
    const next = updateZone(data, entry.zone, (nodes) =>
      nodes.map((item) =>
        item.props.id === node.props.id
          ? { ...item, props: { ...item.props, _editor: { ...meta, [key]: !meta[key] } } }
          : item
      )
    );
    commit(next);
    api.refreshPermissions();
  };
  const openPanel = (next: Panel) => {
    setPanel(next);
    if (compact) setMobilePanel(next);
    else {
      setLeftOpen(panel !== next || !leftOpen);
      setFocusMode(false);
    }
  };
  const shortcuts = (event: KeyboardEvent) => {
    if (props.modalOpen || help || mobilePanel || event.defaultPrevented) return;
    const target = event.target as Element | null;
    const typing =
      typeof target?.closest === 'function' &&
      !!target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
      );
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (command && key === 's') {
      event.preventDefault();
      props.onSave();
      return;
    }
    if (typing) return;
    if (command && key === 'a' && !interactive) {
      event.preventDefault();
      setMultiIds(data.content.map((node) => node.props.id));
      return;
    }
    if (command && key === 'g' && !interactive && selectionIds.length > 1) {
      event.preventDefault();
      selectionCommand(() => groupSelection(data, selectionIds, breakpoint));
      return;
    }
    if (interactive) {
      if (event.key === 'Delete' || event.key === 'Backspace') event.preventDefault();
      return;
    }
    if (command && key === 'z') {
      event.preventDefault();
      if (!historyReady) return;
      if (event.shiftKey) api.history.forward();
      else api.history.back();
    } else if (command && key === 'y') {
      event.preventDefault();
      if (!historyReady) return;
      api.history.forward();
    } else if (command && key === 'd') {
      event.preventDefault();
      duplicateSelected();
    } else if (command && key === 'c' && selected) {
      event.preventDefault();
      componentClipboard = selectionRoots(data, selectionIds).map(({ node }) =>
        structuredClone(node)
      );
      props.onNotice('已复制组件，选中目标位置后可粘贴。');
    } else if (command && key === 'x' && selected && !isLocked(selected.props.id)) {
      event.preventDefault();
      componentClipboard = selectionRoots(data, selectionIds).map(({ node }) =>
        structuredClone(node)
      );
      removeSelected();
    } else if (command && key === 'v' && componentClipboard) {
      event.preventDefault();
      const target = insertionTarget(),
        copies = componentClipboard.map(cloneNode);
      selectionCommand(() => ({
        data: copies.reduce(
          (next, node, index) => insertNode(next, node, target.zone, target.index + index),
          data
        ),
        ids: copies.map((node) => node.props.id),
      }));
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selected) {
        event.preventDefault();
        removeSelected();
      }
    } else if (event.altKey && event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelected(-1);
    } else if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelected(1);
    } else if (event.key === 'Escape') {
      if (selectionIds.length > 1) {
        setMultiIds(selectedId ? [selectedId] : []);
        return;
      }
      if (selectedEntry?.parent) select(selectedEntry.parent.props.id);
      else {
        select(null);
        setFocusMode(false);
      }
    }
  };
  const shortcutRef = useRef(shortcuts);
  shortcutRef.current = shortcuts;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      shortcutRef.current(event);
      if (event.defaultPrevented) event.stopImmediatePropagation();
    };
    const frames = new Map<Document, HTMLIFrameElement>();
    const attach = () =>
      rootRef.current?.querySelectorAll<HTMLIFrameElement>('iframe').forEach((frame) => {
        if (frame.contentDocument && !frames.has(frame.contentDocument)) {
          frame.contentDocument.addEventListener('keydown', listener, true);
          frames.set(frame.contentDocument, frame);
        }
      });
    window.addEventListener('keydown', listener, true);
    const timer = window.setInterval(attach, 400);
    attach();
    return () => {
      window.removeEventListener('keydown', listener, true);
      clearInterval(timer);
      frames.forEach((_, document) => document.removeEventListener('keydown', listener, true));
    };
  }, []);

  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      props.onNotice('请选择不超过 1 MB 的 PNG、JPEG、WebP 或 GIF 图片。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      insertComponent('Image', {
        src: String(reader.result),
        alt: file.name.replace(/\.[^.]+$/, ''),
        caption: '',
        height: 280,
        fit: 'cover',
      });
    reader.onerror = () => props.onNotice('图片读取失败，请重试。');
    reader.readAsDataURL(file);
  };

  const layers = (nodes: BuilderNode[], depth = 0): ReactNode => (
    <ul className="studio-layer-list" aria-label={depth === 0 ? '页面图层' : '子图层'}>
      {nodes.map((node) => {
        const id = node.props.id;
        const meta = (node.props._editor || {}) as BuilderNodeMeta;
        const children = childNodes(node);
        const canContain = containerTypes.has(node.type);
        const entry = entries.find(({ node: item }) => item.props.id === id)!;
        const open = expanded[id] ?? depth === 0;
        const label = nodeLabel(node, builderConfig.components[node.type].label || node.type);
        const drop = dropTarget?.id === id ? dropTarget.position : undefined;
        const dragOver = (event: DragEvent) => {
          if (!dragging || dragging === id) return;
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          const y = (event.clientY - rect.top) / rect.height;
          setDropTarget({
            id,
            position: canContain && y > 0.25 && y < 0.75 ? 'inside' : y < 0.5 ? 'before' : 'after',
          });
        };
        return (
          <li key={id} data-builder-layer-id={id} data-hidden={meta.hidden || undefined}>
            <div
              className="studio-layer-row"
              data-selected={selectionIds.includes(id) || undefined}
              data-drop={drop}
              onDragOver={dragOver}
              onDrop={(event) => {
                if (!dragging || !dropTarget) return;
                event.preventDefault();
                event.stopPropagation();
                const { position } = dropTarget;
                moveNode(
                  dragging,
                  position === 'inside' ? `${id}:content` : entry.zone,
                  position === 'inside'
                    ? children.length
                    : entry.index + (position === 'after' ? 1 : 0)
                );
                setDragging(null);
                setDropTarget(null);
              }}
            >
              <button
                type="button"
                className="studio-layer-expand"
                disabled={!canContain}
                aria-label={`${open ? '收起' : '展开'} ${label}`}
                aria-expanded={canContain ? open : undefined}
                onClick={() => setExpanded((previous) => ({ ...previous, [id]: !open }))}
              >
                {canContain ? open ? <ChevronDown /> : <ChevronRight /> : <span />}
              </button>
              <button
                type="button"
                className="studio-layer-select"
                draggable={!isLocked(id)}
                aria-pressed={selectionIds.includes(id)}
                title={label}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', `zui-layer:${id}`);
                  event.dataTransfer.effectAllowed = 'move';
                  setDragging(id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget(null);
                }}
                onClick={(event) => select(id, compact, event.shiftKey)}
              >
                <ComponentIcon type={node.type} />
                <span>{label}</span>
              </button>
              <ToolButton
                label={`${meta.hidden ? '显示' : '隐藏'} ${label}`}
                className="studio-layer-mini"
                onClick={() => toggleMeta(node, 'hidden')}
              >
                {meta.hidden ? <EyeOff /> : <Eye />}
              </ToolButton>
              <ToolButton
                label={`${meta.locked ? '解锁' : '锁定'} ${label}`}
                className="studio-layer-mini"
                onClick={() => toggleMeta(node, 'locked')}
              >
                {meta.locked ? <Lock /> : <Unlock />}
              </ToolButton>
            </div>
            {canContain && open && children.length > 0 && (
              <div className="studio-layer-children">{layers(children, depth + 1)}</div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const palette = (
    <>
      <div className="studio-segmented" role="group" aria-label="组件库类型">
        <button
          type="button"
          aria-pressed={libraryTab === 'components'}
          onClick={() => setLibraryTab('components')}
        >
          基础组件 <span>{Object.keys(builderConfig.components).length}</span>
        </button>
        <button
          type="button"
          aria-pressed={libraryTab === 'blocks'}
          onClick={() => setLibraryTab('blocks')}
        >
          预设区块 <span>{builderSnippets.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={libraryTab === 'saved'}
          onClick={() => setLibraryTab('saved')}
        >
          我的区块 <span>{savedBlocks.length}</span>
        </button>
      </div>
      <label className="studio-library-search">
        <Search />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索组件或区块…"
          aria-label="搜索组件或区块"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="清空组件搜索">
            <X />
          </button>
        )}
      </label>
      <p className="studio-library-hint">
        {selected && containerTypes.has(selected.type)
          ? `插入到：${nodeLabel(selected, '所选容器')}`
          : selected
            ? '插入到所选组件之后'
            : '拖入画布，或点 + 一键插入'}
      </p>
      {libraryTab === 'components' ? (
        <Drawer>
          {Object.entries(builderConfig.categories || {}).map(([category, config]) => {
            const components = (config.components || []).filter((type) =>
              `${type} ${builderConfig.components[type].label}`
                .toLowerCase()
                .includes(search.trim().toLowerCase())
            );
            return (
              components.length > 0 && (
                <section className="studio-library-group" key={category}>
                  <h3>
                    {config.title}
                    <span>{components.length}</span>
                  </h3>
                  <div className="studio-component-grid">
                    {components.map((type) => (
                      <div className="studio-component-card" key={type}>
                        <Drawer.Item name={type} label={builderConfig.components[type].label}>
                          {() => (
                            <div className="studio-component-drag">
                              <ComponentIcon type={type} />
                              <span>{builderConfig.components[type].label}</span>
                              <small>{type.replace('Typography_', '')}</small>
                            </div>
                          )}
                        </Drawer.Item>
                        <ToolButton
                          label={`插入${builderConfig.components[type].label}`}
                          className="studio-insert"
                          onClick={() => insertComponent(type)}
                        >
                          <Plus />
                        </ToolButton>
                      </div>
                    ))}
                  </div>
                </section>
              )
            );
          })}
          {!Object.entries(builderConfig.components).some(([type, config]) =>
            `${type} ${config.label}`.toLowerCase().includes(search.trim().toLowerCase())
          ) && <div className="studio-empty">没有匹配的组件，换个关键词试试。</div>}
        </Drawer>
      ) : libraryTab === 'saved' ? (
        <div className="studio-saved-blocks">
          <p className="studio-library-hint">
            区块独立保存在此浏览器。包含内部组件、样式与绑定数据，可重复插入任何页面。
          </p>
          <div className="studio-source-actions">
            <button type="button" onClick={() => blockImportRef.current?.click()}>
              导入区块库
            </button>
            <button
              type="button"
              disabled={!savedBlocks.length}
              onClick={() =>
                saveDownload(JSON.stringify(savedBlocks, null, 2), 'ZUI-我的区块.json')
              }
            >
              导出区块库
            </button>
          </div>
          {savedBlocks
            .filter((block) => block.name.includes(search.trim()))
            .map((block) => (
              <div className="studio-saved-block" key={block.id}>
                <button type="button" onClick={() => insertSaved(block)}>
                  <Layers />
                  <span>
                    <strong>{block.name}</strong>
                    <small>
                      {flattenNodes([block.node]).length} 个组件 · {block.sources.length} 个数据源
                    </small>
                  </span>
                  <Plus />
                </button>
                <button
                  type="button"
                  aria-label={`删除区块 ${block.name}`}
                  onClick={() => persistBlocks(savedBlocks.filter((item) => item.id !== block.id))}
                >
                  <Trash />
                </button>
              </div>
            ))}
          {!savedBlocks.length && (
            <div className="studio-empty">选中画布组件或完整容器，点击“存为区块”。</div>
          )}
        </div>
      ) : (
        <div className="studio-snippet-list">
          {builderSnippets
            .filter((item) => `${item.name} ${item.description}`.includes(search.trim()))
            .map((item) => (
              <button
                className="studio-snippet"
                type="button"
                key={item.id}
                onClick={() =>
                  'sources' in item && item.sources.length
                    ? insertSaved({
                        id: item.id,
                        name: item.name,
                        node: item.data,
                        sources: item.sources,
                      })
                    : addNode(cloneNode(item.data))
                }
              >
                <div
                  className="studio-snippet-art"
                  data-accent={item.accent}
                  data-snippet={item.id}
                >
                  <i />
                  <i />
                  <i />
                  <span>{item.category}</span>
                </div>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
                <Plus />
              </button>
            ))}
          {!builderSnippets.some((item) =>
            `${item.name} ${item.description}`.includes(search.trim())
          ) && <div className="studio-empty">没有匹配的区块。</div>}
        </div>
      )}
    </>
  );

  const pagePanel = (
    <div className="studio-pages">
      <p className="studio-library-hint">{props.pages.length} / 20 个页面 · 草稿保存在本机</p>
      {props.pages.map((item, index) => (
        <button
          type="button"
          className="studio-page-card"
          key={item.id}
          aria-pressed={item.id === props.activeId}
          onClick={() => {
            props.onPage(item.id);
            setMobilePanel(null);
          }}
        >
          <div className="studio-page-thumbnail">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <i />
            <i />
            <i />
          </div>
          <span>
            <strong>{item.name}</strong>
            <small>
              {flattenNodes(item.data.content).length} 个组件
              {item.id === props.activeId ? ' · 编辑中' : ''}
            </small>
          </span>
          <ChevronRight />
        </button>
      ))}
      <button
        type="button"
        className="studio-secondary-button"
        disabled={props.pages.length >= 20}
        onClick={() => {
          setMobilePanel(null);
          props.onNew();
        }}
      >
        <Plus />
        添加页面
      </button>
      <div className="studio-page-manage">
        <button
          type="button"
          onClick={() => {
            setMobilePanel(null);
            props.onRename();
          }}
        >
          <Edit />
          重命名页面
        </button>
        <button type="button" disabled={props.pages.length >= 20} onClick={props.onDuplicatePage}>
          <Copy />
          复制页面
        </button>
        <button
          type="button"
          onClick={() => {
            setMobilePanel(null);
            props.onDeletePage();
          }}
          className="studio-danger"
        >
          <Trash />
          删除页面
        </button>
      </div>
      <button
        type="button"
        className="studio-secondary-button"
        onClick={() => {
          setMobilePanel(null);
          props.onHistory();
        }}
      >
        <Clock />
        版本历史
      </button>
      <button
        type="button"
        className="studio-secondary-button"
        disabled={props.exporting}
        onClick={() => props.onPrototype(false)}
      >
        <Eye />
        预览多页面原型
      </button>
      <button
        type="button"
        className="studio-secondary-button"
        disabled={props.exporting}
        onClick={() => props.onPrototype(true)}
      >
        <Download />
        导出多页面原型
      </button>
    </div>
  );
  const imageNodes = props.pages
    .flatMap((item) => flattenNodes(item.data.content))
    .filter(
      ({ node }, index, all) =>
        node.type === 'Image' &&
        safeImage(node.props.src) &&
        all.findIndex(
          ({ node: candidate }) =>
            candidate.type === 'Image' && candidate.props.src === node.props.src
        ) === index
    );
  const assets = (
    <div className="studio-assets">
      <div className="studio-upload-area">
        <ImageIcon />
        <strong>把真实素材带入页面</strong>
        <p>PNG、JPG、WebP、GIF，单张不超过 1 MB。</p>
        <button
          type="button"
          className="studio-secondary-button"
          onClick={() => imageRef.current?.click()}
        >
          <Plus />
          上传并插入图片
        </button>
      </div>
      <p className="studio-library-hint">工作区中的图片 · {imageNodes.length} 张</p>
      <div className="studio-asset-grid">
        {imageNodes.map(({ node }) => (
          <button
            type="button"
            key={node.props.id}
            onClick={() =>
              insertComponent('Image', {
                src: node.props.src,
                alt: node.props.alt || '',
                caption: '',
                fit: 'cover',
                height: 280,
              })
            }
            aria-label={`插入图片 ${node.props.alt || '未命名图片'}`}
          >
            <img src={safeImage(node.props.src)} alt="" />
            <span>{String(node.props.alt || '未命名图片')}</span>
            <Plus />
          </button>
        ))}
      </div>
      {!imageNodes.length && <p className="studio-empty">上传图片后，可在这里重复使用。</p>}
    </div>
  );
  const leftContent =
    panel === 'components' ? (
      palette
    ) : panel === 'layers' ? (
      <div className="studio-layers">
        <div className="studio-layer-tools">
          <button
            type="button"
            onClick={() =>
              setExpanded(Object.fromEntries(entries.map(({ node }) => [node.props.id, true])))
            }
          >
            全部展开
          </button>
          <button
            type="button"
            onClick={() =>
              setExpanded(Object.fromEntries(entries.map(({ node }) => [node.props.id, false])))
            }
          >
            全部收起
          </button>
        </div>
        <button
          type="button"
          className="studio-layer-root"
          aria-pressed={!selected}
          onClick={() => select(null, compact)}
        >
          <FileText />
          页面根节点 <span>{entries.length}</span>
        </button>
        {layers(data.content)}
        {!entries.length && <p className="studio-empty">画布还是空的，先插入一个组件。</p>}
        {selectedEntry && (
          <div className="studio-layer-move">
            <label>
              移动到容器
              <select
                aria-label="移动到容器"
                value=""
                disabled={isLocked(selectedEntry.node.props.id)}
                onChange={(event) => {
                  if (!event.target.value) return;
                  const parentId = event.target.value === 'root' ? null : event.target.value;
                  moveNode(
                    selectedEntry.node.props.id,
                    parentId ? `${parentId}:content` : ROOT_ZONE,
                    parentId
                      ? childNodes(entries.find(({ node }) => node.props.id === parentId)!.node)
                          .length
                      : data.content.length
                  );
                }}
              >
                <option value="">选择目标位置…</option>
                <option value="root">页面根节点</option>
                {entries
                  .filter(
                    ({ node }) =>
                      containerTypes.has(node.type) &&
                      node.props.id !== selectedId &&
                      !isLocked(node.props.id) &&
                      !flattenNodes(childNodes(selectedEntry.node)).some(
                        ({ node: child }) => child.props.id === node.props.id
                      )
                  )
                  .map(({ node }) => (
                    <option value={node.props.id} key={node.props.id}>
                      {nodeLabel(node, builderConfig.components[node.type].label || node.type)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}
        <p className="studio-library-hint">拖动图层可排序、移入容器。也可在属性面板上移、下移。</p>
      </div>
    ) : panel === 'pages' ? (
      pagePanel
    ) : panel === 'data' ? (
      <BuilderSourcesPanel
        value={data.root.props?.datasets || []}
        onChange={(datasets) =>
          commit({ ...data, root: { ...data.root, props: { ...data.root.props, datasets } } })
        }
      />
    ) : panel === 'design' ? (
      <BuilderDesignSystemPanel
        data={data}
        selectedIds={selectionIds}
        breakpoint={breakpoint}
        onData={commit}
        onApplyAll={props.onDesignTokens}
        onNotice={props.onNotice}
      />
    ) : panel === 'symbols' ? (
      <BuilderSymbolsPanel
        data={data}
        selectedId={selectedId}
        symbols={props.symbols}
        onCommand={(command) => {
          const next = props.onSymbol(
            command.type === 'insert' ? { ...command, selectedId } : command,
            data
          );
          if (next) {
            api.dispatch({ type: 'setData', data: next, recordHistory: false });
          }
        }}
      />
    ) : panel === 'audit' ? (
      <BuilderAuditPanel
        data={data}
        pages={props.pages}
        symbols={props.symbols}
        onSelect={(id) => select(id, compact)}
      />
    ) : (
      assets
    );
  const inspector =
    selectionIds.length > 1 ? (
      <BuilderMultiSelection
        count={selectionIds.length}
        breakpoint={breakpoint}
        onStyle={(patch: BuilderStyles) =>
          selectionCommand(() => styleSelection(data, selectionIds, breakpoint, patch))
        }
        onGroup={(layout) =>
          selectionCommand(() =>
            layout === 'free'
              ? freeLayoutSelection(data, selectionIds, breakpoint, selectionRects(false))
              : groupSelection(
                  data,
                  selectionIds,
                  breakpoint,
                  layout === 'grid'
                    ? {
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(3, selectionIds.length)}, minmax(0, 1fr))`,
                        gap: 20,
                      }
                    : { display: 'flex', flexDirection: layout, gap: 16, flexWrap: 'wrap' }
                )
          )
        }
        onAlign={(operation: AlignSelection) =>
          selectionCommand(() =>
            alignSelection(data, selectionIds, breakpoint, selectionRects(true), operation)
          )
        }
        onDuplicate={duplicateSelected}
        onDelete={removeSelected}
        onClear={() => setMultiIds(selectedId ? [selectedId] : [])}
      />
    ) : (
      <BuilderInspector
        pages={props.pages}
        breakpoint={breakpoint}
        onBreakpoint={setDevice}
        onDuplicate={duplicateSelected}
        onDelete={removeSelected}
        onMove={moveSelected}
        onNotice={props.onNotice}
      />
    );
  const showLeft = !compact && leftOpen && !focusMode;
  const showRight = !compact && rightOpen && !focusMode;
  const ancestors: BuilderNode[] = [];
  let ancestor = selectedEntry?.parent;
  while (ancestor) {
    ancestors.unshift(ancestor);
    const parentId = ancestor.props.id;
    ancestor = entries.find(({ node }) => node.props.id === parentId)?.parent || null;
  }

  return (
    <div className="studio" ref={rootRef} data-focus={focusMode || undefined}>
      <header className="studio-topbar">
        <div className="studio-brand">
          <span>S</span>
          <h1 className="doc-h1">页面搭建器</h1>
          <small>STUDIO</small>
        </div>
        <div className="studio-project-picker">
          <FileText />
          <label htmlFor="builder-page-picker" className="doc-sr-only">
            当前页面
          </label>
          <select
            id="builder-page-picker"
            value={props.activeId}
            onChange={(event) => props.onPage(event.target.value)}
          >
            {props.pages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <ToolButton label="新建页面" onClick={props.onNew} disabled={props.pages.length >= 20}>
          <Plus />
        </ToolButton>
        <details className="studio-menu studio-page-menu">
          <summary aria-label="页面操作" title="页面操作">
            <MoreHorizontal />
          </summary>
          <div
            onClick={(event) => {
              if ((event.target as Element).closest('button'))
                event.currentTarget.parentElement!.removeAttribute('open');
            }}
          >
            <button type="button" onClick={props.onRename}>
              <Edit />
              重命名当前页面
            </button>
            <button
              type="button"
              disabled={props.pages.length >= 20}
              onClick={props.onDuplicatePage}
            >
              <Copy />
              复制当前页面
            </button>
            <button type="button" onClick={props.onHistory}>
              <Clock />
              版本历史
            </button>
            <button type="button" onClick={props.onDeletePage} className="studio-danger">
              <Trash />
              删除当前页面
            </button>
          </div>
        </details>
        <div className="studio-history-tools">
          <ToolButton
            label="撤销"
            disabled={!api.history.hasPast || !historyReady}
            onClick={() => api.history.back()}
          >
            <RotateCcw />
          </ToolButton>
          <ToolButton
            label="重做"
            disabled={!api.history.hasFuture || !historyReady}
            onClick={() => api.history.forward()}
          >
            <RotateCcw style={{ transform: 'scaleX(-1)' }} />
          </ToolButton>
        </div>
        <div
          className="doc-builder-save-state studio-save-state"
          data-status={props.status}
          role="status"
        >
          <CheckCircle />
          <span>
            {props.status === 'saved'
              ? '已保存到本机'
              : props.status === 'saving'
                ? '正在保存…'
                : '尚未保存'}
          </span>
          <time>{props.savedAt}</time>
        </div>
        <button type="button" className="studio-save-button" onClick={props.onSave}>
          <Save />
          <span>保存版本</span>
        </button>
        <button
          type="button"
          className="studio-preview-button"
          aria-label="预览页面"
          disabled={props.exporting}
          onClick={props.onPreview}
        >
          <Eye />
          <span>{props.exporting ? '生成中…' : '预览页面'}</span>
        </button>
        <details className="studio-menu studio-file-menu">
          <summary aria-label="文件与备份" title="文件与备份">
            <Download />
          </summary>
          <div
            onClick={(event) => {
              if ((event.target as Element).closest('button'))
                event.currentTarget.parentElement!.removeAttribute('open');
            }}
          >
            <strong>导入与导出</strong>
            <button type="button" onClick={props.onImport}>
              导入 JSON
            </button>
            <button type="button" onClick={props.onExportPage}>
              导出 JSON
            </button>
            <button type="button" disabled={props.exporting} onClick={props.onExportHtml}>
              导出 HTML
            </button>
            <button type="button" onClick={props.onBackup}>
              工作区备份
            </button>
            <button type="button" onClick={props.onCode}>
              查看页面 JSON
            </button>
            <button
              type="button"
              disabled={props.exporting}
              onClick={() => props.onPrototype(true)}
            >
              导出多页面原型 HTML
            </button>
          </div>
        </details>
      </header>
      <div className="studio-workbench">
        <nav className="studio-rail" aria-label="编辑器面板">
          {(
            [
              { id: 'components', icon: <Plus />, label: '组件' },
              { id: 'layers', icon: <Layers />, label: '图层' },
              { id: 'pages', icon: <FileText />, label: '页面' },
              { id: 'assets', icon: <ImageIcon />, label: '图片' },
              { id: 'data', icon: <Database />, label: '数据' },
              { id: 'design', icon: <Type />, label: '规范' },
              { id: 'symbols', icon: <Copy />, label: '主组件' },
              { id: 'audit', icon: <CheckCircle />, label: '检查' },
            ] as const
          ).map((item) => (
            <button
              type="button"
              key={item.id}
              title={panelNames[item.id]}
              aria-label={panelNames[item.id]}
              aria-pressed={panel === item.id && (compact ? mobilePanel === item.id : showLeft)}
              onClick={() => openPanel(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <span />
          <button
            type="button"
            aria-label={dark ? '主题：切换浅色界面' : '主题：切换深色界面'}
            title={dark ? '切换浅色界面' : '切换深色界面'}
            onClick={() => {
              document.documentElement.dataset.theme = dark ? 'light' : 'dark';
              setDark(!dark);
            }}
          >
            {dark ? <Sun /> : <Moon />}
            <span>主题</span>
          </button>
          <button
            type="button"
            aria-label="帮助与键盘快捷键"
            title="帮助与键盘快捷键"
            onClick={() => setHelp(true)}
          >
            <HelpCircle />
            <span>帮助</span>
          </button>
          <a href="#/" aria-label="返回文档" title="返回文档">
            <ArrowLeft />
            <span>文档</span>
          </a>
        </nav>
        {showLeft && (
          <aside className="studio-left" aria-label={panelNames[panel]}>
            <div className="studio-panel-heading">
              <div>
                <span className="studio-panel-kicker">YOUR CREATIVE SPACE</span>
                <h2>{panelNames[panel]}</h2>
              </div>
              <ToolButton label="收起左侧面板" onClick={() => setLeftOpen(false)}>
                <X />
              </ToolButton>
            </div>
            <div className="studio-panel-scroll">{leftContent}</div>
          </aside>
        )}
        <section className="studio-canvas-column" aria-label="画布工作区">
          <div className="studio-canvas-toolbar">
            <div className="studio-canvas-mode">
              <ToolButton
                label="编辑模式"
                aria-pressed={!interactive}
                onClick={() => api.dispatch({ type: 'setUi', ui: { previewMode: 'edit' } })}
              >
                <Edit />
              </ToolButton>
              <ToolButton
                label="交互预览模式"
                aria-pressed={interactive}
                onClick={() => api.dispatch({ type: 'setUi', ui: { previewMode: 'interactive' } })}
              >
                <Eye />
              </ToolButton>
            </div>
            <div className="studio-devices" role="group" aria-label="画布设备">
              {devices.map((device) => (
                <ToolButton
                  key={device.id}
                  label={`切换到${breakpointLabels[device.id]}画布`}
                  aria-pressed={breakpoint === device.id}
                  onClick={() => setDevice(device.id)}
                >
                  {device.icon}
                </ToolButton>
              ))}
            </div>
            <label className="studio-canvas-width">
              <input
                type="number"
                aria-label="画布宽度"
                min={320}
                max={1920}
                value={customWidth}
                onChange={(event) => {
                  const width = event.target.valueAsNumber;
                  if (Number.isFinite(width) && width >= 320 && width <= 1920)
                    setDevice(width <= 600 ? 'mobile' : width <= 900 ? 'tablet' : 'desktop', width);
                }}
              />
              <span>px</span>
            </label>
            <select
              aria-label="画布缩放"
              className="studio-zoom"
              value={zoom}
              onChange={(event) => setZoom(event.target.value)}
            >
              <option value="auto">适应 · {Math.round(canvasScale * 100)}%</option>
              {[25, 50, 75, 100, 125, 150].map((n) => (
                <option value={n} key={n}>
                  {n}%
                </option>
              ))}
            </select>
            <ToolButton
              label={focusMode ? '退出专注模式' : '专注模式'}
              className="studio-focus-button"
              aria-pressed={focusMode}
              onClick={() => {
                setFocusMode(!focusMode);
                setZoom('auto');
              }}
            >
              <Maximize />
            </ToolButton>
            <ToolButton
              label="切换属性面板"
              aria-pressed={compact ? mobilePanel === 'inspector' : showRight}
              onClick={() =>
                compact
                  ? setMobilePanel('inspector')
                  : (setRightOpen(!rightOpen), setFocusMode(false))
              }
            >
              <Edit />
            </ToolButton>
          </div>
          <BuilderCanvasTools
            breakpoint={breakpoint}
            rootRef={rootRef}
            stageRef={stageRef}
            scale={canvasScale}
            interactive={interactive}
            onNotice={props.onNotice}
            onSaveBlock={() => {
              if (!selected) return;
              if (savedBlocks.length >= 20) {
                props.onNotice('区块库最多 20 个，请先导出或移除不用的区块。');
                return;
              }
              setSaveBlockName(
                nodeLabel(selected, builderConfig.components[selected.type].label || '自定义区块')
              );
            }}
          />
          <div
            className="studio-canvas-stage"
            ref={stageRef}
            data-interactive={interactive || undefined}
          >
            <div className="studio-canvas-caption">
              <span className={interactive ? 'is-interactive' : ''} />
              {interactive
                ? '交互预览 · 可以点击按钮和填写表单'
                : `${breakpointLabels[breakpoint]}画布 · 点击组件开始编辑`}
              <span>{customWidth} × 自适应</span>
            </div>
            <div className="studio-canvas-scroll">
              <div className="studio-canvas-device" style={{ width: customWidth * canvasScale }}>
                <div
                  className="studio-canvas-surface"
                  style={{
                    width: customWidth,
                    height: `${100 / canvasScale}%`,
                    transform: `scale(${canvasScale})`,
                  }}
                >
                  <div
                    className="studio-edit-preview"
                    data-inactive={interactive || undefined}
                    aria-hidden={interactive || undefined}
                    inert={interactive || undefined}
                  >
                    <Puck.Preview />
                  </div>
                  {interactive && <BuilderInteractivePreview data={data} />}
                </div>
              </div>
            </div>
            {!data.content.length && !interactive && (
              <div className="studio-canvas-empty">
                <span>
                  <Plus />
                </span>
                <h2>从这里开始创造</h2>
                <p>拖入组件，或从一个完整区块开始。</p>
                <button
                  type="button"
                  onClick={() => {
                    setPanel('components');
                    setLibraryTab('blocks');
                    if (compact) setMobilePanel('components');
                    else {
                      setLeftOpen(true);
                      setFocusMode(false);
                    }
                  }}
                >
                  浏览预设区块 <ChevronRight />
                </button>
              </div>
            )}
          </div>
          <footer className="studio-canvas-footer">
            <div className="studio-breadcrumb" aria-label="当前选中路径">
              <button type="button" onClick={() => select(null)}>
                <FileText />
                页面
              </button>
              {[...ancestors, ...(selected ? [selected] : [])].map((node) => (
                <span key={node.props.id}>
                  <ChevronRight />
                  <button type="button" onClick={() => select(node.props.id)}>
                    {nodeLabel(node, builderConfig.components[node.type].label || node.type)}
                  </button>
                </span>
              ))}
            </div>
            <span>{entries.length} 个组件</span>
          </footer>
        </section>
        {showRight && (
          <aside className="studio-right" aria-label="属性面板">
            {inspector}
          </aside>
        )}
      </div>
      <div className="studio-statusbar">
        <p className="doc-builder-notice" role="status">
          {props.notice || '灵感就位，开始创造。拖入组件，或点加号插入；所有修改自动保存。'}
        </p>
        <button type="button" onClick={() => setHelp(true)}>
          ⌘ / Ctrl S 保存版本
        </button>
      </div>
      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        aria-label="上传工作区图片"
        onChange={(event) => {
          void uploadImage(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        type="file"
        accept=".json,application/json"
        ref={blockImportRef}
        hidden
        aria-label="导入我的区块库"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            if (file.size > 32 * 1024 * 1024) throw new Error('区块库文件最多 32 MB。');
            const blocks = parseBlockLibrary(await file.text());
            if (blocks.length + savedBlocks.length > 20)
              throw new Error('合并后超过 20 个区块，请先整理区块库。');
            if (
              persistBlocks([
                ...savedBlocks,
                ...blocks.map((block) => ({ ...block, id: builderId('block') })),
              ])
            )
              props.onNotice(`已导入 ${blocks.length} 个区块。`);
          } catch (error) {
            props.onNotice(error instanceof Error ? error.message : '导入失败。');
          }
        }}
      />
      <Modal
        open={saveBlockName !== null}
        onOpenChange={(open) => {
          if (!open) setSaveBlockName(null);
        }}
      >
        <Modal.Content size="sm">
          <Modal.Header>
            <Modal.Title>保存可复用区块</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!selected || !saveBlockName?.trim()) return;
                if (
                  persistBlocks([
                    ...savedBlocks,
                    createSavedBlock(
                      saveBlockName,
                      selected,
                      data.root.props?.datasets || [],
                      data.root.props
                    ),
                  ])
                ) {
                  setSaveBlockName(null);
                  setLibraryTab('saved');
                  setPanel('components');
                  setLeftOpen(true);
                  props.onNotice('区块已保存，可在“我的区块”重复使用或导出。');
                }
              }}
            >
              <label className="studio-control">
                <span>区块名称</span>
                <input
                  aria-label="区块名称"
                  required
                  maxLength={80}
                  value={saveBlockName || ''}
                  onChange={(event) => setSaveBlockName(event.target.value)}
                />
              </label>
              <p>
                保留嵌套组件、三端与状态样式、设计变量、交互状态和数据源。所有副本都可独立编辑。
              </p>
              <button type="submit" className="studio-primary-action">
                保存区块
              </button>
            </form>
          </Modal.Body>
        </Modal.Content>
      </Modal>
      <Modal
        open={mobilePanel !== null}
        onOpenChange={(open) => {
          if (!open) setMobilePanel(null);
        }}
      >
        <Modal.Content size="sm" className="studio-mobile-panel">
          <Modal.Header>
            <Modal.Title>
              {mobilePanel === 'inspector' ? '属性面板' : panelNames[panel]}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>{mobilePanel === 'inspector' ? inspector : leftContent}</Modal.Body>
        </Modal.Content>
      </Modal>
      <Modal open={help} onOpenChange={setHelp}>
        <Modal.Content size="md" className="studio-help-dialog">
          <Modal.Header>
            <Modal.Title>把专注留给创造</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>选中组件后使用快捷键。输入文字时，编辑框保留原生的复制、粘贴和撤销行为。</p>
            <dl>
              {[
                ['⌘ / Ctrl S', '保存版本'],
                ['⌘ / Ctrl Z', '撤销'],
                ['⌘ / Ctrl Shift Z', '重做'],
                ['⌘ / Ctrl D', '复制组件'],
                ['⌘ / Ctrl C / X / V', '复制 / 剪切 / 粘贴组件'],
                ['Delete / Backspace', '删除组件'],
                ['Alt ↑ / ↓', '上移 / 下移组件'],
                ['Esc', '选中父级 / 返回页面设置'],
              ].map(([key, text]) => (
                <div key={key}>
                  <dt>{text}</dt>
                  <dd>
                    <kbd>{key}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              图层可拖动排序或移入容器；在样式面板中可为手机和平板覆盖桌面样式。导出 HTML
              后，样式与表单交互仍可独立使用。
            </p>
          </Modal.Body>
        </Modal.Content>
      </Modal>
    </div>
  );
}
