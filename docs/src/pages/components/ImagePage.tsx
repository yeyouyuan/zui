import { Image } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Image
  src="https://picsum.photos/320/200"
  alt="示例图片"
  width={320}
  height={200}
/>`;

const FALLBACK_CODE = `<Image
  src="https://invalid.example/missing.png"
  fallback="https://picsum.photos/320/200?fallback"
  alt="加载失败回退"
  width={320}
  height={200}
/>`;

const PREVIEW_CODE = `<Image
  src="https://picsum.photos/320/200"
  alt="点击预览大图"
  width={320}
  height={200}
  preview
/>
<Image
  src="https://picsum.photos/320/200"
  alt="禁用预览"
  width={160}
  height={100}
  preview={false}
/>`;

export default function ImagePage(): React.ReactNode {
  usePageTitle('Image 图片');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Image 图片</h1>
      <p className="doc-lead">图片组件，支持加载失败兜底与点击全屏预览。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="基础用法" description="传入 src 与 alt，width/height 控制占位尺寸。" code={BASIC_CODE}>
        <Image src="https://picsum.photos/320/200" alt="示例图片" width={320} height={200} />
      </Demo>

      <Demo
        title="失败兜底"
        description="加载失败时自动切换到 fallback 图片，避免破图占位。"
        code={FALLBACK_CODE}
      >
        <Image
          src="https://invalid.example/missing.png"
          fallback="https://picsum.photos/320/200?fallback"
          alt="加载失败回退"
          width={320}
          height={200}
        />
      </Demo>

      <Demo title="点击预览" description="preview 默认 true，点击打开全屏遮罩大图（Esc/点击关闭）；preview={false} 禁用。" code={PREVIEW_CODE}>
        <div className="doc-pg-preview-row">
          <Image
            src="https://picsum.photos/320/200"
            alt="点击预览大图"
            width={320}
            height={200}
            preview
          />
          <Image
            src="https://picsum.photos/320/200"
            alt="禁用预览"
            width={160}
            height={100}
            preview={false}
          />
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'src',
            type: 'string',
            description: '图片地址。',
          },
          {
            name: 'width',
            type: 'number | string',
            description: '宽度。',
          },
          {
            name: 'height',
            type: 'number | string',
            description: '高度。',
          },
          {
            name: 'fallback',
            type: 'string',
            description: '加载失败兜底图。',
          },
          {
            name: 'preview',
            type: 'boolean',
            defaultValue: 'true',
            description: '点击预览大图。',
          },
          {
            name: 'alt',
            type: 'string',
            defaultValue: "''",
            description: '替代文本。',
          },
          {
            name: 'classNames',
            type: '{ root?; image?; preview? }',
            description: 'slot 级类名追加（root / image / preview）。',
          },
          {
            name: '...rest',
            type: "Omit<React.ComponentPropsWithRef<'img'>, 'onError'>",
            description: "原生 img 属性透传（onError 除外，用于 fallback 逻辑）。",
          },
        ]}
      />

      <CustomizeOutlet
        name="Image"
        parts={['root', 'image', 'preview']}
        vars={[
          '--z-image-radius',
          '--z-image-object-fit',
          '--z-image-cursor',
          '--z-image-preview-bg',
          '--z-image-preview-img-shadow',
          '--z-image-preview-close-size',
          '--z-image-preview-close-bg',
          '--z-image-preview-close-fg',
        ]}
      />
    </div>
  );
}
