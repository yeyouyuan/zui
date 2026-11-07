import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Upload, type CustomRequestOptions, type UploadChangeInfo, type UploadFile } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* -------------------------------- 工具 ---------------------------------- */

function makeFile(name: string, size = 1024, type = 'text/plain'): File {
  return new File(['x'.repeat(Math.min(size, 4096))], name, { type });
}

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

function getFileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

/** jsdom 无 DragEvent：用 Event + defineProperty 造一个带 dataTransfer 的 drop 事件 */
function createDropEvent(files: File[]): Event {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  return event;
}

/** 可控的 XMLHttpRequest 桩（不触网，测试手动驱动 progress/load/error） */
class FakeXHR {
  static instances: FakeXHR[] = [];
  upload = { onprogress: null as ((event: { loaded: number; total: number }) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 0;
  responseText = '';
  withCredentials = false;
  method = '';
  url = '';
  requestHeaders: Record<string, string> = {};
  body: FormData | null = null;
  aborted = false;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(key: string, value: string) {
    this.requestHeaders[key] = value;
  }
  send(body: FormData) {
    this.body = body;
    FakeXHR.instances.push(this);
  }
  abort() {
    this.aborted = true;
  }
}

function stubXHR(): typeof FakeXHR.instances {
  vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest);
  FakeXHR.instances = [];
  return FakeXHR.instances;
}

function getLast<T>(mockFn: { mock: { calls: T[][] } }): T {
  const calls = mockFn.mock.calls;
  return calls[calls.length - 1][0];
}

/* ------------------------------ 渲染与语义 ------------------------------- */

describe('渲染与语义', () => {
  it('按钮模式：可见按钮是唯一键盘入口，隐藏 input 不重复聚焦', () => {
    const { container } = render(<Upload />);
    const root = getRoot(container);
    expect(root).toHaveClass('z-upload');
    expect(root).toHaveAttribute('data-part', 'root');

    expect(screen.getByRole('button', { name: '点击上传' })).toBeInTheDocument();
    const input = getFileInput(container);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('data-part', 'input');
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(input).toHaveAttribute('aria-hidden', 'true');
  });

  it('draggable 模式：dragzone 文案与 data-part，classNames 追加', () => {
    const { container } = render(<Upload draggable classNames={{ dragzone: 'c-dz' }} />);
    expect(screen.getByText('点击或拖拽文件到此处')).toBeInTheDocument();
    const zone = container.querySelector('[data-part="dragzone"]');
    expect(zone).toHaveClass('z-upload-dragzone', 'c-dz');
    expect(zone).toHaveAttribute('role', 'button');
    expect(zone).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: '点击或拖拽文件到此处' })).toBeInTheDocument();
  });

  it('拖拽区支持 Enter 和空格打开选择器，禁用时退出键盘导航', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<Upload draggable />);
    const input = getFileInput(container);
    const open = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    const zone = screen.getByRole('button', { name: '点击或拖拽文件到此处' });
    zone.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(open).toHaveBeenCalledTimes(2);
    rerender(<Upload draggable disabled />);
    expect(zone).toHaveAttribute('tabindex', '-1');
    expect(zone).toHaveAttribute('aria-disabled', 'true');
  });

  it('文件列表 ARIA：role=list/listitem、移除按钮 aria-label、size 可读格式、data-status', () => {
    const files: UploadFile[] = [
      { uid: 'u1', name: 'a.png', size: 1024, status: 'success' },
      { uid: 'u2', name: 'b.txt', size: 512, status: 'error' },
      { uid: 'u3', name: 'c.mp4', size: 2 * 1024 * 1024, status: 'uploading' },
    ];
    const { container } = render(<Upload defaultFileList={files} />);

    expect(container.querySelector('[data-part="list"]')).toHaveAttribute('data-part', 'list');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: '删除文件' })).toHaveLength(3);

    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('512 B')).toBeInTheDocument();
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();

    const items = container.querySelectorAll('[data-part="item"]');
    expect(items[0]).toHaveAttribute('data-status', 'success');
    expect(items[1]).toHaveAttribute('data-status', 'error');
    expect(items[2]).toHaveAttribute('data-status', 'uploading');
    expect(items[2].querySelector('[role="progressbar"]')).not.toBeNull();
  });
});

/* ---------------------------- customRequest 引擎 -------------------------- */

