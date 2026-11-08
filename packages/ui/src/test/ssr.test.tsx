import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { CommandPalette } from '../components/CommandPalette';
import { MultiCombobox } from '../components/MultiCombobox';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { SideNav } from '../components/SideNav';
import { Splitter } from '../components/Splitter';
import { Statistic } from '../components/Statistic';
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
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
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

  it('Input 子组件渲染不抛错，输出含 z- 类名', () => {
    const textarea = renderSSR(<Input.Textarea placeholder="请输入" />);
    expect(textarea).toContain('z-input-textarea');
    const password = renderSSR(<Input.Password placeholder="请输入" />);
    expect(password).toContain('type="password"');
    expect(password).toContain('z-input-toggle');
    const search = renderSSR(<Input.Search placeholder="请输入" />);
    expect(search).toContain('z-input-search-button');
  });

  it('Statistic.CountDown 渲染不抛错，输出 role=timer 与 z- 类名', () => {
    const html = renderSSR(<Statistic.CountDown value={Date.now() + 60_000} title="活动结束" />);
    expect(html).toContain('z-statistic');
    expect(html).toContain('role="timer"');
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

  it('Combobox 关闭态渲染为文本输入且不输出 listbox', () => {
    const html = renderSSR(
      <Combobox
        options={[
          { value: 'a', label: '选项 A' },
          { value: 'b', label: '选项 B' },
        ]}
        aria-label="选项搜索"
      />
    );
    expect(html).toContain('z-combobox');
    expect(html).toContain('type="text"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="listbox"');
  });

  it('MultiCombobox 关闭态渲染标签与 hidden input 且不输出 listbox', () => {
    const html = renderSSR(
      <MultiCombobox
        options={[
          { value: 'a', label: '选项 A' },
          { value: 'b', label: '选项 B' },
        ]}
        defaultValue={['a']}
        name="tags"
        aria-label="多选搜索"
      />
    );
    expect(html).toContain('z-multicombobox');
    expect(html).toContain('z-multicombobox-tag');
    expect(html).toContain('type="hidden"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="listbox"');
  });

  it('SideNav SSR 渲染语义结构与当前页标记', () => {
    const html = renderSSR(
      <SideNav
        sections={[
          {
            key: 'workspace',
            label: '工作区',
            items: [
              { key: 'overview', label: '概览', href: '#/overview' },
              {
                key: 'settings',
                label: '设置',
                children: [{ key: 'profile', label: '资料', href: '#/settings/profile' }],
              },
            ],
          },
        ]}
        currentKey="profile"
        aria-label="主导航"
      />
    );
    expect(html).toContain('z-sidenav');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-part="children"');
    expect(html).toContain('aria-label="主导航"');
  });

  it('Splitter SSR 渲染 separator 与不占用 Handle 宽度的百分比轨道', () => {
    const html = renderSSR(
      <Splitter aria-label="工作台" defaultSizes={[40, 60]}>
        <Splitter.Panel>左</Splitter.Panel>
        <Splitter.Panel>右</Splitter.Panel>
      </Splitter>
    );
    expect(html).toContain('z-splitter');
    expect(html).toContain('role="separator"');
    expect(html).toContain('grid-template-columns:40fr var(--z-splitter-handle-size) 60fr');
    expect(html).toContain('aria-valuenow="40"');
  });

  it('CommandPalette SSR 不访问 DOM，Portal 首帧保持 hydration 稳定', () => {
    const closed = renderSSR(
      <CommandPalette commands={[{ key: 'open', label: '打开', onSelect: () => {} }]} />
    );
    expect(closed).toBe('');

    const initiallyOpen = renderSSR(
      <CommandPalette defaultOpen commands={[{ key: 'open', label: '打开', onSelect: () => {} }]} />
    );
    expect(initiallyOpen).toContain('data-zui-portal-source');
    expect(initiallyOpen).not.toContain('role="dialog"');
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
