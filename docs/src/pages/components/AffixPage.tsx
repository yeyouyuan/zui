import { useRef, useState } from 'react';
import { Affix, Button } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [affixed, setAffixed] = useState(false);

<Affix offsetTop={20} onChange={setAffixed}>
  <Button variant="primary">固钉（距顶 20px）</Button>
</Affix>
<span>{affixed ? '已固定' : '未固定'}</span>`;

const BOTTOM_CODE = `<Affix offsetBottom={20}>
  <Button variant="secondary">距底 20px 固定</Button>
</Affix>`;

const TARGET_CODE = `const containerRef = useRef<HTMLDivElement>(null);

<div ref={containerRef} style={{ height: 200, overflow: 'auto', border: '1px solid var(--z-color-border)' }}>
  <div style={{ height: 500 }}>
    <Affix offsetTop={0} target={() => containerRef.current!}>
      <div style={{ background: 'var(--z-color-primary)', color: '#fff', padding: 8 }}>容器内固钉</div>
    </Affix>
  </div>
</div>`;

export default function AffixPage(): React.ReactNode {
  usePageTitle('Affix 固钉');
  const [affixed, setAffixed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Affix 固钉</h1>
      <p className="doc-lead">固钉组件，滚动到阈值后将内容固定在视口或容器边缘。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="基础用法" description="设置 offsetTop，滚动越过阈值后内容吸顶，onChange 回调当前固定状态。" code={BASIC_CODE}>
        <Affix offsetTop={20} onChange={setAffixed}>
          <Button variant="primary">固钉（距顶 20px）</Button>
        </Affix>
        <span style={{ marginLeft: 12 }}>{affixed ? '已固定' : '未固定'}</span>
      </Demo>

      <Demo title="距底部固定" description="offsetBottom 与 offsetTop 二选一，offsetTop 优先。" code={BOTTOM_CODE}>
        <Affix offsetBottom={20}>
          <Button variant="secondary">距底 20px 固定</Button>
        </Affix>
      </Demo>

      <Demo title="自定义滚动容器" description="target 返回滚动容器元素，固钉在容器内生效。" code={TARGET_CODE}>
        <div
          ref={containerRef}
          style={{ height: 200, overflow: 'auto', border: '1px solid var(--z-color-border)' }}
        >
          <div style={{ height: 500, position: 'relative' }}>
            <Affix offsetTop={0} target={() => containerRef.current!}>
              <div style={{ background: 'var(--z-color-primary)', color: '#fff', padding: 8 }}>容器内固钉</div>
            </Affix>
          </div>
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'offsetTop',
            type: 'number',
            description: '固定阈值（距容器顶部），与 offsetBottom 二选一，offsetTop 优先。',
          },
          {
            name: 'offsetBottom',
            type: 'number',
            description: '固定阈值（距容器底部）。',
          },
          {
            name: 'target',
            type: '() => HTMLElement | Window',
            defaultValue: 'window',
            description: '滚动容器，默认 window。',
          },
          {
            name: 'onChange',
            type: '(affixed: boolean) => void',
            description: '固定态切换回调。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '被固定的内容。',
          },
          {
            name: 'classNames',
            type: '{ root?; content? }',
            description: 'slot 级类名追加（root / content）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Affix"
        parts={['root', 'content']}
        vars={['--z-affix-z']}
      />
    </div>
  );
}
