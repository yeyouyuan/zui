'use client';

import * as React from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Book,
  Clipboard,
  Copy,
  FileText,
  Image as ImageIcon,
  Italic,
  Link,
  RotateCcw,
  Scissors,
  Search,
} from '@zui/icons';
import {
  EditorContent,
  Extension,
  Node,
  useEditor,
  useEditorState,
  type Editor,
} from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyleKit, FontFamily } from '@tiptap/extension-text-style';
import { studioFontFamilyCss, studioFontFamilyInput } from './studio-font-input';
import { TableKit } from '@tiptap/extension-table';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { ColorPicker } from '../ColorPicker';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { Select } from '../Select';
import { Tabs } from '../Tabs';
import { StudioRibbonTabs } from './StudioRibbon';
import type { StudioEditorProps, StudioRichNode, StudioWordDocument } from './studio-types';
import {
  WORD_SEARCH_LIMIT,
  WordImage,
  WordPageNumber,
  WordSubscript,
  WordSuperscript,
  wordFindMatches,
  wordHeadings,
  wordReadImage,
  wordReplaceMatches,
} from './studio-word-tools';
import { StudioFontControl, type StudioFontCommitReason } from './StudioFontControl';
import './StudioWord.css';

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-word-page-break]' }],
  renderHTML: () => [
    'div',
    { 'data-word-page-break': '', class: 'z-studio-word-page-break', 'aria-label': '分页符' },
  ],
});

const PARAGRAPH_LAYOUT = {
  indentLeft: 'margin-left',
  indentRight: 'margin-right',
  indentFirstLine: 'text-indent',
  spaceBefore: 'margin-top',
  spaceAfter: 'margin-bottom',
} as const;

const ParagraphLayout = Extension.create({
  name: 'studioParagraphLayout',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          ...Object.fromEntries(
            Object.entries(PARAGRAPH_LAYOUT).map(([key, css]) => [
              key,
              {
                default: null,
                renderHTML: (attributes: Record<string, unknown>) =>
                  typeof attributes[key] === 'number' && Number.isFinite(attributes[key])
                    ? { style: `${css}: ${attributes[key]}pt` }
                    : {},
              },
            ])
          ),
          lineHeight: {
            default: null,
            renderHTML: (attributes: Record<string, unknown>) =>
              typeof attributes.lineHeight === 'number' && Number.isFinite(attributes.lineHeight)
                ? { style: `line-height: ${attributes.lineHeight}` }
                : {},
          },
        },
      },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          backgroundColor: {
            default: null,
            renderHTML: (attributes: Record<string, unknown>) =>
              typeof attributes.backgroundColor === 'string' &&
              /^#[\da-f]{6}$/i.test(attributes.backgroundColor)
                ? { style: `background-color: ${attributes.backgroundColor}` }
                : {},
          },
        },
      },
    ];
  },
});

const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    link: { openOnClick: false, autolink: false, defaultProtocol: 'https' },
    codeBlock: false,
    code: false,
    trailingNode: false,
  }),
  TextStyleKit.configure({ fontFamily: false }),
  FontFamily.extend({
    addGlobalAttributes() {
      return (this.parent?.() ?? []).map((group) => ({
        ...group,
        attributes: {
          ...group.attributes,
          fontFamily: {
            ...group.attributes.fontFamily,
            renderHTML: (attrs) =>
              typeof attrs.fontFamily === 'string' && studioFontFamilyInput(attrs.fontFamily)
                ? { style: `font-family: ${studioFontFamilyCss(attrs.fontFamily)}` }
                : {},
          },
        },
      }));
    },
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TableKit.configure({ table: { resizable: true } }),
  ParagraphLayout,
  PageBreak,
  WordImage,
  WordPageNumber,
  WordSubscript,
  WordSuperscript,
];

const MM_TO_PX = 96 / 25.4;
const FONT_OPTIONS = [
  { value: 'Noto Sans SC', label: '思源黑体' },
  { value: 'SimSun', label: '宋体' },
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
];
const SIZE_OPTIONS = [10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48].map((size) => ({
  value: `${size}pt`,
  label: `${size}`,
}));
const STYLE_OPTIONS = [
  { value: 'paragraph', label: '正文' },
  { value: 'no-spacing', label: '无间距' },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({ value: `heading-${level}`, label: `标题 ${level}` })),
];
const STYLE_PREVIEWS = STYLE_OPTIONS.slice(0, 3);
const ALIGNMENTS = [
  { value: 'left', label: '左对齐', Icon: AlignLeft },
  { value: 'center', label: '居中', Icon: AlignCenter },
  { value: 'right', label: '右对齐', Icon: AlignRight },
  { value: 'justify', label: '两端对齐', Icon: AlignJustify },
] as const;

function keepSelection(event: React.MouseEvent) {
  event.preventDefault();
}

function RibbonGroup({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`z-studio-word-group ${className}`.trim()}
      data-part="word-tool-group"
      role="group"
      aria-label={label}
    >
      <div className="z-studio-word-controls">{children}</div>
      <span className="z-studio-word-group-label">{label}</span>
    </div>
  );
}

function RibbonRow({ children }: { children: React.ReactNode }) {
  return <div className="z-studio-word-control-row">{children}</div>;
}

function WordRuler({
  length,
  margin,
  scale,
  vertical = false,
}: {
  length: number;
  margin: number;
  scale: number;
  vertical?: boolean;
}) {
  const unit = MM_TO_PX * 10;
  const count = Math.floor((length - margin * 2) / unit);
  const rulerStyle = {
    '--z-studio-word-ruler-unit': `${unit * scale}px`,
    '--z-studio-word-ruler-margin': `${margin * scale}px`,
    [vertical ? 'height' : 'width']: length * scale,
  } as React.CSSProperties;
  return (
    <div
      className={`z-studio-word-ruler z-studio-word-ruler-${vertical ? 'vertical' : 'horizontal'}`}
      data-part="word-ruler"
      data-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-hidden="true"
      style={rulerStyle}
    >
      <span className="z-studio-word-ruler-text-area" />
      {Array.from({ length: Math.max(0, count) + 1 }, (_, index) => (
        <span
          key={index}
          className="z-studio-word-ruler-number"
          style={{ [vertical ? 'top' : 'left']: (margin + index * unit) * scale }}
        >
          {index}
        </span>
      ))}
    </div>
  );
}

type WordRegion = 'header' | 'footer';
const EMPTY_REGION: StudioRichNode = { type: 'doc', content: [{ type: 'paragraph' }] };

