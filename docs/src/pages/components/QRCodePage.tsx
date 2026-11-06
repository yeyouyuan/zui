import { QRCode } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<QRCode value="https://zui.dev" />
<QRCode value="1234567" />`;

const SIZE_LEVEL_CODE = `<QRCode value="https://zui.dev" size={96} level="L" />
<QRCode value="https://zui.dev" size={160} level="M" />
<QRCode value="https://zui.dev" size={224} level="H" />`;

const COLOR_CODE = `<QRCode value="https://zui.dev" color="#0f62fe" bgColor="#eef4ff" />
<QRCode value="https://zui.dev" color="white" bgColor="#111827" />`;

export default function QRCodePage(): React.ReactNode {
  usePageTitle('QRCode 二维码');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">QRCode 二维码</h1>
      <p className="doc-lead">
        自研纯 TS QR 编码器（不引第三方库），渲染 SVG 矩阵。支持数字 / 字母数字 / UTF-8
        字节模式与 L/M/Q/H 纠错，自动选择最小可容纳版本（Model 2，版本 1-10）。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="基础用法" description="传入 value 即可生成；role=img + aria-label 携带内容，便于读屏。" code={BASIC_CODE}>
        <div className="doc-pg-preview-row">
          <QRCode value="https://zui.dev" />
          <QRCode value="1234567" />
        </div>
      </Demo>

      <Demo
        title="尺寸与纠错级别"
        description="size 控制边长（默认 160）；level 越高可修复的损伤越多，矩阵也更密。"
        code={SIZE_LEVEL_CODE}
      >
        <div className="doc-pg-preview-row">
          <QRCode value="https://zui.dev" size={96} level="L" />
          <QRCode value="https://zui.dev" size={160} level="M" />
          <QRCode value="https://zui.dev" size={224} level="H" />
        </div>
      </Demo>

      <Demo
        title="自定义颜色"
        description="color / bgColor 覆盖前景与背景；请保持足够对比度以便扫码。"
        code={COLOR_CODE}
      >
        <div className="doc-pg-preview-row">
          <QRCode value="https://zui.dev" color="#0f62fe" bgColor="#eef4ff" />
          <QRCode value="https://zui.dev" color="white" bgColor="#111827" />
        </div>
      </Demo>

      <h2 className="doc-h2">支持范围</h2>
      <p className="doc-p">
        自研最简实现：模式为数字、字母数字（大写字母 + 数字 + 空格 +{' '}
        <code className="doc-code-inline">$%*+-./:</code>）与 UTF-8 字节（中文、任意文本）；
        版本 Model 2 <strong>1-10</strong>，纠错 L/M/Q/H（Reed-Solomon + 标准分块交错）；
        含 4 模块静区（扫码器定位依赖，请勿裁切）。内容超出版本 10 容量时渲染空白占位（不抛错）。
        不支持 ECI、结构化附加与 Micro QR。
      </p>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'string',
            description: '二维码内容（必填）。',
          },
          {
            name: 'size',
            type: 'number',
            defaultValue: '160',
            description: '边长 px。',
          },
          {
            name: 'level',
            type: "'L' | 'M' | 'Q' | 'H'",
            defaultValue: "'M'",
            description: '纠错级别。',
          },
          {
            name: 'color',
            type: 'string',
            defaultValue: 'var(--z-color-fg)',
            description: '前景色（模块）。',
          },
          {
            name: 'bgColor',
            type: 'string',
            defaultValue: 'var(--z-color-bg)',
            description: '背景色。',
          },
          {
            name: 'classNames',
            type: '{ root?; bg?; modules? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'svg'>",
            description: "原生 svg 属性透传到根元素（className、style、aria-* 等；'value'/'color'/'width'/'height' 除外）。",
          },
        ]}
      />

      <CustomizeOutlet
        name="QRCode"
        parts={['root', 'bg', 'modules']}
        vars={['--z-qrcode-fg', '--z-qrcode-bg']}
      />
    </div>
  );
}
