import { useEffect, useState } from 'react';
import type { BuilderData } from './builder-model';

export function BuilderInteractivePreview({ data }: { data: BuilderData }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    import('./builder-export')
      .then(({ exportBuilderHtml }) => {
        const result = exportBuilderHtml(data, '交互预览');
        if (active) {
          setHtml(result);
          setError('');
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '预览无法载入。');
      });
    return () => {
      active = false;
    };
  }, [data]);
  if (error) return <p role="alert">{error}</p>;
  if (!html) return <p role="status">正在准备交互预览…</p>;
  return (
    <iframe
      id="builder-interactive-frame"
      title="页面交互预览"
      className="studio-live-preview"
      srcDoc={html}
      sandbox="allow-scripts allow-forms allow-downloads allow-popups"
    />
  );
}
