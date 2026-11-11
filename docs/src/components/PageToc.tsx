import { useEffect, useState } from 'react';

interface PageTocProps {
  /** 当前页面容器 ref（读取其中 h2/h3 生成 TOC） */
  containerRef?: React.RefObject<HTMLElement | null>;
}

/** TOC 条目：heading 的 id / 文本 / 层级 */
interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

const HEADING_SELECTOR = 'h2.doc-h2, h3.doc-h3';

/** 标题文本 → 片段可用 slug：空白折叠为 '-'，去掉对锚点无意义的符号（CJK 原样保留，HTML5/URL 均合法） */
function slugify(text: string): string {
  const slug = text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[#"'`<>{}|\\^[\]%]+/g, '');
  return slug === '' ? 'section' : slug;
}

/** 扫描容器内标题，缺 id 的自动补 slug（重复自动加序号），返回文档序条目列表 */
function collectHeadings(root: HTMLElement): TocItem[] {
  const headings = root.querySelectorAll<HTMLHeadingElement>(HEADING_SELECTOR);
  const headingSet = new Set<Element>(headings);
  const used = new Set(
    Array.from(root.querySelectorAll<HTMLElement>('[id]'))
      .filter((element) => !headingSet.has(element))
      .map((element) => element.id)
  );
  const items: TocItem[] = [];
  headings.forEach((heading) => {
    const text = (heading.textContent ?? '').trim();
    if (!text) return;
    const base = heading.id || slugify(text);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    heading.id = id;
    used.add(id);
    items.push({ id, text, level: heading.tagName === 'H2' ? 2 : 3 });
  });
  return items;
}

function sameItems(a: TocItem[], b: TocItem[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, i) => item.id === b[i].id && item.text === b[i].text && item.level === b[i].level
    )
  );
}

/**
 * 页内目录：扫描 .doc-main（或 containerRef 指向的容器）内 h2.doc-h2 / h3.doc-h3，
 * 在宽屏右侧、800–1099px 顶部折叠入口渲染目录，并在滚动时高亮当前区块。
 * - MutationObserver：懒加载换页 / DOM 变化后自动重扫（rAF 合帧，避免扫屏）
 * - IntersectionObserver：取最接近视口顶部的可见标题为 active
 * 点击仅平滑滚动：hash 已被路由（#/components/...）占用，不能写 location.hash。
 */
export default function PageToc({ containerRef }: PageTocProps): React.ReactNode {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [compactOpen, setCompactOpen] = useState(false);

  useEffect(() => {
    const rootEl = containerRef?.current ?? document.querySelector<HTMLElement>('.doc-main');
    if (!rootEl) return undefined;

    // 当前落在观察带内的标题集合；回调里实时读位置，避免用回调时刻的缓存 rect
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        let best: Element | null = null;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const el of visible) {
          const top = el.getBoundingClientRect().top;
          if (top < bestTop) {
            bestTop = top;
            best = el;
          }
        }
        if (best?.id) setActiveId(best.id);
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );

    const scan = () => {
      io.disconnect();
      visible.clear();
      const next = collectHeadings(rootEl);
      setItems((prev) => (sameItems(prev, next) ? prev : next));
      // 重扫后当前 active 不在新列表里则清掉；IO 对每个 observe 都会补发一次初始回调，随即恢复
      setActiveId((prev) => (prev !== null && next.some((item) => item.id === prev) ? prev : null));
      rootEl.querySelectorAll<HTMLElement>(HEADING_SELECTOR).forEach((el) => {
        if (el.id) io.observe(el);
      });
    };

    // rAF 合并同一帧内的多次 DOM 变更（Suspense 换页 / 页面内局部重渲染）
    let raf = 0;
    const scheduleScan = () => {
      if (raf !== 0) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        scan();
      });
    };

    scan();
    const mo = new MutationObserver(scheduleScan);
    mo.observe(rootEl, { childList: true, characterData: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(raf);
      raf = 0;
      mo.disconnect();
      io.disconnect();
      visible.clear();
    };
  }, [containerRef]);

  // 只有 0/1 个标题时目录没有导航价值，不渲染
  if (items.length <= 1) return null;

  const links = items.map((item) => {
    const active = item.id === activeId;
    const className = [
      'doc-toc-link',
      item.level === 3 ? 'doc-toc-link--sub' : '',
      active ? 'doc-toc-link--active' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        type="button"
        key={item.id}
        className={className}
        aria-current={active ? 'location' : undefined}
        aria-controls={item.id}
        onClick={() => {
          setActiveId(item.id);
          setCompactOpen(false);
          document.getElementById(item.id)?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
            block: 'start',
          });
        }}
      >
        {item.text}
      </button>
    );
  });

  return (
    <nav
      className="doc-toc"
      aria-label="页内导航"
      data-compact-open={compactOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        className="doc-toc-compact-trigger"
        aria-expanded={compactOpen}
        onClick={() => setCompactOpen((open) => !open)}
      >
        <span>本页内容</span>
        <span aria-hidden="true">⌄</span>
      </button>
      <div className="doc-toc-title" aria-hidden="true">
        本页内容
      </div>
      <div className="doc-toc-list">
        {links}
      </div>
    </nav>
  );
}
