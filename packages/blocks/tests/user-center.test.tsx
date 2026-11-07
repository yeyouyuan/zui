import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserCenterBlock, DEMO_PREFERENCES, DEMO_USER } from '../src/user-center';

afterEach(cleanup);

describe('user-center block', () => {
  it('renders header avatar with user info and profile descriptions', () => {
    const { container } = render(<UserCenterBlock user={DEMO_USER} />);
    // 头像与头部信息（名字同时出现在头部与描述列表，至少两处）
    expect(container.querySelector('.z-avatar')).toBeInTheDocument();
    expect(screen.getAllByText('林小满').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('@xiaoman.lin · 前端工程师')).toBeInTheDocument();
    // 资料描述列表
    expect(screen.getByText('基本资料')).toBeInTheDocument();
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('xiaoman.lin@example.com')).toBeInTheDocument();
    expect(screen.getByText('2023-06-12')).toBeInTheDocument();
  });

  it('switches between security and preferences tabs', async () => {
    const user = userEvent.setup();
    render(
      <UserCenterBlock user={DEMO_USER} preferences={DEMO_PREFERENCES} twoFactorEnabled />
    );
    // 默认展示资料页
    expect(screen.getByText('基本资料')).toBeInTheDocument();
    expect(screen.queryByText('登录二次验证')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '安全' }));
    expect(screen.getByText('安全设置')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '登录二次验证' })).toBeChecked();

    await user.click(screen.getByRole('tab', { name: '偏好' }));
    expect(screen.getByText('邮件通知')).toBeInTheDocument();
    expect(screen.getByText('紧凑模式')).toBeInTheDocument();
  });

  it('toggles preference switches and reports the key', async () => {
    const onPreferenceChange = vi.fn();
    const user = userEvent.setup();
    render(
      <UserCenterBlock
        user={DEMO_USER}
        preferences={DEMO_PREFERENCES}
        onPreferenceChange={onPreferenceChange}
      />
    );
    await user.click(screen.getByRole('tab', { name: '偏好' }));
    await user.click(screen.getByRole('switch', { name: '邮件通知' }));
    expect(onPreferenceChange).toHaveBeenCalledWith('emailNotify', false);
    await user.click(screen.getByRole('switch', { name: '每周摘要' }));
    expect(onPreferenceChange).toHaveBeenCalledWith('weeklyReport', true);
  });

  it('respects controlled activeTab without flipping internally', () => {
    render(<UserCenterBlock user={DEMO_USER} activeTab="security" />);
    expect(screen.getByText('安全设置')).toBeInTheDocument();
    expect(screen.queryByText('基本资料')).not.toBeInTheDocument();
  });
});
