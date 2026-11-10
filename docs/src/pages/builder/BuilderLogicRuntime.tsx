import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Modal } from '@zui/react';
import {
  evaluateCondition,
  resolveLogicValue,
  type BuilderAction,
  type BuilderNodeLogic,
  type BuilderVariable,
  type LogicScope,
  type LogicValue,
} from './builder-logic';
import { saveDownload } from './builder-model';

interface LogicRuntime {
  scope: LogicScope;
  run: (actions: BuilderAction[], event: Record<string, LogicValue>) => Promise<void>;
}
const emptyScope: LogicScope = { state: {}, query: {}, event: {} };
const LogicContext = createContext<LogicRuntime>({ scope: emptyScope, run: async () => {} });
export const useLogicRuntime = () => useContext(LogicContext);
export function BuilderLogicProvider({
  variables = [],
  children,
  navigate,
}: {
  variables?: BuilderVariable[];
  children: ReactNode;
  navigate?: (pageId: string) => boolean;
}) {
  const [state, setState] = useState<Record<string, LogicValue>>(() =>
    Object.fromEntries(variables.map((item) => [item.key, item.initial]))
  );
  const current = useRef(state);
  const [notice, setNotice] = useState<{ value: string; tone: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    value: string;
    resolve: (accepted: boolean) => void;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  const pendingConfirmation = useRef<((accepted: boolean) => void) | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingConfirmation.current?.(false);
    };
  }, []);
  const query: Record<string, string> =
    typeof location === 'undefined' ? {} : Object.fromEntries(new URLSearchParams(location.search));
  const scope: LogicScope = { state, query, event: {} };
  const run = async (actions: BuilderAction[], event: Record<string, LogicValue>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    let budget = 0;
    let navigating = false;
    const execute = async (steps: BuilderAction[]) => {
      for (const action of steps) {
        if (navigating || !mounted.current) return;
        if (++budget > 100) throw new Error('本次交互超过 100 步，请减少动作。');
        const activeScope = { state: current.current, query, event };
        if (action.type === 'set' || action.type === 'increment') {
          if (!Object.hasOwn(current.current, action.key))
            throw new Error(`状态 ${action.key} 尚未定义。`);
          let value = resolveLogicValue(action.value, activeScope);
          if (action.type === 'increment') {
            const previous = current.current[action.key];
            if (
              typeof previous !== 'number' ||
              value === null ||
              value === '' ||
              !Number.isFinite(Number(value))
            )
              throw new Error('增减动作需要数值状态和数值步长。');
            value = previous + Number(value);
            if (!Number.isFinite(value)) throw new Error('状态计算超出数值范围。');
          }
          current.current = { ...current.current, [action.key]: value };
          setState(current.current);
        } else if (action.type === 'reset') {
          current.current = Object.fromEntries(variables.map((item) => [item.key, item.initial]));
          setState(current.current);
        } else if (action.type === 'condition') {
          await execute(
            evaluateCondition(action.condition, activeScope) ? action.then : action.otherwise
          );
        } else if (action.type === 'confirm') {
          const accepted = await new Promise<boolean>((resolve) => {
            pendingConfirmation.current = resolve;
            setConfirmation({
              value: String(resolveLogicValue(action.value, activeScope) ?? ''),
              resolve,
            });
          });
          pendingConfirmation.current = null;
          if (!mounted.current) return;
          setConfirmation(null);
          await execute(accepted ? action.then : action.otherwise);
        } else if (action.type === 'notify') {
          setNotice({
            value: String(resolveLogicValue(action.value, activeScope) ?? ''),
            tone: action.tone,
          });
        } else if (action.type === 'navigate') {
          if (!navigate?.(action.pageId))
            throw new Error('目标页面不可用，请在多页面交互预览中运行。');
          navigating = true;
        } else if (action.type === 'download')
          saveDownload(
            String(resolveLogicValue(action.value, activeScope) ?? ''),
            action.fileName || '内容.txt',
            'text/plain;charset=utf-8'
          );
        else if (action.type === 'refresh')
          document.dispatchEvent(new CustomEvent('zui-builder-refresh', { detail: action.source }));
      }
    };
    try {
      await execute(actions);
    } catch (reason) {
      if (mounted.current)
        setNotice({
          value: reason instanceof Error ? reason.message : '交互执行失败。',
          tone: 'error',
        });
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <LogicContext.Provider value={{ scope, run }}>
      {children}
      {notice && (
        <div
          className="z-builder-prototype-notice"
          role={notice.tone === 'error' ? 'alert' : 'status'}
          data-tone={notice.tone}
        >
          <span>{notice.value}</span>
          <button type="button" aria-label="关闭交互提示" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      <Modal
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) confirmation?.resolve(false);
        }}
      >
        <Modal.Content size="sm">
          <Modal.Header>
            <Modal.Title>确认操作</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            <p>{confirmation?.value}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onClick={() => confirmation?.resolve(false)}>
              取消
            </Button>
            <Button onClick={() => confirmation?.resolve(true)}>确认</Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
      {busy && !confirmation && (
        <span className="z-builder-logic-status" role="status" aria-live="polite">
          正在执行交互
        </span>
      )}
    </LogicContext.Provider>
  );
}

export function useNodeLogic(logic?: BuilderNodeLogic, editing = false) {
  const { scope, run } = useLogicRuntime();
  const visible = editing || !logic?.visible || evaluateCondition(logic.visible, scope);
  const disabled = !editing && logic?.disabled && evaluateCondition(logic.disabled, scope);
  const events = (kind: 'click' | 'change' | 'submit', target: EventTarget | null) => {
    const element = target as HTMLInputElement | null;
    if (editing || element?.closest('[disabled],[aria-disabled="true"]')) return;
    const actions = logic?.[kind];
    if (actions?.length)
      void run(actions, {
        value: element && 'value' in element ? element.value : '',
        checked: element && 'checked' in element ? element.checked : false,
        name: element?.getAttribute('name') || '',
      });
  };
  return { visible, disabled, events };
}
