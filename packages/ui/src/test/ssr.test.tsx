import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Tabs } from '../components/Tabs';
import { Table } from '../components/Table';
import { Alert } from '../components/Alert';
import { MessageProvider } from '../components/Message';

/**
 * SSR 冒烟测试（工程组）：react-dom/server 的 renderToString 渲染核心组件，
 * 断言三件事——不抛错、输出含 z- 类名、无 useLayoutEffect 服务端警告。
 *
 * 说明：react-dom/server 下 useState/useId 可用（effects 不执行）；
 * Portal 组件首帧仅返回隐藏锚点，不输出浮层。
 */

/** renderToString 并收集 console 输出，同时断言无 useLayoutEffect 服务端警告 */
function renderSSR(node: React.ReactNode): string {
  const logs: string[] = [];
  const capture =
    (...args: unknown[]) =>
      void logs.push(args.map(String).join(' '));
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(capture);
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(capture);
  try {
    const html = renderToString(node);
    const layoutEffectWarnings = logs.filter((line) => line.includes('useLayoutEffect'));
    expect(layoutEffectWarnings).toEqual([]);
    return html;
  } finally {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  }
}

describe('SSR renderToString 冒烟', () => {
  it('Button 各 variant 渲染不抛错，输出含 z- 类名', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;
    for (const variant of variants) {
      const html = renderSSR(<Button variant={variant}>确定</Button>);
      expect(html).toContain('z-button');
      expect(html).toContain(`data-variant="${variant}"`);
    }
  });

  it('Input 渲染不抛错，输出含 z- 类名', () => {
    const html = renderSSR(<Input placeholder="请输入" />);
    expect(html).toContain('z-input');
    expect(html).toContain('z-input-field');
  });

  it('Select 关闭态渲染不抛错，输出含 z- 类名', () => {
    const html = renderSSR(
      <Select
        options={[
          { value: 'a', label: '选项 A' },
          { value: 'b', label: '选项 B' },
        ]}
        placeholder="请选择"
      />
    );
    expect(html).toContain('z-select');
    // 关闭态：root/listbox 均为 data-open="false"，触发器 aria-expanded="false"
    expect(html).toContain('data-open="false"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('Tabs 渲染不抛错，输出含 z- 类名', () => {
    const html = renderSSR(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">标签一</Tabs.Trigger>
          <Tabs.Trigger value="two">标签二</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="one">面板一</Tabs.Panel>
        <Tabs.Panel value="two">面板二</Tabs.Panel>
      </Tabs>
    );
    expect(html).toContain('z-tabs');
    expect(html).toContain('z-tabs-list');
    expect(html).toContain('z-tabs-panel');
  });

  it('Table 渲染不抛错，输出含 z- 类名', () => {
    const html = renderSSR(
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>姓名</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.Cell>ZUI</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
    expect(html).toContain('z-table');
    expect(html).toContain('z-table-header-cell');
    expect(html).toContain('z-table-cell');
  });

  it('Alert 渲染不抛错，输出含 z- 类名', () => {
    const html = renderSSR(
      <Alert type="warning" title="注意">
        这是一条警告描述。
      </Alert>
    );
    expect(html).toContain('z-alert');
    expect(html).toContain('z-alert-title');
    expect(html).toContain('z-alert-description');
  });

  it('MessageProvider 包裹空树渲染不抛错、无 useLayoutEffect 警告（不输出浮层）', () => {
    const html = renderSSR(<MessageProvider>{null}</MessageProvider>);
    // Portal 在 SSR 下只保留锚点，消息列表不应泄漏到服务端输出
    expect(html).not.toContain('z-message');
    expect(html).not.toContain('z-message-list');
  });
});
