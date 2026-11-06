import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Avatar, getNameInitial, hashNameColor } from './Avatar';

afterEach(cleanup);

describe('Avatar', () => {
  it('renders name initial fallback by default (no image)', () => {
    render(<Avatar name="张三" />);
    expect(screen.getByText('张')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders root with data-part/data-size/data-shape defaults', () => {
    const { container } = render(<Avatar name="张三" />);
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-avatar');
    expect(root).toHaveAttribute('data-size', 'md');
    expect(root).toHaveAttribute('data-shape', 'circle');
  });

  it('extracts initial: Chinese first char, English first letter uppercased', () => {
    expect(getNameInitial('张三')).toBe('张');
    expect(getNameInitial('alice wang')).toBe('A');
    expect(getNameInitial('bob')).toBe('B');
    render(<Avatar name="alice" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('hashes name into one of 5 semantic subtle colors, deterministically', () => {
    const colors = ['primary', 'success', 'warning', 'info', 'danger'];
    const color = hashNameColor('张三');
    expect(colors).toContain(color);
    expect(hashNameColor('张三')).toBe(color);

    const { container } = render(<Avatar name="张三" />);
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('data-color', color);
  });

  it('renders image when src is given (object-fit cover via image part)', () => {
    const { container } = render(<Avatar src="/a.png" alt="头像" name="张三" />);
    const img = screen.getByRole('img', { name: '头像' });
    expect(img).toHaveAttribute('src', '/a.png');
    expect(img).toHaveClass('z-avatar-image');
    expect(img).toHaveAttribute('data-part', 'image');
    // 名字哈希色仍然记录在根上（回退时生效）
    expect(container.querySelector('[data-part="root"]')).toHaveAttribute(
      'data-color',
      hashNameColor('张三')
    );
  });

  it('falls back to name initial when image fails to load', () => {
    render(<Avatar src="/broken.png" name="张三" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('张')).toBeInTheDocument();
  });

  it('falls back to icon when image fails and no name', () => {
    render(<Avatar src="/broken.png" icon={<i data-testid="icon">I</i>} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders icon when no image and no name', () => {
    render(<Avatar icon={<i data-testid="icon">I</i>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders a built-in default icon when no image/name/icon', () => {
    const { container } = render(<Avatar />);
    const fallback = container.querySelector('[data-part="fallback"]') as HTMLElement;
    expect(fallback).toBeInTheDocument();
    expect(fallback.querySelector('svg')).toBeInTheDocument();
  });

  it('uses name as default alt, explicit alt wins', () => {
    render(<Avatar src="/a.png" name="张三" />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', '张三');
    cleanup();
    render(<Avatar src="/a.png" alt="自定义" />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', '自定义');
  });

  it('fires onError after falling back', () => {
    const onError = vi.fn();
    render(<Avatar src="/broken.png" name="张三" onError={onError} />);
    fireEvent.error(screen.getByRole('img'));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('exposes size via data-size (sm/md/lg)', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { container, unmount } = render(<Avatar size={size} name="A" />);
      expect(container.querySelector('[data-part="root"]')).toHaveAttribute('data-size', size);
      unmount();
    }
  });

  it('supports custom numeric size via --z-avatar-size', () => {
    const { container } = render(<Avatar size={48} name="A" />);
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('data-size', 'custom');
    expect(root.style.getPropertyValue('--z-avatar-size')).toBe('48px');
  });

  it('exposes shape via data-shape', () => {
    const { container } = render(<Avatar shape="square" name="A" />);
    expect(container.querySelector('[data-part="root"]')).toHaveAttribute('data-shape', 'square');
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <Avatar
        src="/a.png"
        name="A"
        className="my-root"
        classNames={{ root: 'cls-root', image: 'cls-image', fallback: 'cls-fallback' }}
      />
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-avatar', 'my-root', 'cls-root');
    const img = container.querySelector('[data-part="image"]');
    expect(img).toHaveClass('z-avatar-image', 'cls-image');

    cleanup();
    render(
      <Avatar name="B" classNames={{ root: 'cls-root', image: 'cls-image', fallback: 'cls-fallback' }} />
    );
    const fallback = document.querySelector('[data-part="fallback"]');
    expect(fallback).toHaveClass('z-avatar-fallback', 'cls-fallback');
  });

  it('forwards ref to the span element', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<Avatar ref={ref} name="A" />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current).toHaveClass('z-avatar');
  });

  it('passes native props through to the span element', () => {
    render(<Avatar name="A" id="my-avatar" data-testid="av" aria-label="用户头像" />);
    const root = screen.getByTestId('av');
    expect(root).toHaveAttribute('id', 'my-avatar');
    expect(root).toHaveAttribute('aria-label', '用户头像');
  });
});
