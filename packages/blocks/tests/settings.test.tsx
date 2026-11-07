import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsBlock, DEMO_SETTINGS_VALUES } from '../src/settings';

afterEach(cleanup);

describe('settings block', () => {
  it('renders anchor navigation and the basic form section by default', () => {
    render(<SettingsBlock values={DEMO_SETTINGS_VALUES} />);
    // 左侧锚点分组
    expect(screen.getByRole('navigation', { name: '设置分组' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '基本设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通知设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '安全设置' })).toBeInTheDocument();
    // 基本设置表单受控值
    const nameInput = screen.getByLabelText('站点名称') as HTMLInputElement;
    expect(nameInput.value).toBe('ZUI 管理平台');
    expect(screen.getByLabelText('站点描述')).toHaveValue('企业级中后台统一工作台');
  });

  it('switches sections and edits a field', async () => {
    const onSectionChange = vi.fn();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SettingsBlock
        values={DEMO_SETTINGS_VALUES}
        onSectionChange={onSectionChange}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole('button', { name: '通知设置' }));
    expect(onSectionChange).toHaveBeenCalledWith('notify');
    expect(screen.getByRole('switch', { name: '邮件通知' })).toBeChecked();
    expect(screen.queryByLabelText('站点名称')).not.toBeInTheDocument();

    // 回到基本设置编辑字段（受控 Input 用 fireEvent 整体赋值，避免逐键回退）
    await user.click(screen.getByRole('button', { name: '基本设置' }));
    fireEvent.change(screen.getByLabelText('站点名称'), { target: { value: '新平台' } });
    expect(onChange).toHaveBeenLastCalledWith('siteName', '新平台');
  });

  it('toggles switches and fires save with the current values', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SettingsBlock values={DEMO_SETTINGS_VALUES} onChange={onChange} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: '通知设置' }));
    await user.click(screen.getByRole('switch', { name: '邮件通知' }));
    expect(onChange).toHaveBeenCalledWith('emailNotify', false);

    await user.click(screen.getByRole('button', { name: '保存设置' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(DEMO_SETTINGS_VALUES);
  });

  it('respects controlled activeSection', () => {
    render(<SettingsBlock values={DEMO_SETTINGS_VALUES} activeSection="security" />);
    expect(screen.getByRole('switch', { name: '登录二次验证' })).toBeInTheDocument();
    expect(screen.queryByLabelText('站点名称')).not.toBeInTheDocument();
  });

  it('keeps labels associated with their own inputs across multiple instances', () => {
    const { container } = render(
      <>
        <SettingsBlock values={{ ...DEMO_SETTINGS_VALUES, siteName: '第一站点' }} />
        <SettingsBlock values={{ ...DEMO_SETTINGS_VALUES, siteName: '第二站点' }} />
      </>
    );
    const labels = Array.from(container.querySelectorAll('label')).filter(
      (label) => label.textContent === '站点名称'
    );
    expect(labels).toHaveLength(2);
    expect(labels[0].htmlFor).not.toBe(labels[1].htmlFor);
    expect(labels.map((label) => (label.control as HTMLInputElement).value)).toEqual([
      '第一站点',
      '第二站点',
    ]);
  });
});
