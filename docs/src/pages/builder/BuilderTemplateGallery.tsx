import { useState } from 'react';
import { Modal } from '@zui/react';
import { Eye, Plus } from '@zui/icons';
import { builderTemplates } from './builder-templates';
import { templateCategory } from './builder-scene-templates';
import { BuilderDocument } from './BuilderDocument';

export function BuilderTemplateGallery({ onCreate }: { onCreate: (id: string) => void }) {
  const [category, setCategory] = useState('全部场景'),
    [preview, setPreview] = useState<string | null>(null);
  const categories = [
    '全部场景',
    '业务系统',
    '数据分析',
    '内容展示',
    '品牌官网',
    '表单收集',
    '基础',
  ];
  const selected = builderTemplates.find((template) => template.id === preview);
  return (
    <>
      <p className="doc-builder-dialog-intro">
        选择适合当前目标的起点。每个模板都可以逐层修改、替换数据与调整三端样式，当前草稿继续保留。
      </p>
      <div className="studio-template-categories" role="group" aria-label="模板场景">
        {categories.map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="doc-builder-templates studio-template-gallery">
        {builderTemplates
          .filter(
            (template) => category === '全部场景' || templateCategory(template.id) === category
          )
          .map((template) => (
            <article className="studio-template-card" aria-label={template.name} key={template.id}>
              <div className="studio-template-thumbnail" aria-hidden="true" inert>
                <div>
                  <BuilderDocument data={template.data} designPreview />
                </div>
                {template.id === 'blank' && (
                  <span className="studio-template-blank">
                    <Plus />
                    自由创造，从这里开始
                  </span>
                )}
              </div>
              <div className="studio-template-card-info">
                <small>{template.label}</small>
                <strong>{template.name}</strong>
                <p>{template.description}</p>
                <div>
                  <button
                    type="button"
                    aria-label="放大预览"
                    onClick={() => setPreview(template.id)}
                  >
                    <Eye />
                    预览
                  </button>
                  <button
                    type="button"
                    aria-label={template.name}
                    onClick={() => onCreate(template.id)}
                  >
                    从这里开始 →
                  </button>
                </div>
              </div>
            </article>
          ))}
      </div>
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <Modal.Content size="lg" className="studio-template-preview-dialog">
          <Modal.Header>
            <Modal.Title>{selected?.name} · 模板预览</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            <p>{selected?.description}</p>
            <p className="studio-inspector-hint">
              这是模板的设计预览。使用模板后可以自由编辑，并进入交互预览操作数据与表单。
            </p>
            {selected && (
              <div className="studio-template-large-preview" inert>
                <BuilderDocument data={selected.data} designPreview />
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="studio-primary-action"
              onClick={() => {
                if (selected) onCreate(selected.id);
                setPreview(null);
              }}
            >
              使用此模板
            </button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </>
  );
}
