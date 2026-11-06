import { Progress } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Progress percent={30} />
<Progress percent={60} />`;

const SIZE_CODE = `<Progress percent={45} size="sm" />
<Progress percent={45} size="md" />`;

const STATUS_CODE = `<Progress percent={40} status="normal" />
<Progress percent={65} status="active" />
<Progress percent={100} status="success" />
<Progress percent={35} status="error" />`;

const CUSTOM_CODE = `<Progress percent={72} showInfo={false} />
<Progress percent={72} color="rebeccapurple" />`;

export default function ProgressPage(): React.ReactNode {
  usePageTitle('Progress 进度条');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Progress 进度条</h1>
      <p className="doc-lead">
        圆角轨道 + 语义状态填充的进度条：role="progressbar" 无障碍标注、宽度 300ms 平滑过渡，
        支持 normal / active / success / error 四种状态。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="基础用法" description="percent 为 0-100 必填值，右侧默认显示百分比文字。" code={BASIC_CODE} stack>
        <Progress percent={30} />
        <Progress percent={60} />
      </Demo>

      <Demo
        title="尺寸"
        description="size 提供 sm（6px 高）/ md（8px 高）两档，默认 md。"
        code={SIZE_CODE}
        stack
      >
        <Progress percent={45} size="sm" />
        <Progress percent={45} size="md" />
      </Demo>

      <Demo
        title="状态"
        description="status 控制填充语义色：normal 蓝 / active 流动光 / success 绿 / error 红。"
        code={STATUS_CODE}
        stack
      >
        <Progress percent={40} status="normal" />
        <Progress percent={65} status="active" />
        <Progress percent={100} status="success" />
        <Progress percent={35} status="error" />
      </Demo>

      <Demo
        title="自定义"
        description="showInfo 隐藏百分比文字；color 覆盖填充色变量。"
        code={CUSTOM_CODE}
        stack
      >
        <Progress percent={72} showInfo={false} />
        <Progress percent={72} color="rebeccapurple" />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'percent',
            type: 'number',
            description: '进度百分比 0-100（必填，越界自动夹取）。',
          },
          {
            name: 'size',
            type: "'sm' | 'md'",
            defaultValue: "'md'",
            description: '进度条高度档位。',
          },
          {
            name: 'status',
            type: "'normal' | 'active' | 'success' | 'error'",
            defaultValue: "'normal'",
            description: '语义状态（active 带流动光效果）。',
          },
          {
            name: 'showInfo',
            type: 'boolean',
            defaultValue: 'true',
            description: '是否显示右侧百分比文字。',
          },
          {
            name: 'color',
            type: 'string',
            description: '自定义填充色（覆盖 --z-progress-color）。',
          },
          {
            name: 'classNames',
            type: '{ root?; track?; fill?; info? }',
            description: 'slot 级类名追加（root / track / fill / info）。',
          },
        ]}
      />
      <p className="doc-p">
        无障碍：填充元素带 <code className="doc-code-inline">role="progressbar"</code>、
        <code className="doc-code-inline">aria-valuenow / aria-valuemin / aria-valuemax</code>。
      </p>

      <CustomizeOutlet
        name="Progress"
        parts={['root', 'track', 'fill', 'info']}
        vars={[
          '--z-progress-height',
          '--z-progress-radius',
          '--z-progress-track-bg',
          '--z-progress-color',
          '--z-progress-info-gap',
          '--z-progress-info-font-size',
          '--z-progress-info-color',
          '--z-progress-transition',
        ]}
      />
    </div>
  );
}