function RegionEditor({
  region,
  documentId,
  content,
  editable,
  onChange,
  onReady,
  onActive,
  onImagePaste,
}: {
  region: WordRegion;
  documentId: string;
  content: StudioRichNode;
  editable: boolean;
  onChange(content: StudioRichNode): void;
  onReady(region: WordRegion, editor: Editor | null): void;
  onActive(region: WordRegion): void;
  onImagePaste(file: File, editor: Editor | null): void;
}) {
  const latest = React.useRef({ editable, onChange, onReady, onActive, onImagePaste });
  latest.current = { editable, onChange, onReady, onActive, onImagePaste };
  const [request, setRequest] = React.useState(0);
  const editor: Editor | null = useEditor(
    {
      extensions: EXTENSIONS,
      content,
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': region === 'header' ? 'Word 页眉' : 'Word 页脚',
          'aria-multiline': 'true',
          'aria-readonly': String(!editable),
          spellcheck: 'false',
        },
        handlePaste: (_view, event) => {
          const file = Array.from(event.clipboardData?.files || []).find((item) =>
            /^image\/(png|jpeg)$/.test(item.type)
          );
          if (!file || !latest.current.editable) return false;
          event.preventDefault();
          latest.current.onImagePaste(file, editor);
          return true;
        },
      },
      onFocus: () => latest.current.onActive(region),
      onUpdate: ({ editor: current }) => {
        if (!latest.current.editable) return;
        latest.current.onChange(current.getJSON() as StudioRichNode);
        setRequest((value) => value + 1);
      },
    },
    [documentId, region]
  );
  React.useEffect(() => {
    if (!editor) return;
    latest.current.onReady(region, editor);
    return () => latest.current.onReady(region, null);
  }, [editor, region]);
  React.useLayoutEffect(() => {
    editor?.setEditable(editable, false);
    editor?.setOptions({
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': region === 'header' ? 'Word 页眉' : 'Word 页脚',
          'aria-multiline': 'true',
          'aria-readonly': String(!editable),
          spellcheck: 'false',
        },
        handlePaste: (_view, event) => {
          const file = Array.from(event.clipboardData?.files || []).find((item) =>
            /^image\/(png|jpeg)$/.test(item.type)
          );
          if (!file || !latest.current.editable) return false;
          event.preventDefault();
          latest.current.onImagePaste(file, editor);
          return true;
        },
      },
    });
  }, [editor, editable, region]);
  React.useLayoutEffect(() => {
    if (
      editor &&
      !editor.isDestroyed &&
      JSON.stringify(editor.getJSON()) !== JSON.stringify(content)
    )
      editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content, request]);
  return (
    <EditorContent editor={editor} className="z-studio-word-content z-studio-word-region-content" />
  );
}

function withoutPageNumbers(node: StudioRichNode): StudioRichNode {
  return {
    ...node,
    ...(node.content
      ? {
          content: node.content
            .filter((child) => child.type !== 'pageNumber')
            .map(withoutPageNumbers),
        }
      : {}),
  };
}

function hasPageNumber(node?: StudioRichNode): boolean {
  return (
    !!node &&
    ((node.type === 'pageNumber' && node.attrs?.kind !== 'total') ||
      !!node.content?.some(hasPageNumber))
  );
}

