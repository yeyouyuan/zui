import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Collapse } from './Collapse';

afterEach(cleanup);

const ITEMS = [
  { key: 'a', label: '标题一', children: <p>内容一</p> },
  { key: 'b', label: '标题二', children: <p>内容二</p> },
  { key: 'c', label: '标题三', children: <p>内容三</p>, disabled: true },
];

function getHeader(label: string): HTMLElement {
  return screen.getByRole('button', { name: label });
}

describe('Collapse', () => {
  it('renders items with headers collapsed by default', () => {
    render(<Collapse items={ITEMS} />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-collapse');
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(getHeader('标题一')).toHaveAttribute('aria-expanded', 'false');
    expect(getHeader('标题一')).toHaveAttribute('data-part', 'header');
    expect(document.querySelectorAll('[data-part="item"]')).toHaveLength(3);
    expect(screen.getByText('内容一')).toBeInTheDocument();
  });

  it('header links to content via aria-controls / aria-labelledby', () => {
    render(<Collapse items={ITEMS} />);
    const header = getHeader('标题一');
    const contentId = header.getAttribute('aria-controls');
    expect(contentId).toBeTruthy();
    const content = document.getElementById(contentId as string) as HTMLElement;
    expect(content).toHaveAttribute('data-part', 'content');
    expect(content).toHaveAttribute('aria-labelledby', header.id);
    expect(content).toHaveAttribute('role', 'region');
  });

  it('uncontrolled: click toggles expand and fires onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Collapse items={ITEMS} onChange={onChange} />);
    await user.click(getHeader('标题一'));
    expect(onChange).toHaveBeenLastCalledWith(['a']);
    expect(getHeader('标题一')).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('[data-part="content"]')).toHaveAttribute('data-expanded', 'true');
    await user.click(getHeader('标题一'));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(getHeader('标题一')).toHaveAttribute('aria-expanded', 'false');
  });

  it('defaultValue opens initial panels (multi-open)', () => {
    render(<Collapse items={ITEMS} defaultValue={['a', 'b']} />);
    expect(getHeader('标题一')).toHaveAttribute('aria-expanded', 'true');
    expect(getHeader('标题二')).toHaveAttribute('aria-expanded', 'true');
    expect(getHeader('标题三')).toHaveAttribute('aria-expanded', 'false');
  });

  it('controlled: reflects value prop and does not toggle internally', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Collapse items={ITEMS} value={['a']} onChange={onChange} />);
    expect(getHeader('标题一')).toHaveAttribute('aria-expanded', 'true');
    await user.click(getHeader('标题二'));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    // 受控：值未回流前保持原状
    expect(getHeader('标题二')).toHaveAttribute('aria-expanded', 'false');
    rerender(<Collapse items={ITEMS} value={['a', 'b']} onChange={onChange} />);
    expect(getHeader('标题二')).toHaveAttribute('aria-expanded', 'true');
  });

  it('accordion: opening another panel closes the current one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Collapse items={ITEMS} defaultValue={['a']} accordion onChange={onChange} />);
    await user.click(getHeader('标题二'));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
    expect(getHeader('标题一')).toHaveAttribute('aria-expanded', 'false');
    expect(getHeader('标题二')).toHaveAttribute('aria-expanded', 'true');
  });

  it('accordion: clicking the open panel closes it (empty keys)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Collapse items={ITEMS} defaultValue={['a']} accordion onChange={onChange} />);
    await user.click(getHeader('标题一'));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(getHeader('标题一')).toHaveAttribute('aria-expanded', 'false');
  });

  it('disabled item: aria-disabled and click is ignored', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Collapse items={ITEMS} onChange={onChange} />);
    const header = getHeader('标题三');
    expect(header).toHaveAttribute('aria-disabled', 'true');
    await user.click(header);
    expect(onChange).not.toHaveBeenCalled();
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('keyboard: Enter/Space activate header (native button)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Collapse items={ITEMS} onChange={onChange} />);
    getHeader('标题二').focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['b']);
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('passes className and classNames to parts; data-accordion on root', () => {
    render(
      <Collapse
        items={ITEMS}
        accordion
        className="my-root"
        classNames={{ root: 'c-root', item: 'c-item', header: 'c-header', content: 'c-content' }}
      />
    );
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-collapse', 'my-root', 'c-root');
    expect(root).toHaveAttribute('data-accordion', 'true');
    expect(document.querySelector('[data-part="item"]')).toHaveClass('z-collapse-item', 'c-item');
    expect(getHeader('标题一')).toHaveClass('z-collapse-header', 'c-header');
    expect(document.querySelector('[data-part="content"]')).toHaveClass('z-collapse-content', 'c-content');
  });
});
