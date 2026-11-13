import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StudioPdf from './StudioPdf';
import { isOfficeStudioDocument } from './studio-model';
import type {
  StudioPdfDocument,
  StudioPdfRenderer,
  StudioPdfRenderResult,
  StudioPdfSession,
} from './studio-types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

/** Independently known crop-box transforms for a 300x400pt page. */
function viewport(scale = 1, rotation = 0): StudioPdfRenderResult {
  const turn = ((rotation % 360) + 360) % 360;
  const swapped = turn === 90 || turn === 270;
  return {
    width: (swapped ? 400 : 300) * scale,
    height: (swapped ? 300 : 400) * scale,
    toViewportPoint(x, y) {
      const point: [number, number] =
        turn === 90
          ? [y - 20, x - 40]
          : turn === 180
            ? [340 - x, y - 20]
            : turn === 270
              ? [420 - y, 340 - x]
              : [x - 40, 420 - y];
      return [point[0] * scale, point[1] * scale];
    },
    toPdfPoint(x, y) {
      const a = x / scale;
      const b = y / scale;
      return turn === 90
        ? [40 + b, 20 + a]
        : turn === 180
          ? [340 - a, 20 + b]
          : turn === 270
            ? [340 - b, 420 - a]
            : [40 + a, 420 - b];
    },
  };
}

function document(): StudioPdfDocument {
  return {
    version: 1,
    id: 'pdf-1',
    name: 'Test.pdf',
    kind: 'pdf',
    pageCount: 2,
    marks: [{ id: 'note', page: 0, type: 'text', x: 80, y: 150, size: 12, text: 'Note' }],
    rotations: {},
    fields: [
      {
        name: 'name',
        type: 'text',
        value: 'Original',
        readOnly: false,
        widgets: [{ page: 0, x: 60, y: 100, width: 100, height: 24 }],
      },
      {
        name: 'confirmed',
        type: 'checkbox',
        value: false,
        readOnly: false,
        widgets: [
          { page: 0, x: 60, y: 70, width: 18, height: 18 },
          { page: 1, x: 60, y: 70, width: 18, height: 18 },
        ],
      },
      {
        name: 'choice',
        type: 'choice',
        value: 'A',
        readOnly: false,
        options: ['A', 'B'],
        widgets: [
          { page: 0, x: 100, y: 70, width: 18, height: 18, option: 'A' },
          { page: 0, x: 130, y: 70, width: 18, height: 18, option: 'B' },
        ],
      },
      {
        name: 'locked',
        type: 'text',
        value: 'LOCKED',
        readOnly: true,
        widgets: [{ page: 0, x: 60, y: 40, width: 100, height: 24 }],
      },
    ],
  };
}

function renderer() {
  const renderPage = vi.fn<StudioPdfSession['render']>(async (_page, _canvas, options) =>
    viewport(options.scale, options.rotation)
  );
  const destroy = vi.fn();
  const session: StudioPdfSession = { pageCount: 2, render: renderPage, destroy };
  const load = vi.fn<StudioPdfRenderer['load']>(async () => session);
  return { renderer: { load }, session, load, renderPage, destroy };
}

function host(
  model = document(),
  options: { readOnly?: boolean; disabled?: boolean; search?: StudioPdfSession['search'] } = {}
) {
  const f = renderer();
  if (options.search) f.session.search = options.search;
  const source = new Blob(['%PDF-controlled']);
  let latest = model;
  const changed = vi.fn();
  function Host() {
    const [value, setValue] = useState(model);
    return (
      <StudioPdf
        document={value}
        onChange={(next) => {
          latest = next;
          changed(next);
          setValue(next);
        }}
        source={source}
        pdfRenderer={f.renderer}
        disabled={options.disabled ?? false}
        readOnly={options.readOnly ?? false}
      />
    );
  }
  const rendered = render(<Host />);
  return { ...f, ...rendered, source, changed, document: () => latest };
}

