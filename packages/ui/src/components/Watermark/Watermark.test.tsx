import { afterEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import { Watermark } from './index';

afterEach(cleanup);

function getOverlay() {
  return document.querySelector('[data-part="overlay"]') as HTMLElement;
}

/** 解出 data-uri 中编码的 SVG 文本 */
function tileOf(overlay: HTMLElement): string {
  const attr = overlay.getAttribute('style') ?? '';
  const match = attr.match(/background-image:\s*url\("data:image\/svg\+xml,([^"]*)"\)/);
  return match ? decodeURIComponent(match[1]) : '';
}

describe('Watermark 渲染', () => {
  it('渲染 children 与 aria-hidden 覆盖层', () => {
    render(
      <Watermark content="机密">
        <p>正文</p>
      </Watermark>
    );
    expect(screen.getByText('正文')).toBeInTheDocument();
    const overlay = getOverlay();
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });

  it('文本内容平铺为 SVG data-uri 背景', () => {
    render(<Watermark content="ZUI">x</Watermark>);
    const overlay = getOverlay();
    expect(overlay.style.backgroundImage).toContain('data:image/svg+xml');
    expect(tileOf(overlay)).toContain('ZUI');
  });

  it('多行 content 平铺多个 text 节点', () => {
    render(<Watermark content={['第一行', '第二行']}>x</Watermark>);
    const decoded = tileOf(getOverlay());
    expect(decoded).toContain('第一行');
    expect(decoded).toContain('第二行');
  });

  it('image 模式使用图片 href', () => {
    render(<Watermark image="data:image/png;base64,AAA">x</Watermark>);
    const decoded = tileOf(getOverlay());
    expect(decoded).toContain('<image');
    expect(decoded).toContain('data:image/png;base64,AAA');
  });

  it('rotate / gap 影响 SVG 尺寸与旋转', () => {
    render(<Watermark content="W" rotate={30} gap={[120, 80]}>x</Watermark>);
    const style = getOverlay().style;
    expect(style.backgroundSize).toBe('120px 80px');
    expect(tileOf(getOverlay())).toContain('rotate(30 60 40)');
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-rotate', '30');
  });
});

describe('Watermark 定制与安全', () => {
  it('classNames / className 透传到对应 part', () => {
    render(
      <Watermark content="W" className="doc-wrap" classNames={{ root: 'my-root', overlay: 'my-overlay' }}>
        x
      </Watermark>
    );
    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveClass('z-watermark', 'my-root', 'doc-wrap');
    expect(getOverlay()).toHaveClass('z-watermark-overlay', 'my-overlay');
  });

  it('覆盖层不拦截指针（pointer-events: none 类名语义）', () => {
    render(<Watermark content="W">x</Watermark>);
    expect(getOverlay()).toHaveClass('z-watermark-overlay');
  });

  it('特殊字符被 XML 转义，不破坏 data-uri', () => {
    render(<Watermark content={String.raw`<b>&"`}>x</Watermark>);
    const decoded = tileOf(getOverlay());
    expect(decoded).toContain('&lt;b&gt;');
    expect(decoded).toContain('&amp;');
    expect(decoded).not.toContain('<b>');
  });

  it('SSR 渲染不访问 DOM，输出稳定的 SVG data-uri', () => {
    expect(() =>
      renderToString(
        <Watermark content="CONFIDENTIAL">
          <span>正文</span>
        </Watermark>
      )
    ).not.toThrow();
    const html = renderToString(<Watermark content="CONFIDENTIAL">正文</Watermark>);
    expect(html).toContain('z-watermark');
    expect(html).toContain('data:image/svg+xml');
  });
});
