'use client';

import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeStudio } from './OfficeStudio';
import { createOfficeStudioDocument } from './studio-model';
import type {
  OfficeStudioHandle,
  StudioEditorProps,
  StudioExcelDocument,
  StudioWordDocument,
} from './studio-types';

afterEach(cleanup);

vi.mock('./StudioWord', () => ({
  StudioWord: ({
    document,
    onChange,
    disabled,
    readOnly,
  }: StudioEditorProps<StudioWordDocument>) => (
    <textarea
      aria-label="正文画布"
      disabled={disabled}
      readOnly={readOnly}
      value={document.content.content?.[0]?.content?.[0]?.text ?? ''}
      onChange={(event) =>
        onChange({
          ...document,
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: event.target.value }] }],
          },
        })
      }
    />
  ),
}));
vi.mock('./StudioPdf', () => ({ StudioPdf: () => <div>PDF 画布</div> }));

function doc(text = '原文'): StudioWordDocument {
  return {
    ...createOfficeStudioDocument('word'),
    kind: 'word',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
    page: { size: 'A4', orientation: 'portrait', margin: 20 },
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function openedMenu(trigger: HTMLElement) {
  const menu = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
  expect(menu).toHaveAttribute('role', 'menu');
  return within(menu!);
}

describe('OfficeStudio', () => {
  it('rejects saving, exporting, printing and replacing a spreadsheet with an invalid pending input', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<OfficeStudioHandle>();
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    document.sheets[0].dataValidations = [
      {
        id: 'amount',
        range: 'B4:B4',
        type: 'whole',
        operator: 'between',
        formula1: '0',
        formula2: '5000',
        errorMessage: '数量必须在 0 到 5000 之间',
      },
    ];
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onExport = vi.fn().mockResolvedValue(undefined);
    const onPrint = vi.fn().mockResolvedValue(undefined);
    const onCreate = vi.fn().mockResolvedValue(doc());
    const onImport = vi.fn().mockResolvedValue(doc());
    const onError = vi.fn();
    const { container } = render(
      <OfficeStudio
        ref={ref}
        defaultValue={document}
        onSave={onSave}
        onExport={onExport}
        onPrint={onPrint}
        onCreate={onCreate}
        onImport={onImport}
        onError={onError}
      />
    );
    await user.dblClick(await screen.findByRole('gridcell', { name: 'B4' }));
    const input = screen.getByRole('textbox', { name: '编辑 B4' });
    fireEvent.change(input, { target: { value: '9000' } });
    const file = new File(['file'], 'replacement.docx');
    for (const operation of [
      () => ref.current!.save(),
      () => ref.current!.export(),
      () => ref.current!.print(),
    ]) {
      await act(async () => {
        await expect(operation()).rejects.toThrow('数量必须在 0 到 5000 之间');
      });
    }
    act(() => {
      expect(() => ref.current!.getDocument()).toThrow('数量必须在 0 到 5000 之间');
    });
    await user.click(screen.getByRole('button', { name: '新建' }));
    await user.click(screen.getByRole('menuitem', { name: 'Word 文档' }));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    for (const callback of [onSave, onExport, onPrint, onCreate, onImport])
      expect(callback).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('数量必须在 0 到 5000 之间');
    expect(input).toHaveValue('9000');
    await user.click(input);
    fireEvent.change(input, { target: { value: '4000' } });
    await user.keyboard('{Enter}');
    await act(async () => {
      await ref.current!.save();
    });
    expect(onSave.mock.calls[0][0].sheets[0].cells.B4.input).toBe('4000');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(ref.current!.getDocument().kind).toBe('excel');
  });

  it('prints a committed document from the ref and allows printing in read-only preview', async () => {
    const onPrint = vi.fn().mockResolvedValue(undefined);
    const ref = React.createRef<OfficeStudioHandle>();
    const { rerender } = render(<OfficeStudio ref={ref} defaultValue={doc()} onPrint={onPrint} />);
    fireEvent.change(await screen.findByRole('textbox', { name: '正文画布' }), {
      target: { value: '打印的最新内容' },
    });
    await act(async () => {
      await ref.current!.print();
    });
    expect(onPrint.mock.calls[0][0].content.content[0].content[0].text).toBe('打印的最新内容');
    rerender(<OfficeStudio ref={ref} defaultValue={doc()} onPrint={onPrint} readOnly />);
    expect(screen.getByRole('button', { name: '打印' })).toBeEnabled();
    fireEvent.keyDown(screen.getByRole('region'), { key: 'p', ctrlKey: true });
    await waitFor(() => expect(onPrint).toHaveBeenCalledTimes(2));
  });

  it('keeps printing errors reviewable and retries the latest snapshot', async () => {
    const onPrint = vi
      .fn()
      .mockRejectedValueOnce(new Error('打印窗口不可用'))
      .mockResolvedValue(undefined);
    render(<OfficeStudio defaultValue={doc()} onPrint={onPrint} />);
    fireEvent.click(screen.getByRole('button', { name: '打印' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('打印窗口不可用');
    fireEvent.change(await screen.findByRole('textbox', { name: '正文画布' }), {
      target: { value: '重试时的新内容' },
    });
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(onPrint).toHaveBeenCalledTimes(2));
    expect(onPrint.mock.calls[1][0].content.content[0].content[0].text).toBe('重试时的新内容');
  });
  it('uses ZUI actions and exposes semantic slots, root props and a live document ref', async () => {
    const ref = React.createRef<OfficeStudioHandle>();
    const document = doc();
    const { container } = render(
      <OfficeStudio
        ref={ref}
        defaultValue={document}
        className="business-studio"
        data-business="files"
        classNames={{ header: 'business-header', stage: 'business-stage' }}
      />
    );
    expect(screen.getByRole('region', { name: 'Word 文档编辑器' })).toHaveClass('business-studio');
    expect(container.querySelector('[data-business="files"]')).toBeTruthy();
    expect(container.querySelector('[data-part="header"]')).toHaveClass('business-header');
    expect(container.querySelector('[data-part="stage"]')).toHaveClass('business-stage');
    expect(
      Array.from(container.querySelectorAll('[data-part="actions"] button')).every(
        (button) =>
          button.classList.contains('z-button') ||
          button.classList.contains('z-dropdown-menu-trigger')
      )
    ).toBe(true);
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(ref.current?.getDocument()).toBe(document);
    expect(await screen.findByRole('textbox', { name: '正文画布' })).toHaveValue('原文');
  });

  it('keeps edits made during save unsaved, and saves the newest document on the next request', async () => {
    const pending = deferred();
    const onSave = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue(undefined);
    const ref = React.createRef<OfficeStudioHandle>();
    render(<OfficeStudio ref={ref} defaultValue={doc()} onSave={onSave} />);
    const status = screen.getByRole('status');
    expect(status.closest('header')).not.toBeNull();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    fireEvent.change(await screen.findByRole('textbox', { name: '正文画布' }), {
      target: { value: '第一次修改' },
    });
    let task!: Promise<void>;
    act(() => {
      task = ref.current!.save();
    });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(status).toHaveTextContent('正在保存…');
    fireEvent.change(screen.getByRole('textbox', { name: '正文画布' }), {
      target: { value: '保存期间的新输入' },
    });
    await act(async () => {
      pending.resolve();
      await task;
    });
    expect(status).toHaveTextContent('有未保存修改');
    expect(status).toHaveAttribute('title', '有未保存修改');
    await act(async () => {
      await ref.current!.save();
    });
    expect(onSave.mock.calls[1][0].content.content[0].content[0].text).toBe('保存期间的新输入');
    expect(status).toHaveTextContent('已保存');
    expect(status).toHaveAttribute('title', '已保存');
  });

  it('retains the canvas on failure and retries the current edited snapshot', async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('存储配额不足'))
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    render(<OfficeStudio defaultValue={doc()} onSave={onSave} onError={onError} />);
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('存储配额不足');
    expect(screen.getByRole('status')).toHaveTextContent('保存失败，请重试');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    fireEvent.change(screen.getByRole('textbox', { name: '正文画布' }), {
      target: { value: '错误后的修改' },
    });
    await user.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0].content.content[0].content[0].text).toBe('错误后的修改');
    expect(screen.getByRole('textbox', { name: '正文画布' })).toHaveValue('错误后的修改');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('exports the latest document after a pending save instead of resolving without exporting', async () => {
    const pending = deferred();
    const onSave = vi.fn(() => pending.promise);
    const onExport = vi.fn().mockResolvedValue(undefined);
    const ref = React.createRef<OfficeStudioHandle>();
    render(<OfficeStudio ref={ref} defaultValue={doc()} onSave={onSave} onExport={onExport} />);
    const canvas = await screen.findByRole('textbox', { name: '正文画布' });
    let saving!: Promise<void>;
    act(() => {
      saving = ref.current!.save();
    });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    fireEvent.change(canvas, { target: { value: '保存之后继续输入的内容' } });
    let exporting!: Promise<void>;
    act(() => {
      exporting = ref.current!.export();
    });
    expect(onExport).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve();
      await Promise.all([saving, exporting]);
    });
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport.mock.calls[0][0].content.content[0].content[0].text).toBe(
      '保存之后继续输入的内容'
    );
    expect(screen.getByRole('status')).toHaveTextContent('有未保存修改');
  });

  it.each(['readOnly', 'disabled'] as const)(
    'updates the open new-document menu when %s changes and blocks selection',
    async (permission) => {
      const user = userEvent.setup();
      const documentValue = doc();
      const onCreate = vi.fn().mockResolvedValue(undefined);
      const { rerender } = render(
        <OfficeStudio defaultValue={documentValue} onCreate={onCreate} />
      );
      await screen.findByRole('textbox', { name: '正文画布' });
      const trigger = screen.getByRole('button', { name: '新建' });
      await user.click(trigger);
      const menu = openedMenu(trigger);
      expect(menu.getAllByRole('menuitem')).toHaveLength(3);
      for (const item of menu.getAllByRole('menuitem'))
        expect(item).not.toHaveAttribute('aria-disabled', 'true');

      rerender(
        <OfficeStudio
          defaultValue={documentValue}
          onCreate={onCreate}
          {...{ [permission]: true }}
        />
      );
      expect(trigger).toBeDisabled();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      for (const item of menu.getAllByRole('menuitem')) {
        expect(item).toHaveAttribute('aria-disabled', 'true');
        await user.click(item);
      }
      await user.keyboard('{Enter}');
      expect(onCreate).not.toHaveBeenCalled();
      expect(screen.getByRole('textbox', { name: '正文画布' })).toHaveValue('原文');

      rerender(<OfficeStudio defaultValue={documentValue} onCreate={onCreate} />);
      expect(trigger).toBeEnabled();
      await user.click(menu.getByRole('menuitem', { name: 'Word 文档' }));
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      expect(onCreate).toHaveBeenCalledWith('word');
    }
  );

  it.each(['readOnly', 'disabled'] as const)(
    'updates every item in an open file menu after %s changes',
    async (permission) => {
      const user = userEvent.setup();
      const documentValue = createOfficeStudioDocument('excel');
      const callbacks = {
        onCreate: vi.fn().mockResolvedValue(undefined),
        onImport: vi.fn().mockResolvedValue(undefined),
        onSave: vi.fn().mockResolvedValue(undefined),
        onExport: vi.fn().mockResolvedValue(undefined),
        onPrint: vi.fn().mockResolvedValue(undefined),
      };
      const { rerender } = render(<OfficeStudio defaultValue={documentValue} {...callbacks} />);
      const trigger = await screen.findByRole('button', { name: '文件' });
      const fileClick = vi.spyOn(screen.getByLabelText('导入文档文件'), 'click');
      await user.click(trigger);
      const menu = openedMenu(trigger);
      expect(menu.getAllByRole('menuitem')).toHaveLength(7);
      for (const item of menu.getAllByRole('menuitem'))
        expect(item).not.toHaveAttribute('aria-disabled', 'true');

      rerender(
        <OfficeStudio defaultValue={documentValue} {...callbacks} {...{ [permission]: true }} />
      );
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      for (const name of ['Word 文档', 'Excel 文档', 'PDF 文档', '打开文件', '保存']) {
        const item = menu.getByRole('menuitem', { name });
        expect(item).toHaveAttribute('aria-disabled', 'true');
        await user.click(item);
      }
      await user.keyboard('{Enter}');
      expect(fileClick).not.toHaveBeenCalled();
      for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();

      if (permission === 'disabled') {
        expect(trigger).toBeDisabled();
        for (const name of ['导出文件', '打印']) {
          const item = menu.getByRole('menuitem', { name });
          expect(item).toHaveAttribute('aria-disabled', 'true');
          await user.click(item);
        }
        for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
      } else {
        expect(trigger).toBeEnabled();
        for (const name of ['导出文件', '打印'])
          expect(menu.getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled', 'true');
        await user.click(menu.getByRole('menuitem', { name: '导出文件' }));
        await waitFor(() => expect(callbacks.onExport).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(trigger).toBeEnabled());
        await user.click(trigger);
        await user.click(openedMenu(trigger).getByRole('menuitem', { name: '打印' }));
        await waitFor(() => expect(callbacks.onPrint).toHaveBeenCalledTimes(1));
        expect(callbacks.onCreate).not.toHaveBeenCalled();
        expect(callbacks.onImport).not.toHaveBeenCalled();
        expect(callbacks.onSave).not.toHaveBeenCalled();
      }
      fileClick.mockRestore();
    }
  );

  it.each(['文件', '新建'] as const)(
    'disables an already open %s menu during save without queuing other host callbacks',
    async (label) => {
      const user = userEvent.setup();
      const pending = deferred();
      const ref = React.createRef<OfficeStudioHandle>();
      const documentValue = label === '文件' ? createOfficeStudioDocument('excel') : doc();
      const onSave = vi.fn(() => pending.promise);
      const callbacks = {
        onCreate: vi.fn().mockResolvedValue(undefined),
        onImport: vi.fn().mockResolvedValue(undefined),
        onExport: vi.fn().mockResolvedValue(undefined),
        onPrint: vi.fn().mockResolvedValue(undefined),
      };
      render(
        <OfficeStudio ref={ref} defaultValue={documentValue} onSave={onSave} {...callbacks} />
      );
      const trigger = await screen.findByRole('button', { name: label });
      const fileClick = vi.spyOn(screen.getByLabelText('导入文档文件'), 'click');
      await user.click(trigger);
      const menu = openedMenu(trigger);
      let saving!: Promise<void>;
      act(() => {
        saving = ref.current!.save();
      });
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(trigger).toBeDisabled();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'true');
      for (const item of menu.getAllByRole('menuitem')) {
        expect(item).toHaveAttribute('aria-disabled', 'true');
        await user.click(item);
      }
      await user.keyboard('{Enter}');
      await act(async () => {
        pending.resolve();
        await saving;
      });
      expect(trigger).toBeEnabled();
      for (const item of menu.getAllByRole('menuitem'))
        expect(item).not.toHaveAttribute('aria-disabled', 'true');
      expect(onSave).toHaveBeenCalledTimes(1);
      for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
      expect(fileClick).not.toHaveBeenCalled();
      expect(ref.current!.getDocument().id).toBe(documentValue.id);
      fileClick.mockRestore();
    }
  );

  it('respects controlled acceptance and disabled/read-only editing', async () => {
    const ref = React.createRef<OfficeStudioHandle>();
    const document = doc();
    const onChange = vi.fn();
    const { rerender } = render(<OfficeStudio ref={ref} value={document} onChange={onChange} />);
    fireEvent.change(await screen.findByRole('textbox', { name: '正文画布' }), {
      target: { value: '申请修改' },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current?.getDocument()).toBe(document);
    rerender(
      <OfficeStudio ref={ref} value={onChange.mock.calls[0][0]} onChange={onChange} readOnly />
    );
    expect((ref.current?.getDocument() as StudioWordDocument).content).toBe(
      onChange.mock.calls[0][0].content
    );
    expect(screen.getByRole('textbox', { name: '文档名称' })).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    rerender(<OfficeStudio value={document} disabled />);
    expect(screen.getByRole('textbox', { name: '正文画布' })).toBeDisabled();
  });

  it('supports keyboard save and keeps the same mounted canvas through fullscreen', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OfficeStudio defaultValue={doc()} onSave={onSave} />);
    const canvas = await screen.findByRole('textbox', { name: '正文画布' });
    fireEvent.keyDown(canvas, { key: 's', ctrlKey: true });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: '全屏编辑' }));
    expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen', 'true');
    expect(screen.getByRole('textbox', { name: '正文画布' })).toBe(canvas);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('region')).not.toHaveAttribute('data-fullscreen');
    expect(screen.getByRole('textbox', { name: '正文画布' })).toBe(canvas);
  });

  it('imports the selected file and retains the document when the host rejects it', async () => {
    const user = userEvent.setup();
    const file = new File(['complex'], '复杂文档.docx');
    const onImport = vi
      .fn()
      .mockRejectedValueOnce(new Error('暂不支持页眉'))
      .mockResolvedValue(undefined);
    render(<OfficeStudio defaultValue={doc()} onImport={onImport} />);
    await user.upload(screen.getByLabelText('导入文档文件'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('暂不支持页眉');
    expect(screen.getByRole('textbox', { name: '正文画布' })).toHaveValue('原文');
    await user.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2));
    expect(onImport.mock.calls[1][0]).toBe(file);
  });

  it('imperative save and export commit the real focused spreadsheet draft before taking a snapshot', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<OfficeStudioHandle>();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onExport = vi.fn().mockResolvedValue(undefined);
    render(
      <OfficeStudio
        ref={ref}
        defaultValue={createOfficeStudioDocument('excel')}
        onSave={onSave}
        onExport={onExport}
      />
    );
    await user.dblClick(await screen.findByRole('gridcell', { name: 'B4' }));
    const input = screen.getByRole('textbox', { name: '编辑 B4' });
    await user.clear(input);
    await user.type(input, '2100');
    expect(input).toHaveFocus();
    await act(async () => {
      await ref.current!.save();
    });
    expect(onSave.mock.calls[0][0].sheets[0].cells.B4.input).toBe('2100');
    expect(screen.getByRole('gridcell', { name: 'D8' })).toHaveTextContent('21500.00');
    await user.dblClick(screen.getByRole('gridcell', { name: 'B4' }));
    const next = screen.getByRole('textbox', { name: '编辑 B4' });
    await user.clear(next);
    await user.type(next, '2200');
    await act(async () => {
      await ref.current!.export();
    });
    expect(onExport.mock.calls[0][0].sheets[0].cells.B4.input).toBe('2200');
  });
});

