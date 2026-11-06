import { Badge, Button } from '@zui/react';
import { useState } from 'react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const WRAP_CODE = `<Badge count={5}>
  <Button>消息</Button>
</Badge>
<Badge count={120}>
  <Button>订单</Button>
</Badge>
<Badge dot>
  <Button>动态</Button>
</Badge>`;

const STANDALONE_CODE = `<Badge count={8} />
<Badge count={120} max={99} />
<Badge count={0} showZero />
<Badge dot />`;

const COLOR_CODE = `<Badge count={5} color="primary"><Button>主色</Button></Badge>
<Badge count={5} color="success"><Button>成功</Button></Badge>
<Badge count={5} color="warning"><Button>警告</Button></Badge>
<Badge count={5} color="error"><Button>危险</Button></Badge>
<Badge count={5} color="neutral"><Button>中性</Button></Badge>`;

const MAX_CODE = `const [count, setCount] = useState(0);

<Badge count={count}>
  <Button onClick={() => setCount(count + 1)}>点击 +1（当前 {count}）</Button>
</Badge>`;

export default function BadgePage(): React.ReactNode {
  usePageTitle('Badge 徽标');
  const [count, setCount] = useState(0);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Badge 徽标</h1>
      <p className="doc-lead">
        数字 / 圆点角标：包裹子元素时定位在右上角，无子元素时独立展示；支持 max 溢出折叠（默认
        99+）、dot 小圆点与 5 种语义颜色。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="包裹型角标"
        description="有 children 时 root 为相对定位锚点，角标绝对定位右上角；count=0 默认隐藏，dot 显示小圆点。"
        code={WRAP_CODE}
      >
        <div className="doc-pg-preview-row">
          <Badge count={5}>
            <Button>消息</Button>
          </Badge>
          <Badge count={120}>
            <Button>订单</Button>
          </Badge>
          <Badge dot>
            <Button>动态</Button>
          </Badge>
        </div>
      </Demo>

      <Demo
        title="独立数字"
        description="无 children 时直接渲染独立徽标；showZero 让 0 也显示；dot 模式为 8px 圆点。"
        code={STANDALONE_CODE}
      >
        <div className="doc-pg-preview-row">
          <Badge count={8} />
          <Badge count={120} max={99} />
          <Badge count={0} showZero />
          <Badge dot />
        </div>
      </Demo>

      <Demo
        title="颜色"
        description="color 提供 primary / success / warning / error / neutral，默认 error（红底白字）。"
        code={COLOR_CODE}
      >
        <div className="doc-pg-preview-row">
          <Badge count={5} color="primary">
            <Button variant="secondary">主色</Button>
          </Badge>
          <Badge count={5} color="success">
            <Button variant="secondary">成功</Button>
          </Badge>
          <Badge count={5} color="warning">
            <Button variant="secondary">警告</Button>
          </Badge>
          <Badge count={5} color="error">
            <Button variant="secondary">危险</Button>
          </Badge>
          <Badge count={5} color="neutral">
            <Button variant="secondary">中性</Button>
          </Badge>
        </div>
      </Demo>

      <Demo
        title="溢出折叠"
        description="count 超过 max 时显示 ${max}+，max 默认 99。"
        code={MAX_CODE}
      >
        <Badge count={count}>
          <Button onClick={() => setCount(count + 1)}>点击 +1（当前 {count}）</Button>
        </Badge>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'count',
            type: 'number',
            defaultValue: '0',
            description: '数字；0 时默认隐藏（showZero=false）。',
          },
          {
            name: 'dot',
            type: 'boolean',
            defaultValue: 'false',
            description: '小圆点模式（8px），不显示数字。',
          },
          {
            name: 'max',
            type: 'number',
            defaultValue: '99',
            description: 'count 超出显示 ${max}+。',
          },
          {
            name: 'showZero',
            type: 'boolean',
            defaultValue: 'false',
            description: 'count=0 时是否仍显示徽标。',
          },
          {
            name: 'color',
            type: "'primary' | 'success' | 'warning' | 'error' | 'neutral'",
            defaultValue: "'error'",
            description: '语义颜色。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '有 children 时包裹并定位右上角角标；无则独立展示数字/圆点。',
          },
          {
            name: 'className',
            type: 'string',
            description: '附加到可见元素（包裹型 root / 独立型 indicator）。',
          },
          {
            name: 'classNames',
            type: '{ root?; indicator? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />
      <p className="doc-p">
        data 属性：<code className="doc-code-inline">data-color</code>、
        <code className="doc-code-inline">data-dot</code>（dot 模式）。
      </p>

      <CustomizeOutlet
        name="Badge"
        parts={['root', 'indicator']}
        vars={[
          '--z-badge-size',
          '--z-badge-padding-x',
          '--z-badge-font-size',
          '--z-badge-font-weight',
          '--z-badge-radius',
          '--z-badge-dot-size',
          '--z-badge-border-width',
          '--z-badge-bg',
          '--z-badge-fg',
          '--z-badge-border-color',
        ]}
      />
    </div>
  );
}