const paper = () => window.document.querySelector<HTMLDivElement>('.z-studio-pdf-paper')!;
const mark = () => window.document.querySelector<SVGGElement>('[data-mark="note"]')!;
async function ready() {
  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'PDF 页面编辑区' })).toHaveAttribute(
      'aria-busy',
      'false'
    )
  );
  expect(paper()).toHaveStyle({ visibility: 'visible' });
}
function rectangle(width = 300, height = 400, left = 0, top = 0) {
  vi.spyOn(paper(), 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    left,
    top,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  });
}
function pointer(target: Element, type: string, x: number, y: number, pointerId = 7) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  fireEvent(target, event);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('StudioPdf document editing', () => {
  it('edits actual page fields and radio widgets, mirrors the sidebar, and never reloads or rerenders original pages for value/mark changes', async () => {
    const f = host();
    await ready();
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.renderPage).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('PDF 页面表单 name'), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByLabelText('PDF 页面表单 confirmed'));
    fireEvent.click(screen.getByLabelText('PDF 页面表单 choice B'));
    expect(f.document().fields.find((field) => field.name === 'name')?.value).toBe('Alice');
    expect(f.document().fields.find((field) => field.name === 'confirmed')?.value).toBe(true);
    expect(f.document().fields.find((field) => field.name === 'choice')?.value).toBe('B');
    fireEvent.click(screen.getByRole('button', { name: '表单 4' }));
    expect(screen.getByLabelText('PDF 表单 name')).toHaveValue('Alice');
    expect(screen.getByLabelText('PDF 表单 confirmed')).toBeChecked();
    fireEvent.change(screen.getByLabelText('PDF 表单 name'), { target: { value: 'Bob' } });
    expect(screen.getByLabelText('PDF 页面表单 name')).toHaveValue('Bob');
    fireEvent.click(mark());
    fireEvent.change(screen.getByLabelText('PDF 选中标注文字'), { target: { value: 'Edited' } });
    expect(f.document().marks[0].text).toBe('Edited');
    expect(mark().textContent).toContain('Edited');
    const item = within(screen.getByLabelText('PDF 标注列表')).getByRole('button');
    expect(item).toHaveClass('z-button');
    fireEvent.click(screen.getByRole('button', { name: '文字' }));
    expect(item).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(item);
    expect(item).toHaveAttribute('aria-pressed', 'true');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.renderPage).toHaveBeenCalledTimes(1);
  });

  it('controls ZUI radio groups independently, mirrors sidebar edits and history, and carries checkbox values between pages', async () => {
    const model = document();
    model.fields.push({
      name: 'secondChoice',
      type: 'choice',
      value: 'B',
      readOnly: false,
      options: ['A', 'B'],
      widgets: [
        { page: 0, x: 100, y: 200, width: 18, height: 18, option: 'A' },
        { page: 0, x: 130, y: 200, width: 18, height: 18, option: 'B' },
      ],
    });
    const f = host(model);
    await ready();
    const firstA = screen.getByRole('radio', { name: 'PDF 页面表单 choice A' });
    const firstB = screen.getByRole('radio', { name: 'PDF 页面表单 choice B' });
    const secondB = screen.getByRole('radio', { name: 'PDF 页面表单 secondChoice B' });
    const confirmed = screen.getByRole('checkbox', { name: 'PDF 页面表单 confirmed' });
    expect(firstA).toBeChecked();
    expect(firstB).not.toBeChecked();
    expect(secondB).toBeChecked();
    expect(firstA.closest('.z-radio')).not.toBeNull();
    expect(firstA.closest('[role="radiogroup"]')).toBe(firstB.closest('[role="radiogroup"]'));
    expect(firstA.getAttribute('name')).toBe(firstB.getAttribute('name'));
    expect(firstA.getAttribute('name')).not.toBe(secondB.getAttribute('name'));
    expect(confirmed.closest('.z-checkbox')).not.toBeNull();
    fireEvent.click(firstB);
    expect(firstA).not.toBeChecked();
    expect(firstB).toBeChecked();
    expect(secondB).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '表单 5' }));
    const sidebarChoice = screen.getByLabelText('PDF 表单 choice');
    fireEvent.click(sidebarChoice);
    const choices = window.document.getElementById(
      sidebarChoice.getAttribute('aria-controls') ?? ''
    )!;
    fireEvent.click(within(choices).getByRole('option', { name: 'A' }));
    expect(firstA).toBeChecked();
    expect(firstB).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(firstB).toBeChecked();
    expect(secondB).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    expect(firstA).toBeChecked();
    fireEvent.click(confirmed);
    fireEvent.click(screen.getByRole('button', { name: 'PDF 下一页' }));
    await ready();
    expect(screen.getByRole('checkbox', { name: 'PDF 页面表单 confirmed' })).toBeChecked();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(f.document().fields.find((field) => field.name === 'confirmed')?.value).toBe(true);
    expect(isOfficeStudioDocument(f.document())).toBe(true);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.renderPage).toHaveBeenCalledTimes(2);
  });

  it('uses PDF point transforms for original crop offsets and for fields, text, highlights and visual keyboard movement after rotation', async () => {
    const model = document();
    model.marks.push({
      id: 'highlight',
      page: 0,
      type: 'highlight',
      x: 120,
      y: 200,
      width: 60,
      height: 18,
      size: 16,
      text: '',
    });
    const f = host(model);
    await ready();
    expect(mark()).toHaveAttribute('transform', 'matrix(1 0 0 1 40 270)');
    expect(window.document.querySelector('[data-field="name"]')).toHaveStyle({
      transform: 'matrix(1,0,0,1,20,296)',
    });
    fireEvent.click(screen.getByRole('button', { name: '旋转当前页' }));
    await ready();
    expect(f.document().rotations).toEqual({ 0: 90 });
    expect(mark()).toHaveAttribute('transform', 'matrix(0 1 -1 0 130 40)');
    expect(window.document.querySelector('[data-field="name"]')).toHaveStyle({
      transform: 'matrix(0,1,-1,0,104,20)',
    });
    const highlight = window.document.querySelector('[data-mark="highlight"]')!;
    expect(highlight).toHaveAttribute('transform', 'matrix(0 1 -1 0 180 80)');
    expect(highlight.querySelector('rect[fill-opacity]')).toHaveAttribute('y', '-18');
    fireEvent.keyDown(mark(), { key: 'ArrowRight', shiftKey: true });
    expect(f.document().marks[0].x).toBe(80);
    expect(f.document().marks[0].y).toBe(160);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.renderPage).toHaveBeenCalledTimes(2);
  });

  it('places annotations at actual PDF points when the visible paper is resized, and supports pointer dragging and keyboard deletion', async () => {
    const f = host();
    await ready();
    rectangle(150, 200, 10, 20);
    fireEvent.click(screen.getByRole('button', { name: '文字' }));
    fireEvent.change(screen.getByLabelText('PDF 新增文字'), { target: { value: 'Hello' } });
    fireEvent.click(paper(), { clientX: 60, clientY: 120 });
    expect(f.document().marks[1]).toMatchObject({
      type: 'text',
      x: 140,
      y: 220,
      text: 'Hello',
      page: 0,
    });
    pointer(mark(), 'pointerdown', 30, 80);
    pointer(mark().parentElement!, 'pointermove', 45, 90);
    pointer(mark().parentElement!, 'pointerup', 45, 90);
    expect(f.document().marks[0]).toMatchObject({ x: 110, y: 130 });
    fireEvent.keyDown(mark(), { key: 'Delete' });
    expect(f.document().marks.some((entry) => entry.id === 'note')).toBe(false);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.renderPage).toHaveBeenCalledTimes(1);
  });

  it('resizes selected rectangles directly on the page as one undoable action', async () => {
    const model = document();
    model.marks.push({
      id: 'box',
      page: 0,
      type: 'rectangle',
      x: 100,
      y: 200,
      width: 60,
      height: 40,
      size: 16,
      text: '',
      lineWidth: 2,
    });
    const f = host(model);
    await ready();
    rectangle();
    const box = window.document.querySelector<SVGGElement>('[data-mark="box"]')!;
    fireEvent.click(box);
    const handle = window.document.querySelector<SVGRectElement>('[data-mark-resize="box"]')!;
    expect(handle).not.toBeNull();
    pointer(handle, 'pointerdown', 120, 220);
    pointer(handle.ownerSVGElement!, 'pointermove', 140, 240);
    pointer(handle.ownerSVGElement!, 'pointerup', 140, 240);
    expect(f.document().marks.find((entry) => entry.id === 'box')).toMatchObject({
      width: 80,
      height: 60,
      y: 180,
    });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(f.document().marks.find((entry) => entry.id === 'box')).toMatchObject({
      width: 60,
      height: 40,
    });
  });

  it('supports keyboard placement and clamps highlights inside the visible crop box', async () => {
    const f = host();
    await ready();
    fireEvent.click(screen.getByRole('tab', { name: '批注' }));
    fireEvent.click(screen.getByRole('button', { name: '高亮' }));
    fireEvent.click(screen.getByRole('button', { name: '放在当前页中央' }));
    expect(f.document().marks[1]).toMatchObject({
      type: 'highlight',
      x: 190,
      y: 211,
      width: 120,
      height: 18,
    });
    rectangle();
    fireEvent.click(screen.getByRole('tab', { name: '批注' }));
    fireEvent.click(screen.getByRole('button', { name: '高亮' }));
    fireEvent.click(paper(), { clientX: 299, clientY: 1 });
    expect(f.document().marks[2]).toMatchObject({ x: 216, y: 398, width: 120, height: 18 });
    fireEvent.click(screen.getByRole('button', { name: '文字' }));
    fireEvent.change(screen.getByLabelText('PDF 新增文字'), { target: { value: 'A'.repeat(50) } });
    fireEvent.click(screen.getByRole('button', { name: '放在当前页中央' }));
    expect(screen.getByRole('alert')).toHaveTextContent('超过页面范围');
    expect(f.document().marks).toHaveLength(3);
  });

  it('blocks readonly field changes and every document modification in readOnly/disabled modes while retaining readOnly page navigation', async () => {
    const editable = host();
    await ready();
    const locked = screen.getByLabelText('PDF 页面表单 locked');
    expect(locked).toBeDisabled();
    fireEvent.change(locked, { target: { value: 'Attempt' } });
    expect(editable.changed).not.toHaveBeenCalled();
    editable.unmount();
    const f = host(document(), { readOnly: true });
    await ready();
    expect(screen.getByRole('button', { name: '文字' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '旋转当前页' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('PDF 页面表单 name'), { target: { value: 'Attempt' } });
    fireEvent.click(screen.getByLabelText('PDF 页面表单 confirmed'));
    expect(screen.getByRole('radio', { name: 'PDF 页面表单 choice B' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'PDF 页面表单 choice B' }));
    fireEvent.keyDown(mark(), { key: 'Delete' });
    fireEvent.keyDown(mark(), { key: 'ArrowRight' });
    expect(f.changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'PDF 下一页' }));
    await ready();
    expect(f.renderPage.mock.lastCall?.[0]).toBe(1);
    f.unmount();
    const disabled = host(document(), { disabled: true });
    await ready();
    expect(screen.getByRole('button', { name: 'PDF 下一页' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'PDF 缩放 100%' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('PDF 页面表单 name'), { target: { value: 'Attempt' } });
    expect(disabled.changed).not.toHaveBeenCalled();
  });

  it('blocks ZUI choice and multiline edits for intrinsic locks, read-only documents and disabled editors', async () => {
    for (const permissions of [{}, { readOnly: true }, { disabled: true }]) {
      const model = document();
      const intrinsic = !('readOnly' in permissions || 'disabled' in permissions);
      model.fields.push(
        {
          name: 'status',
          type: 'choice',
          value: 'Draft',
          options: ['Draft', 'Approved'],
          readOnly: intrinsic,
          widgets: [{ page: 0, x: 60, y: 250, width: 100, height: 24 }],
        },
        {
          name: 'notes',
          type: 'text',
          value: 'First\nSecond',
          multiline: true,
          readOnly: intrinsic,
          widgets: [{ page: 0, x: 60, y: 180, width: 100, height: 50 }],
        }
      );
      const f = host(model, permissions);
      await ready();
      const status = screen.getByLabelText('PDF 页面表单 status');
      const notes = screen.getByRole('textbox', { name: 'PDF 页面表单 notes' });
      expect(status).toBeDisabled();
      expect(notes).toBeDisabled();
      fireEvent.click(status);
      fireEvent.keyDown(status, { key: 'ArrowDown' });
      expect(status).toHaveAttribute('aria-expanded', 'false');
      fireEvent.change(notes, { target: { value: 'Attempt\nChange' } });
      expect(notes).toHaveValue('First\nSecond');
      expect(f.changed).not.toHaveBeenCalled();
      expect(f.document().fields.find((field) => field.name === 'status')?.value).toBe('Draft');
      f.unmount();
    }
  });

  it('edits dropdown and multiline widgets, respects intrinsic widget rotation, and keeps PDF points fixed while zooming', async () => {
    const model = document();
    model.fields.push({
      name: 'status',
      type: 'choice',
      value: 'Draft',
      options: ['Draft', 'Approved'],
      readOnly: false,
      widgets: [{ page: 0, x: 60, y: 250, width: 100, height: 24, rotation: 90 }],
    });
    model.fields.push({
      name: 'notes',
      type: 'text',
      value: 'First\nSecond',
      multiline: true,
      readOnly: false,
      widgets: [{ page: 0, x: 60, y: 180, width: 100, height: 50 }],
    });
    const f = host(model);
    await ready();
    const status = screen.getByLabelText('PDF 页面表单 status');
    const notes = screen.getByLabelText('PDF 页面表单 notes');
    expect(status.closest('.z-select')).not.toBeNull();
    expect(notes.closest('.z-input')).not.toBeNull();
    expect(notes).toHaveAttribute('maxlength', '10000');
    fireEvent.click(status);
    fireEvent.click(screen.getByRole('option', { name: 'Approved' }));
    fireEvent.change(notes, {
      target: { value: 'New\nLines' },
    });
    expect(f.document().fields.find((field) => field.name === 'status')?.value).toBe('Approved');
    expect(f.document().fields.find((field) => field.name === 'notes')?.value).toBe('New\nLines');
    fireEvent.keyDown(status, { key: 'ArrowDown' });
    fireEvent.keyDown(status, { key: 'Home' });
    fireEvent.keyDown(status, { key: 'Enter' });
    expect(f.document().fields.find((field) => field.name === 'status')?.value).toBe('');
    expect(status).toHaveTextContent('未选择');
    expect(isOfficeStudioDocument(f.document())).toBe(true);
    const content = window.document.querySelector('[data-field="status"] > div');
    expect(content).toHaveStyle({
      width: '24px',
      height: '100px',
      transform: 'translate(0px, 24px) rotate(-90deg)',
    });
    fireEvent.click(screen.getByRole('button', { name: 'PDF 缩放 100%' }));
    fireEvent.click(screen.getByRole('option', { name: '150%' }));
    await ready();
    expect(paper()).toHaveStyle({ width: '450px', height: '600px' });
    expect(mark()).toHaveAttribute('transform', 'matrix(1.5 0 0 1.5 60 405)');
    expect(window.document.querySelector('[data-field="name"]')).toHaveStyle({
      transform: 'matrix(1.5,0,0,1.5,30,444)',
    });
    expect(f.document().marks[0]).toMatchObject({ x: 80, y: 150 });
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.renderPage).toHaveBeenCalledTimes(2);
  });
});

