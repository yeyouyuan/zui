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
  Typography,
  Checkbox as ZCheckbox,
  Image as ZImage,
  Form as ZForm,
  App as ZApp,
  useMessage,
} from '@zui/react';
import type { Config, SlotComponent } from '@puckeditor/core';
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { catalogComponents } from './builder-catalog';
import { catalogDefinitions, catalogGroupTitles } from './builder-catalog-data';
import { BuilderFormContext } from './builder-form-context';
import { BuilderCssField } from './BuilderCssField';
import { validateCssDeclarations } from './builder-design';
import { safeImage, safeLink, saveDownload } from './builder-model';
import { BuilderDesignFrame } from './BuilderDesignFrame';
import type { BuilderDesign, BuilderNodeMeta, BuilderStateDesign } from './builder-design';
import { tokenStyles, type BuilderToken } from './builder-tokens';
import type { BuilderNodeLogic } from './builder-logic';
import { flattenNodes } from './builder-tree';
import { copyCodeText } from '../../components/CodeBlock';
import './builder-content.css';
import { sceneComponents } from './builder-scene-config';
import { BuilderDataProvider } from './builder-scene-runtime';
import type { BuilderDataSource } from './builder-data-sources';

const booleanOptions = [
  { label: '是', value: true },
  { label: '否', value: false },
];
const boundedNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

