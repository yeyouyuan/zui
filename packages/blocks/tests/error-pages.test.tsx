import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorPagesBlock } from '../src/error-pages';

afterEach(cleanup);

describe('error-pages block', () => {
  it('renders the 404 result with back actions by default', () => {
    const { container } = render(<ErrorPagesBlock />);
    expect(container.querySelector('.z-result')).toHaveAttribute('data-status', '404');
    // SVG 图标内数字码 + Result 标题
    expect(screen.getAllByText('404').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('抱歉，你访问的页面不存在或已被移除')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回上一页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '回到首页' })).toBeInTheDocument();
    // 默认不显示切换器
    expect(screen.queryByRole('radiogroup', { name: '错误页状态切换' })).not.toBeInTheDocument();
  });

  it('switches between 403/404/500 via the built-in switcher and fires onStatusChange', () => {
    const onStatusChange = vi.fn();
    const { container } = render(<ErrorPagesBlock showSwitcher onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '403' }));
    expect(onStatusChange).toHaveBeenCalledWith('403');
    expect(container.querySelector('.z-result')).toHaveAttribute('data-status', '403');
    expect(screen.getByText('抱歉，你没有权限访问该页面')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '500' }));
    expect(onStatusChange).toHaveBeenLastCalledWith('500');
    expect(container.querySelector('.z-result')).toHaveAttribute('data-status', '500');
    expect(screen.getByText('抱歉，服务器出了点问题，请稍后再试')).toBeInTheDocument();
  });

  it('follows controlled status props and fires back/home callbacks', () => {
    const onStatusChange = vi.fn();
    const onBack = vi.fn();
    const onHome = vi.fn();
    const { container, rerender } = render(
      <ErrorPagesBlock status="500" onStatusChange={onStatusChange} onBack={onBack} onHome={onHome} />
    );
    expect(container.querySelector('.z-result')).toHaveAttribute('data-status', '500');
    fireEvent.click(screen.getByRole('button', { name: '返回上一页' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '回到首页' }));
    expect(onHome).toHaveBeenCalledTimes(1);
    // 受控切换：父级改 props 才变
    rerender(<ErrorPagesBlock status="403" onStatusChange={onStatusChange} onBack={onBack} onHome={onHome} />);
    expect(container.querySelector('.z-result')).toHaveAttribute('data-status', '403');
  });

  it('supports per-status custom copy', () => {
    render(<ErrorPagesBlock status="403" copy={{ '403': { title: '无权限', subTitle: '请联系管理员开通' } }} />);
    expect(screen.getByText('无权限')).toBeInTheDocument();
    expect(screen.getByText('请联系管理员开通')).toBeInTheDocument();
  });
});
