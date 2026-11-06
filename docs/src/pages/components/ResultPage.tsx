import { Button, Result } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Result status="success" title="提交成功" subTitle="我们已收到你的反馈。" />`;

const STATUS_CODE = `<Result status="error" title="请求失败" subTitle="服务器开小差了，请稍后重试。" />
<Result status="warning" title="注意" subTitle="有 2 项待处理。" />
<Result status="404" />`;

const EXTRA_CODE = `<Result
  status="info"
  title="操作成功"
  subTitle="订单已创建，订单号 #10086。"
  extra={
    <>
      <Button variant="primary">查看详情</Button>
      <Button variant="outline">返回首页</Button>
    </>
  }
/>`;

export default function ResultPage(): React.ReactNode {
  usePageTitle('Result 结果页');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Result 结果页</h1>
      <p className="doc-lead">结果页组件，反馈操作处理结果（成功/失败/警告/异常码）。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="成功" description="status 为 success 时显示成功大图标 + 标题 + 副标题。" code={BASIC_CODE}>
        <Result status="success" title="提交成功" subTitle="我们已收到你的反馈。" />
      </Demo>

      <Demo title="不同状态" description="status 支持 success / error / info / warning / 404 / 403 / 500；缺省 title 使用内置默认文案。" code={STATUS_CODE} stack>
        <Result status="error" title="请求失败" subTitle="服务器开小差了，请稍后重试。" />
        <Result status="warning" title="注意" subTitle="有 2 项待处理。" />
        <Result status="404" />
      </Demo>

      <Demo title="操作区" description="extra 放置操作按钮组，常见于完成后跳转。" code={EXTRA_CODE}>
        <Result
          status="info"
          title="操作成功"
          subTitle="订单已创建，订单号 #10086。"
          extra={
            <>
              <Button variant="primary">查看详情</Button>
              <Button variant="outline">返回首页</Button>
            </>
          }
        />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'status',
            type: "'success' | 'error' | 'info' | 'warning' | '404' | '403' | '500'",
            defaultValue: "'info'",
            description: '结果状态。',
          },
          {
            name: 'title',
            type: 'React.ReactNode',
            description: '主标题（缺省使用状态默认文案）。',
          },
          {
            name: 'subTitle',
            type: 'React.ReactNode',
            description: '副标题。',
          },
          {
            name: 'extra',
            type: 'React.ReactNode',
            description: '操作按钮区。',
          },
          {
            name: 'classNames',
            type: '{ root?; icon?; title?; subtitle?; extra? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Result"
        parts={['root', 'icon', 'title', 'subtitle', 'extra']}
        vars={[
          '--z-result-max-width',
          '--z-result-gap',
          '--z-result-icon-size',
          '--z-result-title-size',
          '--z-result-title-weight',
          '--z-result-title-fg',
          '--z-result-subtitle-size',
          '--z-result-subtitle-fg',
          '--z-result-extra-gap',
        ]}
      />
    </div>
  );
}