function ImageSourceField({
  value = '',
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const [error, setError] = useState('');
  const id = useId();
  return (
    <div className="z-builder-image-field">
      <label htmlFor={`${id}-url`}>图片地址</label>
      <input
        id={`${id}-url`}
        value={value.startsWith('data:') ? '' : value}
        placeholder={value.startsWith('data:') ? '已嵌入本地图片' : 'https://…'}
        disabled={readOnly}
        onChange={(event) => {
          onChange(event.target.value);
          setError('');
        }}
      />
      <label htmlFor={`${id}-file`}>上传本地图片（最大 1 MB）</label>
      <input
        id={`${id}-file`}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={readOnly}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (
            !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
            file.size > 1024 * 1024
          ) {
            setError('请选择不超过 1 MB 的 PNG、JPEG、WebP 或 GIF 图片。');
            return;
          }
          const reader = new FileReader();
          reader.onerror = () => setError('图片读取失败，请重试。');
          reader.onload = () => {
            onChange(String(reader.result));
            setError('');
          };
          reader.readAsDataURL(file);
        }}
      />
      {value && (
        <button type="button" disabled={readOnly} onClick={() => onChange('')}>
          移除图片
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function BuilderSwitch({
  label,
  name,
  size,
  defaultChecked = false,
}: {
  label: string;
  name?: string;
  size?: 'sm' | 'md';
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <span data-builder-switch>
      <ZSwitch label={label} size={size} checked={checked} onChange={setChecked} />
      {name && <input type="hidden" name={name} value={String(checked)} />}
    </span>
  );
}

function BuilderActionButton({ p }: { p: Record<string, unknown> }) {
  const message = useMessage();
  const [error, setError] = useState('');
  const action = String(p.action || 'button');
  const payload = String(p.payload || '');
  const run = async () => {
    setError('');
    try {
      if (action === 'copy') {
        if (!(await copyCodeText(payload))) throw new Error('浏览器未允许复制，请检查剪贴板权限');
        message.success('内容已复制');
      } else if (action === 'download') {
        saveDownload(payload, String(p.fileName || 'download.txt'), 'text/plain;charset=utf-8');
      } else if (action === 'message') message.info(payload || '操作完成');
      else if (action === 'toggle') {
        const target = document.getElementById(String(p.targetId || ''));
        if (!target) throw new Error('未找到目标，请设置目标组件的 HTML ID');
        target.hidden = !target.hidden;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试');
    }
  };
  return (
    <>
      <ZButton
        variant={String(p.variant || 'primary') as 'primary'}
        size={String(p.size || 'md') as 'md'}
        disabled={Boolean(p.disabled)}
        type="button"
        onClick={() => {
          void run();
        }}
      >
        {String(p.children || '按钮')}
      </ZButton>
      {error && <small role="alert">{error}</small>}
    </>
  );
}

function BuilderForm({
  title,
  successMessage,
  Content,
  isEditing,
  customSubmit = false,
}: {
  title: string;
  successMessage: string;
  Content: SlotComponent;
  isEditing: boolean;
  customSubmit?: boolean;
}) {
  const [submission, setSubmission] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const submit = (values: Record<string, unknown>) => {
    if (isEditing || customSubmit) return;
    if (!formRef.current) return;
    const entries: Record<string, string[]> = Object.create(null);
    for (const [key, value] of new FormData(formRef.current)) {
      (entries[key] ??= []).push(String(value));
    }
    for (const [key, value] of Object.entries(values))
      entries[key] = [typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')];
    setSubmission(
      JSON.stringify({ submittedAt: new Date().toISOString(), fields: entries }, null, 2)
    );
  };
  if (isEditing)
    return (
      <div className="z-builder-form" aria-label={title || '页面表单'}>
        {title && <h2 className="z-builder-section-title">{title}</h2>}
        <Content className="z-builder-stack" minEmptyHeight={120} />
      </div>
    );
  return (
    <BuilderFormContext.Provider value={true}>
      <ZForm
        ref={formRef}
        className="z-builder-form"
        data-builder-form
        data-success-message={successMessage}
        aria-label={title || '页面表单'}
        onFinish={submit}
        onSubmitCapture={(event) => {
          formRef.current = event.currentTarget;
          if (!event.currentTarget.reportValidity()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {title && <h2 className="z-builder-section-title">{title}</h2>}
        <Content className="z-builder-stack" minEmptyHeight={120} />
        <div data-builder-form-result>
          {submission && (
            <div className="z-builder-form-result" role="status">
              <p>{successMessage || '已生成本次提交数据。'}</p>
              <ZButton
                variant="outline"
                type="button"
                onClick={() => saveDownload(submission, '表单提交.json')}
              >
                下载提交数据
              </ZButton>
            </div>
          )}
        </div>
      </ZForm>
    </BuilderFormContext.Provider>
  );
}

export const builderConfig: Config = {
  categories: {
    layout: {
      title: '布局与容器',
      components: ['Container', 'Section', 'Columns', 'Divider', 'Spacer'],
    },
    content: {
      title: '内容与展示',
      components: [
        'Heading',
        'Typography_Text',
        'Image',
        'Card',
        'Tag',
        'Badge',
        'Progress',
        'Alert',
      ],
    },
    form: {
      title: '表单与操作',
      components: ['Form', 'Input', 'TextArea', 'FormSelect', 'Checkbox', 'Switch', 'Button'],
    },
  },
  root: {
    label: '页面设置',
    fields: {
      title: { type: 'text', label: '网页标题' },
      description: { type: 'textarea', label: '网页描述' },
      theme: {
        type: 'radio',
        label: '页面主题',
        options: [
          { label: '浅色', value: 'light' },
          { label: '深色', value: 'dark' },
        ],
      },
      maxWidth: { type: 'number', label: '内容最大宽度（px）', min: 320, max: 1920 },
      padding: { type: 'number', label: '页面边距（px）', min: 0, max: 96 },
      contentGap: { type: 'number', label: '组件默认间距（px）', min: 0, max: 160 },
      primaryColor: { type: 'text', label: '页面品牌色（如 #6366f1）' },
      background: { type: 'text', label: '页面背景色' },
      fontFamily: { type: 'text', label: '页面字体族' },
      customCss: {
        type: 'custom',
        label: '页面内容 CSS',
        render: ({ value, onChange, readOnly }) => (
          <BuilderCssField
            label="页面内容 CSS"
            value={value || ''}
            onChange={onChange}
            readOnly={readOnly}
          />
        ),
      },
      visualPreset: {
        type: 'select',
        label: '视觉风格',
        options: [
          { label: '鸢尾紫 · 创作', value: 'indigo' },
          { label: '海洋蓝 · 专业', value: 'ocean' },
          { label: '松石绿 · 从容', value: 'forest' },
          { label: '琥珀橙 · 活力', value: 'amber' },
          { label: '蔷薇粉 · 温暖', value: 'rose' },
          { label: '石墨灰 · 极简', value: 'graphite' },
        ],
      },
      radius: { type: 'number', label: '全局圆角（px）', min: 0, max: 32 },
    },
    defaultProps: {
      title: '未命名页面',
      description: '',
      theme: 'light',
      maxWidth: 1120,
      padding: 24,
      contentGap: 20,
      primaryColor: '',
      background: '',
      fontFamily: '',
      customCss: '',
      visualPreset: 'indigo',
      radius: 12,
      datasets: [],
    },
    render: ({
      children,
      theme = 'light',
      maxWidth = 1120,
      padding = 24,
      contentGap = 20,
      primaryColor = '',
      background = '',
      fontFamily = '',
      customCss = '',
      visualPreset = 'indigo',
      radius = 12,
      datasets = [],
      dataKey = '',
      tokens = [],
      puck,
    }: {
      children?: ReactNode;
      theme?: string;
      maxWidth?: number;
      padding?: number;
      contentGap?: number;
      primaryColor?: string;
      background?: string;
      fontFamily?: string;
      customCss?: string;
      visualPreset?: string;
      radius?: number;
      datasets?: BuilderDataSource[];
      dataKey?: string;
      tokens?: BuilderToken[];
      puck?: { isEditing: boolean };
    }) => (
      <ZApp>
        <BuilderDataProvider sources={datasets} editing={puck?.isEditing} dataKey={dataKey}>
          <div
            className="z-builder-canvas"
            data-theme={theme}
            data-visual={visualPreset}
            style={
              {
                padding: boundedNumber(padding, 24, 0, 96),
                '--builder-page-gap': `${boundedNumber(contentGap, 20, 0, 160)}px`,
                '--builder-radius': `${boundedNumber(radius, 12, 0, 32)}px`,
                ...tokenStyles(tokens),
                ...(primaryColor ? { '--z-color-primary': primaryColor } : {}),
                ...(background ? { backgroundColor: background } : {}),
                ...(fontFamily ? { fontFamily } : {}),
              } as CSSProperties
            }
          >
            <div
              className="z-builder-page-content"
              style={{ maxWidth: boundedNumber(maxWidth, 1120, 320, 1920) }}
            >
              {children}
              {customCss && (
                <style>{`.z-builder-page-content > [data-builder-runtime-content],.z-builder-page-content > [data-puck-dropzone]{${validateCssDeclarations(customCss)}}`}</style>
              )}
            </div>
          </div>
        </BuilderDataProvider>
      </ZApp>
    ),
  },
  components: {
    Container: {
      label: '自由布局容器',
      fields: { content: { type: 'slot' } },
      defaultProps: {
        content: [],
        _design: { desktop: { display: 'flex', flexDirection: 'column', gap: 20 } },
      },
      render: ({ content: Content }) => <Content className="z-builder-flex" minEmptyHeight={120} />,
    },
    Spacer: {
      label: '留白',
      fields: { height: { type: 'number', label: '留白高度（px）', min: 0, max: 96 } },
      defaultProps: { height: 32 },
      render: ({ height = 32, puck }) => (
        <div
          className="z-builder-spacer"
          data-editing={puck.isEditing || undefined}
          style={{ height: boundedNumber(height, 32, 0, 96) }}
          aria-hidden="true"
        />
      ),
    },
    TextArea: {
      label: '多行输入',
      fields: {
        label: { type: 'text', label: '标签' },
        name: { type: 'text', label: '字段名' },
        placeholder: { type: 'text', label: '占位文本' },
        required: { type: 'radio', label: '必填', options: booleanOptions },
        rows: { type: 'number', label: '行数', min: 2, max: 20 },
      },
      defaultProps: {
        label: '留言',
        name: 'message',
        placeholder: '写下你的想法…',
        required: false,
        rows: 4,
      },
      render: ({ label, name, placeholder, required, rows = 4 }) => (
        <label className="z-builder-native-field">
          <span>{label || '留言'}</span>
          <ZInput.Textarea
            name={name}
            placeholder={placeholder}
            required={required}
            rows={Math.round(boundedNumber(rows, 4, 2, 20))}
          />
        </label>
      ),
    },
    Checkbox: {
      label: '复选框',
      fields: {
        label: { type: 'text', label: '标签' },
        name: { type: 'text', label: '字段名' },
        required: { type: 'radio', label: '必须勾选', options: booleanOptions },
        defaultChecked: { type: 'radio', label: '默认选中', options: booleanOptions },
      },
      defaultProps: {
        label: '我同意相关条款',
        name: 'agreement',
        required: false,
        defaultChecked: false,
      },
      render: ({ label, name, required, defaultChecked }) => (
        <ZCheckbox
          key={String(defaultChecked)}
          name={name}
          value="true"
          required={required}
          defaultChecked={defaultChecked}
          label={label || '同意'}
        />
      ),
    },
    FormSelect: {
      label: '下拉选项',
      fields: {
        label: { type: 'text', label: '标签' },
        name: { type: 'text', label: '字段名' },
        placeholder: { type: 'text', label: '占位文本' },
        required: { type: 'radio', label: '必填', options: booleanOptions },
        options: { type: 'textarea', label: '选项（每行一项，支持 值=名称）' },
      },
      defaultProps: {
        label: '感兴趣的方向',
        name: 'interest',
        placeholder: '请选择',
        required: false,
        options: 'design=产品设计\ndevelopment=技术开发\nother=其他',
      },
      render: ({ label, name, placeholder, required, options = '' }) => (
        <label className="z-builder-native-field">
          <span>{label || '请选择'}</span>
          <select name={name} required={required} defaultValue="">
            <option value="">{placeholder || '请选择'}</option>
            {String(options)
              .split('\n')
              .filter((option) => option.trim())
              .map((option, index) => {
                const [value, ...parts] = option.split('=');
                return (
                  <option value={value.trim()} key={index}>
                    {parts.join('=').trim() || value.trim()}
                  </option>
                );
              })}
          </select>
        </label>
      ),
    },
    Heading: {
      label: '标题',
      fields: {
        text: { type: 'textarea', label: '标题文字' },
        level: {
          type: 'select',
          label: '标题层级',
          options: ['h1', 'h2', 'h3'].map((value) => ({ label: value.toUpperCase(), value })),
        },
        align: {
          type: 'radio',
          label: '对齐',
          options: [
            { label: '左', value: 'left' },
            { label: '中', value: 'center' },
            { label: '右', value: 'right' },
          ],
        },
      },
      defaultProps: { text: '为你的想法，搭一张页面。', level: 'h1', align: 'left' },
      render: ({ text, level = 'h2', align = 'left' }) => {
        const Tag = level as 'h1' | 'h2' | 'h3';
        return (
          <Tag className="z-builder-heading" style={{ textAlign: align }}>
            {text}
          </Tag>
        );
      },
    },
    Section: {
      label: '内容分区',
      fields: {
        title: { type: 'text', label: '区块标题（可选）' },
        anchor: { type: 'text', label: '锚点 ID（用于按钮跳转）' },
        tone: {
          type: 'radio',
          label: '背景',
          options: [
            { label: '纯色', value: 'plain' },
            { label: '柔和', value: 'muted' },
            { label: '品牌', value: 'brand' },
          ],
        },
        padding: { type: 'number', label: '内边距（px）', min: 0, max: 96 },
        content: { type: 'slot' },
      },
      defaultProps: { title: '', anchor: '', tone: 'muted', padding: 24, content: [] },
      render: ({ title, anchor, tone = 'muted', padding = 24, content: Content }) => (
        <section
          className="z-builder-section"
          id={anchor || undefined}
          data-tone={tone}
          style={{ padding: boundedNumber(padding, 24, 0, 96) }}
        >
          {title && <h2 className="z-builder-section-title">{title}</h2>}
          <Content className="z-builder-stack" minEmptyHeight={100} />
        </section>
      ),
    },
    Columns: {
      label: '响应式分栏',
      fields: {
        columns: { type: 'number', label: '列数', min: 1, max: 4 },
        gap: { type: 'number', label: '间距（px）', min: 0, max: 96 },
        content: { type: 'slot' },
      },
      defaultProps: { columns: 2, gap: 20, content: [] },
      render: ({ columns = 2, gap = 20, content: Content }) => (
        <div className="z-builder-columns-container">
          <Content
            className="z-builder-columns"
            style={{
              gridTemplateColumns: `repeat(${Math.round(boundedNumber(columns, 2, 1, 4))}, minmax(0, 1fr))`,
              gap: boundedNumber(gap, 20, 0, 96),
            }}
            minEmptyHeight={120}
          />
        </div>
      ),
    },
    Image: {
      label: '图片',
      fields: {
        src: {
          type: 'custom',
          label: '图片地址 / 本地图片',
          render: ({ value, onChange, readOnly }) => (
            <ImageSourceField value={value} onChange={onChange} readOnly={readOnly} />
          ),
        },
        alt: { type: 'text', label: '替代文本' },
        caption: { type: 'text', label: '图注' },
        height: { type: 'number', label: '高度（px）', min: 80, max: 1000 },
        fit: {
          type: 'radio',
          label: '显示方式',
          options: [
            { label: '填满', value: 'cover' },
            { label: '完整', value: 'contain' },
          ],
        },
      },
      defaultProps: { src: '', alt: '图片说明', caption: '', height: 280, fit: 'cover' },
      render: ({ src, alt, caption, height = 280, fit = 'cover' }) => (
        <figure className="z-builder-image">
          {safeImage(src) ? (
            <ZImage
              src={safeImage(src)}
              alt={alt || ''}
              height={boundedNumber(height, 280, 80, 1000)}
              style={{ objectFit: fit }}
            />
          ) : (
            <div
              className="z-builder-image-placeholder"
              style={{ minHeight: boundedNumber(height, 280, 80, 1000) }}
            >
              在属性面板上传图片，或填写图片地址
            </div>
          )}
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      ),
    },
    Form: {
      label: '表单容器',
      fields: {
        title: { type: 'text', label: '表单标题' },
        successMessage: { type: 'textarea', label: '提交成功提示' },
        content: { type: 'slot', disallow: ['Form'] },
      },
      defaultProps: {
        title: '联系我们',
        successMessage: '已生成本次提交数据，可下载后自行处理。',
        content: [],
      },
      render: ({ title, successMessage, content: Content, puck, _logic }) => (
        <BuilderForm
          title={title}
          successMessage={successMessage}
          Content={Content}
          isEditing={puck.isEditing}
          customSubmit={!!(_logic as BuilderNodeLogic | undefined)?.submit?.length}
        />
      ),
    },
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
        disabled: { type: 'radio', options: booleanOptions, label: '禁用' },
        href: { type: 'text', label: '跳转链接（https / mailto / #锚点）' },
        newTab: { type: 'radio', label: '在新标签页打开链接', options: booleanOptions },
        payload: { type: 'textarea', label: '动作文本（复制 / 下载 / 消息）' },
        fileName: { type: 'text', label: '下载文件名' },
        targetId: { type: 'text', label: '切换目标的 HTML ID' },
        action: {
          type: 'radio',
          label: '按钮用途',
          options: [
            { label: '普通按钮 / 链接', value: 'button' },
            { label: '提交所在表单', value: 'submit' },
            { label: '复制文本', value: 'copy' },
            { label: '下载文本文件', value: 'download' },
            { label: '显示消息', value: 'message' },
            { label: '切换区域显隐', value: 'toggle' },
          ],
        },
      },
      defaultProps: { children: '按钮', variant: 'primary', size: 'md', action: 'button' },
      render: ({
        children,
        variant,
        size,
        disabled,
        href,
        action,
        payload,
        fileName,
        targetId,
        newTab,
        puck,
      }) =>
        (action === 'button' || !action) && safeLink(href) && !disabled ? (
          <a
            className="z-button"
            data-part="root"
            data-variant={variant}
            data-size={size}
            href={safeLink(href)}
            target={newTab ? '_blank' : undefined}
            rel={newTab ? 'noopener noreferrer' : undefined}
            onClick={(event) => {
              if (puck.isEditing) {
                event.preventDefault();
              } else if (
                safeLink(href)?.startsWith('#') &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                const document = event.currentTarget.ownerDocument;
                const anchor = safeLink(href)!.slice(1);
                if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
                else document.defaultView?.scrollTo({ top: 0 });
              }
            }}
          >
            <span className="z-button-label" data-part="label">
              {children}
            </span>
          </a>
        ) : !puck.isEditing &&
          ['copy', 'download', 'message', 'toggle'].includes(String(action)) ? (
          <BuilderActionButton
            p={{ children, variant, size, disabled, action, payload, fileName, targetId }}
          />
        ) : (
          <ZButton
            type={action === 'submit' ? 'submit' : 'button'}
            variant={variant}
            size={size}
            disabled={disabled}
          >
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
        clearable: { type: 'radio', options: booleanOptions, label: '可清除' },
        label: { type: 'text', label: '字段标签' },
        name: { type: 'text', label: '提交字段名' },
        type: {
          type: 'select',
          label: '输入类型',
          options: ['text', 'email', 'tel', 'number', 'url'].map((value) => ({
            label: value,
            value,
          })),
        },
        required: { type: 'radio', label: '必填', options: booleanOptions },
      },
      defaultProps: {
        label: '字段名称',
        name: 'field',
        placeholder: '请输入内容',
        size: 'md',
        type: 'text',
        required: false,
      },
      render: ({
        id,
        label,
        name,
        placeholder,
        size,
        type = 'text',
        required,
        clearable,
        status,
      }) => (
        <div className="z-builder-field">
          {label && (
            <label htmlFor={`field-${id}`}>
              {label}
              {required && ' *'}
            </label>
          )}
          <ZInput
            id={`field-${id}`}
            aria-label={label || placeholder || '文本输入'}
            name={name || id}
            type={type}
            placeholder={placeholder}
            size={size}
            required={required}
            clearable={clearable}
            status={status}
          />
        </div>
      ),
    },

    Card: {
      label: '卡片',
      fields: {
        title: { type: 'text', label: '标题' },
        children: { type: 'textarea', label: '内容' },
        content: { type: 'slot', label: '自定义卡片内容（可嵌套任意组件）' },
        hoverable: { type: 'radio', options: booleanOptions, label: '悬浮效果' },
      },
      defaultProps: { title: '卡片标题', children: '卡片内容', content: [] },
      render: ({ title, children, hoverable, content: Content, puck }) => {
        const Slot = Content as SlotComponent;
        return (
          <ZCard title={title || undefined} hoverable={hoverable}>
            {children && <div>{children}</div>}
            <Slot className="z-builder-stack" minEmptyHeight={puck?.isEditing ? 72 : 0} />
          </ZCard>
        );
      },
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
        closable: { type: 'radio', options: booleanOptions, label: '可关闭' },
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
        name: { type: 'text', label: '提交字段名（可选）' },
        defaultChecked: { type: 'radio', label: '默认开启', options: booleanOptions },
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
      render: ({ label, name, size, defaultChecked }) => (
        <BuilderSwitch
          key={`${name}-${defaultChecked}`}
          label={label}
          name={name}
          size={size}
          defaultChecked={defaultChecked}
        />
      ),
    },

    Badge: {
      label: '徽标',
      fields: {
        count: { type: 'number', label: '数量' },
        dot: { type: 'radio', options: booleanOptions, label: '圆点模式' },
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
        closable: { type: 'radio', options: booleanOptions, label: '可关闭' },
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
        dashed: { type: 'radio', options: booleanOptions, label: '虚线' },
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
        <ZProgress
          percent={boundedNumber(percent, 0, 0, 100)}
          status={status}
          aria-label="任务进度"
        />
      ),
    },

    Typography_Text: {
      label: '文本',
      fields: {
        children: { type: 'textarea', label: '内容' },
        strong: { type: 'radio', options: booleanOptions, label: '加粗' },
      },
      defaultProps: { children: '文本内容' },
      render: ({ children, strong }) => (
        <Typography.Text strong={strong}>{children}</Typography.Text>
      ),
    },
  },
};

Object.assign(builderConfig.components, catalogComponents);
Object.assign(builderConfig.components, sceneComponents);
builderConfig.categories!.application = {
  title: '应用与数据',
  components: Object.keys(sceneComponents),
};
for (const [group, title] of Object.entries(catalogGroupTitles)) {
  const existing = builderConfig.categories?.[group]?.components || [];
  const added = Object.keys(catalogDefinitions).filter(
    (type) => catalogDefinitions[type].group === group
  );
  builderConfig.categories![group] = { title, components: [...existing, ...added] };
}

// Keep the editor's metadata and responsive appearance on every registered component.
for (const [componentType, definition] of Object.entries(builderConfig.components)) {
  // Catalog definitions are shared across module reloads; decorate an owned copy.
  const component = { ...definition };
  builderConfig.components[componentType] = component;
  const Original = component.render;
  // Let the same root own its dimensions in Puck and the standalone renderer.
  component.inline = true;
  component.render = (props) => (
    <BuilderDesignFrame
      component={componentType}
      layoutStyle={
        component === builderConfig.components.Col
          ? {
              flex: `0 0 ${(boundedNumber(props.span, 12, 1, 24) / 24) * 100}%`,
              maxWidth: `${(boundedNumber(props.span, 12, 1, 24) / 24) * 100}%`,
              marginLeft: `${(boundedNumber(props.offset, 0, 0, 23) / 24) * 100}%`,
            }
          : undefined
      }
      id={props.id}
      design={props._design as BuilderDesign | undefined}
      states={props._states as BuilderStateDesign | undefined}
      logic={props._logic as BuilderNodeLogic | undefined}
      meta={props._editor as BuilderNodeMeta | undefined}
      editing={props.puck.isEditing}
      dragRef={props.puck.dragRef}
    >
      <Original {...props} />
    </BuilderDesignFrame>
  );
  component.resolvePermissions = (data, { permissions, appState }) => {
    const nodes = flattenNodes(appState.data.content);
    let entry = nodes.find(({ node }) => node.props.id === data.props.id);
    let locked = !!(data.props._editor as BuilderNodeMeta | undefined)?.locked;
    while (entry?.parent && !locked) {
      locked = !!(entry.parent.props._editor as BuilderNodeMeta | undefined)?.locked;
      const parentId = entry.parent.props.id;
      entry = nodes.find(({ node }) => node.props.id === parentId);
    }
    return { ...permissions, drag: !locked, edit: !locked, delete: !locked, duplicate: !locked };
  };
  if (component.fields?.content?.type === 'slot') {
    component.resolveFields = (data, { fields, appState }) => {
      const nodes = flattenNodes(appState.data.content);
      let entry = nodes.find(({ node }) => node.props.id === data.props.id);
      let insideForm = entry?.node.type === 'Form';
      let locked = !!(data.props._editor as BuilderNodeMeta | undefined)?.locked;
      while (entry?.parent) {
        insideForm ||= entry.parent.type === 'Form';
        locked ||= !!(entry.parent.props._editor as BuilderNodeMeta | undefined)?.locked;
        const parentId = entry.parent.props.id;
        entry = nodes.find(({ node }) => node.props.id === parentId);
      }
      return {
        ...fields,
        content: {
          ...fields.content,
          type: 'slot',
          disallow: locked ? Object.keys(builderConfig.components) : insideForm ? ['Form'] : [],
        },
      };
    };
  }
}
