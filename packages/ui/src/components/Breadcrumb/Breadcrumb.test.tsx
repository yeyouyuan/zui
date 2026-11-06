import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Breadcrumb } from './Breadcrumb';

afterEach(cleanup);

function getNav(): HTMLElement {
  return screen.getByRole('navigation', { name: '面包屑' });
}

function renderBasic() {
  return render(
    <Breadcrumb>
      <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
      <Breadcrumb.Item href="/components">组件</Breadcrumb.Item>
      <Breadcrumb.Item>分页</Breadcrumb.Item>
    </Breadcrumb>
  );
}

describe('Breadcrumb', () => {
  it('渲染默认态：nav + ol/li 语义列表', () => {
    const { container } = renderBasic();
    const nav = getNav();
    expect(nav.tagName).toBe('NAV');
    expect(nav).toHaveAttribute('data-part', 'root');
    expect(nav).toHaveClass('z-breadcrumb');

    const ol = nav.querySelector('ol');
    expect(ol).not.toBeNull();
    expect(screen.getByRole('list')).toBe(ol);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(nav.querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelectorAll('li > *')).toHaveLength(3 + 2); // 3 项 + 2 分隔符
  });

  it('分隔符默认 "/"：z-breadcrumb-separator + aria-hidden，末项后无分隔符', () => {
    renderBasic();
    const separators = getNav().querySelectorAll('[data-part="separator"]');
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator).toHaveClass('z-breadcrumb-separator');
      expect(separator).toHaveAttribute('aria-hidden', 'true');
      expect(separator.textContent).toBe('/');
    }
  });

  it('最后一项 aria-current="page"，其余项无', () => {
    renderBasic();
    expect(screen.getByText('分页')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('首页')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('组件')).not.toHaveAttribute('aria-current');
  });

  it('href 渲染 a，无 href 渲染 span；item 带 data-part 与类名', () => {
    renderBasic();
    const home = screen.getByText('首页');
    const components = screen.getByText('组件');
    const current = screen.getByText('分页');

    expect(home.tagName).toBe('A');
    expect(home).toHaveAttribute('href', '/');
    expect(components.tagName).toBe('A');
    expect(components).toHaveAttribute('href', '/components');
    expect(current.tagName).toBe('SPAN');

    for (const item of [home, components, current]) {
      expect(item).toHaveAttribute('data-part', 'item');
      expect(item).toHaveClass('z-breadcrumb-item');
    }
  });

  it('自定义 separator prop', () => {
    render(
      <Breadcrumb separator="›">
        <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
        <Breadcrumb.Item>当前</Breadcrumb.Item>
      </Breadcrumb>
    );
    const separators = getNav().querySelectorAll('[data-part="separator"]');
    expect(separators).toHaveLength(1);
    expect(separators[0].textContent).toBe('›');
  });

  it('单项面包屑：无分隔符，末项 aria-current', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item>仅此一项</Breadcrumb.Item>
      </Breadcrumb>
    );
    expect(getNav().querySelectorAll('[data-part="separator"]')).toHaveLength(0);
    expect(screen.getByText('仅此一项')).toHaveAttribute('aria-current', 'page');
  });

  it('classNames / className 透传（root / item / separator）', () => {
    render(
      <Breadcrumb
        className="my-root"
        classNames={{ root: 'cls-root', item: 'cls-item', separator: 'cls-sep' }}
      >
        <Breadcrumb.Item href="/" className="my-item">
          首页
        </Breadcrumb.Item>
        <Breadcrumb.Item>当前</Breadcrumb.Item>
      </Breadcrumb>
    );
    const nav = getNav();
    expect(nav).toHaveClass('z-breadcrumb', 'my-root', 'cls-root');
    expect(screen.getByText('首页')).toHaveClass('z-breadcrumb-item', 'my-item', 'cls-item');
    expect(screen.getByText('当前')).toHaveClass('z-breadcrumb-item', 'cls-item');
    expect(nav.querySelector('[data-part="separator"]')).toHaveClass(
      'z-breadcrumb-separator',
      'cls-sep'
    );
  });

  it('原生属性透传到 nav，ref 转发到 nav 元素', () => {
    const ref = React.createRef<HTMLElement>();
    render(
      <Breadcrumb ref={ref} id="bc" data-testid="bc" aria-describedby="bc-desc">
        <Breadcrumb.Item>当前</Breadcrumb.Item>
      </Breadcrumb>
    );
    const nav = getNav();
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(nav);
    expect(nav).toHaveAttribute('id', 'bc');
    expect(nav).toHaveAttribute('data-testid', 'bc');
    expect(nav).toHaveAttribute('aria-describedby', 'bc-desc');
  });

  it('Breadcrumb.Item ref 转发（a 与 span 两种形态）', () => {
    const linkRef = React.createRef<HTMLAnchorElement>();
    const textRef = React.createRef<HTMLSpanElement>();
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/" ref={linkRef}>
          首页
        </Breadcrumb.Item>
        <Breadcrumb.Item ref={textRef}>
          当前
        </Breadcrumb.Item>
      </Breadcrumb>
    );
    expect(linkRef.current).toBeInstanceOf(HTMLAnchorElement);
    expect(linkRef.current?.getAttribute('href')).toBe('/');
    expect(textRef.current).toBeInstanceOf(HTMLSpanElement);
    expect(textRef.current?.textContent).toBe('当前');
  });

  it('链接项可键盘聚焦并用 Enter 激活', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="#/components" onClick={onClick}>
          组件
        </Breadcrumb.Item>
        <Breadcrumb.Item>当前</Breadcrumb.Item>
      </Breadcrumb>
    );
    await user.tab();
    expect(screen.getByText('组件')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('末项为纯文本子节点时不崩溃', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
        当前页
      </Breadcrumb>
    );
    expect(screen.getByText('当前页')).toBeInTheDocument();
    expect(getNav().querySelectorAll('li')).toHaveLength(2);
    expect(getNav().querySelectorAll('[data-part="separator"]')).toHaveLength(1);
  });
});