/** A local, structured rich-text document editor. Page margins are in millimetres. */
export function StudioWord({
  document,
  onChange,
  disabled,
  readOnly,
}: StudioEditorProps<StudioWordDocument>) {
  const editable = !disabled && !readOnly;
  const latest = React.useRef({ document, onChange, editable });
  latest.current = { document, onChange, editable };
  const [tab, setTab] = React.useState('home');
  const [zoom, setZoom] = React.useState('fit');
  const [stageWidth, setStageWidth] = React.useState(900);
  const [paperHeight, setPaperHeight] = React.useState(0);
  const [showRuler, setShowRuler] = React.useState(true);
  const [statisticsOpen, setStatisticsOpen] = React.useState(false);
  const [clipboardBusy, setClipboardBusy] = React.useState(false);
  const [tableRows, setTableRows] = React.useState('3');
  const [tableColumns, setTableColumns] = React.useState('3');
  const [tableHeader, setTableHeader] = React.useState(true);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkHref, setLinkHref] = React.useState('');
  const [linkError, setLinkError] = React.useState('');
  const [contentRequest, setContentRequest] = React.useState(0);
  const [region, setRegion] = React.useState<'content' | WordRegion>('content');
  const [regions, setRegions] = React.useState<Partial<Record<WordRegion, Editor>>>({});
  const [sidePanel, setSidePanel] = React.useState<'search' | 'outline' | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [replacement, setReplacement] = React.useState('');
  const [matchCase, setMatchCase] = React.useState(false);
  const [matchIndex, setMatchIndex] = React.useState(-1);
  const [imageBusy, setImageBusy] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [lockImageRatio, setLockImageRatio] = React.useState(true);
  const imageRatioRef = React.useRef<{
    editor: Editor;
    position: number;
    src: unknown;
    ratio: number;
  } | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const paperRef = React.useRef<HTMLElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const imageOperationRef = React.useRef(false);
  const clipboardOperationRef = React.useRef(false);
  const insertImageRef = React.useRef<(file: File, target: Editor | null) => Promise<void>>(
    async () => undefined
  );
  const focusRegionRef = React.useRef<WordRegion | null>(null);
  const bodyEditor: Editor | null = useEditor(
    {
      extensions: EXTENSIONS,
      content: document.content,
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': 'Word 文档正文',
          'aria-multiline': 'true',
          'aria-readonly': String(!editable),
          spellcheck: 'false',
        },
        handlePaste: (_view, event) => {
          const file = Array.from(event.clipboardData?.files || []).find((item) =>
            /^image\/(png|jpeg)$/.test(item.type)
          );
          if (!file || !latest.current.editable) return false;
          event.preventDefault();
          void insertImageRef.current(file, bodyEditor);
          return true;
        },
      },
      onFocus: () => setRegion('content'),
      onUpdate: ({ editor: current }) => {
        const state = latest.current;
        if (!state.editable) return;
        state.onChange({ ...state.document, content: current.getJSON() as StudioRichNode });
        setContentRequest((request) => request + 1);
      },
    },
    [document.id]
  );

  const editor =
    region !== 'content' && regions[region] && !regions[region]!.isDestroyed
      ? regions[region]!
      : bodyEditor;
  const registerRegion = React.useCallback((name: WordRegion, current: Editor | null) => {
    setRegions((previous) => {
      if (previous[name] === current || (!current && !previous[name])) return previous;
      const next = { ...previous };
      if (current) next[name] = current;
      else delete next[name];
      return next;
    });
  }, []);
  React.useEffect(() => {
    setRegion('content');
    setSidePanel(null);
    setStatisticsOpen(false);
    setLinkOpen(false);
    setNotice('');
  }, [document.id]);
  React.useEffect(() => {
    const requested = focusRegionRef.current;
    if (requested && regions[requested] && !regions[requested]!.isDestroyed) {
      focusRegionRef.current = null;
      regions[requested]!.commands.focus('end');
    }
  }, [regions, region]);
  React.useEffect(() => {
    if (sidePanel === 'search') searchInputRef.current?.focus();
  }, [sidePanel]);
  React.useEffect(() => setMatchIndex(-1), [editor, searchQuery, matchCase]);

  const selection = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current || current.isDestroyed || !current.schema) return null;
      const style = current.getAttributes('textStyle');
      const paragraph = current.getAttributes('paragraph');
      return {
        bold: current.isActive('bold'),
        italic: current.isActive('italic'),
        underline: current.isActive('underline'),
        strike: current.isActive('strike'),
        superscript: current.isActive('superscript'),
        subscript: current.isActive('subscript'),
        image: current.isActive('image') ? current.getAttributes('image') : null,
        matches: wordFindMatches(current, searchQuery, matchCase),
        bullet: current.isActive('bulletList'),
        ordered: current.isActive('orderedList'),
        align: (current.getAttributes('heading').textAlign ||
          current.getAttributes('paragraph').textAlign ||
          'left') as string,
        from: current.state.selection.from,
        to: current.state.selection.to,
        font: (style.fontFamily || 'Noto Sans SC') as string,
        fontSize: (style.fontSize || '12pt') as string,
        color: (style.color || '#000000') as string,
        style: current.isActive('heading')
          ? `heading-${current.getAttributes('heading').level}`
          : paragraph.lineHeight === 1 && paragraph.spaceBefore === 0 && paragraph.spaceAfter === 0
            ? 'no-spacing'
            : 'paragraph',
        selectedText: current.state.doc.textBetween(
          current.state.selection.from,
          current.state.selection.to,
          '\n'
        ),
        undo: current.can().undo(),
        redo: current.can().redo(),
        inTable: current.isActive('table'),
        indent: Number(current.state.selection.$from.parent.attrs.indentLeft || 0),
        lineHeight: String(
          current.state.selection.$from.parent.attrs.lineHeight ||
            (current.isActive('heading') ? 1.35 : 1.75)
        ),
        canMerge: current.can().mergeCells(),
        canSplit: current.can().splitCell(),
      };
    },
  });
  const bodySummary = useEditorState({
    editor: bodyEditor,
    selector: ({ editor: current }) => {
      if (!current || current.isDestroyed || !current.schema) return null;
      const text = current.getText();
      let paragraphs = 0;
      current.state.doc.descendants((node) => {
        if (['paragraph', 'heading'].includes(node.type.name)) paragraphs++;
      });
      return {
        headings: wordHeadings(current),
        characters: Array.from(text).length,
        nonWhitespaceCharacters: Array.from(text.replace(/\s/g, '')).length,
        paragraphs,
      };
    },
  });
  const outline = bodySummary?.headings || [];

  React.useEffect(() => {
    if (!selection?.image) imageRatioRef.current = null;
  }, [selection?.image]);

  React.useLayoutEffect(() => {
    if (!bodyEditor || bodyEditor.isDestroyed || !bodyEditor.schema) return;
    bodyEditor.setEditable(editable, false);
    bodyEditor.setOptions({
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': 'Word 文档正文',
          'aria-multiline': 'true',
          'aria-readonly': String(!editable),
          spellcheck: 'false',
        },
        handlePaste: (_view, event) => {
          const file = Array.from(event.clipboardData?.files || []).find((item) =>
            /^image\/(png|jpeg)$/.test(item.type)
          );
          if (!file || !latest.current.editable) return false;
          event.preventDefault();
          void insertImageRef.current(file, bodyEditor);
          return true;
        },
      },
    });
  }, [bodyEditor, editable]);

  React.useLayoutEffect(() => {
    if (!bodyEditor || bodyEditor.isDestroyed) return;
    // A host can reject an update without changing the content reference. Accepted
    // content already matches the editor, so leave its selection and history alone.
    if (JSON.stringify(bodyEditor.getJSON()) !== JSON.stringify(document.content)) {
      bodyEditor.commands.setContent(document.content, { emitUpdate: false });
    }
  }, [bodyEditor, document.content, contentRequest]);

  const [portraitWidth, portraitHeight] =
    document.page.size === 'Letter' ? [215.9, 279.4] : [210, 297];
  const landscape = document.page.orientation === 'landscape';
  const pageWidth = (landscape ? portraitHeight : portraitWidth) * MM_TO_PX;
  const pageHeight = (landscape ? portraitWidth : portraitHeight) * MM_TO_PX;
  const margin = Math.min(60, Math.max(5, document.page.margin)) * MM_TO_PX;
  const scale =
    zoom === 'fit' ? Math.min(1, Math.max(0.25, (stageWidth - 48) / pageWidth)) : Number(zoom);

  React.useEffect(() => {
    const stage = stageRef.current;
    const paper = paperRef.current;
    if (!stage || !paper) return;
    const measure = () => {
      if (stage.clientWidth) setStageWidth(stage.clientWidth);
      setPaperHeight(paper.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [bodyEditor, pageWidth, pageHeight, margin]);

  const updatePage = (patch: Partial<StudioWordDocument['page']>) => {
    if (!editable) return;
    const current = latest.current;
    current.onChange({ ...current.document, page: { ...current.document.page, ...patch } });
  };

  async function insertImage(file: File, target = editor) {
    if (!target || !latest.current.editable || imageOperationRef.current) return;
    const id = latest.current.document.id;
    imageOperationRef.current = true;
    setImageBusy(true);
    setNotice('正在读取图片…');
    try {
      const attrs = await wordReadImage(file, pageWidth - margin * 2);
      if (latest.current.document.id !== id || !latest.current.editable || target.isDestroyed)
        return;
      target.chain().focus().insertContent({ type: 'image', attrs }).run();
      setNotice('图片已插入，可选中图片调整尺寸。');
    } catch (error) {
      if (latest.current.document.id === id)
        setNotice(error instanceof Error ? error.message : '图片插入失败。');
    } finally {
      imageOperationRef.current = false;
      setImageBusy(false);
    }
  }
  insertImageRef.current = insertImage;

  const openRegion = (name: WordRegion) => {
    if (!editable) return;
    const state = latest.current;
    if (!state.document[name]) state.onChange({ ...state.document, [name]: EMPTY_REGION });
    focusRegionRef.current = name;
    setRegion(name);
    if (regions[name]) {
      focusRegionRef.current = null;
      regions[name]!.commands.focus('end');
    }
  };

  const updateRegion = (name: WordRegion, content: StudioRichNode) => {
    const state = latest.current;
    if (state.editable)
      state.onChange({
        ...state.document,
        [name]: content,
        ...(name === 'footer' ? { pageNumbers: hasPageNumber(content) } : {}),
      });
  };

  const togglePageNumbers = (value: boolean) => {
    const state = latest.current;
    if (!state.editable) return;
    const footer = withoutPageNumbers(state.document.footer || EMPTY_REGION);
    if (value)
      footer.content = [
        ...(footer.content || []),
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'pageNumber', attrs: { kind: 'current' } }],
        },
      ];
    state.onChange({ ...state.document, footer, pageNumbers: value });
  };

  const navigateMatch = (index: number) => {
    const matches = selection?.matches || [];
    if (!editor || !matches.length) return;
    const next = (index + matches.length) % matches.length;
    setMatchIndex(next);
    editor.chain().focus().setTextSelection(matches[next]).scrollIntoView().run();
  };
  const stepMatch = (direction: number) => {
    const count = selection?.matches.length || 0;
    navigateMatch(matchIndex < 0 ? (direction > 0 ? 0 : count - 1) : matchIndex + direction);
  };

  const updateImage = (patch: Record<string, unknown>) => {
    if (!editor || !editable || !selection?.image) return;
    const position = editor.state.selection.from;
    editor.chain().updateAttributes('image', patch).setNodeSelection(position).run();
  };

  const resizeImage = (dimension: 'width' | 'height', value: string) => {
    if (!editor || !editable || !selection?.image) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 1 || amount > 2000) return;
    const attrs = selection.image;
    const patch = { [dimension]: amount };
    if (lockImageRatio) {
      const position = editor.state.selection.from;
      let original = imageRatioRef.current;
      if (
        !original ||
        original.editor !== editor ||
        original.position !== position ||
        original.src !== attrs.src
      ) {
        original = {
          editor,
          position,
          src: attrs.src,
          ratio: Number(attrs.width) / Number(attrs.height),
        };
        imageRatioRef.current = original;
      }
      const other = dimension === 'width' ? 'height' : 'width';
      patch[other] = Math.max(
        1,
        Math.min(
          2000,
          Math.round(dimension === 'width' ? amount / original.ratio : amount * original.ratio)
        )
      );
    }
    updateImage(patch);
  };

  const applyLink = () => {
    if (!editor || !editable) return;
    const href = linkHref.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      let protocol = '';
      try {
        protocol = new URL(href).protocol;
      } catch {
        setLinkError('请输入完整的 https://、http:// 或 mailto: 地址。');
        return;
      }
      if (!['https:', 'http:', 'mailto:'].includes(protocol)) {
        setLinkError('链接仅支持 https://、http:// 和 mailto: 地址。');
        return;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const fontOptions = FONT_OPTIONS;
  const sizeOptions = SIZE_OPTIONS.map((option) => ({ ...option, value: option.label }));
  const fontSelectionRef = React.useRef<{
    editor: Editor;
    selection: Editor['state']['selection'];
    doc: Editor['state']['doc'];
  } | null>(null);
  const rememberFontSelection = () => {
    if (editor && !editor.isDestroyed)
      fontSelectionRef.current = {
        editor,
        selection: editor.state.selection,
        doc: editor.state.doc,
      };
  };
  const commitFont = (kind: 'family' | 'size', value: string, reason: StudioFontCommitReason) => {
    const saved = fontSelectionRef.current;
    if (
      !editor ||
      !editable ||
      !saved ||
      saved.editor !== editor ||
      editor.isDestroyed ||
      saved.doc !== editor.state.doc
    )
      return false;
    const chain = editor.chain().command(({ tr }) => {
      tr.setSelection(saved.selection);
      return true;
    });
    if (reason !== 'blur') chain.focus();
    return kind === 'family'
      ? chain.setFontFamily(value).run()
      : chain.setFontSize(`${value}pt`).run();
  };
  const fontContextKey = `${document.id}:${region}:${selection?.from}:${selection?.to}`;
  const toolsDisabled = !editor || !editable;
  const applyParagraphStyle = (value: string) => {
    if (!editor || !editable) return;
    const chain = editor.chain().focus();
    if (value === 'no-spacing')
      chain
        .setParagraph()
        .updateAttributes('paragraph', { lineHeight: 1, spaceBefore: 0, spaceAfter: 0 })
        .run();
    else if (value === 'paragraph')
      chain
        .setParagraph()
        .updateAttributes('paragraph', { lineHeight: null, spaceBefore: null, spaceAfter: null })
        .run();
    else chain.setHeading({ level: Number(value.slice(-1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  };
  const adjustIndent = (amount: number) => {
    if (!editor || !editable) return;
    editor
      .chain()
      .focus()
      .updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', {
        indentLeft: Math.max(0, Math.min(144, (selection?.indent || 0) + amount)),
      })
      .run();
  };
  const handleClipboard = async (action: 'copy' | 'cut' | 'paste') => {
    const target = editor;
    if (!target || clipboardOperationRef.current || (action !== 'copy' && !editable)) return;
    const documentId = latest.current.document.id;
    const originalContent = target.state.doc;
    const range = { from: target.state.selection.from, to: target.state.selection.to };
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    clipboardOperationRef.current = true;
    setClipboardBusy(true);
    try {
      if (action === 'paste') {
        if (!clipboard?.readText) throw new Error('clipboard unavailable');
        const text = await clipboard.readText();
        if (
          !text ||
          target.isDestroyed ||
          latest.current.document.id !== documentId ||
          !latest.current.editable ||
          !target.state.doc.eq(originalContent)
        )
          return;
        const lines = text.replace(/\r\n?/g, '\n').split('\n');
        target
          .chain()
          .focus()
          .insertContentAt(
            range,
            lines.length === 1
              ? { type: 'text', text }
              : lines.map((line) => ({
                  type: 'paragraph',
                  content: line ? [{ type: 'text', text: line }] : [],
                }))
          )
          .run();
      } else {
        const text = originalContent.textBetween(range.from, range.to, '\n');
        if (!text) return;
        if (!clipboard?.writeText) throw new Error('clipboard unavailable');
        await clipboard.writeText(text);
        if (action === 'cut') {
          if (
            target.isDestroyed ||
            latest.current.document.id !== documentId ||
            !latest.current.editable ||
            !target.state.doc.eq(originalContent)
          )
            return;
          target.chain().focus().setTextSelection(range).deleteSelection().run();
        }
      }
      if (latest.current.document.id === documentId)
        setNotice(
          action === 'copy'
            ? '已复制所选文本。'
            : action === 'cut'
              ? '已剪切所选文本。'
              : '已粘贴文本。'
        );
    } catch {
      if (latest.current.document.id === documentId)
        setNotice(
          `请使用 Ctrl/⌘+${action === 'copy' ? 'C' : action === 'cut' ? 'X' : 'V'} ${action === 'copy' ? '复制' : action === 'cut' ? '剪切' : '粘贴'}。`
        );
    } finally {
      clipboardOperationRef.current = false;
      setClipboardBusy(false);
    }
  };

  return (
    <div
      className="z-studio-word"
      data-part="word"
      data-readonly={!editable || undefined}
      onClick={(event) => {
        const image =
          event.target instanceof HTMLElement ? event.target.closest('img[data-word-image]') : null;
        if (!image) return;
        for (const [name, current] of [
          ['content', bodyEditor],
          ['header', regions.header],
          ['footer', regions.footer],
        ] as const) {
          if (!current || current.isDestroyed || !current.view.dom.contains(image)) continue;
          event.preventDefault();
          const position = current.view.posAtDOM(image, 0);
          current.chain().focus().setNodeSelection(position).run();
          setRegion(name);
          setTab('insert');
          break;
        }
      }}
      onKeyDownCapture={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          ['f', 'h'].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          setSidePanel('search');
          if (event.key.toLowerCase() === 'h') setNotice('输入查找内容和替换文本。');
          searchInputRef.current?.focus();
        } else if (event.key === 'Escape' && sidePanel) setSidePanel(null);
      }}
    >
      <Tabs value={tab} onValueChange={setTab} className="z-studio-word-ribbon z-studio-ribbon">
        <StudioRibbonTabs>
          <Tabs.List aria-label="Word 工具">
            <Tabs.Trigger value="home">开始</Tabs.Trigger>
            <Tabs.Trigger value="insert">插入</Tabs.Trigger>
            <Tabs.Trigger value="layout">布局</Tabs.Trigger>
            <Tabs.Trigger value="references">引用</Tabs.Trigger>
            <Tabs.Trigger value="review">审阅</Tabs.Trigger>
            <Tabs.Trigger value="view">视图</Tabs.Trigger>
          </Tabs.List>
        </StudioRibbonTabs>
        <Tabs.Panel value="home" className="z-studio-word-tool-row">
          <RibbonGroup label="剪贴板" className="z-studio-word-clipboard-group">
            <Button
              variant="ghost"
              size="sm"
              className="z-studio-word-large-tool"
              title="粘贴剪贴板文本 (Ctrl/⌘+V)"
              disabled={toolsDisabled || clipboardBusy}
              onMouseDown={keepSelection}
              onClick={() => void handleClipboard('paste')}
            >
              <Clipboard size={24} />
              <span>粘贴</span>
            </Button>
            <div className="z-studio-word-tool-stack">
              <Button
                variant="ghost"
                size="sm"
                iconStart={<Scissors size={16} />}
                title="剪切所选文本 (Ctrl/⌘+X)"
                disabled={toolsDisabled || clipboardBusy || !selection?.selectedText}
                onMouseDown={keepSelection}
                onClick={() => void handleClipboard('cut')}
              >
                剪切
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconStart={<Copy size={16} />}
                title="复制所选文本 (Ctrl/⌘+C)"
                disabled={!editor || clipboardBusy || !selection?.selectedText}
                onMouseDown={keepSelection}
                onClick={() => void handleClipboard('copy')}
              >
                复制
              </Button>
            </div>
          </RibbonGroup>
          <RibbonGroup label="历史" className="z-studio-word-history-group">
            <Button
              iconStart={<RotateCcw size={16} />}
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.undo}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              撤销
            </Button>
            <Button
              iconStart={<RotateCcw size={16} style={{ transform: 'scaleX(-1)' }} />}
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.redo}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              重做
            </Button>
          </RibbonGroup>
          <RibbonGroup label="字体" className="z-studio-word-font-group">
            <RibbonRow>
              <StudioFontControl
                label="字体"
                kind="family"
                options={fontOptions}
                value={selection?.font || 'Noto Sans SC'}
                disabled={toolsDisabled}
                contextKey={fontContextKey}
                className="z-studio-word-font"
                onEditStart={rememberFontSelection}
                onCommit={(value, reason) => commitFont('family', value, reason)}
                onCancel={() => editor?.commands.focus()}
              />
              <StudioFontControl
                label="字号"
                kind="size"
                maxSize={300}
                sizeStep={0.5}
                options={sizeOptions}
                value={(selection?.fontSize || '12pt').replace(/pt$/i, '')}
                disabled={toolsDisabled}
                contextKey={fontContextKey}
                className="z-studio-word-size"
                onEditStart={rememberFontSelection}
                onCommit={(value, reason) => commitFont('size', value, reason)}
                onCancel={() => editor?.commands.focus()}
              />
            </RibbonRow>
            <RibbonRow>
              <Button
                aria-label="粗体"
                title="粗体 (Ctrl/⌘+B)"
                aria-pressed={selection?.bold || false}
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold size={16} />
              </Button>
              <Button
                aria-label="斜体"
                title="斜体 (Ctrl/⌘+I)"
                aria-pressed={selection?.italic || false}
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic size={16} />
              </Button>
              <Button
                aria-label="下划线"
                aria-pressed={selection?.underline || false}
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
              >
                <span className="z-studio-word-underline">U</span>
              </Button>
              <Button
                aria-label="删除线"
                aria-pressed={selection?.strike || false}
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
              >
                <s>S</s>
              </Button>
              <Button
                aria-label="上标"
                aria-pressed={selection?.superscript || false}
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().toggleMark('superscript').run()}
              >
                x<sup>2</sup>
              </Button>
              <Button
                aria-label="下标"
                aria-pressed={selection?.subscript || false}
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().toggleMark('subscript').run()}
              >
                x<sub>2</sub>
              </Button>
              <ColorPicker
                aria-label="文字颜色"
                title="文字颜色"
                value={selection?.color || '#000000'}
                disabled={toolsDisabled}
                size="sm"
                onChange={(value) => editor?.chain().focus().setColor(value).run()}
              />
              <Button
                aria-label="清除格式"
                title="清除文字和段落格式"
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
              >
                <span aria-hidden="true" className="z-studio-word-clear-format">
                  A
                </span>
              </Button>
            </RibbonRow>
          </RibbonGroup>
          <RibbonGroup label="段落" className="z-studio-word-paragraph-group">
            <RibbonRow>
              <Button
                aria-label="项目符号"
                title="项目符号"
                aria-pressed={selection?.bullet || false}
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <span aria-hidden="true">• ≡</span>
              </Button>
              <Button
                aria-label="编号列表"
                title="编号列表"
                aria-pressed={selection?.ordered || false}
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <span aria-hidden="true">1. ≡</span>
              </Button>
              <Button
                aria-label="减少缩进"
                title="减少缩进"
                variant="ghost"
                size="sm"
                disabled={toolsDisabled || (selection?.indent || 0) <= 0}
                onMouseDown={keepSelection}
                onClick={() => adjustIndent(-18)}
              >
                ← ≡
              </Button>
              <Button
                aria-label="增加缩进"
                title="增加缩进"
                variant="ghost"
                size="sm"
                disabled={toolsDisabled}
                onMouseDown={keepSelection}
                onClick={() => adjustIndent(18)}
              >
                ≡ →
              </Button>
              <Select
                aria-label="段落行距"
                size="sm"
                disabled={toolsDisabled}
                value={selection?.lineHeight || '1.75'}
                options={[
                  1,
                  1.15,
                  1.5,
                  1.75,
                  2,
                  ...(selection?.lineHeight &&
                  ![1, 1.15, 1.5, 1.75, 2].includes(Number(selection.lineHeight))
                    ? [Number(selection.lineHeight)]
                    : []),
                ].map((value) => ({ value: String(value), label: `${value} 倍` }))}
                onChange={(value) =>
                  editor
                    ?.chain()
                    .focus()
                    .updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', {
                      lineHeight: Number(value),
                    })
                    .run()
                }
              />
            </RibbonRow>
            <RibbonRow>
              {ALIGNMENTS.map(({ value, label, Icon }) => (
                <Button
                  key={value}
                  aria-label={label}
                  title={label}
                  aria-pressed={selection?.align === value}
                  variant="ghost"
                  size="sm"
                  disabled={toolsDisabled}
                  onMouseDown={keepSelection}
                  onClick={() => editor?.chain().focus().setTextAlign(value).run()}
                >
                  <Icon size={16} />
                </Button>
              ))}
            </RibbonRow>
          </RibbonGroup>
          <RibbonGroup label="样式" className="z-studio-word-styles-group">
            <div className="z-studio-word-style-gallery" data-part="word-style-gallery">
              {STYLE_PREVIEWS.map(({ value, label }) => (
                <Button
                  key={value}
                  variant="ghost"
                  size="sm"
                  className="z-studio-word-style-preview"
                  data-style={value}
                  aria-label={`${label}样式`}
                  aria-pressed={selection?.style === value}
                  title={label}
                  disabled={toolsDisabled}
                  onMouseDown={keepSelection}
                  onClick={() => applyParagraphStyle(value)}
                >
                  <span className="z-studio-word-style-sample" aria-hidden="true">
                    AaBbCc
                  </span>
                  <span>{label}</span>
                </Button>
              ))}
            </div>
            <Select
              aria-label="段落样式"
              className="z-studio-word-style-list"
              options={STYLE_OPTIONS}
              value={selection?.style || 'paragraph'}
              disabled={toolsDisabled}
              size="sm"
              onChange={applyParagraphStyle}
            />
          </RibbonGroup>
          <RibbonGroup label="编辑" className="z-studio-word-navigation-group">
            <Button
              aria-label="查找与替换"
              title="查找与替换 (Ctrl/⌘+F)"
              iconStart={<Search size={16} />}
              variant="ghost"
              size="sm"
              disabled={!editor}
              onClick={() => setSidePanel('search')}
            >
              查找
            </Button>
            <Button
              aria-label="文档大纲"
              title="文档大纲"
              iconStart={<Book size={16} />}
              variant="ghost"
              size="sm"
              disabled={!bodyEditor}
              onClick={() => setSidePanel('outline')}
            >
              大纲
            </Button>
          </RibbonGroup>
        </Tabs.Panel>
        <Tabs.Panel value="insert" className="z-studio-word-tool-row">
          <RibbonGroup label="页面">
            <Button
              variant="ghost"
              size="sm"
              className="z-studio-word-large-tool"
              title="插入分页符"
              disabled={toolsDisabled}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().insertContent({ type: 'pageBreak' }).run()}
            >
              <FileText size={24} />
              <span>分页符</span>
            </Button>
          </RibbonGroup>
          <RibbonGroup label="表格" className="z-studio-word-table-group">
            <Select
              aria-label="表格行数"
              size="sm"
              value={tableRows}
              disabled={toolsDisabled}
              options={[2, 3, 4, 5, 6, 8, 10].map((value) => ({
                value: String(value),
                label: `${value} 行`,
              }))}
              onChange={setTableRows}
            />
            <Select
              aria-label="表格列数"
              size="sm"
              value={tableColumns}
              disabled={toolsDisabled}
              options={[2, 3, 4, 5, 6, 8].map((value) => ({
                value: String(value),
                label: `${value} 列`,
              }))}
              onChange={setTableColumns}
            />
            <Checkbox
              label="标题行"
              checked={tableHeader}
              disabled={toolsDisabled}
              onChange={setTableHeader}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={toolsDisabled}
              onMouseDown={keepSelection}
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .insertTable({
                    rows: Number(tableRows),
                    cols: Number(tableColumns),
                    withHeaderRow: tableHeader,
                  })
                  .run()
              }
            >
              插入表格
            </Button>
          </RibbonGroup>
          <RibbonGroup label="图片">
            <input
              type="file"
              accept="image/png,image/jpeg"
              aria-label="选择 Word 图片"
              ref={imageInputRef}
              className="z-studio-word-file-input"
              tabIndex={-1}
              disabled={toolsDisabled || imageBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void insertImage(file);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="z-studio-word-large-tool"
              disabled={toolsDisabled || imageBusy}
              onMouseDown={keepSelection}
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageIcon size={24} />
              {imageBusy ? '正在读取…' : '插入图片'}
            </Button>
            {selection?.image && (
              <>
                <Input
                  type="number"
                  min={1}
                  max={2000}
                  size="sm"
                  aria-label="图片宽度"
                  value={String(selection.image.width)}
                  disabled={toolsDisabled}
                  className="z-studio-word-image-size"
                  onChange={(event) => resizeImage('width', event.target.value)}
                />
                <span>×</span>
                <Input
                  type="number"
                  min={1}
                  max={2000}
                  size="sm"
                  aria-label="图片高度"
                  value={String(selection.image.height)}
                  disabled={toolsDisabled}
                  className="z-studio-word-image-size"
                  onChange={(event) => resizeImage('height', event.target.value)}
                />
                <Checkbox
                  label="保持比例"
                  checked={lockImageRatio}
                  disabled={toolsDisabled}
                  onChange={(value) => {
                    imageRatioRef.current = null;
                    setLockImageRatio(value);
                  }}
                />
                <Input
                  size="sm"
                  aria-label="图片说明"
                  value={String(selection.image.alt || '')}
                  disabled={toolsDisabled}
                  maxLength={1000}
                  onChange={(event) => updateImage({ alt: event.target.value })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={toolsDisabled}
                  onMouseDown={keepSelection}
                  onClick={() => editor?.chain().focus().deleteSelection().run()}
                >
                  删除图片
                </Button>
              </>
            )}
          </RibbonGroup>
          <RibbonGroup label="链接">
            <Button
              iconStart={<Link size={15} />}
              variant="ghost"
              size="sm"
              disabled={toolsDisabled}
              onMouseDown={keepSelection}
              onClick={() => {
                setLinkHref(editor?.getAttributes('link').href || '');
                setLinkError('');
                setLinkOpen(true);
              }}
            >
              链接
            </Button>
          </RibbonGroup>
          <RibbonGroup label="页眉页脚" className="z-studio-word-header-group">
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled}
              onClick={() => openRegion('header')}
            >
              编辑页眉
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled}
              onClick={() => openRegion('footer')}
            >
              编辑页脚
            </Button>
            <Checkbox
              label="显示页码"
              checked={document.pageNumbers || hasPageNumber(document.footer)}
              disabled={toolsDisabled}
              onChange={togglePageNumbers}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled}
              onMouseDown={keepSelection}
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .insertContent({ type: 'pageNumber', attrs: { kind: 'current' } })
                  .run()
              }
            >
              插入页码
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled}
              onMouseDown={keepSelection}
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .insertContent({ type: 'pageNumber', attrs: { kind: 'total' } })
                  .run()
              }
            >
              插入总页数
            </Button>
            {region !== 'content' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={!bodyEditor}
                onClick={() => {
                  setRegion('content');
                  bodyEditor?.commands.focus();
                }}
              >
                返回正文
              </Button>
            )}
          </RibbonGroup>
          <RibbonGroup label="文本">
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            >
              分隔线
            </Button>
          </RibbonGroup>
          <RibbonGroup label="表格工具" className="z-studio-word-table-tools-group">
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.inTable}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().addRowAfter().run()}
            >
              增加行
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.inTable}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().addColumnAfter().run()}
            >
              增加列
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.inTable}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().deleteRow().run()}
            >
              删除行
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.inTable}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().deleteColumn().run()}
            >
              删除列
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.canMerge}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().mergeCells().run()}
            >
              合并单元格
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.canSplit}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().splitCell().run()}
            >
              拆分单元格
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.inTable}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
            >
              切换标题行
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || !selection?.inTable}
              onMouseDown={keepSelection}
              onClick={() => editor?.chain().focus().deleteTable().run()}
            >
              删除表格
            </Button>
          </RibbonGroup>
        </Tabs.Panel>
        <Tabs.Panel value="layout" className="z-studio-word-tool-row">
          <RibbonGroup label="页面设置" className="z-studio-word-page-group">
            <Select
              aria-label="纸张尺寸"
              size="sm"
              disabled={toolsDisabled}
              value={document.page.size}
              options={[
                { value: 'A4', label: 'A4 · 210 × 297 mm' },
                { value: 'Letter', label: 'Letter · 216 × 279 mm' },
              ]}
              onChange={(value) => updatePage({ size: value as 'A4' | 'Letter' })}
            />
            <Select
              aria-label="纸张方向"
              size="sm"
              disabled={toolsDisabled}
              value={document.page.orientation}
              options={[
                { value: 'portrait', label: '纵向' },
                { value: 'landscape', label: '横向' },
              ]}
              onChange={(value) => updatePage({ orientation: value as 'portrait' | 'landscape' })}
            />
            <Select
              aria-label="页边距"
              size="sm"
              disabled={toolsDisabled}
              value={String(document.page.margin)}
              options={[
                10,
                15,
                20,
                25,
                30,
                40,
                50,
                ...(![10, 15, 20, 25, 30, 40, 50].includes(document.page.margin)
                  ? [document.page.margin]
                  : []),
              ].map((value) => ({ value: String(value), label: `${value} mm` }))}
              onChange={(value) => updatePage({ margin: Number(value) })}
            />
          </RibbonGroup>
          <RibbonGroup label="段落" className="z-studio-word-layout-group">
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled || (selection?.indent || 0) <= 0}
              onMouseDown={keepSelection}
              onClick={() => adjustIndent(-18)}
            >
              减少缩进
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toolsDisabled}
              onMouseDown={keepSelection}
              onClick={() => adjustIndent(18)}
            >
              增加缩进
            </Button>
            <Select
              aria-label="段落行距"
              size="sm"
              disabled={toolsDisabled}
              value={selection?.lineHeight || '1.75'}
              options={[
                1,
                1.15,
                1.5,
                1.75,
                2,
                ...(selection?.lineHeight &&
                ![1, 1.15, 1.5, 1.75, 2].includes(Number(selection.lineHeight))
                  ? [Number(selection.lineHeight)]
                  : []),
              ].map((value) => ({ value: String(value), label: `${value} 倍行距` }))}
              onChange={(value) => {
                const node = editor?.isActive('heading') ? 'heading' : 'paragraph';
                editor
                  ?.chain()
                  .focus()
                  .updateAttributes(node, { lineHeight: Number(value) })
                  .run();
              }}
            />
          </RibbonGroup>
          <RibbonGroup label="页眉页脚" className="z-studio-word-distance-group">
            <label className="z-studio-word-distance-label">
              页眉
              <Input
                type="number"
                min={0}
                max={80}
                step={0.5}
                size="sm"
                aria-label="页眉距顶端（mm）"
                disabled={toolsDisabled}
                value={String(document.page.headerDistance ?? 12.5)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (event.target.value && Number.isFinite(value) && value >= 0 && value <= 80)
                    updatePage({ headerDistance: value });
                }}
              />
            </label>
            <label className="z-studio-word-distance-label">
              页脚
              <Input
                type="number"
                min={0}
                max={80}
                step={0.5}
                size="sm"
                aria-label="页脚距底端（mm）"
                disabled={toolsDisabled}
                value={String(document.page.footerDistance ?? 12.5)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (event.target.value && Number.isFinite(value) && value >= 0 && value <= 80)
                    updatePage({ footerDistance: value });
                }}
              />
            </label>
          </RibbonGroup>
        </Tabs.Panel>
        <Tabs.Panel value="references" className="z-studio-word-tool-row">
          <RibbonGroup label="目录">
            <Button
              variant="ghost"
              size="sm"
              className="z-studio-word-large-tool"
              iconStart={<Book size={24} />}
              disabled={!bodyEditor}
              title="按文档标题导航"
              onClick={() => setSidePanel('outline')}
            >
              文档大纲
            </Button>
          </RibbonGroup>
          <RibbonGroup label="标题级别">
            <Select
              aria-label="引用标题样式"
              size="sm"
              options={STYLE_OPTIONS}
              value={selection?.style || 'paragraph'}
              disabled={toolsDisabled}
              onChange={applyParagraphStyle}
            />
          </RibbonGroup>
          <RibbonGroup label="链接">
            <Button
              iconStart={<Link size={24} />}
              className="z-studio-word-large-tool"
              variant="ghost"
              size="sm"
              disabled={toolsDisabled}
              onMouseDown={keepSelection}
              onClick={() => {
                setLinkHref(editor?.getAttributes('link').href || '');
                setLinkError('');
                setLinkOpen(true);
              }}
            >
              链接
            </Button>
          </RibbonGroup>
        </Tabs.Panel>
        <Tabs.Panel value="review" className="z-studio-word-tool-row">
          <RibbonGroup label="校对">
            <Button
              iconStart={<FileText size={24} />}
              className="z-studio-word-large-tool"
              variant="ghost"
              size="sm"
              disabled={!bodyEditor}
              onClick={() => setStatisticsOpen(true)}
            >
              字数统计
            </Button>
          </RibbonGroup>
          <RibbonGroup label="查找">
            <Button
              iconStart={<Search size={24} />}
              className="z-studio-word-large-tool"
              variant="ghost"
              size="sm"
              disabled={!editor}
              onClick={() => setSidePanel('search')}
            >
              查找与替换
            </Button>
          </RibbonGroup>
        </Tabs.Panel>
        <Tabs.Panel value="view" className="z-studio-word-tool-row">
          <RibbonGroup label="显示" className="z-studio-word-view-group">
            <Checkbox label="标尺" checked={showRuler} onChange={setShowRuler} />
            <Checkbox
              label="导航窗格"
              checked={!!sidePanel}
              onChange={(value) => setSidePanel(value ? 'outline' : null)}
            />
          </RibbonGroup>
          <RibbonGroup label="缩放">
            <Button
              variant="ghost"
              size="sm"
              className="z-studio-word-large-tool"
              onClick={() => setZoom('1')}
              aria-pressed={zoom === '1'}
            >
              <span className="z-studio-word-zoom-sample">100%</span>
              <span>实际大小</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="z-studio-word-large-tool"
              onClick={() => setZoom('fit')}
              aria-pressed={zoom === 'fit'}
            >
              <FileText size={24} />
              <span>适应宽度</span>
            </Button>
          </RibbonGroup>
        </Tabs.Panel>
      </Tabs>
      <div className="z-studio-word-workspace" data-part="word-workspace">
        <div className="z-studio-word-navigation-rail" role="toolbar" aria-label="Word 文档工具">
          <Button
            variant="ghost"
            size="sm"
            aria-label="打开查找与替换"
            title="查找与替换"
            aria-pressed={sidePanel === 'search'}
            disabled={!editor}
            onClick={() => setSidePanel(sidePanel === 'search' ? null : 'search')}
          >
            <Search size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="打开文档大纲"
            title="文档大纲"
            aria-pressed={sidePanel === 'outline'}
            disabled={!bodyEditor}
            onClick={() => setSidePanel(sidePanel === 'outline' ? null : 'outline')}
          >
            <Book size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="打开字数统计"
            title="字数统计"
            disabled={!bodyEditor}
            onClick={() => setStatisticsOpen(true)}
          >
            <FileText size={18} />
          </Button>
        </div>
        {sidePanel && (
          <aside
            className="z-studio-word-sidebar"
            data-part="word-navigation"
            aria-label={sidePanel === 'search' ? 'Word 查找与替换' : 'Word 文档大纲'}
          >
            <div className="z-studio-word-sidebar-heading">
              <strong>{sidePanel === 'search' ? '查找与替换' : '文档大纲'}</strong>
              <Button
                size="sm"
                variant="ghost"
                aria-label="关闭文档导航"
                onClick={() => setSidePanel(null)}
              >
                ×
              </Button>
            </div>
            {sidePanel === 'search' ? (
              <>
                <span className="z-studio-word-sidebar-note">
                  {region === 'content' ? '正文' : region === 'header' ? '页眉' : '页脚'}中查找
                </span>
                <Input
                  aria-label="查找内容"
                  ref={searchInputRef}
                  size="sm"
                  value={searchQuery}
                  maxLength={5000}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      stepMatch(event.shiftKey ? -1 : 1);
                    }
                  }}
                />
                <Checkbox label="区分大小写" checked={matchCase} onChange={setMatchCase} />
                <div className="z-studio-word-search-actions">
                  <span role="status">
                    {(selection?.matches.length || 0) > WORD_SEARCH_LIMIT
                      ? `超过 ${WORD_SEARCH_LIMIT} 处匹配`
                      : `${selection?.matches.length || 0} 处匹配`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!selection?.matches.length}
                    onClick={() => stepMatch(-1)}
                  >
                    上一处
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!selection?.matches.length}
                    onClick={() => stepMatch(1)}
                  >
                    下一处
                  </Button>
                </div>
                <Input
                  aria-label="替换为"
                  size="sm"
                  value={replacement}
                  maxLength={10000}
                  disabled={!editable}
                  onChange={(event) => setReplacement(event.target.value)}
                />
                <div className="z-studio-word-search-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={toolsDisabled || !selection?.matches.length}
                    onClick={() => {
                      const matches = selection?.matches || [];
                      if (editor && matches.length) {
                        try {
                          if (
                            wordReplaceMatches(
                              editor,
                              [matches[Math.max(0, Math.min(matchIndex, matches.length - 1))]],
                              replacement
                            )
                          )
                            setNotice('已替换一处匹配。');
                        } catch (error) {
                          setNotice(error instanceof Error ? error.message : '替换失败。');
                        }
                      }
                    }}
                  >
                    替换
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      toolsDisabled ||
                      !selection?.matches.length ||
                      selection.matches.length > WORD_SEARCH_LIMIT
                    }
                    onClick={() => {
                      if (editor && selection?.matches.length) {
                        const count = selection.matches.length;
                        try {
                          if (wordReplaceMatches(editor, selection.matches, replacement)) {
                            setMatchIndex(-1);
                            setNotice(`已替换 ${count} 处匹配。`);
                          }
                        } catch (error) {
                          setNotice(error instanceof Error ? error.message : '替换失败。');
                        }
                      }
                    }}
                  >
                    全部替换
                  </Button>
                </div>
                {(selection?.matches.length || 0) > WORD_SEARCH_LIMIT && (
                  <p className="z-studio-word-sidebar-note">
                    匹配超过上限，请缩小查找范围后再全部替换。
                  </p>
                )}
                <div className="z-studio-word-navigation-list">
                  {(selection?.matches || []).slice(0, 200).map((match, index) => (
                    <Button
                      key={`${match.from}-${match.to}`}
                      variant="ghost"
                      size="sm"
                      aria-label={`跳转匹配 ${index + 1}`}
                      aria-pressed={index === matchIndex}
                      onClick={() => navigateMatch(index)}
                    >
                      {index + 1}. {match.text}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="z-studio-word-navigation-list">
                {!outline.length && (
                  <p className="z-studio-word-sidebar-note">应用标题样式后，可在这里快速跳转。</p>
                )}
                {outline.map((heading, index) => (
                  <Button
                    key={`${heading.position}-${index}`}
                    size="sm"
                    variant="ghost"
                    style={{ paddingInlineStart: 8 + (heading.level - 1) * 12 }}
                    onClick={() => {
                      setRegion('content');
                      bodyEditor
                        ?.chain()
                        .focus()
                        .setTextSelection(heading.position)
                        .scrollIntoView()
                        .run();
                    }}
                  >
                    {heading.text || '未命名标题'}
                  </Button>
                ))}
              </div>
            )}
          </aside>
        )}
        <div className="z-studio-word-stage" data-part="word-stage" ref={stageRef}>
          {showRuler && <WordRuler length={pageWidth} margin={margin} scale={scale} />}
          <div
            className="z-studio-word-paper-space"
            style={{
              width: pageWidth * scale,
              minHeight: Math.max(pageHeight, paperHeight) * scale,
            }}
          >
            {showRuler && <WordRuler length={pageHeight} margin={margin} scale={scale} vertical />}
            <article
              ref={paperRef}
              className="z-studio-word-paper"
              data-part="word-paper"
              aria-label="文档纸张"
              style={{
                width: pageWidth,
                minHeight: pageHeight,
                padding: margin,
                transform: `scale(${scale})`,
              }}
            >
              {document.header && (
                <section
                  className="z-studio-word-region"
                  data-region="header"
                  data-active={region === 'header' || undefined}
                  aria-label="页眉区域"
                >
                  <span className="z-studio-word-region-label">页眉</span>
                  <RegionEditor
                    region="header"
                    documentId={document.id}
                    content={document.header}
                    editable={editable}
                    onReady={registerRegion}
                    onActive={setRegion}
                    onImagePaste={(file, target) => {
                      void insertImage(file, target);
                    }}
                    onChange={(content) => updateRegion('header', content)}
                  />
                </section>
              )}
              <EditorContent
                editor={bodyEditor}
                className="z-studio-word-content z-studio-word-body"
              />
              {document.footer && (
                <section
                  className="z-studio-word-region"
                  data-region="footer"
                  data-active={region === 'footer' || undefined}
                  aria-label="页脚区域"
                >
                  <span className="z-studio-word-region-label">页脚</span>
                  <RegionEditor
                    region="footer"
                    documentId={document.id}
                    content={document.footer}
                    editable={editable}
                    onReady={registerRegion}
                    onActive={setRegion}
                    onImagePaste={(file, target) => {
                      void insertImage(file, target);
                    }}
                    onChange={(content) => updateRegion('footer', content)}
                  />
                </section>
              )}
            </article>
          </div>
        </div>
      </div>
      <div className="z-studio-word-status" data-part="word-status">
        <span>
          {bodySummary?.nonWhitespaceCharacters || 0} 字 · {document.page.size} ·{' '}
          {landscape ? '横向' : '纵向'}
          {!editable ? ' · 只读' : ''}
          {region !== 'content' ? ` · 正在${region === 'header' ? '编辑页眉' : '编辑页脚'}` : ''}
        </span>
        {notice && (
          <span role="status" className="z-studio-word-notice">
            {notice}
          </span>
        )}
        <div className="z-studio-word-zoom">
          <span>缩放</span>
          <Select
            aria-label="Word 缩放"
            size="sm"
            value={zoom}
            options={[
              { value: 'fit', label: '适应宽度' },
              ...[0.5, 0.75, 1, 1.25, 1.5].map((value) => ({
                value: String(value),
                label: `${Math.round(value * 100)}%`,
              })),
            ]}
            onChange={setZoom}
          />
        </div>
      </div>
      <Modal open={statisticsOpen} onOpenChange={setStatisticsOpen}>
        <Modal.Content size="sm">
          <Modal.Header>
            <Modal.Title>字数统计</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            <dl className="z-studio-word-statistics">
              <div>
                <dt>字符数（含空白）</dt>
                <dd>{bodySummary?.characters || 0}</dd>
              </div>
              <div>
                <dt>字符数（不含空白）</dt>
                <dd>{bodySummary?.nonWhitespaceCharacters || 0}</dd>
              </div>
              <div>
                <dt>段落数</dt>
                <dd>{bodySummary?.paragraphs || 0}</dd>
              </div>
            </dl>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={() => setStatisticsOpen(false)}>
              关闭
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
      <Modal open={linkOpen && editable} onOpenChange={setLinkOpen}>
        <Modal.Content size="sm">
          <Modal.Header>
            <Modal.Title>编辑链接</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            <label className="z-studio-word-link-label">
              链接地址
              <Input
                aria-label="链接地址"
                value={linkHref}
                onChange={(event) => {
                  setLinkHref(event.target.value);
                  setLinkError('');
                }}
                placeholder="https://example.com"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyLink();
                }}
              />
            </label>
            <p className="z-studio-word-link-note">选择正文后添加链接；留空会移除当前链接。</p>
            {linkError ? (
              <p role="alert" className="z-studio-word-link-error">
                {linkError}
              </p>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              取消
            </Button>
            <Button onClick={applyLink}>应用链接</Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </div>
  );
}

export default StudioWord;