describe('StudioPdf renderer lifecycle', () => {
  it('disposes a late load after switching source and disposes the active session on unmount', async () => {
    const first = renderer();
    const second = renderer();
    const waits = [deferred<StudioPdfSession>(), deferred<StudioPdfSession>()];
    const load = vi
      .fn<StudioPdfRenderer['load']>()
      .mockReturnValueOnce(waits[0].promise)
      .mockReturnValueOnce(waits[1].promise);
    const adapter = { load };
    const model = document();
    const sourceA = new Blob(['A']);
    const sourceB = new Blob(['B']);
    const onChange = vi.fn();
    const view = render(
      <StudioPdf
        document={model}
        onChange={onChange}
        source={sourceA}
        pdfRenderer={adapter}
        disabled={false}
        readOnly={false}
      />
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    view.rerender(
      <StudioPdf
        document={model}
        onChange={onChange}
        source={sourceB}
        pdfRenderer={adapter}
        disabled={false}
        readOnly={false}
      />
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await act(async () => {
      waits[1].resolve(second.session);
    });
    await ready();
    await act(async () => {
      waits[0].resolve(first.session);
    });
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(first.renderPage).not.toHaveBeenCalled();
    expect(second.renderPage).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(second.renderPage.mock.lastCall?.[2].signal?.aborted).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('aborts an old page render and ignores its result when it finishes after the newer page', async () => {
    const f = renderer();
    const waits = [deferred<StudioPdfRenderResult>(), deferred<StudioPdfRenderResult>()];
    f.renderPage.mockReturnValueOnce(waits[0].promise).mockReturnValueOnce(waits[1].promise);
    const view = render(
      <StudioPdf
        document={document()}
        onChange={vi.fn()}
        source={new Blob(['PDF'])}
        pdfRenderer={f.renderer}
        disabled={false}
        readOnly={false}
      />
    );
    await waitFor(() => expect(f.renderPage).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'PDF 下一页' }));
    await waitFor(() => expect(f.renderPage).toHaveBeenCalledTimes(2));
    expect(f.renderPage.mock.calls[0][2].signal?.aborted).toBe(true);
    await act(async () => {
      waits[1].resolve(viewport(1.5));
    });
    await ready();
    expect(paper()).toHaveStyle({ width: '450px', height: '600px' });
    await act(async () => {
      waits[0].resolve(viewport());
    });
    expect(paper()).toHaveStyle({ width: '450px', height: '600px' });
    expect(screen.getByRole('img', { name: 'PDF 第 2 页原文' })).toBeInTheDocument();
    view.unmount();
    expect(f.destroy).toHaveBeenCalledTimes(1);
  });

  it('owns only the current StrictMode session and handles synchronous renderer errors and page-count mismatches explicitly', async () => {
    const sessions = [renderer(), renderer()];
    let index = 0;
    const adapter: StudioPdfRenderer = { load: vi.fn(async () => sessions[index++].session) };
    const model = document();
    const view = render(
      <StrictMode>
        <StudioPdf
          document={model}
          onChange={vi.fn()}
          source={new Blob(['PDF'])}
          pdfRenderer={adapter}
          disabled={false}
          readOnly={false}
        />
      </StrictMode>
    );
    await ready();
    expect(sessions[0].destroy).toHaveBeenCalledTimes(1);
    expect(sessions[0].renderPage).not.toHaveBeenCalled();
    expect(sessions[1].renderPage).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(sessions[1].destroy).toHaveBeenCalledTimes(1);
    const bad: StudioPdfRenderer = {
      load() {
        throw new Error('Unsupported PDF');
      },
    };
    const failed = render(
      <StudioPdf
        document={model}
        onChange={vi.fn()}
        source={new Blob(['PDF'])}
        pdfRenderer={bad}
        disabled={false}
        readOnly={false}
      />
    );
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unsupported PDF'));
    failed.unmount();
    const mismatch = renderer();
    mismatch.session.pageCount = 3;
    render(
      <StudioPdf
        document={model}
        onChange={vi.fn()}
        source={new Blob(['PDF'])}
        pdfRenderer={mismatch.renderer}
        disabled={false}
        readOnly={false}
      />
    );
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('页数与原文件不一致'));
    expect(mismatch.destroy).toHaveBeenCalledTimes(1);
    expect(mismatch.renderPage).not.toHaveBeenCalled();
  });
});

describe('StudioPdf Office ribbon and navigation', () => {
  it('switches ribbon tabs with the keyboard without losing a draft or reloading the PDF, and runs the actual comment tools', async () => {
    const f = host();
    await ready();
    const tabs = screen.getByRole('tablist', { name: 'PDF 功能区选项卡' });
    const ribbon = tabs.closest('.z-studio-ribbon');
    expect(ribbon).not.toBeNull();
    const editor = f.container.querySelector('.z-studio-pdf');
    expect(editor).not.toBeNull();
    const expectZuiButtons = () =>
      expect(
        Array.from(editor!.querySelectorAll('button')).every((button) =>
          [
            'z-button',
            'z-tab',
            'z-select-trigger',
            'z-color-picker-swatch',
            'z-input-number-btn',
          ].some((className) => button.classList.contains(className))
        )
      ).toBe(true);
    expectZuiButtons();
    const home = within(tabs).getByRole('tab', { name: '开始' });
    const comments = within(tabs).getByRole('tab', { name: '批注' });
    expect(home).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: '高亮' })).not.toBeInTheDocument();
    fireEvent.focus(home);
    fireEvent.keyDown(home, { key: 'ArrowRight' });
    expect(comments).toHaveFocus();
    expect(comments).toHaveAttribute('aria-selected', 'true');
    expectZuiButtons();
    fireEvent.click(screen.getByRole('button', { name: '文字' }));
    fireEvent.change(screen.getByLabelText('PDF 新增文字'), { target: { value: 'Review draft' } });
    fireEvent.click(home);
    expect(screen.getByLabelText('PDF 新增文字')).toHaveValue('Review draft');
    fireEvent.click(comments);
    fireEvent.click(screen.getByRole('button', { name: '高亮' }));
    fireEvent.click(screen.getByRole('button', { name: '放在当前页中央' }));
    expect(f.document().marks[1]).toMatchObject({ type: 'highlight', page: 0 });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(f.document().marks).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    expect(f.document().marks[1].type).toBe('highlight');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.renderPage).toHaveBeenCalledTimes(1);
  });

  it('keeps sidebar search state and permits statusbar navigation and bounded zoom in read-only mode while disabling every control when disabled', async () => {
    const f = host(document(), { readOnly: true, search: async () => [] });
    await ready();
    const search = screen.getByRole('button', { name: 'PDF 文本查找侧栏' });
    fireEvent.click(search);
    expect(screen.getByRole('complementary', { name: 'PDF 批注与表单' })).toHaveAttribute(
      'data-side',
      'left'
    );
    fireEvent.change(screen.getByLabelText('PDF 查找文字'), { target: { value: 'Review' } });
    fireEvent.click(screen.getByRole('button', { name: 'PDF 页面缩略图侧栏' }));
    fireEvent.click(search);
    expect(screen.getByLabelText('PDF 查找文字')).toHaveValue('Review');
    fireEvent.click(search);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    const statusbar = screen.getByRole('group', { name: 'PDF 状态栏' });
    const page = within(statusbar).getByRole('spinbutton', { name: 'PDF 跳转页' });
    expect(page).not.toBeDisabled();
    fireEvent.change(page, { target: { value: '2' } });
    fireEvent.blur(page);
    await ready();
    expect(screen.getByRole('img', { name: 'PDF 第 2 页原文' })).toBeInTheDocument();
    for (const percentage of [125, 150, 200]) {
      fireEvent.click(within(statusbar).getByRole('button', { name: 'PDF 放大视图' }));
      await ready();
      expect(
        within(statusbar).getByRole('button', { name: 'PDF 缩放 ' + percentage + '%' })
      ).toBeInTheDocument();
    }
    expect(within(statusbar).getByRole('button', { name: 'PDF 放大视图' })).toBeDisabled();
    fireEvent.click(within(statusbar).getByRole('button', { name: 'PDF 缩放 200%' }));
    fireEvent.click(screen.getByRole('option', { name: '50%' }));
    await ready();
    expect(within(statusbar).getByRole('button', { name: 'PDF 缩小视图' })).toBeDisabled();
    expect(f.changed).not.toHaveBeenCalled();
    f.unmount();
    host(document(), { disabled: true, search: async () => [] });
    await ready();
    for (const tab of screen.getAllByRole('tab')) expect(tab).toBeDisabled();
    for (const button of within(
      screen.getByRole('navigation', { name: 'PDF 侧边导航' })
    ).getAllByRole('button'))
      expect(button).toBeDisabled();
    for (const button of within(screen.getByRole('group', { name: 'PDF 状态栏' })).getAllByRole(
      'button'
    ))
      expect(button).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'PDF 跳转页' })).toBeDisabled();
  });
});