describe('customRequest 引擎', () => {
  it('选择文件触发 customRequest，onChange 报告 uploading + percent 0', async () => {
    const file = makeFile('hello.txt');
    const customRequest = vi.fn();
    const onChange = vi.fn();
    const { container } = render(<Upload customRequest={customRequest} onChange={onChange} />);

    await userEvent.upload(getFileInput(container), file);

    expect(customRequest).toHaveBeenCalledTimes(1);
    const options = customRequest.mock.calls[0][0] as CustomRequestOptions;
    expect(options.file).toBe(file);
    expect(typeof options.onProgress).toBe('function');
    expect(typeof options.onSuccess).toBe('function');
    expect(typeof options.onError).toBe('function');

    expect(onChange).toHaveBeenCalledTimes(1);
    const info = onChange.mock.calls[0][0] as UploadChangeInfo;
    expect(info.file.name).toBe('hello.txt');
    expect(info.file.status).toBe('uploading');
    expect(info.file.percent).toBe(0);
    expect(info.file.uid).toMatch(/^z-upload-/);
    expect(info.fileList).toHaveLength(1);
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });

  it('onProgress 更新进度条（aria-valuenow 与 width）', async () => {
    let captured: CustomRequestOptions | undefined;
    const { container } = render(
      <Upload
        customRequest={(options) => {
          captured = options;
        }}
      />
    );
    await userEvent.upload(getFileInput(container), makeFile('doc.pdf'));
    act(() => captured!.onProgress(40));

    const bar = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar.style.width).toBe('40%');
  });

  it('onSuccess 进入 success（percent 100 + response）', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Upload customRequest={({ onSuccess }) => onSuccess({ ok: true })} onChange={onChange} />
    );
    await userEvent.upload(getFileInput(container), makeFile('ok.txt'));
    await waitFor(() => {
      expect(container.querySelector('[data-part="item"]')).toHaveAttribute(
        'data-status',
        'success'
      );
    });
    const info = getLast(onChange);
    expect(info.file.status).toBe('success');
    expect(info.file.percent).toBe(100);
    expect(info.file.response).toEqual({ ok: true });
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('onError 进入 error（error 文案进入 onChange）', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Upload customRequest={({ onError }) => onError('boom')} onChange={onChange} />
    );
    await userEvent.upload(getFileInput(container), makeFile('bad.txt'));
    await waitFor(() => {
      expect(container.querySelector('[data-part="item"]')).toHaveAttribute('data-status', 'error');
    });
    expect(getLast(onChange).file.error).toBe('boom');
  });

  it('customRequest 返回 abort 句柄，卸载时中止', async () => {
    const abort = vi.fn();
    const { container, unmount } = render(<Upload customRequest={() => ({ abort })} />);
    await userEvent.upload(getFileInput(container), makeFile('x.txt'));
    unmount();
    expect(abort).toHaveBeenCalled();
  });
});

/* ------------------------------ XHR 引擎（mock） -------------------------- */

