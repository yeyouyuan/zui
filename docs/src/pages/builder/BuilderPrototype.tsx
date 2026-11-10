import { useEffect, useState } from 'react';
import { BuilderDocument } from './BuilderDocument';
import { validateBuilderData, type BuilderData } from './builder-model';
export interface BuilderPrototypeData {
  format: 'zui-prototype';
  version: 1;
  startId: string;
  pages: { id: string; name: string; data: BuilderData }[];
}
export function validatePrototype(input: unknown): BuilderPrototypeData {
  const source = input as BuilderPrototypeData;
  if (
    !source ||
    source.format !== 'zui-prototype' ||
    source.version !== 1 ||
    !Array.isArray(source.pages) ||
    !source.pages.length ||
    source.pages.length > 20
  )
    throw new Error('多页面原型格式错误，最多 20 页。');
  const ids = new Set<string>();
  const pages = source.pages.map((page) => {
    if (
      !page ||
      typeof page.id !== 'string' ||
      !/^[\w-]{1,150}$/.test(page.id) ||
      ids.has(page.id) ||
      typeof page.name !== 'string' ||
      page.name.length > 80
    )
      throw new Error('原型页面标识或名称无效。');
    ids.add(page.id);
    return { id: page.id, name: page.name, data: validateBuilderData(page.data) };
  });
  if (!ids.has(source.startId)) throw new Error('原型首页不存在。');
  return { format: 'zui-prototype', version: 1, pages, startId: source.startId };
}
export function BuilderPrototype({ prototype }: { prototype: BuilderPrototypeData }) {
  const readRoute = () =>
    typeof location !== 'undefined' && location.hash.startsWith('#/page/')
      ? location.hash.slice(7)
      : prototype.startId;
  const [id, setId] = useState(readRoute);
  const page = prototype.pages.find((item) => item.id === id);
  useEffect(() => {
    const route = () => setId(readRoute());
    window.addEventListener('hashchange', route);
    return () => window.removeEventListener('hashchange', route);
    // The prototype is an immutable export; only its route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (page) document.title = page.data.root.props?.title || page.name;
  }, [page]);
  const navigate = (next: string) => {
    if (!prototype.pages.some((item) => item.id === next)) return false;
    window.location.hash = `/page/${next}`;
    setId(next);
    window.scrollTo({ top: 0 });
    return true;
  };
  return (
    <>
      <nav className="z-builder-prototype-nav" aria-label="原型页面">
        <strong>
          ZUI <span>交互原型</span>
        </strong>
        <select
          aria-label="当前原型页面"
          value={id}
          onChange={(event) => navigate(event.target.value)}
        >
          {!page && <option value={id}>页面不存在</option>}
          {prototype.pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.name}
            </option>
          ))}
        </select>
        <span>{prototype.pages.length} 个页面</span>
      </nav>
      {page ? (
        <BuilderDocument key={page.id} data={page.data} navigate={navigate} />
      ) : (
        <section className="z-builder-prototype-empty">
          <h1>页面不存在</h1>
          <p>这个链接所指向的页面不在当前原型中。</p>
          <button type="button" onClick={() => navigate(prototype.startId)}>
            回到首页
          </button>
        </section>
      )}
    </>
  );
}
