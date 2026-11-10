'use client';

import { Button, Input, Modal, MessageProvider } from '@zui/react';
import { Clock } from '@zui/icons';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePageTitle } from '../../components/usePageTitle';
import { copyCodeText } from '../../components/CodeBlock';
import { builderConfig } from './builder-config';
import { BuilderEditor } from './BuilderEditor';
import {
  checkedStructure,
  childNodes,
  containerTypes,
  insertNode,
  ROOT_ZONE,
} from './builder-tree';
import { flattenNodes } from './builder-tree';
import { BuilderEditorSelection } from './builder-scene-runtime';
import { useBuilderEditor } from './builder-editor-context';
import { BuilderTemplateGallery } from './BuilderTemplateGallery';
import { tokenReference, validateTokens } from './builder-tokens';
import {
  createSymbol,
  detachSymbol,
  findInstance,
  linkOriginal,
  newSymbolInstance,
  switchSymbolVariant,
  updateSymbol,
  validateSymbols,
  type BuilderInstance,
} from './builder-symbols';
import { isNodeLocked, mapBuilderNodes } from './builder-selection';
import type { BuilderAction, BuilderNodeLogic } from './builder-logic';
import './builder-studio.css';
import { builderTemplates, initialBuilderData } from './builder-templates';
import {
  builderId,
  countBuilderComponents,
  createBuilderPage,
  MAX_IMPORT_BYTES,
  parseBuilderImport,
  saveDownload,
  type BuilderData,
} from './builder-model';
import { useBuilderWorkspace } from './use-builder-workspace';
import './builder-page.css';

type PuckOverrides = NonNullable<Parameters<typeof Puck>[0]['overrides']>;

const visuallyHiddenHeadingStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

function BuilderCanvasFrame({ children, document }: { children: ReactNode; document?: Document }) {
  const api = useBuilderEditor((state) => state);
  const entries = flattenNodes(api.appState.data.content);
  const selection: string[] = [];
  let entry = entries.find(({ node }) => node.props.id === api.selectedItem?.props.id);
  while (entry) {
    selection.push(entry.node.props.id);
    const parentId = entry.parent?.props.id;
    entry = parentId ? entries.find(({ node }) => node.props.id === parentId) : undefined;
  }
  useEffect(() => {
    if (!document) return undefined;
    document.title = '页面搭建器画布';
    document.documentElement.lang = 'zh-CN';

    const normalizeEditableComponents = () => {
      const editCanvas = document.querySelector('[data-puck-entry][data-puck-preview-mode="edit"]');
      if (!editCanvas) return;

      // Puck 当前仍会在组件外层添加 draggable button 语义，即使启用了独立拖拽
      // handle。这会让 Button 等真实控件形成嵌套交互，也让空 Divider 产生无名按钮。
      // 编辑态的拖拽入口已经由 action bar handle 承担，因此移除重复的外层语义；
      // 组件仍可点击选中，键盘用户也可通过结构面板选择并操作组件。
      editCanvas
        .querySelectorAll<HTMLElement>('[data-puck-component][aria-roledescription="draggable"]')
        .forEach((component) => {
          component.removeAttribute('role');
          component.removeAttribute('tabindex');
          component.removeAttribute('aria-roledescription');
          component.removeAttribute('aria-describedby');
          component.removeAttribute('aria-pressed');
        });

      // 组件被选中后，Puck 会把操作栏作为 portal 放到 main 之外。为这块动态内容补充
      // 命名地标，既保留现有按钮语义，也确保整个 iframe 的可见内容都位于 landmark 中。
      document
        .querySelectorAll<HTMLButtonElement>('button[title="拖拽排序"]')
        .forEach((dragHandle) => {
          const actionBar = dragHandle.parentElement?.parentElement;
          if (!actionBar) return;
          if (actionBar.getAttribute('role') !== 'region') {
            actionBar.setAttribute('role', 'region');
          }
          if (actionBar.getAttribute('aria-label') !== '选中组件操作') {
            actionBar.setAttribute('aria-label', '选中组件操作');
          }
        });
    };

    normalizeEditableComponents();
    const FrameMutationObserver = document.defaultView?.MutationObserver;
    const observer = FrameMutationObserver
      ? new FrameMutationObserver(normalizeEditableComponents)
      : undefined;
    observer?.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        'aria-describedby',
        'aria-pressed',
        'aria-roledescription',
        'data-puck-preview-mode',
        'role',
        'tabindex',
      ],
    });

    return () => observer?.disconnect();
  }, [document]);

  return (
    <main aria-labelledby="builder-canvas-title">
      <h1 id="builder-canvas-title" style={visuallyHiddenHeadingStyle}>
        页面搭建器画布
      </h1>
      <BuilderEditorSelection.Provider value={selection}>
        {children}
      </BuilderEditorSelection.Provider>
    </main>
  );
}