describe('XHR 引擎（mock XMLHttpRequest，无真实网络）', () => {
  it('open/send 携带 action/method/headers/data/name/withCredentials', async () => {
    const instances = stubXHR();
    const { container } = render(
      <Upload
        action="/api/upload"
        headers={{ 'x-token': 'abc' }}
        data={{ biz: 1 }}
        name="attachment"
        withCredentials
      />
    );
    const file = makeFile('req.txt');
    await userEvent.upload(getFileInput(container), file);

    expect(instances).toHaveLength(1);
    const xhr = instances[0];
    expect(xhr.method).toBe('post');
    expect(xhr.url).toBe('/api/upload');
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.requestHeaders['x-token']).toBe('abc');
    expect(xhr.body).toBeInstanceOf(FormData);
    const attached = xhr.body!.get('attachment') as File;
    expect(attached).toBeInstanceOf(File);
    expect(attached.name).toBe(file.name);
    expect(xhr.body!.get('biz')).toBe('1');
  });

  it('upload.onprogress 更新 percent', async () => {
    const instances = stubXHR();
    const { container } = render(<Upload action="/api/upload" />);
    await userEvent.upload(getFileInput(container), makeFile('p.txt'));
    act(() => instances[0].upload.onprogress?.({ loaded: 25, total: 100 }));

    const bar = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar.style.width).toBe('25%');
  });

  it('load 2xx → success，JSON 响应解析为 response', async () => {
    const instances = stubXHR();
    const onChange = vi.fn();
    const { container } = render(<Upload action="/api/upload" onChange={onChange} />);
    await userEvent.upload(getFileInput(container), makeFile('s.txt'));
    instances[0].status = 200;
    instances[0].responseText = '{"url":"https://cdn/x.png"}';
    act(() => instances[0].onload?.());

    expect(container.querySelector('[data-part="item"]')).toHaveAttribute('data-status', 'success');
    const info = getLast(onChange);
    expect(info.file.status).toBe('success');
    expect(info.file.percent).toBe(100);
    expect(info.file.response).toEqual({ url: 'https://cdn/x.png' });
  });

  it('load 非 2xx → error（HTTP 500）', async () => {
    const instances = stubXHR();
    const { container } = render(<Upload action="/api/upload" />);
    await userEvent.upload(getFileInput(container), makeFile('e.txt'));
    instances[0].status = 500;
    act(() => instances[0].onload?.());

    expect(container.querySelector('[data-part="item"]')).toHaveAttribute('data-status', 'error');
  });

  it('onerror → error（Network error）', async () => {
    const instances = stubXHR();
    const { container } = render(<Upload action="/api/upload" />);
    await userEvent.upload(getFileInput(container), makeFile('n.txt'));
    act(() => instances[0].onerror?.());

    expect(container.querySelector('[data-part="item"]')).toHaveAttribute('data-status', 'error');
  });

  it('卸载时中止在途上传（xhr.abort）', async () => {
    const instances = stubXHR();
    const { container, unmount } = render(<Upload action="/api/upload" />);
    await userEvent.upload(getFileInput(container), makeFile('u.txt'));
    unmount();
    expect(instances[0].aborted).toBe(true);
  });
});

/* --------------------------- 移除 / 跳过 / 上限 --------------------------- */

