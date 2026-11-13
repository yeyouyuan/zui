import { createRef, StrictMode, useLayoutEffect, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { StudioWord } from './StudioWord';
import { OfficeStudio } from './OfficeStudio';
import type { OfficeStudioHandle, StudioEditorProps, StudioWordDocument } from './studio-types';

const documentModel = (text = '项目评审内容'): StudioWordDocument => ({
  version: 1,
  id: 'word-ui-test',
  name: '测试.docx',
  kind: 'word',
  page: { size: 'A4', orientation: 'portrait', margin: 20 },
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
});
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y3nRmwAAAAASUVORK5CYII=';
const JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAQACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDn6KKK++PngooooA//2Q==';

function selectNodeContents(textbox: HTMLElement, node: Node) {
  act(() => {
    textbox.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
}

const restore: (() => void)[] = [];
let restoreClipboard: (() => void) | undefined;

function mockClipboard(api: Partial<Pick<Clipboard, 'readText' | 'writeText'>>) {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: api });
  restoreClipboard = () => {
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
  };
}

beforeAll(() => {
  // jsdom has no layout; these geometry methods let ProseMirror perform selection/focus work.
  for (const [prototype, key, implementation] of [
    [Range.prototype, 'getClientRects', () => []],
    [
      Range.prototype,
      'getBoundingClientRect',
      () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    ],
    [HTMLElement.prototype, 'scrollIntoView', () => undefined],
  ] as const) {
    if (key in prototype) continue;
    Object.defineProperty(prototype, key, { configurable: true, value: implementation });
    restore.push(() => Reflect.deleteProperty(prototype, key));
  }
});
afterAll(() => restore.forEach((callback) => callback()));
afterEach(() => {
  cleanup();
  restoreClipboard?.();
  restoreClipboard = undefined;
  vi.restoreAllMocks();
});

describe('StudioWord Office ribbon actions', () => {
  it('applies font family and size to the selected range and restores them with undo and redo', async () => {
    const { textbox, onChange } = await mount();
    selectNodeContents(textbox, textbox.querySelector('p')!);
    fireEvent.focus(screen.getByRole('combobox', { name: '字体' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: '字体' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: '宋体' }));
    await waitFor(() =>
      expect(textbox.querySelector('span')).toHaveStyle({ fontFamily: 'SimSun' })
    );
    fireEvent.focus(screen.getByRole('combobox', { name: '字号' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: '字号' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: '18' }));
    await waitFor(() => expect(textbox.querySelector('span')).toHaveStyle({ fontSize: '18pt' }));
    expect(onChange.mock.lastCall?.[0].content.content[0].content[0].marks).toContainEqual(
      expect.objectContaining({
        type: 'textStyle',
        attrs: expect.objectContaining({ fontFamily: 'SimSun', fontSize: '18pt' }),
      })
    );
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() =>
      expect(textbox.querySelector('span')).not.toHaveStyle({ fontSize: '18pt' })
    );
    expect(textbox.querySelector('span')).toHaveStyle({ fontFamily: 'SimSun' });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(textbox.querySelector('span[style*="SimSun"]')).toBeNull());
    expect(textbox).toHaveTextContent('项目评审内容');
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    await waitFor(() =>
      expect(textbox.querySelector('span')).toHaveStyle({ fontFamily: 'SimSun' })
    );
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    await waitFor(() => expect(textbox.querySelector('span')).toHaveStyle({ fontSize: '18pt' }));
    expect(textbox.querySelector('span')).toHaveStyle({ fontFamily: 'SimSun' });
    fireEvent.click(screen.getByRole('button', { name: '文字颜色' }));
    fireEvent.change(await screen.findByRole('textbox', { name: '十六进制颜色值' }), {
      target: { value: '#0055aa' },
    });
    await waitFor(() => expect(textbox.querySelector('span')).toHaveStyle({ color: '#0055aa' }));
    expect(onChange.mock.lastCall?.[0].content.content[0].content[0].marks).toContainEqual(
      expect.objectContaining({
        type: 'textStyle',
        attrs: expect.objectContaining({
          fontFamily: 'SimSun',
          fontSize: '18pt',
          color: '#0055aa',
        }),
      })
    );
  });

  it('applies genuine no-spacing and heading styles through the gallery without replacing text', async () => {
    const { textbox, onChange } = await mount();
    selectNodeContents(textbox, textbox.querySelector('p')!);
    fireEvent.click(screen.getByRole('button', { name: '无间距样式' }));
    await waitFor(() => expect(textbox.querySelector('p')).toHaveStyle({ lineHeight: '1' }));
    expect(onChange.mock.lastCall?.[0].content.content[0].attrs).toMatchObject({
      lineHeight: 1,
      spaceBefore: 0,
      spaceAfter: 0,
    });
    expect(screen.getByRole('button', { name: '无间距样式' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: '正文样式' }));
    await waitFor(() => expect(textbox.querySelector('p')).not.toHaveAttribute('style'));
    fireEvent.click(screen.getByRole('button', { name: '标题 1样式' }));
    await waitFor(() => expect(textbox.querySelector('h1')).toHaveTextContent('项目评审内容'));
    expect(onChange.mock.lastCall?.[0].content.content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
    });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(textbox.querySelector('h1')).toBeNull());
    expect(textbox).toHaveTextContent('项目评审内容');
  });

  it('toggles rulers, navigates headings and changes zoom in read-only mode without document edits', async () => {
    const model = documentModel('正文');
    model.content.content!.unshift({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: '目录入口' }],
    });
    const { container, onChange } = await mount({ document: model, readOnly: true });
    expect(container.querySelectorAll('[data-part="word-ruler"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: '视图' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '标尺' }));
    expect(container.querySelectorAll('[data-part="word-ruler"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('checkbox', { name: '标尺' }));
    expect(container.querySelectorAll('[data-part="word-ruler"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('checkbox', { name: '导航窗格' }));
    fireEvent.click(await screen.findByRole('button', { name: '目录入口' }));
    fireEvent.click(screen.getByRole('tab', { name: '开始' }));
    expect(screen.getByRole('button', { name: '标题 1样式' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('tab', { name: '视图' }));
    fireEvent.click(screen.getByRole('button', { name: /100% 实际大小/ }));
    expect(screen.getByRole('button', { name: /Word 缩放/ })).toHaveTextContent('100%');
    fireEvent.click(screen.getByRole('button', { name: /^适应宽度$/ }));
    expect(screen.getByRole('button', { name: /Word 缩放/ })).toHaveTextContent('适应宽度');
    fireEvent.click(screen.getByRole('button', { name: '打开文档大纲' }));
    expect(screen.queryByRole('button', { name: '目录入口' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('copies plain text, cuts only after a successful write and restores the selected text with undo', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard({ writeText });
    const { textbox, onChange } = await mount({ document: documentModel('预算与预算') });
    selectNodeContents(textbox, textbox.querySelector('p')!);
    await waitFor(() => expect(screen.getByRole('button', { name: '复制' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: '复制' }));
    await screen.findByText('已复制所选文本。');
    expect(writeText).toHaveBeenCalledWith('预算与预算');
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: '剪切' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: '剪切' }));
    await waitFor(() => expect(textbox).not.toHaveTextContent('预算与预算'));
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(textbox).toHaveTextContent('预算与预算'));
  });

  it('pastes multiline clipboard text as paragraphs without interpreting HTML and supports undo', async () => {
    const readText = vi.fn().mockResolvedValue('<img src=x onerror=alert(1)> &\r\n下一段');
    mockClipboard({ readText });
    const { textbox, onChange } = await mount({ document: documentModel('原文') });
    selectNodeContents(textbox, textbox.querySelector('p')!);
    fireEvent.click(screen.getByRole('button', { name: '粘贴' }));
    await waitFor(() => expect(textbox).toHaveTextContent('<img src=x onerror=alert(1)> &下一段'));
    expect([...textbox.querySelectorAll('p')].map((node) => node.textContent)).toEqual([
      '<img src=x onerror=alert(1)> &',
      '下一段',
    ]);
    expect(textbox.querySelector('img, script')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(textbox).toHaveTextContent('原文'));
    expect(textbox).not.toHaveTextContent('下一段');
  });

  it('allows copying a read-only selection while disabling cut and paste', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard({ writeText });
    const { textbox, onChange } = await mount({ readOnly: true });
    selectNodeContents(textbox, textbox.querySelector('p')!);
    await waitFor(() => expect(screen.getByRole('button', { name: '复制' })).not.toBeDisabled());
    expect(screen.getByRole('button', { name: '剪切' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '粘贴' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '复制' }));
    await screen.findByText('已复制所选文本。');
    expect(writeText).toHaveBeenCalledWith('项目评审内容');
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ['copy', '复制', 'C'],
    ['cut', '剪切', 'X'],
    ['paste', '粘贴', 'V'],
  ] as const)(
    'keeps the document when clipboard %s fails and offers the native shortcut',
    async (_, label, key) => {
      mockClipboard({
        readText: vi.fn().mockRejectedValue(new Error('clipboard denied')),
        writeText: vi.fn().mockRejectedValue(new Error('clipboard denied')),
      });
      const { textbox, onChange } = await mount();
      selectNodeContents(textbox, textbox.querySelector('p')!);
      await waitFor(() => expect(screen.getByRole('button', { name: label })).not.toBeDisabled());
      fireEvent.click(screen.getByRole('button', { name: label }));
      await screen.findByText(`请使用 Ctrl/⌘+${key} ${label}。`);
      expect(textbox).toHaveTextContent('项目评审内容');
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['paste', 'same-id'],
    ['paste', 'new-id'],
    ['cut', 'same-id'],
    ['cut', 'new-id'],
  ] as const)(
    'ignores late clipboard %s after a %s document replacement',
    async (action, identity) => {
      let finish!: () => void;
      const readText = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            finish = () => resolve('迟到粘贴');
          })
      );
      const writeText = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = () => resolve();
          })
      );
      mockClipboard({ readText, writeText });
      const { textbox, rerender, onChange } = await mount({ document: documentModel('原文') });
      selectNodeContents(textbox, textbox.querySelector('p')!);
      const label = action === 'paste' ? '粘贴' : '剪切';
      await waitFor(() => expect(screen.getByRole('button', { name: label })).not.toBeDisabled());
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(action === 'paste' ? readText : writeText).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: '粘贴' })).toBeDisabled();
      const next = documentModel(identity === 'same-id' ? '替换正文' : '原文');
      if (identity === 'new-id') next.id = 'next-document';
      rerender(<WordHost document={next} onChange={onChange} disabled={false} readOnly={false} />);
      await waitFor(() =>
        expect(textbox).toHaveTextContent(identity === 'same-id' ? '替换正文' : '原文')
      );
      await act(async () => finish());
      await waitFor(() => expect(screen.getByRole('button', { name: '粘贴' })).not.toBeDisabled());
      expect(textbox).toHaveTextContent(identity === 'same-id' ? '替换正文' : '原文');
      expect(textbox).not.toHaveTextContent('迟到粘贴');
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it('counts Unicode body characters and paragraphs while the header is active', async () => {
    const model = documentModel('中😀 A');
    model.header = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '很长的页眉内容' }] }],
    };
    const { container, onChange } = await mount({ document: model });
    const header = await screen.findByRole('textbox', { name: 'Word 页眉' });
    act(() => header.focus());
    fireEvent.click(screen.getByRole('button', { name: '打开字数统计' }));
    const dialog = await screen.findByRole('dialog', { name: '字数统计' });
    const count = (label: string) =>
      within(dialog).getByText(label).closest('div')?.querySelector('dd')?.textContent;
    expect(count('字符数（含空白）')).toBe('4');
    expect(count('字符数（不含空白）')).toBe('3');
    expect(count('段落数')).toBe('1');
    expect(container.querySelector('[data-part="word-status"]')).toHaveTextContent('3 字');
    expect(container.querySelector('[data-part="word-status"]')).toHaveTextContent('正在编辑页眉');
    expect(onChange).not.toHaveBeenCalled();
  });
});

