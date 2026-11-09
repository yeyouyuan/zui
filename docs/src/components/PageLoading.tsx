/** 首次直达路由时的结构占位；切页由 deferred route 保留已加载内容。 */
export default function PageLoading(): React.ReactNode {
  return (
    <div className="doc-page doc-page-loading" role="status" aria-label="正在加载文档">
      <span className="doc-route-progress" aria-hidden="true" />
      <p className="doc-page-loading-label">正在准备页面…</p>
      <div className="doc-page-loading-title" aria-hidden="true" />
      <div className="doc-page-loading-line" aria-hidden="true" />
      <div className="doc-page-loading-line" aria-hidden="true" />
      <div className="doc-page-loading-demo" aria-hidden="true" />
      <div className="doc-page-loading-demo" aria-hidden="true" />
    </div>
  );
}
