import { Transfer } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const DATA = [
  { key: 'a', title: 'Apple' },
  { key: 'b', title: 'Banana' },
  { key: 'c', title: 'Cherry', disabled: true },
  { key: 'd', title: 'Durian' },
  { key: 'e', title: 'Elderberry' },
];

const BASIC_CODE = `const dataSource = [
  { key: 'a', title: 'Apple' },
  { key: 'b', title: 'Banana' },
  { key: 'c', title: 'Cherry', disabled: true },
  { key: 'd', title: 'Durian' },
  { key: 'e', title: 'Elderberry' },
];

<Transfer dataSource={dataSource} defaultTargetKeys={['b']} />`;

const SEARCH_CODE = `<Transfer
  dataSource={dataSource}
  showSearch
  titles={['可选成员', '已选成员']}
  defaultTargetKeys={['a', 'd']}
/>`;

export default function TransferPage(): React.ReactNode {
  usePageTitle('Transfer 穿梭框');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Transfer 穿梭框</h1>
      <p className="doc-lead">
        双列列表之间批量搬运选项：勾选 + 中间移动按钮，支持双列搜索、全选半选态与键盘导航，
        适合人员分配、字段选择等「多对多归组」场景。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="dataSource 是全量数据，targetKeys 决定落在目标列的项；勾选后点 → / ← 移动。"
        code={BASIC_CODE}
        stack
      >
        <Transfer dataSource={DATA} defaultTargetKeys={['b']} />
      </Demo>

      <Demo
        title="搜索与自定义标题"
        description="showSearch 在两侧各加一个过滤框；titles 自定义两列标题。disabled 项不可勾选也不会被搬运。"
        code={SEARCH_CODE}
        stack
      >
        <Transfer
          dataSource={DATA}
          showSearch
          titles={['可选成员', '已选成员']}
          defaultTargetKeys={['a', 'd']}
        />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'dataSource',
            type: 'Array<{ key: string; title: React.ReactNode; disabled?: boolean }>',
            description: '全量数据源。',
          },
          {
            name: 'targetKeys',
            type: 'string[]',
            description: '已移动到目标列的 key（受控）。',
          },
          {
            name: 'defaultTargetKeys',
            type: 'string[]',
            defaultValue: '[]',
            description: '非受控初始目标列 key。',
          },
          {
            name: 'onChange',
            type: '(keys: string[]) => void',
            description: '目标列变化回调，key 按 dataSource 顺序整理。',
          },
          {
            name: 'titles',
            type: '[string, string]',
            defaultValue: "['源列表','目标列表']",
            description: '双列标题。',
          },
          {
            name: 'showSearch',
            type: 'boolean',
            defaultValue: 'false',
            description: '双列搜索框。',
          },
          {
            name: 'className',
            type: 'string',
            description: '追加到根元素的类名。',
          },
          {
            name: 'classNames',
            type: '{ root?; list?; item?; buttons? }',
            description: 'slot 级类名追加（root / list / item / buttons）。',
          },
        ]}
      />
      <p className="doc-p">
        交互约定：每列 <code className="doc-code-inline">role=&quot;listbox&quot;</code> +{' '}
        <code className="doc-code-inline">aria-multiselectable</code>，行{' '}
        <code className="doc-code-inline">role=&quot;option&quot;</code>；↑↓/Home/End 列内移动焦点、
        Space 勾选；表头全选复选框支持 indeterminate（<code className="doc-code-inline">aria-checked=&quot;mixed&quot;</code>）。
      </p>

      <CustomizeOutlet
        name="Transfer"
        parts={['root', 'list', 'header', 'search', 'item', 'checkbox', 'buttons']}
        vars={[
          '--z-transfer-width',
          '--z-transfer-height',
          '--z-transfer-border',
          '--z-transfer-radius',
          '--z-transfer-bg',
          '--z-transfer-header-bg',
          '--z-transfer-header-fg',
          '--z-transfer-header-height',
          '--z-transfer-item-height',
          '--z-transfer-item-padding-x',
          '--z-transfer-item-fg',
          '--z-transfer-item-hover-bg',
          '--z-transfer-item-selected-bg',
          '--z-transfer-item-selected-fg',
          '--z-transfer-button-size',
          '--z-transfer-button-bg',
          '--z-transfer-button-fg',
          '--z-transfer-button-border',
          '--z-transfer-button-hover-bg',
          '--z-transfer-checkbox-size',
          '--z-transfer-checkbox-checked-bg',
          '--z-transfer-gap',
        ]}
      />
    </div>
  );
}