const PUCK_OVERRIDES: PuckOverrides = {
  iframe: BuilderCanvasFrame,
};

const PUCK_DICTIONARY: NonNullable<Parameters<typeof Puck>[0]['dictionary']> = {
  'header-publish': '保存版本',
  'header-undo': '撤销',
  'header-redo': '重做',
  'header-toggle-leftsidebar': '切换组件面板',
  'header-toggle-rightsidebar': '切换属性面板',
  'header-toggle-menubar': '切换工具菜单',
  'action-selectparent': '选择父级',
  'action-drag': '拖拽排序',
  'action-duplicate': '复制组件',
  'action-delete': '删除组件',
  'label-page': '页面',
  'label-component': '组件',
  'outline-empty': '暂无组件',
  'outline-item-collapse': '收起',
  'outline-item-expand': '展开',
  'outline-header-title': '页面结构',
  'outline-header-collapseall': '全部收起',
  'outline-item-duplicate': '复制组件',
  'outline-item-delete': '删除组件',
  'drawer-category-collapse': '收起 {title}',
  'drawer-category-expand': '展开 {title}',
  'drawer-category-other': '其他',
  'canvas-noconfig': '{type} 暂无可编辑属性',
  'plugin-blocks': '组件',
  'plugin-outline': '结构',
  'plugin-fields': '属性',
  'plugin-components': '组件',
  'viewport-zoom-in': '放大画布',
  'viewport-zoom-out': '缩小画布',
  'viewport-zoom-auto': '{zoom}%（自动）',
  'viewport-toggle-menu': '切换画布尺寸菜单',
  'viewport-switch': '切换到{label}画布',
  'viewport-switch-default': '切换画布尺寸',
  'layout-maximize': '最大化',
  'layout-minimize': '还原',
  'loader-loading': '正在加载页面画布',
};