function WordHost({ document, onChange, ...props }: StudioEditorProps<StudioWordDocument>) {
  const [value, setValue] = useState(document);
  useLayoutEffect(() => setValue(document), [document]);
  return (
    <StudioWord
      {...props}
      document={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

async function mount(
  options: { disabled?: boolean; readOnly?: boolean; document?: StudioWordDocument } = {}
) {
  const onChange = vi.fn();
  const document = options.document || documentModel();
  const view = render(
    <WordHost
      document={document}
      onChange={onChange}
      disabled={options.disabled || false}
      readOnly={options.readOnly || false}
    />
  );
  const textbox = await screen.findByRole('textbox', { name: 'Word 文档正文' });
  return { ...view, textbox, onChange, document };
}

describe('StudioWord structured editing', () => {
  it('renders an editable document, ZUI ribbon and a scrollable paper stage', async () => {
    const { textbox, container, onChange } = await mount();
    expect(textbox).toHaveTextContent('项目评审内容');
    expect(textbox).toHaveAttribute('contenteditable', 'true');
    expect(textbox).toHaveAttribute('aria-multiline', 'true');
    expect(screen.getByRole('tab', { name: '开始' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: '字体' })).toHaveClass('z-combobox-input');
    const tabs = screen.getByRole('tablist', { name: 'Word 工具' });
    const ribbon = tabs.closest('.z-studio-ribbon');
    expect(ribbon).not.toBeNull();
    const expectZuiButtons = () =>
      expect(
        Array.from(ribbon!.querySelectorAll('button')).every(
          (button) =>
            button.classList.contains('z-button') ||
            button.classList.contains('z-tab') ||
            button.classList.contains('z-select-trigger') ||
            button.classList.contains('z-combobox-toggle') ||
            button.classList.contains('z-color-picker-swatch')
        )
      ).toBe(true);
    for (const name of ['开始', '插入', '布局', '引用', '审阅', '视图']) {
      fireEvent.click(within(tabs).getByRole('tab', { name }));
      expectZuiButtons();
    }
    fireEvent.click(within(tabs).getByRole('tab', { name: '开始' }));
    expect(container.querySelector('[data-part="word-stage"]')).toHaveClass('z-studio-word-stage');
    expect(container.querySelector('[data-part="word-paper"]')).toHaveStyle({
      width: `${(210 * 96) / 25.4}px`,
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('formats a selected text range and undo restores the original structured content', async () => {
    const { textbox, onChange } = await mount();
    act(() => {
      textbox.focus();
      const range = document.createRange();
      range.selectNodeContents(textbox.querySelector('p')!);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    fireEvent.click(screen.getByRole('button', { name: '粗体' }));
    await waitFor(() => expect(textbox.querySelector('strong')).toHaveTextContent('项目评审内容'));
    expect(onChange.mock.lastCall?.[0].content.content[0].content[0].marks).toContainEqual({
      type: 'bold',
    });
    expect(screen.getByRole('button', { name: '粗体' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(textbox.querySelector('strong')).toBeNull());
    expect(onChange.mock.lastCall?.[0].name).toBe('测试.docx');
  });

  it('inserts a real table and changes its row count through the ribbon', async () => {
    const { textbox, onChange } = await mount();
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '插入表格' }));
    await waitFor(() => expect(textbox.querySelectorAll('tr')).toHaveLength(3));
    expect(textbox.querySelectorAll('th')).toHaveLength(3);
    expect(
      onChange.mock.lastCall?.[0].content.content.some(
        (node: { type: string }) => node.type === 'table'
      )
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '增加行' }));
    await waitFor(() => expect(textbox.querySelectorAll('tr')).toHaveLength(4));
    fireEvent.click(screen.getByRole('button', { name: '删除表格' }));
    await waitFor(() => expect(textbox.querySelector('table')).toBeNull());
  });

  it('takes an external document replacement without echoing a change event', async () => {
    const { textbox, rerender, onChange } = await mount();
    rerender(
      <WordHost
        document={documentModel('替换后的文档')}
        onChange={onChange}
        disabled={false}
        readOnly={false}
      />
    );
    await waitFor(() => expect(textbox).toHaveTextContent('替换后的文档'));
    expect(textbox).not.toHaveTextContent('项目评审内容');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the latest host callback and metadata after a parent update', async () => {
    const { rerender, document, textbox } = await mount();
    const nextChange = vi.fn();
    const next = { ...document, name: '最新标题.docx', page: { ...document.page, margin: 30 } };
    rerender(<WordHost document={next} onChange={nextChange} disabled={false} readOnly={false} />);
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '插入表格' }));
    await waitFor(() => expect(textbox.querySelector('table')).not.toBeNull());
    expect(nextChange.mock.lastCall?.[0].name).toBe('最新标题.docx');
    expect(nextChange.mock.lastCall?.[0].page.margin).toBe(30);
  });

  it('restores rejected controlled edits so the canvas and saved model agree', async () => {
    const value = documentModel();
    const ref = createRef<OfficeStudioHandle>();
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(<OfficeStudio ref={ref} value={value} onChange={onChange} onSave={onSave} />);
    const textbox = await screen.findByRole('textbox', { name: 'Word 文档正文' });
    act(() => {
      textbox.focus();
      const range = document.createRange();
      range.selectNodeContents(textbox.querySelector('p')!);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    fireEvent.click(screen.getByRole('button', { name: '粗体' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.lastCall?.[0].content.content[0].content[0].marks).toContainEqual({
      type: 'bold',
    });
    await waitFor(() => expect(textbox.querySelector('strong')).toBeNull());
    expect(textbox).toHaveTextContent('项目评审内容');
    expect(ref.current?.getDocument()).toBe(value);
    await act(async () => ref.current?.save());
    expect(onSave).toHaveBeenCalledWith(value);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the caret and latest text when the controlled host accepts successive input', async () => {
    const ref = createRef<OfficeStudioHandle>();
    const onSave = vi.fn();
    function AcceptedWorkspace() {
      const [value, setValue] = useState(documentModel('原文'));
      return (
        <OfficeStudio
          ref={ref}
          value={value}
          onChange={(next) => {
            if (next.kind === 'word') setValue(next);
          }}
          onSave={onSave}
        />
      );
    }
    render(<AcceptedWorkspace />);
    const textbox = await screen.findByRole('textbox', { name: 'Word 文档正文' });
    act(() => {
      textbox.focus();
      const range = document.createRange();
      range.setStart(textbox.querySelector('p')!.firstChild!, 1);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    for (const [text, body, offset] of [
      ['甲', '原甲文', 2],
      ['乙', '原甲乙文', 3],
    ] as const) {
      fireEvent.paste(textbox, {
        clipboardData: { getData: (type: string) => (type === 'text/plain' ? text : '') },
      });
      await waitFor(() => expect(textbox).toHaveTextContent(body));
      expect(window.getSelection()?.anchorNode).toBe(textbox.querySelector('p')!.firstChild);
      expect(window.getSelection()?.anchorOffset).toBe(offset);
      expect(window.getSelection()?.isCollapsed).toBe(true);
    }
    await act(async () => ref.current?.save());
    expect(onSave.mock.lastCall?.[0].content.content[0].content[0].text).toBe('原甲乙文');
  });

  it('updates page settings while preserving the current document body', async () => {
    const { document, onChange } = await mount();
    fireEvent.click(screen.getByRole('tab', { name: '布局' }));
    fireEvent.click(screen.getByRole('button', { name: /纸张方向/ }));
    fireEvent.click(await screen.findByRole('option', { name: '横向' }));
    expect(onChange).toHaveBeenCalledWith({
      ...document,
      page: { ...document.page, orientation: 'landscape' },
    });
  });

  it.each([{ readOnly: true }, { disabled: true }])(
    'prevents document changes with %j and still allows zoom',
    async (options) => {
      const { textbox, onChange } = await mount(options);
      await waitFor(() => expect(textbox).toHaveAttribute('contenteditable', 'false'));
      expect(textbox).toHaveAttribute('aria-readonly', 'true');
      expect(screen.getByRole('button', { name: '粗体' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: '粗体' }));
      fireEvent.click(screen.getByRole('tab', { name: '插入' }));
      expect(screen.getByRole('button', { name: '插入表格' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: /Word 缩放/ }));
      fireEvent.click(await screen.findByRole('option', { name: '75%' }));
      expect(screen.getByRole('button', { name: /Word 缩放/ })).toHaveTextContent('75%');
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it('rejects unsafe hyperlink protocols without editing the document', async () => {
    const { onChange } = await mount();
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '链接' }));
    const input = await screen.findByRole('textbox', { name: '链接地址' });
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: '应用链接' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('链接仅支持');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('survives StrictMode and renders on the server without browser globals', async () => {
    const document = documentModel();
    expect(() =>
      renderToString(
        <StudioWord
          document={document}
          onChange={() => undefined}
          disabled={false}
          readOnly={false}
        />
      )
    ).not.toThrow();
    const view = render(
      <StrictMode>
        <StudioWord
          document={document}
          onChange={() => undefined}
          disabled={false}
          readOnly={false}
        />
      </StrictMode>
    );
    await waitFor(() =>
      expect(view.getAllByRole('textbox', { name: 'Word 文档正文' })).toHaveLength(1)
    );
  });

  it('imports a local embedded image and refuses invalid image bytes without changing content', async () => {
    const { textbox, onChange } = await mount();
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    const imageInput = screen.getByLabelText('选择 Word 图片');
    const file = new File(
      [Uint8Array.from(atob(PNG), (character) => character.charCodeAt(0))],
      '项目图.png',
      { type: 'image/png' }
    );
    fireEvent.change(imageInput, { target: { files: [file] } });
    await waitFor(() => expect(textbox.querySelector('img')).toHaveAttribute('alt', '项目图.png'));
    const nodes = onChange.mock.lastCall?.[0].content.content.flatMap(
      (node: { content?: { type: string; attrs?: { src?: string } }[] }) => node.content || []
    );
    expect(nodes.find((node: { type: string }) => node.type === 'image').attrs.src).toBe(
      `data:image/png;base64,${PNG}`
    );
    expect(textbox).toHaveTextContent('项目评审内容');
    onChange.mockClear();
    fireEvent.change(imageInput, {
      target: { files: [new File(['<svg/>'], '假的.png', { type: 'image/png' })] },
    });
    await waitFor(() =>
      expect(screen.getByText('请选择有效的 PNG 或 JPEG 图片。')).toBeInTheDocument()
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(textbox.querySelectorAll('img[data-word-image]')).toHaveLength(1);
  });

  it('resizes a selected image with its aspect ratio and restores a deletion with undo', async () => {
    const model = documentModel();
    model.content.content![0].content!.unshift({
      type: 'image',
      attrs: { src: `data:image/png;base64,${PNG}`, width: 320, height: 160, alt: '示意图' },
    });
    const { textbox, onChange } = await mount({ document: model });
    const image = textbox.querySelector('img[data-word-image]')!;
    expect(image).not.toBeNull();
    fireEvent.click(image);
    const width = await screen.findByRole('spinbutton', { name: '图片宽度' });
    fireEvent.change(width, { target: { value: '3' } });
    await waitFor(() =>
      expect(textbox.querySelector('img[data-word-image]')).toHaveAttribute('width', '3')
    );
    fireEvent.change(width, { target: { value: '200' } });
    await waitFor(() =>
      expect(textbox.querySelector('img[data-word-image]')).toHaveAttribute('width', '200')
    );
    expect(textbox.querySelector('img[data-word-image]')).toHaveAttribute('height', '100');
    expect(onChange.mock.lastCall?.[0].content.content[0].content[0].attrs).toMatchObject({
      width: 200,
      height: 100,
    });
    const description = screen.getByRole('textbox', { name: '图片说明' });
    fireEvent.change(description, { target: { value: '项目' } });
    fireEvent.change(screen.getByRole('textbox', { name: '图片说明' }), {
      target: { value: '项目示意图' },
    });
    await waitFor(() =>
      expect(textbox.querySelector('img[data-word-image]')).toHaveAttribute('alt', '项目示意图')
    );
    fireEvent.click(screen.getByRole('button', { name: '删除图片' }));
    await waitFor(() => expect(textbox.querySelector('img[data-word-image]')).toBeNull());
    expect(textbox).toHaveTextContent('项目评审内容');
    fireEvent.click(screen.getByRole('tab', { name: '开始' }));
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(textbox.querySelector('img[data-word-image]')).not.toBeNull());
  });

  it('pastes a local JPEG and retains its real pixel dimensions', async () => {
    const { textbox, onChange } = await mount();
    const file = new File(
      [Uint8Array.from(atob(JPEG), (character) => character.charCodeAt(0))],
      '照片.jpg',
      { type: 'image/jpeg' }
    );
    fireEvent.paste(textbox, { clipboardData: { files: [file], getData: () => '' } });
    await waitFor(() =>
      expect(textbox.querySelector('img[data-word-image]')).toHaveAttribute(
        'src',
        `data:image/jpeg;base64,${JPEG}`
      )
    );
    expect(textbox.querySelector('img[data-word-image]')).toHaveAttribute('width', '32');
    expect(textbox.querySelector('img[data-word-image]')).toHaveAttribute('height', '16');
    expect(
      onChange.mock.lastCall?.[0].content.content
        .flatMap(
          (node: { content?: { type: string; attrs?: { width?: number; height?: number } }[] }) =>
            node.content || []
        )
        .find((node: { type: string }) => node.type === 'image').attrs
    ).toMatchObject({ width: 32, height: 16 });
  });

  it('edits and formats a header independently and adds or removes a footer page field', async () => {
    const { textbox, onChange } = await mount();
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑页眉' }));
    const header = await screen.findByRole('textbox', { name: 'Word 页眉' });
    act(() => header.focus());
    fireEvent.paste(header, {
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? '公司抬头' : '') },
    });
    await waitFor(() => expect(header).toHaveTextContent('公司抬头'));
    expect(textbox).toHaveTextContent('项目评审内容');
    selectNodeContents(header, header.querySelector('p')!);
    fireEvent.click(screen.getByRole('tab', { name: '开始' }));
    fireEvent.click(screen.getByRole('button', { name: '粗体' }));
    await waitFor(() => expect(header.querySelector('strong')).toHaveTextContent('公司抬头'));
    expect(onChange.mock.lastCall?.[0].header.content[0].content[0].marks).toContainEqual({
      type: 'bold',
    });
    expect(textbox.querySelector('strong')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '显示页码' }));
    const footer = await screen.findByRole('textbox', { name: 'Word 页脚' });
    expect(footer.querySelector('[data-word-page-number="current"]')).toBeInTheDocument();
    expect(onChange.mock.lastCall?.[0].pageNumbers).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: '显示页码' }));
    await waitFor(() => expect(footer.querySelector('[data-word-page-number]')).toBeNull());
    expect(onChange.mock.lastCall?.[0].pageNumbers).toBe(false);
    expect(header).toHaveTextContent('公司抬头');
    expect(textbox).toHaveTextContent('项目评审内容');
  });

  it('finds across styled runs and replaces plain text in one undoable transaction', async () => {
    const model = documentModel();
    model.content.content = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '预', marks: [{ type: 'bold' }] },
          { type: 'text', text: '算预算' },
          { type: 'hardBreak' },
          { type: 'text', text: '后续' },
        ],
      },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '交付计划' }] },
    ];
    const { textbox, onChange } = await mount({ document: model });
    fireEvent.keyDown(textbox, { key: 'f', ctrlKey: true });
    const query = await screen.findByRole('textbox', { name: '查找内容' });
    fireEvent.change(query, { target: { value: '预算' } });
    expect(await screen.findByText('2 处匹配')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '替换为' }), {
      target: { value: '<成本>' },
    });
    fireEvent.click(screen.getByRole('button', { name: '全部替换' }));
    await waitFor(() => expect(textbox.querySelector('p')).toHaveTextContent('<成本><成本>后续'));
    expect(textbox.querySelector('成本')).toBeNull();
    expect(textbox.querySelector('p br')).not.toBeNull();
    expect(textbox.querySelector('h2')).toHaveTextContent('交付计划');
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(textbox.querySelector('p')).toHaveTextContent('预算预算后续'));
    expect(textbox.querySelector('strong')).toHaveTextContent('预');
    fireEvent.click(screen.getByRole('button', { name: '文档大纲' }));
    fireEvent.click(await screen.findByRole('button', { name: '交付计划' }));
    expect(window.getSelection()?.anchorNode?.parentElement?.closest('h2')).not.toBeNull();
  });

  it('inserts current and total page fields into the active footer and saves region distances', async () => {
    const { textbox, onChange } = await mount();
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑页脚' }));
    const footer = await screen.findByRole('textbox', { name: 'Word 页脚' });
    act(() => footer.focus());
    fireEvent.click(screen.getByRole('button', { name: '插入页码' }));
    fireEvent.click(screen.getByRole('button', { name: '插入总页数' }));
    await waitFor(() => expect(footer.querySelectorAll('[data-word-page-number]')).toHaveLength(2));
    expect(footer.querySelector('[data-word-page-number="current"]')).not.toBeNull();
    expect(footer.querySelector('[data-word-page-number="total"]')).not.toBeNull();
    expect(textbox.querySelector('[data-word-page-number]')).toBeNull();
    expect(onChange.mock.lastCall?.[0].pageNumbers).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: '布局' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '页眉距顶端（mm）' }), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: '页脚距底端（mm）' }), {
      target: { value: '8.5' },
    });
    expect(onChange.mock.lastCall?.[0].page).toMatchObject({
      headerDistance: 0,
      footerDistance: 8.5,
    });
    expect(footer.querySelectorAll('[data-word-page-number]')).toHaveLength(2);
  });

  it('cycles search matches from the first result with Enter and replaces only the selected result', async () => {
    const { textbox, onChange } = await mount({ document: documentModel('预算与预算') });
    fireEvent.keyDown(textbox, { key: 'f', ctrlKey: true });
    const query = await screen.findByRole('textbox', { name: '查找内容' });
    fireEvent.change(query, { target: { value: '预算' } });
    await screen.findByText('2 处匹配');
    fireEvent.keyDown(query, { key: 'Enter' });
    expect(screen.getByRole('button', { name: '跳转匹配 1' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.keyDown(query, { key: 'Enter' });
    expect(screen.getByRole('button', { name: '跳转匹配 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.change(screen.getByRole('textbox', { name: '替换为' }), {
      target: { value: '成本' },
    });
    fireEvent.click(screen.getByRole('button', { name: '替换' }));
    await waitFor(() => expect(textbox).toHaveTextContent('预算与成本'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disables incomplete bulk results and rejects replacement growth without changing content', async () => {
    const { textbox, onChange } = await mount({ document: documentModel('预算'.repeat(10001)) });
    fireEvent.keyDown(textbox, { key: 'h', ctrlKey: true });
    const query = await screen.findByRole('textbox', { name: '查找内容' });
    fireEvent.change(query, { target: { value: '预算' } });
    expect(await screen.findByText('超过 10000 处匹配')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部替换' })).toBeDisabled();
    fireEvent.change(query, { target: { value: '预算预算' } });
    expect(await screen.findByText('5000 处匹配')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '替换为' }), {
      target: { value: '改'.repeat(500) },
    });
    fireEvent.click(screen.getByRole('button', { name: '全部替换' }));
    expect(
      await screen.findByText('替换后的文本超过 200 万字符，请缩小替换范围。')
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(textbox.textContent).toBe('预算'.repeat(10001));
  });

  it('allows readonly navigation while disabling replacement and embedded image input', async () => {
    const model = documentModel('预算预算');
    model.header = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '抬头' }] }],
    };
    const { textbox, onChange } = await mount({ document: model, readOnly: true });
    const header = await screen.findByRole('textbox', { name: 'Word 页眉' });
    expect(header).toHaveAttribute('contenteditable', 'false');
    fireEvent.keyDown(textbox, { key: 'h', ctrlKey: true });
    fireEvent.change(await screen.findByRole('textbox', { name: '查找内容' }), {
      target: { value: '预算' },
    });
    expect(await screen.findByText('2 处匹配')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '替换为' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '全部替换' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一处' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    expect(screen.getByLabelText('选择 Word 图片')).toBeDisabled();
    expect(screen.getByRole('button', { name: '编辑页眉' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('StudioWord typed font details', () => {
  it('keeps selected text when typing fonts with CSS punctuation and normalizes Word half-point sizes', async () => {
    const { textbox, onChange } = await mount();
    selectNodeContents(textbox, textbox.querySelector('p')!);
    const family = screen.getByRole('combobox', { name: '字体' });
    fireEvent.focus(family);
    fireEvent.change(family, { target: { value: 'Custom "Font"; & \\Family' } });
    fireEvent.keyDown(family, { key: 'Enter' });
    await waitFor(() =>
      expect(onChange.mock.lastCall?.[0].content.content[0].content[0].marks).toContainEqual(
        expect.objectContaining({
          type: 'textStyle',
          attrs: expect.objectContaining({ fontFamily: 'Custom "Font"; & \\Family' }),
        })
      )
    );
    expect(textbox.querySelector('span')?.style.fontFamily).toContain('Custom');
    const size = screen.getByRole('combobox', { name: '字号' });
    fireEvent.focus(size);
    fireEvent.change(size, { target: { value: '17,3pt' } });
    fireEvent.keyDown(size, { key: 'Enter' });
    await waitFor(() => expect(textbox.querySelector('span')).toHaveStyle({ fontSize: '17.5pt' }));
    expect(textbox).toHaveTextContent('项目评审内容');
    fireEvent.focus(size);
    fireEvent.change(size, { target: { value: '301' } });
    fireEvent.keyDown(size, { key: 'Enter' });
    expect(size).toHaveAttribute('aria-invalid', 'true');
    fireEvent.keyDown(size, { key: 'Escape' });
    expect(size).toHaveValue('17.5');
  });
});
