import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Tabs defaultValue="account">
  <Tabs.List>
    <Tabs.Trigger value="account">账户</Tabs.Trigger>
    <Tabs.Trigger value="security">安全</Tabs.Trigger>
    <Tabs.Trigger value="notify">通知</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="account">账户设置内容</Tabs.Panel>
  <Tabs.Panel value="security">安全设置内容</Tabs.Panel>
  <Tabs.Panel value="notify">通知设置内容</Tabs.Panel>
</Tabs>`;

const VERTICAL_CODE = `<Tabs defaultValue="a" orientation="vertical">
  <Tabs.List>…</Tabs.List>
  <Tabs.Panel value="a">…</Tabs.Panel>
</Tabs>`;

const MANUAL_CODE = `<Tabs defaultValue="one" activationMode="manual">
  {/* manual：焦点移动不立即选中，按 Enter / Space 才激活 */}
</Tabs>`;

const EXTRA_CODE = `<Tabs.Trigger value="x" disabled>禁用页签</Tabs.Trigger>
<Tabs.Trigger value="y" icon={<span>⚙</span>}>带图标</Tabs.Trigger>
<Tabs.Panel value="z" forceMount hidden>常驻面板</Tabs.Panel>`;

export default function TabsPage(): React.ReactNode {
  usePageTitle('Tabs 标签页');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Tabs 标签页</h1>
      <p className="doc-lead">
        组合式标签页：roving tabindex + 双向 aria 关联（aria-controls / aria-labelledby），
        支持水平 / 垂直排布与 automatic / manual 两种激活模式。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="Tabs.Trigger 与 Tabs.Panel 用 value 配对；未激活的 Panel 默认卸载（forceMount 可保留）。"
        code={BASIC_CODE}
      >
        <div style={{ width: '100%' }}>
          <Tabs defaultValue="account">
            <TabsList>
              <TabsTrigger value="account">账户</TabsTrigger>
              <TabsTrigger value="security">安全</TabsTrigger>
              <TabsTrigger value="notify">通知</TabsTrigger>
            </TabsList>
            <TabsPanel value="account">账户设置：昵称、头像、邮箱等基础资料。</TabsPanel>
            <TabsPanel value="security">安全设置：密码、两步验证、登录设备管理。</TabsPanel>
            <TabsPanel value="notify">通知设置：邮件、短信与站内消息的接收偏好。</TabsPanel>
          </Tabs>
        </div>
      </Demo>

      <Demo
        title="垂直排列"
        description='orientation="vertical" 时键盘改为 ↑ ↓ 移动，列表带 aria-orientation="vertical"。'
        code={VERTICAL_CODE}
      >
        <div style={{ width: '100%' }}>
          <Tabs defaultValue="a" orientation="vertical">
            <TabsList>
              <TabsTrigger value="a">概览</TabsTrigger>
              <TabsTrigger value="b">成员</TabsTrigger>
              <TabsTrigger value="c">账单</TabsTrigger>
            </TabsList>
            <TabsPanel value="a">项目概览：进度、里程碑与最近活动。</TabsPanel>
            <TabsPanel value="b">成员管理：邀请、角色与权限。</TabsPanel>
            <TabsPanel value="c">账单：用量统计与发票记录。</TabsPanel>
          </Tabs>
        </div>
      </Demo>

      <Demo
        title="手动激活"
        description='activationMode="manual"：方向键只移动焦点，Enter / Space 才切换选中（适合内容加载较重的场景）。'
        code={MANUAL_CODE}
      >
        <div style={{ width: '100%' }}>
          <Tabs defaultValue="one" activationMode="manual">
            <TabsList>
              <TabsTrigger value="one">第一页</TabsTrigger>
              <TabsTrigger value="two">第二页</TabsTrigger>
              <TabsTrigger value="three">第三页</TabsTrigger>
            </TabsList>
            <TabsPanel value="one">用 Tab 键聚焦后，按 ← → 移动焦点（此时尚未选中）。</TabsPanel>
            <TabsPanel value="two">按 Enter 或 Space 激活当前焦点所在页签。</TabsPanel>
            <TabsPanel value="three">Home / End 可直接跳到首尾页签。</TabsPanel>
          </Tabs>
        </div>
      </Demo>

      <Demo
        title="禁用与图标"
        description="Tabs.Trigger 支持 disabled 与 icon 插槽；Tabs.Panel 的 forceMount 保留面板（hidden）供预渲染。"
        code={EXTRA_CODE}
      >
        <div style={{ width: '100%' }}>
          <Tabs defaultValue="y">
            <TabsList>
              <TabsTrigger value="x" disabled>
                禁用页签
              </TabsTrigger>
              <TabsTrigger value="y" icon={<span aria-hidden="true">⚙</span>}>
                带图标
              </TabsTrigger>
            </TabsList>
            <TabsPanel value="y">图标通过 icon 插槽渲染，带 data-part="icon"。</TabsPanel>
          </Tabs>
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <h3 className="doc-h3">Tabs</h3>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'string',
            description: '受控激活页签值。',
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: '非受控初始值。',
          },
          {
            name: 'onValueChange',
            type: '(value: string) => void',
            description: '激活值变化回调。',
          },
          {
            name: 'orientation',
            type: "'horizontal' | 'vertical'",
            defaultValue: "'horizontal'",
            description: '排列方向，写入 tablist 的 aria-orientation，并决定方向键。',
          },
          {
            name: 'activationMode',
            type: "'automatic' | 'manual'",
            defaultValue: "'automatic'",
            description: 'automatic：焦点即选中；manual：Enter / Space 才激活。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: 'Tabs.List 与 Tabs.Panel 组合节点。',
          },
          {
            name: 'className',
            type: 'string',
            description: '追加到根元素。',
          },
          {
            name: 'classNames',
            type: '{ root?; list?; trigger?; panel? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />
      <h3 className="doc-h3">Tabs.Trigger / Tabs.Panel</h3>
      <ApiTable
        rows={[
          {
            name: 'Tabs.Trigger value',
            type: 'string',
            description: '页签标识（必填），与 Panel 的 value 配对。',
          },
          {
            name: 'Tabs.Trigger disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用该页签。',
          },
          {
            name: 'Tabs.Trigger icon',
            type: 'React.ReactNode',
            description: '前置图标插槽。',
          },
          {
            name: 'Tabs.Trigger ...rest',
            type: '透传',
            description: '原生 button 属性透传；role="tab"、roving tabindex 自动维护。',
          },
          {
            name: 'Tabs.Panel value',
            type: 'string',
            description: '面板标识（必填）。',
          },
          {
            name: 'Tabs.Panel forceMount',
            type: 'boolean',
            defaultValue: 'false',
            description: '常驻渲染面板（未激活时 hidden），默认卸载。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Tabs"
        parts={['root', 'list', 'trigger', 'panel', 'icon']}
        vars={[
          '--z-tabs-gap',
          '--z-tabs-trigger-font-size',
          '--z-tabs-trigger-padding-x',
          '--z-tabs-trigger-padding-y',
          '--z-tabs-trigger-radius',
          '--z-tabs-trigger-fg',
          '--z-tabs-trigger-active-fg',
          '--z-tabs-trigger-hover-bg',
          '--z-tabs-indicator-color',
          '--z-tabs-indicator-size',
          '--z-tabs-panel-padding',
          '--z-tabs-panel-padding-top',
          '--z-tabs-transition',
        ]}
      />
    </div>
  );
}
