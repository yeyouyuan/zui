import { Statistic } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Statistic title="总销售额" value={1234567} />
<Statistic title="活跃用户" value={8848} suffix="人" />`;

const PRECISION_CODE = `<Statistic title="完成率" value={98.6} precision={1} suffix="%" />
<Statistic title="客单价" value={256} precision={2} prefix="¥" />`;

const STYLE_CODE = `<Statistic
  title="今日营收"
  value={123456}
  prefix="¥"
  valueStyle={{ color: 'var(--z-color-success)' }}
/>`;

const COUNTDOWN_CODE = `<Statistic.CountDown
  title="距活动结束"
  value={Date.now() + 2 * 60 * 60 * 1000}
  onFinish={() => console.log('活动已结束')}
/>`;

export default function StatisticPage(): React.ReactNode {
  usePageTitle('Statistic 统计数值');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Statistic 统计数值</h1>
      <p className="doc-lead">
        标题 + 千分位数字 + 前后缀的指标展示：数字自动千分位格式化，大数字字重
        600，适合仪表盘与运营概览。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="value 为数字时自动千分位格式化；title / suffix 可选。"
        code={BASIC_CODE}
      >
        <div className="doc-pg-preview-row">
          <Statistic title="总销售额" value={1234567} />
          <Statistic title="活跃用户" value={8848} suffix="人" />
        </div>
      </Demo>

      <Demo
        title="精度与前后缀"
        description="precision 控制小数位；prefix / suffix 放置货币符号与单位。"
        code={PRECISION_CODE}
      >
        <div className="doc-pg-preview-row">
          <Statistic title="完成率" value={98.6} precision={1} suffix="%" />
          <Statistic title="客单价" value={256} precision={2} prefix="¥" />
        </div>
      </Demo>

      <Demo
        title="数值样式"
        description="valueStyle 覆盖数值行内联样式（如语义色）。"
        code={STYLE_CODE}
      >
        <Statistic
          title="今日营收"
          value={123456}
          prefix="¥"
          valueStyle={{ color: 'var(--z-color-success)' }}
        />
      </Demo>

      <Demo
        title="倒计时"
        description="Statistic.CountDown 到目标时间的剩余时长（秒级刷新，跨天累计小时数）；到点触发一次 onFinish。根元素 role=timer，可访问名默认取语言包倒计时文案。"
        code={COUNTDOWN_CODE}
      >
        <div className="doc-pg-preview-row">
          <Statistic.CountDown title="距活动结束" value={Date.now() + 2 * 60 * 60 * 1000} />
          <Statistic.CountDown title="距秒杀开始" value={Date.now() + 45_000} />
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'title',
            type: 'React.ReactNode',
            description: '指标标题。',
          },
          {
            name: 'value',
            type: 'number | string',
            description: '数值：数字千分位格式化；纯数字字符串同样格式化；非数字字符串原样显示。',
          },
          {
            name: 'precision',
            type: 'number',
            description: '小数位（仅数字生效）。',
          },
          {
            name: 'prefix',
            type: 'React.ReactNode',
            description: '前置内容（如货币符号）。',
          },
          {
            name: 'suffix',
            type: 'React.ReactNode',
            description: '后置内容（如单位）。',
          },
          {
            name: 'valueStyle',
            type: 'React.CSSProperties',
            description: '数值行内联样式（style 覆盖）。',
          },
          {
            name: 'classNames',
            type: '{ root?; title?; value?; suffix? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素（className、style、aria-*、事件等）。',
          },
          {
            name: 'CountDown.value',
            type: 'number | string | Date',
            description: '目标时间：毫秒时间戳、可解析时间字符串或 Date。',
          },
          {
            name: 'CountDown.onFinish',
            type: '() => void',
            description:
              '每个目标时间倒计时到 0 时只触发一次（含 StrictMode effect 重放）；到点后停在 00:00:00。',
          },
        ]}
      />
      <p className="doc-p">
        数字使用 <code className="doc-code-inline">tabular-nums</code> 等宽数字避免跳动；
        大数字字重由 <code className="doc-code-inline">--z-statistic-value-font-weight</code>
        （600）控制。 CountDown
        的服务端与水合首帧使用确定性占位，挂载后再按客户端时钟计算剩余时间，避免跨秒水合不一致。
      </p>

      <CustomizeOutlet
        name="Statistic"
        parts={['root', 'title', 'value', 'prefix', 'suffix']}
        vars={[
          '--z-statistic-font-family',
          '--z-statistic-title-font-size',
          '--z-statistic-title-fg',
          '--z-statistic-title-font-weight',
          '--z-statistic-title-margin-bottom',
          '--z-statistic-value-font-size',
          '--z-statistic-value-font-weight',
          '--z-statistic-value-fg',
          '--z-statistic-value-line-height',
          '--z-statistic-suffix-font-size',
          '--z-statistic-suffix-font-weight',
          '--z-statistic-suffix-fg',
          '--z-statistic-suffix-margin-left',
          '--z-statistic-prefix-font-size',
          '--z-statistic-prefix-font-weight',
          '--z-statistic-prefix-fg',
          '--z-statistic-prefix-margin-right',
        ]}
      />
    </div>
  );
}