describe('StudioPdf drawing and search', () => {
  it.each([
    ['horizontal', 70, 50],
    ['vertical', 35, 100],
  ])(
    'keeps a %s signature stroke valid for persistence without zero-size box fields',
    async (_label, x, y) => {
      const f = host();
      await ready();
      rectangle(150, 200, 10, 20);
      fireEvent.click(screen.getByRole('tab', { name: '批注' }));
      fireEvent.click(screen.getByRole('button', { name: '手写签名' }));
      pointer(paper(), 'pointerdown', 35, 50);
      pointer(paper(), 'pointerup', Number(x), Number(y));
      const stroke = f.document().marks[1];
      expect(stroke.type).toBe('ink');
      expect(stroke.points).toHaveLength(2);
      expect(stroke.width).toBeUndefined();
      expect(stroke.height).toBeUndefined();
      expect(isOfficeStudioDocument(f.document())).toBe(true);
    }
  );

  it('renders page thumbnails on separate canvases, permits read-only navigation and cancels thumbnail tasks when the panel closes', async () => {
    const f = host(document(), { readOnly: true });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '页面' }));
    await waitFor(() =>
      expect(f.renderPage.mock.calls.filter((call) => call[2].scale === 0.25)).toHaveLength(2)
    );
    const thumbnails = f.renderPage.mock.calls.filter((call) => call[2].scale === 0.25);
    expect(thumbnails[0][1]).not.toBe(thumbnails[1][1]);
    expect(thumbnails[0][1]).not.toBe(f.renderPage.mock.calls[0][1]);
    fireEvent.click(screen.getByRole('button', { name: 'PDF 第 2 页缩略图' }));
    await ready();
    expect(screen.getByRole('img', { name: 'PDF 第 2 页原文' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF 第 2 页缩略图' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: /^批注 / }));
    expect(thumbnails.every((call) => call[2].signal?.aborted)).toBe(true);
    expect(f.changed).not.toHaveBeenCalled();
    expect(f.load).toHaveBeenCalledTimes(1);
  });

  it('draws a rectangle in original PDF points after rotation and CSS resize, commits once, and restores it through undo/redo', async () => {
    const f = host();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '旋转当前页' }));
    await ready();
    rectangle(200, 150, 10, 20);
    fireEvent.click(screen.getByRole('button', { name: '矩形' }));
    expect(screen.queryByRole('button', { name: '放在当前页中央' })).not.toBeInTheDocument();
    expect(screen.getByText('在页面上按住并拖动，绘制矩形框。')).toBeInTheDocument();
    f.changed.mockClear();
    pointer(paper(), 'pointerdown', 60, 40);
    pointer(paper(), 'pointermove', 140, 90);
    expect(f.changed).not.toHaveBeenCalled();
    expect(window.document.querySelector('.z-studio-pdf-drawing-preview rect')).toHaveAttribute(
      'fill',
      'none'
    );
    pointer(paper(), 'pointerup', 140, 90);
    expect(f.changed).toHaveBeenCalledTimes(1);
    expect(f.document().marks[1]).toMatchObject({
      type: 'rectangle',
      x: 80,
      y: 120,
      width: 100,
      height: 160,
      lineWidth: 2,
    });
    const shape = window.document.querySelector(
      '[data-mark="' + f.document().marks[1].id + '"] rect[stroke]'
    );
    expect(shape).toHaveAttribute('y', '-160');
    expect(shape).toHaveAttribute('stroke-width', '2');
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(f.document().marks).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    expect(f.document().marks[1]).toMatchObject({ type: 'rectangle', x: 80, y: 120 });
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.renderPage).toHaveBeenCalledTimes(2);
  });

  it('moves all signature points together, treats an entire drag as one undo action, and never commits a cancelled stroke', async () => {
    const f = host();
    await ready();
    rectangle(150, 200, 10, 20);
    fireEvent.click(screen.getByRole('tab', { name: '批注' }));
    fireEvent.click(screen.getByRole('button', { name: '手写签名' }));
    expect(screen.queryByRole('button', { name: '放在当前页中央' })).not.toBeInTheDocument();
    pointer(paper(), 'pointerdown', 35, 70);
    pointer(paper(), 'pointermove', 45, 80);
    pointer(paper(), 'pointerup', 55, 70);
    const signed = f.document().marks[1];
    expect(signed).toMatchObject({
      type: 'ink',
      x: 90,
      y: 300,
      points: [
        [90, 320],
        [110, 300],
        [130, 320],
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    const signature = window.document.querySelector('[data-mark="' + signed.id + '"]')!;
    pointer(signature, 'pointerdown', 35, 70);
    pointer(signature.parentElement!, 'pointermove', 40, 75);
    pointer(signature.parentElement!, 'pointermove', 45, 80);
    pointer(signature.parentElement!, 'pointerup', 45, 80);
    expect(f.document().marks[1]).toMatchObject({
      x: 110,
      y: 280,
      points: [
        [110, 300],
        [130, 280],
        [150, 300],
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(f.document().marks[1].points).toEqual(signed.points);
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(f.document().marks).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    expect(f.document().marks[1].points).toEqual(signed.points);
    fireEvent.click(screen.getByRole('tab', { name: '批注' }));
    fireEvent.click(screen.getByRole('button', { name: '手写签名' }));
    const count = f.changed.mock.calls.length;
    pointer(paper(), 'pointerdown', 35, 70);
    pointer(paper(), 'pointermove', 45, 80);
    pointer(paper(), 'pointercancel', 45, 80);
    expect(f.changed).toHaveBeenCalledTimes(count);
    expect(window.document.querySelector('.z-studio-pdf-drawing-preview')).toBeNull();
  });

  it('searches extracted text, navigates results and marks their original rectangles in read-only mode', async () => {
    const search = vi.fn<NonNullable<StudioPdfSession['search']>>(async () => [
      { page: 1, text: 'A matching paragraph', rect: { x: 80, y: 150, width: 100, height: 12 } },
      {
        page: 0,
        text: 'Another matching paragraph',
        rect: { x: 100, y: 300, width: 80, height: 14 },
      },
    ]);
    const f = host(document(), { readOnly: true, search });
    await ready();
    fireEvent.keyDown(screen.getByRole('region', { name: 'PDF 页面编辑区' }), {
      key: 'f',
      ctrlKey: true,
    });
    expect(screen.getByLabelText('PDF 查找文字')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('PDF 查找文字'), { target: { value: 'matching' } });
    fireEvent.submit(screen.getByRole('search', { name: 'PDF 全文查找' }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'PDF 第 2 页原文' })).toBeInTheDocument()
    );
    await ready();
    const hit = window.document.querySelector('.z-studio-pdf-search-hit')!;
    expect(hit).toHaveAttribute('transform', 'matrix(1 0 0 1 40 270)');
    expect(hit.querySelector('rect')).toHaveAttribute('y', '-12');
    fireEvent.click(screen.getByRole('button', { name: 'PDF 下一个匹配' }));
    await ready();
    expect(screen.getByRole('img', { name: 'PDF 第 1 页原文' })).toBeInTheDocument();
    const firstResult = within(screen.getByLabelText('PDF 查找结果')).getAllByRole('button')[0];
    expect(firstResult).toHaveClass('z-button');
    expect(firstResult).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(firstResult);
    await ready();
    expect(screen.getByRole('img', { name: 'PDF 第 2 页原文' })).toBeInTheDocument();
    expect(firstResult).toHaveAttribute('aria-pressed', 'true');
    expect(search).toHaveBeenCalledTimes(1);
    expect(f.changed).not.toHaveBeenCalled();
  });

  it('aborts an older search and ignores its late result after a newer search has completed', async () => {
    const first = deferred<Awaited<ReturnType<NonNullable<StudioPdfSession['search']>>>>();
    const second = deferred<Awaited<ReturnType<NonNullable<StudioPdfSession['search']>>>>();
    const search = vi
      .fn<NonNullable<StudioPdfSession['search']>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const f = host(document(), { search });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '查找' }));
    fireEvent.change(screen.getByLabelText('PDF 查找文字'), { target: { value: 'old' } });
    fireEvent.submit(screen.getByRole('search', { name: 'PDF 全文查找' }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('PDF 查找文字'), { target: { value: 'new' } });
    fireEvent.submit(screen.getByRole('search', { name: 'PDF 全文查找' }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(search.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () =>
      second.resolve([
        { page: 1, text: 'New result', rect: { x: 80, y: 150, width: 50, height: 12 } },
      ])
    );
    await ready();
    await act(async () =>
      first.resolve([
        { page: 0, text: 'Old result', rect: { x: 80, y: 150, width: 50, height: 12 } },
      ])
    );
    expect(screen.getByLabelText('PDF 查找结果')).toHaveTextContent('New result');
    expect(screen.getByLabelText('PDF 查找结果')).not.toHaveTextContent('Old result');
    expect(screen.getByRole('img', { name: 'PDF 第 2 页原文' })).toBeInTheDocument();
    f.unmount();
    expect(search.mock.calls[1][1]?.signal?.aborted).toBe(true);
  });
});
