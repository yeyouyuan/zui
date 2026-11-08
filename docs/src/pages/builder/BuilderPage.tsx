'use client';

import {
  Button as ZButton,
  Input as ZInput,
  Card as ZCard,
  Alert as ZAlert,
  Switch as ZSwitch,
  Badge as ZBadge,
  Tag as ZTag,
  Divider as ZDivider,
  Progress as ZProgress,
  MessageProvider,
  Typography,
} from '@zui/react';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePageTitle } from '../../components/usePageTitle';

/* ---------- ZUI → Puck 组件注册 ---------- */

type PuckConfig = Parameters<typeof Puck>[0]['config'];
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
      {children}
    </main>
  );
}

const PUCK_OVERRIDES: PuckOverrides = {
  iframe: BuilderCanvasFrame,
};

const PUCK_DICTIONARY: NonNullable<Parameters<typeof Puck>[0]['dictionary']> = {
  'header-publish': '复制 JSON',
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

const config: PuckConfig = {
  components: {
    Button: {
      label: '按钮',
      fields: {
        children: { type: 'text', label: '文本' },
        variant: {
          type: 'select',
          label: '变体',
          options: [
            { label: '主要', value: 'primary' },
            { label: '次要', value: 'secondary' },
            { label: '描边', value: 'outline' },
            { label: '幽灵', value: 'ghost' },
            { label: '危险', value: 'danger' },
          ],
        },
        size: {
          type: 'select',
          label: '尺寸',
          options: [
            { label: '小', value: 'sm' },
            { label: '中', value: 'md' },
            { label: '大', value: 'lg' },
          ],
        },
        disabled: { type: 'checkbox', label: '禁用' },
      },
      defaultProps: { children: '按钮', variant: 'primary', size: 'md' },
      render: ({ children, variant, size, disabled }) => (
        <ZButton variant={variant} size={size} disabled={disabled}>
          {children}
        </ZButton>
      ),
    },

    Input: {
      label: '输入框',
      fields: {
        placeholder: { type: 'text', label: '占位符' },
        size: {
          type: 'select',
          label: '尺寸',
          options: [
            { label: '小', value: 'sm' },
            { label: '中', value: 'md' },
            { label: '大', value: 'lg' },
          ],
        },
        status: {
          type: 'select',
          label: '状态',
          options: [
            { label: '默认', value: 'default' },
            { label: '错误', value: 'error' },
            { label: '成功', value: 'success' },
          ],
        },
        clearable: { type: 'checkbox', label: '可清除' },
      },
      defaultProps: { placeholder: '请输入内容', size: 'md' },
      render: (props) => <ZInput {...props} />,
    },

    Card: {
      label: '卡片',
      fields: {
        title: { type: 'text', label: '标题' },
        children: { type: 'textarea', label: '内容' },
        hoverable: { type: 'checkbox', label: '悬浮效果' },
      },
      defaultProps: { title: '卡片标题', children: '卡片内容' },
      render: ({ title, children, hoverable }) => (
        <ZCard title={title} hoverable={hoverable}>
          {children}
        </ZCard>
      ),
    },

    Alert: {
      label: '警告提示',
      fields: {
        type: {
          type: 'select',
          label: '类型',
          options: [
            { label: '信息', value: 'info' },
            { label: '成功', value: 'success' },
            { label: '警告', value: 'warning' },
            { label: '错误', value: 'error' },
          ],
        },
        title: { type: 'text', label: '标题' },
        children: { type: 'textarea', label: '描述' },
        closable: { type: 'checkbox', label: '可关闭' },
      },
      defaultProps: { type: 'info', title: '提示', children: '这是一条提示信息' },
      render: ({ type, title, children, closable }) => (
        <ZAlert type={type} title={title} closable={closable}>
          {children}
        </ZAlert>
      ),
    },

    Switch: {
      label: '开关',
      fields: {
        label: { type: 'text', label: '标签' },
        size: {
          type: 'select',
          label: '尺寸',
          options: [
            { label: '小', value: 'sm' },
            { label: '中', value: 'md' },
          ],
        },
      },
      defaultProps: { label: '开关' },
      render: ({ label, size }) => <ZSwitch label={label} size={size} />,
    },

    Badge: {
      label: '徽标',
      fields: {
        count: { type: 'number', label: '数量' },
        dot: { type: 'checkbox', label: '圆点模式' },
        children: { type: 'text', label: '包裹内容' },
      },
      defaultProps: { count: 5 },
      render: ({ count, dot, children }) => (
        <ZBadge count={count} dot={dot}>
          {children || <span style={{ padding: 16 }}>内容</span>}
        </ZBadge>
      ),
    },

    Tag: {
      label: '标签',
      fields: {
        children: { type: 'text', label: '文本' },
        color: {
          type: 'select',
          label: '颜色',
          options: [
            { label: '主色', value: 'primary' },
            { label: '成功', value: 'success' },
            { label: '警告', value: 'warning' },
            { label: '错误', value: 'error' },
            { label: '中性', value: 'neutral' },
          ],
        },
        closable: { type: 'checkbox', label: '可关闭' },
      },
      defaultProps: { children: '标签', color: 'primary' },
      render: ({ children, color, closable }) => (
        <ZTag color={color} closable={closable}>
          {children}
        </ZTag>
      ),
    },

    Divider: {
      label: '分割线',
      fields: {
        children: { type: 'text', label: '文字（可选）' },
        dashed: { type: 'checkbox', label: '虚线' },
      },
      defaultProps: {},
      render: ({ children, dashed }) => <ZDivider dashed={dashed}>{children}</ZDivider>,
    },

    Progress: {
      label: '进度条',
      fields: {
        percent: { type: 'number', label: '百分比', min: 0, max: 100 },
        status: {
          type: 'select',
          label: '状态',
          options: [
            { label: '正常', value: 'normal' },
            { label: '活跃', value: 'active' },
            { label: '成功', value: 'success' },
            { label: '错误', value: 'error' },
          ],
        },
      },
      defaultProps: { percent: 60 },
      render: ({ percent, status }) => (
        <ZProgress percent={percent} status={status} aria-label="任务进度" />
      ),
    },

    Typography_Text: {
      label: '文本',
      fields: {
        children: { type: 'textarea', label: '内容' },
        strong: { type: 'checkbox', label: '加粗' },
      },
      defaultProps: { children: '文本内容' },
      render: ({ children, strong }) => (
        <Typography.Text strong={strong}>{children}</Typography.Text>
      ),
    },
  },
};

/* ---------- 初始页面数据 ---------- */

const initialData = {
  content: [
    {
      type: 'Alert',
      props: {
        id: 'welcome-alert',
        type: 'info',
        title: '开始搭建',
        children: '打开组件面板，将组件拖到画布；选中后在属性面板编辑。',
        closable: false,
      },
    },
    {
      type: 'Card',
      props: {
        id: 'profile-card',
        title: '用户信息',
        children: '这里可以放任何内容。',
        hoverable: true,
      },
    },
    { type: 'Button', props: { id: 'submit-button', children: '提交', variant: 'primary' } },
    { type: 'Divider', props: { id: 'content-divider' } },
    {
      type: 'Typography_Text',
      props: { id: 'intro-text', children: '使用 Typography.Text 渲染文本', strong: true },
    },
    { type: 'Progress', props: { id: 'task-progress', percent: 72, status: 'active' } },
    { type: 'Tag', props: { id: 'primary-tag', children: '标签', color: 'primary' } },
    { type: 'Tag', props: { id: 'success-tag', children: '另一个标签', color: 'success' } },
  ],
};

/* ---------- 页面 ---------- */

export default function BuilderPage(): React.ReactNode {
  usePageTitle('页面搭建器');

  const [data, setData] = useState(initialData);
  const [copyStatus, setCopyStatus] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [initialEditorUi] = useState(() => {
    const viewportWidth = typeof window === 'undefined' ? 1600 : window.innerWidth;
    return {
      // 文档站本身已有侧栏；常见笔记本宽度优先保证画布可读，面板仍可从顶部按钮打开。
      leftSideBarVisible: viewportWidth >= 1600,
      rightSideBarVisible: viewportWidth >= 1920,
    };
  });

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
  }, []);

  const copyJson = async (nextData = data) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(nextData, null, 2));
      setCopyStatus('JSON 已复制到剪贴板。');
    } catch {
      setCopyStatus('复制失败，请聚焦下方 JSON 后手动复制。');
    }
  };

  return (
    <div className="doc-page doc-builder-page">
      <h1 className="doc-h1">页面搭建器</h1>
      <p className="doc-lead doc-builder-intro">
        基于 Puck 的可视化页面编辑器。打开组件面板后将组件拖到画布，选中后在属性面板编辑。
        编辑内容会实时同步到下方 JSON，可复制保存或交给后端。支持注册任何 React 组件库的组件。
      </p>

      <MessageProvider>
        <div className="doc-builder-editor" ref={editorRef}>
          <Puck
            config={config}
            data={data}
            dictionary={PUCK_DICTIONARY}
            dnd={{ enableDragHandle: true }}
            overrides={PUCK_OVERRIDES}
            ui={initialEditorUi}
            onChange={(nextData) => setData(nextData)}
            onPublish={(nextData) => void copyJson(nextData)}
          />
        </div>
      </MessageProvider>

      <div className="doc-builder-json-heading">
        <h2 className="doc-h2" id="builder-json-title">
          当前 JSON 数据
        </h2>
        <ZButton type="button" size="sm" variant="outline" onClick={() => void copyJson()}>
          复制 JSON
        </ZButton>
      </div>
      {copyStatus ? (
        <p className="doc-builder-copy-status" role="status">
          {copyStatus}
        </p>
      ) : null}
      <pre className="doc-builder-json" tabIndex={0} aria-labelledby="builder-json-title">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