describe('OfficeStudio pending font input', () => {
  it('commits font drafts before save, export and print and rejects an invalid size snapshot', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<OfficeStudioHandle>();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onExport = vi.fn().mockResolvedValue(undefined);
    const onPrint = vi.fn().mockResolvedValue(undefined);
    render(
      <OfficeStudio
        ref={ref}
        defaultValue={createOfficeStudioDocument('excel')}
        onSave={onSave}
        onExport={onExport}
        onPrint={onPrint}
      />
    );
    const family = await screen.findByRole('combobox', { name: '表格字体' });
    await user.click(family);
    await user.clear(family);
    await user.type(family, 'Custom Font');
    await act(async () => {
      await ref.current!.save();
    });
    expect(onSave.mock.lastCall?.[0].sheets[0].cells.A1.fontFamily).toBe('Custom Font');
    const size = screen.getByRole('combobox', { name: '表格字号' });
    await user.click(size);
    await user.clear(size);
    await user.type(size, '0');
    await act(async () => {
      await expect(ref.current!.export()).rejects.toThrow('字号');
    });
    expect(onExport).not.toHaveBeenCalled();
    await user.click(size);
    await user.clear(size);
    await user.type(size, '16,5');
    await act(async () => {
      await ref.current!.export();
    });
    expect(onExport.mock.lastCall?.[0].sheets[0].cells.A1.fontSize).toBe(16.5);
    await user.click(size);
    await user.clear(size);
    await user.type(size, '18');
    await act(async () => {
      await ref.current!.print();
    });
    expect(onPrint.mock.lastCall?.[0].sheets[0].cells.A1.fontSize).toBe(18);
  });
});
