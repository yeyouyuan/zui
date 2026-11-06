import { Watermark } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const CARD_STYLE: React.CSSProperties = {
  padding: 24,
  border: '1px solid var(--z-color-border)',
  borderRadius: 8,
};

const BASIC_CODE = `<Watermark content="ZUI 机密">
  <div style={{ padding: 24 }}>
    <h3>受保护的内容</h3>
    <p>水印覆盖在内容之上，pointer-events: none 不阻挡交互。</p>
  </div>
</Watermark>`;

const CONFIG_CODE = `<Watermark content={['内部资料', '请勿外传']} rotate={-22} gap={[100, 100]}>
  <div style={{ padding: 24 }}>多行水印文本</div>
</Watermark>

<Watermark content="自定义间距" rotate={0} gap={[200, 80]}>
  <div style={{ padding: 24 }}>更大间距、水平水印</div>
</Watermark>`;

const IMAGE_CODE = `<Watermark image="data:image/svg+xml,..." rotate={-22}>
  <div style={{ padding: 24 }}>图片水印（data-uri）</div>
</Watermark>`;

export default function WatermarkPage(): React.ReactNode {
  usePageTitle('Watermark 水印');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Watermark 水印</h1>
      <p className="doc-lead">水印组件，为内容区域叠加半透明防伪水印。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="content 平铺绘制文本水印；覆盖层 absolute + pointer-events:none，不阻挡内容交互。"
        code={BASIC_CODE}
      >
        <Watermark content="ZUI 机密">
          <div style={CARD_STYLE}>
            <h3>受保护的内容</h3>
            <p>水印覆盖在内容之上，pointer-events: none 不阻挡交互。</p>
          </div>
        </Watermark>
      </Demo>

      <Demo title="旋转与间距" description="rotate 控制旋转角度（默认 -22 度）；gap 控制平铺间距 [x, y]（默认 [100, 100]）。" code={CONFIG_CODE} stack>
        <Watermark content={['内部资料', '请勿外传']} rotate={-22} gap={[100, 100]}>
          <div style={CARD_STYLE}>多行水印文本</div>
        </Watermark>
        <Watermark content="自定义间距" rotate={0} gap={[200, 80]}>
          <div style={CARD_STYLE}>更大间距、水平水印</div>
        </Watermark>
      </Demo>

      <Demo title="图片水印" description="image 传 data-uri / base64 作为水印图案（优先于 content）。" code={IMAGE_CODE}>
        <Watermark image="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Ctext x='10' y='35' font-size='16' fill='%23000' fill-opacity='0.25'%3EZUI%3C/text%3E%3C/svg%3E">
          <div style={CARD_STYLE}>图片水印（data-uri）</div>
        </Watermark>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'content',
            type: 'React.ReactNode | React.ReactNode[]',
            description: '文本水印内容（字符串/数字会平铺绘制）。',
          },
          {
            name: 'image',
            type: 'string',
            description: '图片水印（data-uri/base64，优先于 content）。',
          },
          {
            name: 'rotate',
            type: 'number',
            defaultValue: '-22',
            description: '旋转角度（deg）。',
          },
          {
            name: 'gap',
            type: '[number, number]',
            defaultValue: '[100, 100]',
            description: '平铺间距 [x, y]。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '被水印覆盖的内容。',
          },
          {
            name: 'classNames',
            type: '{ root?; overlay? }',
            description: 'slot 级类名追加（root / overlay）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Watermark"
        parts={['root', 'overlay']}
        vars={['--z-watermark-overlay-bg-repeat', '--z-watermark-overlay-z']}
      />
    </div>
  );
}
