import { renderToStaticMarkup } from 'react-dom/server';
import uiStyles from '@zui/react/styles.css?inline';
import contentStyles from './builder-content.css?inline';
import { BuilderDocument } from './BuilderDocument';
import runtime from 'virtual:zui-builder-runtime';
import { validateBuilderData, type BuilderData } from './builder-model';
import { validatePrototype, type BuilderPrototypeData } from './BuilderPrototype';

const escapeAttribute = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );

export function exportBuilderHtml(input: BuilderData, fallbackTitle: string): string {
  const data = validateBuilderData(input);
  const title = data.root.props?.title || fallbackTitle;
  const description = data.root.props?.description || '';
  const theme = data.root.props?.theme === 'dark' ? 'dark' : 'light';
  const markup = renderToStaticMarkup(<BuilderDocument data={data} />);
  const css = `${uiStyles}\n${contentStyles}\nhtml,body{margin:0;min-height:100%;background:var(--z-color-bg);color:var(--z-color-fg);} main{min-height:100vh;}`;
  const payload = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<!doctype html>\n<html lang="zh-CN" data-theme="${theme}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeAttribute(title)}</title><meta name="description" content="${escapeAttribute(description)}"><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><main id="zui-page-root">${markup}</main><script id="zui-page-data" type="application/json">${payload}</script><script>${runtime.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}

export function exportBuilderPrototypeHtml(input: BuilderPrototypeData): string {
  const prototype = validatePrototype(input);
  const first = prototype.pages.find((page) => page.id === prototype.startId)!;
  const html = exportBuilderHtml(first.data, `${first.name} · 交互原型`);
  const payload = JSON.stringify(prototype)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return html.replace(
    /(<script id="zui-page-data" type="application\/json">)[\s\S]*?(<\/script>)/,
    () => `<script id="zui-page-data" type="application/json">${payload}</script>`
  );
}