describe('移除 / beforeUpload / maxCount', () => {
  it('onRemove 返回 false 阻止移除', async () => {
    const onRemove = vi.fn(() => false);
    const onChange = vi.fn();
    render(
      <Upload
        defaultFileList={[{ uid: 'u1', name: 'keep.txt', status: 'success' }]}
        onRemove={onRemove}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: '删除文件' }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1', name: 'keep.txt' }));
    expect(screen.getByText('keep.txt')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('onRemove 放行时移除并触发 onChange（fileList 变短）', async () => {
    const onChange = vi.fn();
    render(
      <Upload
        defaultFileList={[
          { uid: 'u1', name: 'a.txt', status: 'success' },
          { uid: 'u2', name: 'b.txt', status: 'success' },
        ]}
        onChange={onChange}
      />
    );
    const removeButtons = screen.getAllByRole('button', { name: '删除文件' });
    await userEvent.click(removeButtons[0]);

    await waitFor(() => expect(screen.queryByText('a.txt')).not.toBeInTheDocument());
    expect(getLast(onChange).fileList).toHaveLength(1);
    expect(screen.getByText('b.txt')).toBeInTheDocument();
  });

  it('beforeUpload 返回 false：不入列、不上传、不触发 onChange', async () => {
    const beforeUpload = vi.fn(() => false);
    const customRequest = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Upload beforeUpload={beforeUpload} customRequest={customRequest} onChange={onChange} />
    );
    await userEvent.upload(getFileInput(container), makeFile('skip.txt'));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(beforeUpload).toHaveBeenCalledWith(expect.any(File), [expect.any(File)]);
    expect(customRequest).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[data-part="list"]')).toBeNull();
  });

  it('beforeUpload 按类型过滤：仅保留通过的文件', async () => {
    const customRequest = vi.fn();
    const { container } = render(
      <Upload
        multiple
        beforeUpload={(file) => file.name.endsWith('.png')}
        customRequest={customRequest}
      />
    );
    const files = [makeFile('a.png'), makeFile('b.txt'), makeFile('c.png')];
    await userEvent.upload(getFileInput(container), files);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(customRequest).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('b.txt')).not.toBeInTheDocument();
    expect(screen.getByText('a.png')).toBeInTheDocument();
    expect(screen.getByText('c.png')).toBeInTheDocument();
  });

  it('maxCount 超出时挤掉最旧', async () => {
    const { container } = render(<Upload maxCount={2} customRequest={() => undefined} />);
    const input = getFileInput(container);
    await userEvent.upload(input, makeFile('f1.txt'));
    await userEvent.upload(input, makeFile('f2.txt'));
    await userEvent.upload(input, makeFile('f3.txt'));

    expect(screen.queryByText('f1.txt')).not.toBeInTheDocument();
    expect(screen.getByText('f2.txt')).toBeInTheDocument();
    expect(screen.getByText('f3.txt')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

/* --------------------------------- 拖拽 ---------------------------------- */

describe('draggable 拖拽', () => {
  it('drop 触发上传（mock DataTransfer，多文件）', () => {
    const customRequest = vi.fn();
    const { container } = render(<Upload draggable customRequest={customRequest} />);
    const zone = container.querySelector('[data-part="dragzone"]') as HTMLElement;
    fireEvent(zone, createDropEvent([makeFile('d1.txt'), makeFile('d2.txt')]));

    expect(customRequest).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('d1.txt')).toBeInTheDocument();
    expect(screen.getByText('d2.txt')).toBeInTheDocument();
  });

  it('dragover 高亮 data-dragover，dragleave 清除', () => {
    const { container } = render(<Upload draggable />);
    const zone = container.querySelector('[data-part="dragzone"]') as HTMLElement;

    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute('data-dragover', 'true');

    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveAttribute('data-dragover');
  });
});

/* --------------------------- 受控 / 禁用 / 定制 --------------------------- */

describe('受控 / 禁用 / 定制出口', () => {
  it('受控 fileList：onChange → 父组件更新 → UI 跟随到 success', async () => {
    const infos: UploadChangeInfo[] = [];
    function ControlledDemo() {
      const [files, setFiles] = React.useState<UploadFile[]>([]);
      return (
        <Upload
          fileList={files}
          customRequest={({ onSuccess }) => onSuccess('done')}
          onChange={(info) => {
            infos.push(info);
            setFiles(info.fileList);
          }}
        />
      );
    }
    const { container } = render(<ControlledDemo />);
    await userEvent.upload(getFileInput(container), makeFile('ctrl.txt'));

    await waitFor(() => {
      expect(container.querySelector('[data-part="item"]')).toHaveAttribute(
        'data-status',
        'success'
      );
    });
    const last = infos[infos.length - 1];
    expect(last.file.name).toBe('ctrl.txt');
    expect(last.file.status).toBe('success');
    expect(last.fileList).toHaveLength(1);
  });

  it('disabled：按钮与 input 禁用，拖拽区不响应 drop / dragover', async () => {
    const first = render(<Upload disabled />);
    expect(screen.getByRole('button', { name: '点击上传' })).toBeDisabled();
    expect(getFileInput(first.container)).toBeDisabled();
    first.unmount();

    const customRequest = vi.fn();
    const { container } = render(<Upload draggable disabled customRequest={customRequest} />);
    const zone = container.querySelector('[data-part="dragzone"]') as HTMLElement;
    expect(zone).toHaveAttribute('data-disabled', 'true');
    expect(getFileInput(container)).toBeDisabled();

    fireEvent.dragOver(zone);
    expect(zone).not.toHaveAttribute('data-dragover');
    fireEvent(zone, createDropEvent([makeFile('no.txt')]));
    expect(customRequest).not.toHaveBeenCalled();
    expect(container.querySelector('[data-part="list"]')).toBeNull();
  });

  it('classNames/data-part 透传 + className 与 aria 属性落到根元素', () => {
    const { container } = render(
      <Upload
        className="my-root"
        aria-label="上传组件"
        defaultFileList={[{ uid: 'u1', name: 'x.txt', status: 'success' }]}
        classNames={{ root: 'c-root', trigger: 'c-trigger', list: 'c-list', item: 'c-item' }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-upload', 'my-root', 'c-root');
    expect(root).toHaveAttribute('aria-label', '上传组件');
    expect(container.querySelector('[data-part="trigger"]')).toHaveClass('c-trigger');
    expect(screen.getByRole('list')).toHaveClass('c-list');
    expect(screen.getByRole('listitem')).toHaveClass('c-item');
  });

  it('Esc 无关性：按键不影响列表与状态', () => {
    const onChange = vi.fn();
    render(
      <Upload
        defaultFileList={[
          { uid: 'u1', name: 'a.txt', status: 'success' },
          { uid: 'u2', name: 'b.txt', status: 'success' },
        ]}
        onChange={onChange}
      />
    );
    fireEvent.keyDown(screen.getByRole('list'), { key: 'Escape' });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});