export default function BuilderPage(): React.ReactNode {
  usePageTitle('页面搭建器');
  const { workspace, update, persist, status, message, savedAt, reload, rebuild, rawBackup } =
    useBuilderWorkspace(initialBuilderData);
  const current = workspace.pages.find((page) => page.id === workspace.activeId)!;
  const [notice, setNotice] = useState('');
  const [editorRevision, setEditorRevision] = useState(0);
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | 'history' | 'rebuild' | null>(
    null
  );
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState('auto');
  const [exporting, setExporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return undefined;
    const keyboardPatchedPluginTabs = new WeakSet<HTMLElement>();

    const patchThirdPartyA11y = () => {
      const zoomSelect = Array.from(root.querySelectorAll<HTMLSelectElement>('select')).find(
        (select) => Array.from(select.options).some((option) => option.label.includes('（自动）'))
      );
      if (zoomSelect && !zoomSelect.getAttribute('aria-label')) {
        zoomSelect.setAttribute('aria-label', '画布缩放');
      }

      const previewFrame = root.querySelector<HTMLIFrameElement>('iframe#preview-frame');
      if (previewFrame && !previewFrame.title) previewFrame.title = '页面画布预览';

      const loader = root.querySelector<HTMLElement>(
        '[aria-label="loading"], [aria-label="正在加载页面画布"]'
      );
      if (loader) {
        if (loader.getAttribute('role') !== 'status') loader.setAttribute('role', 'status');
        if (loader.getAttribute('aria-label') !== '正在加载页面画布') {
          loader.setAttribute('aria-label', '正在加载页面画布');
        }
      }

      // Puck 0.24 的插件导航项是带 click handler 的 div，默认无法聚焦或用键盘激活。
      // 保留第三方布局，只补齐等价的按钮语义、选中状态与 Enter / Space 行为。
      root.querySelectorAll<HTMLElement>('nav > ul > li > div').forEach((pluginTab) => {
        const label = pluginTab.textContent?.trim();
        if (label !== '组件' && label !== '结构' && label !== '属性') return;

        if (pluginTab.getAttribute('role') !== 'button') {
          pluginTab.setAttribute('role', 'button');
        }
        if (pluginTab.getAttribute('tabindex') !== '0') {
          pluginTab.setAttribute('tabindex', '0');
        }

        const isActive = Array.from(pluginTab.parentElement?.classList ?? []).some((className) =>
          className.includes('NavItem--active')
        );
        if (pluginTab.getAttribute('aria-pressed') !== String(isActive)) {
          pluginTab.setAttribute('aria-pressed', String(isActive));
        }

        if (!keyboardPatchedPluginTabs.has(pluginTab)) {
          pluginTab.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            pluginTab.click();
          });
          keyboardPatchedPluginTabs.add(pluginTab);
        }
      });

      // Puck 的结构树同样把整行设为 draggable button，内部又包含展开、选择、复制和删除
      // button。画布 action bar 已保留独立的键盘拖拽入口，因此这里移除重复包装语义，保留
      // 内部真实按钮的完整 Tab 顺序与操作能力。
      root
        .querySelectorAll<HTMLElement>(
          '[data-puck-layer-tree-id] > [aria-roledescription="draggable"][role="button"]'
        )
        .forEach((layer) => {
          layer.removeAttribute('role');
          layer.removeAttribute('tabindex');
          layer.removeAttribute('aria-roledescription');
          layer.removeAttribute('aria-describedby');
          layer.removeAttribute('aria-pressed');
          layer.removeAttribute('aria-grabbed');
          layer.removeAttribute('aria-disabled');
        });
    };

    patchThirdPartyA11y();
    const observer = new MutationObserver(patchThirdPartyA11y);
    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        'aria-describedby',
        'aria-disabled',
        'aria-grabbed',
        'aria-pressed',
        'aria-roledescription',
        'class',
        'role',
        'tabindex',
      ],
    });
    return () => observer.disconnect();
  }, [workspace.activeId, editorRevision]);

  const updateData = (data: BuilderData) => {
    try {
      checkedStructure(data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '页面结构无效，已保留修改前的内容。');
      setEditorRevision((revision) => revision + 1);
      return;
    }
    data = { ...data };
    if (data.zones && !Object.keys(data.zones).length) delete data.zones;
    update((previous) => {
      const active = previous.pages.find((page) => page.id === previous.activeId)!;
      if (JSON.stringify(active.data) === JSON.stringify(data)) return previous;
      return {
        ...previous,
        pages: previous.pages.map((page) =>
          page.id === previous.activeId
            ? { ...page, data, updatedAt: new Date().toISOString() }
            : page
        ),
      };
    });
  };

  const saveVersion = (data = current.data) => {
    update((previous) => ({
      ...previous,
      pages: previous.pages.map((page) =>
        page.id === previous.activeId
          ? {
              ...page,
              data,
              updatedAt: new Date().toISOString(),
              snapshots: [
                {
                  id: builderId('snapshot'),
                  savedAt: new Date().toISOString(),
                  data: structuredClone(data),
                },
                ...page.snapshots,
              ].slice(0, 5),
            }
          : page
      ),
    }));
    if (persist()) setNotice('已保存当前版本，可从“版本历史”恢复。');
  };

  const addPage = (templateId: string) => {
    const template = builderTemplates.find((item) => item.id === templateId)!;
    if (workspace.pages.length >= 20) {
      setNotice('工作区最多 20 页，请先备份并删除不再使用的页面。');
      return;
    }
    const page = createBuilderPage(template.name, template.data);
    update((previous) => ({ ...previous, activeId: page.id, pages: [...previous.pages, page] }));
    setDialog(null);
    setNotice(`已创建“${page.name}”，原页面继续保留。`);
  };

  const importFile = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice('导入文件不能超过 32 MB。');
      return;
    }
    try {
      const imported = parseBuilderImport(await file.text());
      if (workspace.pages.length + imported.pages.length > 20)
        throw new Error('导入后将超过 20 页，请先整理工作区。');
      const pages = imported.pages.map((page) => ({ ...page, id: builderId() }));
      const pageAliases = new Map(imported.pages.map((page, index) => [page.id, pages[index].id]));
      const symbolAliases = new Map<string, string>();
      const symbols = structuredClone(workspace.symbols || []);
      const addedSymbolIds = new Set<string>();
      for (const symbol of imported.symbols || []) {
        const existing = symbols.find((item) => item.id === symbol.id);
        const remapsNavigation = symbol.variants.some(
          (variant) =>
            JSON.stringify(variant.node).includes('"navigate"') &&
            [...pageAliases.keys()].some((id) => JSON.stringify(variant.node).includes(`"${id}"`))
        );
        if (existing && JSON.stringify(existing) === JSON.stringify(symbol) && !remapsNavigation)
          continue;
        const id = existing ? builderId('symbol') : symbol.id;
        symbolAliases.set(symbol.id, id);
        symbols.push({ ...symbol, id });
        addedSymbolIds.add(id);
      }
      validateSymbols(symbols);
      const remapActions = (actions: BuilderAction[]): BuilderAction[] =>
        actions.map((action) =>
          action.type === 'navigate'
            ? { ...action, pageId: pageAliases.get(action.pageId) || action.pageId }
            : action.type === 'condition' || action.type === 'confirm'
              ? {
                  ...action,
                  then: remapActions(action.then),
                  otherwise: remapActions(action.otherwise),
                }
              : action
        );
      const remapData = (data: BuilderData): BuilderData => ({
        ...data,
        content: mapBuilderNodes(data.content, (node) => {
          const logic = node.props._logic as BuilderNodeLogic | undefined;
          const instance = node.props._instance as BuilderInstance | undefined;
          return {
            ...node,
            props: {
              ...node.props,
              ...(instance
                ? {
                    _instance: {
                      ...instance,
                      symbolId: symbolAliases.get(instance.symbolId) || instance.symbolId,
                    },
                  }
                : {}),
              ...(logic
                ? {
                    _logic: {
                      ...logic,
                      ...Object.fromEntries(
                        (['click', 'change', 'submit'] as const)
                          .filter((key) => logic[key])
                          .map((key) => [key, remapActions(logic[key]!)])
                      ),
                    },
                  }
                : {}),
            },
          };
        }),
      });
      for (const page of pages) {
        page.data = remapData(page.data);
        page.snapshots = page.snapshots.map((snapshot) => ({
          ...snapshot,
          data: remapData(snapshot.data),
        }));
      }
      for (const symbol of symbols)
        if (addedSymbolIds.has(symbol.id))
          symbol.variants = symbol.variants.map((variant) => ({
            ...variant,
            node: remapData({ root: { props: {} }, content: [variant.node] }).content[0],
          }));
      update((previous) => ({
        ...previous,
        activeId: pages[0].id,
        pages: [...previous.pages, ...pages],
        symbols,
      }));
      setNotice(`已导入 ${pages.length} 个页面，原有页面继续保留。`);
    } catch (error) {
      setNotice(
        `导入失败：${error instanceof Error ? error.message : '文件格式不正确。'} 原页面未修改。`
      );
    }
  };

  const exportPage = () => {
    saveDownload(
      JSON.stringify(
        {
          format: 'zui-page',
          version: 1,
          pageId: current.id,
          name: current.name,
          data: current.data,
          symbols: workspace.symbols || [],
        },
        null,
        2
      ),
      `${current.name}.json`
    );
    setNotice('页面 JSON 已导出，可重新导入继续编辑。');
  };
  const exportWorkspace = () => {
    saveDownload(JSON.stringify(workspace, null, 2), 'ZUI-页面工作区.json');
    setNotice('工作区已备份，包含所有页面和最近保存版本。');
  };
  const generateHtml = async (
    mode: 'preview' | 'download' | 'prototype-preview' | 'prototype-download'
  ) => {
    setExporting(true);
    try {
      const { exportBuilderHtml, exportBuilderPrototypeHtml } = await import('./builder-export');
      const isPrototype = mode.startsWith('prototype');
      const html = isPrototype
        ? exportBuilderPrototypeHtml({
            format: 'zui-prototype',
            version: 1,
            startId: current.id,
            pages: workspace.pages.map(({ id, name, data }) => ({ id, name, data })),
          })
        : exportBuilderHtml(current.data, current.name);
      if (mode.endsWith('preview')) {
        setPreviewWidth('auto');
        setPreview(html);
      } else {
        saveDownload(
          html,
          isPrototype ? 'ZUI-多页面交互原型.html' : `${current.name}.html`,
          'text/html;charset=utf-8'
        );
        setNotice(
          isPrototype
            ? '多页面交互原型已导出，页面切换、交互状态和全部页面保存在同一 HTML 中。'
            : 'HTML 已导出，可直接用浏览器打开。页面样式和表单数据下载已包含在文件内。'
        );
      }
    } catch (error) {
      setNotice(`页面生成失败：${error instanceof Error ? error.message : '请检查属性值后重试。'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="doc-page doc-builder-page">
      {message && (
        <div className="doc-builder-storage-error" role="alert">
          <p>{message}</p>
          <div>
            <Button size="sm" variant="outline" onClick={exportWorkspace}>
              备份当前工作区
            </Button>
            {status === 'error' && (
              <Button size="sm" onClick={() => persist()}>
                重试保存
              </Button>
            )}
            {status === 'conflict' && (
              <Button
                size="sm"
                onClick={() => {
                  if (reload()) {
                    setEditorRevision((value) => value + 1);
                    setNotice('已载入最新工作区。');
                  }
                }}
              >
                载入最新存档
              </Button>
            )}
            {status === 'corrupt' && rawBackup && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveDownload(rawBackup, 'ZUI-原始存档.txt', 'text/plain')}
              >
                下载原始存档
              </Button>
            )}
            {['corrupt', 'conflict'].includes(status) && (
              <Button size="sm" variant="outline" onClick={() => setDialog('rebuild')}>
                重建本地存档
              </Button>
            )}
          </div>
        </div>
      )}

      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        aria-label="导入页面或工作区 JSON"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importFile(file);
        }}
      />
      <MessageProvider>
        <div className="doc-builder-editor" ref={editorRef}>
          <Puck
            key={`${workspace.activeId}-${editorRevision}`}
            config={builderConfig}
            data={current.data}
            dictionary={PUCK_DICTIONARY}
            dnd={{ enableDragHandle: true }}
            overrides={PUCK_OVERRIDES}
            ui={{
              viewports: {
                current: { width: 1280, height: 'auto' },
                controlsVisible: false,
                options: [],
              },
            }}
            onChange={updateData}
          >
            <BuilderEditor
              pages={workspace.pages}
              activeId={workspace.activeId}
              status={status}
              savedAt={savedAt}
              notice={notice}
              exporting={exporting}
              modalOpen={!!dialog || !!preview || codeOpen}
              onPage={(id) => {
                update((previous) => ({ ...previous, activeId: id }));
                setNotice('');
              }}
              onNew={() => setDialog('new')}
              onRename={() => {
                setName(current.name);
                setDialog('rename');
              }}
              onDuplicatePage={() => {
                if (workspace.pages.length >= 20) return;
                const page = createBuilderPage(`${current.name.slice(0, 75)} 副本`, current.data);
                update((previous) => ({
                  ...previous,
                  activeId: page.id,
                  pages: [...previous.pages, page],
                }));
                setNotice('已复制当前页面。');
              }}
              onDeletePage={() => setDialog('delete')}
              onHistory={() => setDialog('history')}
              onSave={() => saveVersion()}
              onPreview={() => void generateHtml('preview')}
              onPrototype={(download) =>
                void generateHtml(download ? 'prototype-download' : 'prototype-preview')
              }
              onImport={() => importRef.current?.click()}
              onExportPage={exportPage}
              onExportHtml={() => void generateHtml('download')}
              onBackup={exportWorkspace}
              onCode={() => setCodeOpen(true)}
              onNotice={setNotice}
              symbols={workspace.symbols || []}
              onSymbol={(command, latestData) => {
                try {
                  let next = {
                    ...workspace,
                    pages: workspace.pages.map((page) =>
                      page.id === current.id ? { ...page, data: latestData } : page
                    ),
                  };
                  let data = latestData;
                  if (command.type === 'create') {
                    const selected = flattenNodes(data.content).find(
                      ({ node }) => node.props.id === command.nodeId
                    )?.node;
                    if (!selected) throw new Error('请先选择组件。');
                    if (isNodeLocked(data, selected.props.id)) throw new Error('请先解锁选区。');
                    const symbol = createSymbol(command.name, selected, data);
                    if ((next.symbols?.length || 0) >= 50) throw new Error('主组件最多 50 个。');
                    data = linkOriginal(data, symbol, selected.props.id);
                    next.symbols = [...(next.symbols || []), symbol];
                    setNotice('主组件已创建，当前选区已关联；可继续插入实例和设计变体。');
                  } else if (command.type === 'insert') {
                    const symbol = next.symbols?.find((item) => item.id === command.symbolId);
                    if (!symbol) throw new Error('主组件不存在。');
                    const activeInstance = findInstance(data, command.selectedId);
                    const selected = flattenNodes(data.content).find(
                      ({ node }) =>
                        node.props.id === (activeInstance?.node.props.id || command.selectedId)
                    );
                    const targetParentId =
                      selected && !activeInstance && containerTypes.has(selected.node.type)
                        ? selected.node.props.id
                        : selected?.parent?.props.id;
                    if (targetParentId && isNodeLocked(data, targetParentId))
                      throw new Error('目标容器已锁定，请先解锁。');
                    const { node, data: merged } = newSymbolInstance(
                      data,
                      symbol,
                      command.variantId
                    );
                    const inside =
                      selected && !activeInstance && containerTypes.has(selected.node.type);
                    const target = inside
                      ? `${selected.node.props.id}:content`
                      : selected?.zone || ROOT_ZONE;
                    data = insertNode(
                      merged,
                      node,
                      target,
                      inside
                        ? childNodes(selected.node).length
                        : selected
                          ? selected.index + 1
                          : data.content.length
                    );
                    setNotice('已插入关联实例，文字与样式可以独立覆盖。');
                  } else if (command.type === 'switch') {
                    const symbol = next.symbols?.find((item) => item.id === command.symbolId);
                    if (!symbol) throw new Error('主组件不存在。');
                    data = switchSymbolVariant(
                      data,
                      command.nodeId,
                      symbol,
                      command.variantId,
                      command.reset
                    );
                    setNotice(
                      command.reset
                        ? '实例已恢复主组件设计，覆盖已清除。'
                        : '已切换变体，实例的独立覆盖保留。'
                    );
                  } else if (command.type === 'detach') {
                    data = detachSymbol(data, command.nodeId);
                    setNotice('实例已解除关联，继续作为普通组件编辑。');
                  } else if (command.type === 'update') {
                    next = updateSymbol(next, current.id, command.nodeId, command.variantName);
                    data = next.pages.find((page) => page.id === current.id)!.data;
                    setNotice(
                      command.variantName
                        ? '已保存新变体，并关联当前实例。'
                        : '主组件已同步至所有页面，实例的独立覆盖保留。'
                    );
                  } else if (command.type === 'delete') {
                    const used = next.pages.some((page) =>
                      flattenNodes(page.data.content).some(
                        ({ node }) =>
                          (node.props._instance as { symbolId?: string } | undefined)?.symbolId ===
                          command.symbolId
                      )
                    );
                    if (used) throw new Error('还有页面引用此主组件，请先解除所有实例关联。');
                    next.symbols = next.symbols?.filter((symbol) => symbol.id !== command.symbolId);
                    setNotice('未被引用的主组件已移除。');
                  }
                  checkedStructure(data);
                  next.pages = next.pages.map((page) =>
                    page.id === current.id
                      ? { ...page, data, updatedAt: new Date().toISOString() }
                      : page
                  );
                  update(() => next);
                  return data;
                } catch (reason) {
                  setNotice(reason instanceof Error ? reason.message : '主组件操作失败。');
                  return false;
                }
              }}
              onDesignTokens={(tokens) => {
                try {
                  const pages = workspace.pages.map((page) => {
                    const existing = page.data.root.props?.tokens || [];
                    for (const token of existing)
                      if (
                        tokens.some((item) => item.key === token.key && item.type !== token.type) &&
                        JSON.stringify(page.data.content).includes(tokenReference(token))
                      )
                        throw new Error(
                          `页面“${page.name}”正在引用不同类型的同名变量 ${token.key}，请先调整。`
                        );
                    const merged = validateTokens([
                      ...tokens,
                      ...existing.filter((token) => !tokens.some((item) => item.key === token.key)),
                    ]);
                    return {
                      ...page,
                      data: {
                        ...page.data,
                        root: {
                          ...page.data.root,
                          props: { ...page.data.root.props, tokens: merged },
                        },
                      },
                      updatedAt: new Date().toISOString(),
                    };
                  });
                  update((previous) => ({ ...previous, pages }));
                  setEditorRevision((value) => value + 1);
                  setNotice('设计规范已同步到全部页面；其他页面独有的变量继续保留。');
                } catch (reason) {
                  setNotice(reason instanceof Error ? reason.message : '同步失败。');
                }
              }}
            />
          </Puck>
        </div>
      </MessageProvider>

      <pre className="doc-builder-json" hidden>
        {JSON.stringify(current.data, null, 2)}
      </pre>
      <Modal open={codeOpen} onOpenChange={setCodeOpen}>
        <Modal.Content size="lg" className="studio-code-dialog">
          <Modal.Header>
            <Modal.Title>当前页面 JSON</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>复制数据用于开发接入，或导出 JSON 继续编辑。</p>
            <Button
              size="sm"
              variant="outline"
              onClick={async () =>
                setNotice(
                  (await copyCodeText(JSON.stringify(current.data, null, 2)))
                    ? 'JSON 已复制。'
                    : '复制失败，可使用导出 JSON。'
                )
              }
            >
              复制 JSON
            </Button>
            <pre tabIndex={0} aria-label="页面数据">
              {JSON.stringify(current.data, null, 2)}
            </pre>
          </Modal.Body>
        </Modal.Content>
      </Modal>

      <Modal
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <Modal.Content size={dialog === 'new' ? 'lg' : 'md'} className="doc-builder-dialog">
          <Modal.Header>
            <Modal.Title>
              {
                (
                  {
                    new: '选择一个起点',
                    rename: '重命名页面',
                    delete: '删除当前页面',
                    history: '保存版本',
                    rebuild: '重建本地存档',
                  } as const
                )[dialog ?? 'new']
              }
            </Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            {dialog === 'new' && <BuilderTemplateGallery onCreate={addPage} />}
            {dialog === 'rename' && (
              <form
                id="builder-rename-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!name.trim()) return;
                  update((previous) => ({
                    ...previous,
                    pages: previous.pages.map((page) =>
                      page.id === previous.activeId
                        ? { ...page, name: name.trim().slice(0, 80) }
                        : page
                    ),
                  }));
                  setDialog(null);
                  setNotice('页面名称已更新。');
                }}
              >
                <label htmlFor="builder-rename">页面名称</label>
                <Input
                  id="builder-rename"
                  data-autofocus
                  maxLength={80}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </form>
            )}
            {dialog === 'delete' && (
              <p>将删除“{current.name}”及其保存版本。请先导出需要保留的内容。</p>
            )}
            {dialog === 'rebuild' && (
              <p>
                将以当前工作区替换浏览器中的存档。建议先下载当前工作区和原始存档；其他标签页的未合并编辑不会自动加入。
              </p>
            )}
            {dialog === 'history' && (
              <>
                <p className="doc-builder-dialog-intro">
                  保留最近 5
                  次手动保存的版本。自动保存持续更新草稿；恢复前会保留当前内容为一个版本。
                </p>
                {current.snapshots.length ? (
                  <ol className="doc-builder-history">
                    {current.snapshots.map((snapshot, index) => (
                      <li key={snapshot.id}>
                        <div>
                          <strong>保存版本 {current.snapshots.length - index}</strong>
                          <time dateTime={snapshot.savedAt}>
                            {new Date(snapshot.savedAt).toLocaleString('zh-CN')}
                          </time>
                          <small>{countBuilderComponents(snapshot.data)} 个组件</small>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            update((previous) => ({
                              ...previous,
                              pages: previous.pages.map((page) =>
                                page.id === previous.activeId
                                  ? {
                                      ...page,
                                      data: structuredClone(snapshot.data),
                                      updatedAt: new Date().toISOString(),
                                      snapshots: [
                                        {
                                          id: builderId('snapshot'),
                                          savedAt: new Date().toISOString(),
                                          data: structuredClone(page.data),
                                        },
                                        ...page.snapshots,
                                      ].slice(0, 5),
                                    }
                                  : page
                              ),
                            }));
                            setEditorRevision((value) => value + 1);
                            setDialog(null);
                            setNotice('已恢复保存版本，恢复前的内容已加入版本历史。');
                          }}
                        >
                          恢复此版本
                        </Button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="doc-builder-history-empty">
                    <Clock aria-hidden="true" />
                    <strong>还没有保存版本</strong>
                    <p>点击“保存版本”，为重要进展留一个可恢复的节点。</p>
                  </div>
                )}
              </>
            )}
          </Modal.Body>
          {dialog === 'rename' && (
            <Modal.Footer>
              <Button variant="outline" onClick={() => setDialog(null)}>
                取消
              </Button>
              <Button type="submit" form="builder-rename-form" disabled={!name.trim()}>
                保存名称
              </Button>
            </Modal.Footer>
          )}
          {dialog === 'delete' && (
            <Modal.Footer>
              <Button variant="outline" onClick={() => setDialog(null)}>
                取消
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  update((previous) => {
                    const pages = previous.pages.filter((page) => page.id !== previous.activeId);
                    if (!pages.length)
                      pages.push(createBuilderPage('空白页面', builderTemplates[0].data));
                    return { ...previous, pages, activeId: pages[0].id };
                  });
                  setDialog(null);
                  setNotice('页面已删除。');
                }}
              >
                确认删除
              </Button>
            </Modal.Footer>
          )}
          {dialog === 'rebuild' && (
            <Modal.Footer>
              <Button variant="outline" onClick={() => setDialog(null)}>
                取消
              </Button>
              <Button
                onClick={() => {
                  if (rebuild()) {
                    setDialog(null);
                    setNotice('本地存档已重建。');
                  }
                }}
              >
                确认重建
              </Button>
            </Modal.Footer>
          )}
        </Modal.Content>
      </Modal>

      <Modal
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <Modal.Content className="doc-builder-preview-dialog" size="lg">
          <Modal.Header>
            <Modal.Title>{current.name} · 页面预览</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <div className="doc-builder-preview-toolbar">
            <p>与导出 HTML 一致的独立页面</p>
            <div role="group" aria-label="页面预览尺寸">
              {[
                ['auto', '自适应'],
                ['768', '平板'],
                ['390', '手机'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={previewWidth === value}
                  onClick={() => setPreviewWidth(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (preview)
                  saveDownload(preview, `${current.name}.html`, 'text/html;charset=utf-8');
              }}
            >
              下载 HTML
            </Button>
          </div>
          <div className="doc-builder-preview-stage">
            <iframe
              title={`${current.name}独立页面预览`}
              srcDoc={preview ?? ''}
              sandbox="allow-scripts allow-forms allow-downloads"
              style={{ maxWidth: previewWidth === 'auto' ? '100%' : `${previewWidth}px` }}
            />
          </div>
        </Modal.Content>
      </Modal>
    </div>
  );
}
