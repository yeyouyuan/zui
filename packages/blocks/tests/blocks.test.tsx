import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardBlock, FormPageBlock, LoginBlock } from '../src';

afterEach(cleanup);

describe('business block forms', () => {
  it('validates a login before delivering the public values', async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<LoginBlock onSubmit={submit} />);
    await user.click(screen.getByRole('button', { name: '登录', exact: true }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getAllByText('该项为必填')).toHaveLength(2);
    await user.type(container.querySelector('input[name="username"]')!, 'alice');
    await user.type(container.querySelector('input[name="password"]')!, 'correct horse');
    await user.click(screen.getByLabelText('记住我'));
    await user.click(screen.getByRole('button', { name: '登录', exact: true }));
    expect(submit).toHaveBeenCalledWith({ username: 'alice', password: 'correct horse', remember: false });
  });

  it('keeps generated input IDs distinct between login instances', () => {
    render(<><LoginBlock /><LoginBlock /></>);
    const accounts = Array.from(document.querySelectorAll('input[name="username"]'));
    expect(accounts[0].id).toBeTruthy();
    expect(accounts[0].id).not.toBe(accounts[1].id);
  });

  it('keeps form-page labels and dates attached to their own instance', () => {
    const { container } = render(<><FormPageBlock /><FormPageBlock /></>);
    for (const name of ['name', 'code', 'owner', 'email', 'plannedDate']) {
      const controls = Array.from(container.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));
      expect(controls).toHaveLength(2);
      expect(controls[0].id).toBeTruthy();
      expect(controls[0].id).not.toBe(controls[1].id);
      for (const control of controls) expect(control.labels?.length).toBeGreaterThan(0);
    }
  });

  it('validates required project fields, blocks loading submits, and preserves public values', async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    const { container, rerender } = render(<FormPageBlock onSubmit={submit} />);
    await user.click(screen.getByLabelText('我已阅读并同意《项目管理规范》'));
    await user.click(screen.getByRole('button', { name: '提交', exact: true }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getAllByText('该项为必填')).toHaveLength(3);
    await user.type(container.querySelector('input[name="name"]')!, 'ZUI');
    await user.type(container.querySelector('input[name="code"]')!, 'prj-001');
    await user.type(container.querySelector('input[name="owner"]')!, 'Alice');
    await user.type(container.querySelector('input[name="email"]')!, 'bad-email');
    await user.click(screen.getByRole('button', { name: '提交', exact: true }));
    expect(screen.getByText('请输入有效的电子邮箱')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    await user.clear(container.querySelector('input[name="email"]')!);
    await user.type(container.querySelector('input[name="email"]')!, 'alice@example.com');
    await user.click(screen.getByRole('switch', { name: '进度通知' }));
    await user.click(screen.getByRole('switch', { name: '立即启用' }));
    rerender(<FormPageBlock loading onSubmit={submit} />);
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).not.toHaveBeenCalled();
    rerender(<FormPageBlock onSubmit={submit} />);
    await user.click(screen.getByRole('button', { name: '提交', exact: true }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZUI', code: 'PRJ-001', owner: 'Alice', email: 'alice@example.com', agreed: true, plannedDate: '', notify: false, enabled: false }));
    expect(container.querySelector('.z-datepicker')).toBeInTheDocument();
  });
});

describe('dashboard block', () => {
  it('uses Statistic without dropping custom React values and clamps progress semantics', () => {
    const { container } = render(<DashboardBlock stats={[{ key: 'number', label: '访问量', value: 12345 }, { key: 'custom', label: '自定义', value: <strong>待更新</strong> }]} channels={[{ key: 'wide', name: '测试渠道', visits: '10', share: 150 }]} />);
    expect(container.querySelector('.z-statistic')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(screen.getByText('待更新')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '流量占比' })).toHaveAttribute('aria-valuenow', '100');
  });
});
