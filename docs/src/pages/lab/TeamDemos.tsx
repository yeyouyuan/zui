import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@zui/react';
import { Bell, Check, CheckCircle, Clipboard, Plus, ShieldCheck, Star, Users } from '@zui/icons';
import { Choices, LabCard, Notice, Person } from './shared';

const STAGES = ['待开始', '进行中', '已完成'] as const;
type Stage = (typeof STAGES)[number];
interface Task {
  id: number;
  name: string;
  stage: Stage;
  priority: string;
  owner: string;
}
const INITIAL_TASKS: Task[] = [
  { id: 1, name: '梳理空状态文案', stage: '待开始', priority: '普通', owner: '林悦' },
  { id: 2, name: '设计文件工作台', stage: '进行中', priority: '高', owner: '陈晨' },
  { id: 3, name: '检查键盘操作', stage: '进行中', priority: '高', owner: '周宁' },
  { id: 4, name: '统一间距规范', stage: '已完成', priority: '普通', owner: '林悦' },
];

export function TaskBoard() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('全部');
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('通过任务下方的状态菜单移动任务。');
  const nextId = useRef(5);
  const taskControls = useRef(new Map<number, HTMLSelectElement>());
  const movingTask = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (movingTask.current === null) return;
    taskControls.current.get(movingTask.current)?.focus({ preventScroll: true });
    movingTask.current = null;
  }, [tasks]);
  const visible = tasks.filter(
    (task) =>
      task.name.includes(query.trim()) && (priority === '全部' || task.priority === priority)
  );
  return (
    <LabCard
      number="05"
      name="TaskBoard"
      title="让进展自然流动"
      description="轻量看板结合任务筛选与状态流转，每一次推进都清晰可见。"
      category="team"
      icon={Clipboard}
      features={['任务创建', '优先级筛选', '无拖拽流转']}
    >
      <div className="lab-toolbar">
        <input
          aria-label="搜索任务"
          placeholder="搜索任务…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="筛选任务优先级"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="全部">全部优先级</option>
          <option value="高">高优先级</option>
          <option value="普通">普通优先级</option>
        </select>
      </div>
      <div className="lab-board">
        {STAGES.map((stage) => (
          <section className="lab-board-column" key={stage} aria-label={`${stage}任务`}>
            <h3>
              <span className="lab-dot" data-stage={stage} />
              {stage}
              <span>{visible.filter((task) => task.stage === stage).length}</span>
            </h3>
            {visible
              .filter((task) => task.stage === stage)
              .map((task) => (
                <div className="lab-task" key={task.id}>
                  <span className="lab-priority" data-priority={task.priority}>
                    {task.priority === '高' ? '高优先级' : '常规任务'}
                  </span>
                  <strong>{task.name}</strong>
                  <div className="lab-toolbar">
                    <Person name={task.owner} tone={task.owner === '陈晨' ? 'orange' : 'green'} />
                    <span className="lab-small lab-muted">{task.owner}</span>
                  </div>
                  <select
                    ref={(node) => {
                      if (node) taskControls.current.set(task.id, node);
                      else taskControls.current.delete(task.id);
                    }}
                    aria-label={`${task.name}的状态`}
                    value={task.stage}
                    onChange={(event) => {
                      const target = event.target.value as Stage;
                      movingTask.current = task.id;
                      setTasks((items) =>
                        items.map((item) =>
                          item.id === task.id ? { ...item, stage: target } : item
                        )
                      );
                      setMessage(`“${task.name}”已移至${target}。`);
                    }}
                  >
                    {STAGES.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
              ))}
            {!visible.some((task) => task.stage === stage) && (
              <p className="lab-column-empty">暂无任务</p>
            )}
          </section>
        ))}
      </div>
      <form
        className="lab-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) {
            setMessage('请输入任务名称。');
            return;
          }
          setTasks((items) => [
            ...items,
            {
              id: nextId.current++,
              name: draft.trim(),
              stage: '待开始',
              priority: '普通',
              owner: '林悦',
            },
          ]);
          setMessage(`已创建“${draft.trim()}”，位于待开始。`);
          setDraft('');
          setQuery('');
          setPriority('全部');
        }}
      >
        <input
          aria-label="新任务名称"
          placeholder="下一件要完成的事…"
          maxLength={60}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          required
        />
        <Button size="sm" type="submit" iconStart={<Plus />}>
          添加任务
        </Button>
      </form>
      <Notice>{message}</Notice>
    </LabCard>
  );
}

const APPROVERS = [
  { name: '林悦', role: '提交申请' },
  { name: '陈晨', role: '设计负责人' },
  { name: '周宁', role: '项目负责人' },
];

export function ApprovalFlow() {
  const id = useId();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [step, setStep] = useState(1);
  const [returned, setReturned] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(false);
  const [history, setHistory] = useState(['林悦提交了申请']);
  const [message, setMessage] = useState('等待设计负责人审批。');
  const completed = step === APPROVERS.length;
  const restartRef = useRef<HTMLButtonElement>(null);
  const shouldFocus = useRef(false);
  useLayoutEffect(() => {
    if (!shouldFocus.current) return;
    (completed || returned ? restartRef.current : commentRef.current)?.focus({
      preventScroll: true,
    });
    shouldFocus.current = false;
  }, [completed, returned]);
  const record = (approved: boolean) => {
    if (!approved && !comment.trim()) {
      setError(true);
      setMessage('退回前请填写原因。');
      commentRef.current?.focus();
      return;
    }
    setHistory((items) => [
      ...items,
      `${APPROVERS[step].name}${approved ? '通过' : '退回'}了申请${comment.trim() ? `：${comment.trim()}` : ''}`,
    ]);
    setComment('');
    setError(false);
    if (approved) {
      if (step === 2) shouldFocus.current = true;
      setStep((value) => value + 1);
      setMessage(step === 2 ? '所有审批已通过，申请已完成。' : '已通过，等待项目负责人审批。');
    } else {
      shouldFocus.current = true;
      setReturned(true);
      setMessage('申请已退回，可修改后重新提交。');
    }
  };
  return (
    <LabCard
      number="06"
      name="ApprovalFlow"
      title="每个决定，都有依据"
      description="以时间线承载审批进度，让通过、退回和再次提交形成闭环。"
      category="team"
      icon={CheckCircle}
      features={['逐级审批', '退回校验', '操作记录']}
    >
      <div className="lab-request">
        <div>
          <span className="lab-overline">设计资源申请 · REQ-024</span>
          <h3>组件库视觉升级</h3>
          <p className="lab-small lab-muted">申请人 林悦 · 示例预算 ¥8,000</p>
        </div>
        <span className="lab-pill" data-tone={returned ? 'orange' : 'green'}>
          {returned ? '已退回' : completed ? '已完成' : '审批中'}
        </span>
      </div>
      <ol className="lab-approval-steps">
        {APPROVERS.map((person, index) => (
          <li
            key={person.name}
            data-state={index < step ? 'done' : index === step ? 'active' : 'waiting'}
          >
            <span className="lab-step-node" aria-hidden="true">
              {index < step ? <Check /> : index + 1}
            </span>
            <div>
              <strong>{person.name}</strong>
              <span>{person.role}</span>
            </div>
            <small>
              {index < step
                ? '已完成'
                : index === step
                  ? returned
                    ? '已退回'
                    : '待处理'
                  : '待流转'}
            </small>
          </li>
        ))}
      </ol>
      {!completed && !returned && (
        <div className="lab-approval-action">
          <label htmlFor={`${id}-comment`}>
            审批意见 <span className="lab-muted">（退回时必填）</span>
          </label>
          <textarea
            ref={commentRef}
            id={`${id}-comment`}
            aria-invalid={error || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            rows={2}
            maxLength={200}
            value={comment}
            placeholder="补充你的建议…"
            onChange={(event) => {
              setComment(event.target.value);
              setError(false);
            }}
          />
          {error && (
            <p className="lab-error" id={`${id}-error`}>
              请填写退回原因。
            </p>
          )}
          <div className="lab-inline-actions">
            <Button size="sm" variant="outline" onClick={() => record(false)}>
              退回修改
            </Button>
            <Button size="sm" onClick={() => record(true)} iconStart={<Check />}>
              通过审批
            </Button>
          </div>
        </div>
      )}
      {(completed || returned) && (
        <Button
          ref={restartRef}
          size="sm"
          variant="outline"
          onClick={() => {
            shouldFocus.current = true;
            setStep(1);
            setReturned(false);
            if (completed) setHistory(['林悦提交了申请']);
            else setHistory((items) => [...items, '林悦重新提交了申请']);
            setMessage('等待设计负责人审批。');
          }}
        >
          {returned ? '修改后重新提交' : '重置演示'}
        </Button>
      )}
      <details className="lab-history">
        <summary>操作记录 · {history.length}</summary>
        <ol>
          {history.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ol>
      </details>
      <Notice>{message}</Notice>
    </LabCard>
  );
}

const INITIAL_MESSAGES = [
  {
    id: 1,
    person: '陈晨',
    title: '在视觉规范中提到了你',
    description: '“文件列表选中状态再加强一点层次。”',
    time: '09:42',
    read: false,
    starred: false,
    tone: 'orange',
  },
  {
    id: 2,
    person: '周宁',
    title: '完成了主题适配验收',
    description: '明暗主题与窄屏检查已完成，可以进入下一轮。',
    time: '09:18',
    read: false,
    starred: true,
    tone: 'green',
  },
  {
    id: 3,
    person: '林悦',
    title: '分享了新的交互方案',
    description: '新增文件预览、版本对比和审批流程设计。',
    time: '昨天',
    read: true,
    starred: false,
    tone: 'blue',
  },
];

export function ActivityInbox() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [notice, setNotice] = useState('打开通知会将它标记为已读。');
  const detailActionRef = useRef<HTMLButtonElement>(null);
  const inboxRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'detail' | 'list' | null>(null);
  useLayoutEffect(() => {
    if (pendingFocus.current === 'detail') detailActionRef.current?.focus({ preventScroll: true });
    if (pendingFocus.current === 'list') inboxRef.current?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [messages, activeId]);
  const unread = messages.filter((item) => !item.read).length;
  const active = messages.find((item) => item.id === activeId);
  const visible = messages.filter(
    (item) => filter === 'all' || (filter === 'unread' ? !item.read : item.starred)
  );
  return (
    <LabCard
      number="07"
      name="ActivityInbox"
      title="重要消息，刚刚好"
      description="将提醒、收藏和上下文放在一起，专注于需要回应的动态。"
      category="team"
      icon={Bell}
      features={['已读状态', '收藏筛选', '上下文详情']}
    >
      <div className="lab-toolbar">
        <div className="lab-inline-actions">
          <strong>团队动态</strong>
          <span className="lab-count" aria-label={`${unread} 条未读通知`}>
            {unread}
          </span>
        </div>
        <button
          type="button"
          className="lab-text-button"
          disabled={!unread}
          onClick={() => {
            setMessages((items) => items.map((item) => ({ ...item, read: true })));
            setNotice('全部通知已标为已读。');
          }}
        >
          全部已读
        </button>
      </div>
      <Choices
        label="通知筛选"
        value={filter}
        items={[
          { value: 'all', label: '全部' },
          { value: 'unread', label: '未读' },
          { value: 'starred', label: '已收藏' },
        ]}
        onChange={setFilter}
      />
      <div ref={inboxRef} className="lab-inbox" role="group" aria-label="通知列表" tabIndex={-1}>
        {visible.map((item) => (
          <div
            className="lab-message"
            key={item.id}
            data-unread={!item.read}
            data-active={activeId === item.id}
          >
            <Person name={item.person} tone={item.tone} />
            <button
              type="button"
              className="lab-message-main"
              onClick={() => {
                if (filter === 'unread') pendingFocus.current = 'detail';
                setActiveId(item.id);
                setMessages((items) =>
                  items.map((message) =>
                    message.id === item.id ? { ...message, read: true } : message
                  )
                );
                setNotice(`已打开${item.person}的通知。`);
              }}
            >
              <strong>
                {item.person}
                <span>{item.time}</span>
              </strong>
              <span>{item.title}</span>
              {!item.read && <span className="lab-sr-only">未读</span>}
            </button>
            <button
              type="button"
              className="lab-icon-button lab-star"
              aria-label={`收藏${item.person}的通知`}
              aria-pressed={item.starred}
              onClick={() => {
                if (filter === 'starred' && item.starred) pendingFocus.current = 'list';
                setMessages((items) =>
                  items.map((message) =>
                    message.id === item.id ? { ...message, starred: !message.starred } : message
                  )
                );
              }}
            >
              <Star />
            </button>
          </div>
        ))}
        {!visible.length && (
          <div className="lab-empty">
            <CheckCircle aria-hidden="true" />
            <p>{filter === 'unread' ? '当前没有未读通知' : '还没有收藏的通知'}</p>
          </div>
        )}
      </div>
      {active && (
        <div className="lab-message-detail">
          <span className="lab-overline">来自 {active.person}</span>
          <p>{active.description}</p>
          <button
            ref={detailActionRef}
            type="button"
            className="lab-text-button"
            onClick={() => {
              setMessages((items) =>
                items.map((item) => (item.id === active.id ? { ...item, read: !item.read } : item))
              );
              setNotice(`已标为${active.read ? '未读' : '已读'}。`);
            }}
          >
            {active.read ? '标为未读' : '标为已读'}
          </button>
        </div>
      )}
      <Notice>{notice}</Notice>
    </LabCard>
  );
}

const ROLES = { admin: '管理员', editor: '编辑者', viewer: '查看者' } as const;
type Role = keyof typeof ROLES;
const PERMISSIONS = [
  { label: '查看文件与评论', roles: ['admin', 'editor', 'viewer'] },
  { label: '编辑内容与版本', roles: ['admin', 'editor'] },
  { label: '管理成员与权限', roles: ['admin'] },
] as const;

export function AccessControl() {
  const [members, setMembers] = useState<{ id: number; name: string; role: Role }[]>([
    { id: 1, name: '林悦', role: 'admin' },
    { id: 2, name: '陈晨', role: 'editor' },
    { id: 3, name: '周宁', role: 'viewer' },
  ]);
  const [selected, setSelected] = useState(2);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('选择成员，查看其当前权限。');
  const nextId = useRef(4);
  const active = members.find((member) => member.id === selected)!;
  return (
    <LabCard
      number="08"
      name="AccessControl"
      title="协作开放，权限清楚"
      description="按角色分配能力，并即时查看每一位成员可以执行的操作。"
      category="team"
      icon={ShieldCheck}
      features={['角色分配', '能力矩阵', '成员管理']}
    >
      <div className="lab-toolbar">
        <div className="lab-inline-actions">
          <Users aria-hidden="true" />
          <strong>设计工作空间</strong>
        </div>
        <span className="lab-pill">{members.length} 位成员</span>
      </div>
      <div className="lab-members">
        {members.map((member) => (
          <div key={member.id} className="lab-member" data-active={selected === member.id}>
            <button
              type="button"
              aria-pressed={selected === member.id}
              onClick={() => setSelected(member.id)}
            >
              <Person name={member.name} tone={member.id % 2 ? 'green' : 'orange'} />
              <strong>{member.name}</strong>
            </button>
            <select
              aria-label={`${member.name}的角色`}
              value={member.role}
              onChange={(event) => {
                const role = event.target.value as Role;
                setMembers((items) =>
                  items.map((item) => (item.id === member.id ? { ...item, role } : item))
                );
                setSelected(member.id);
                setNotice(`已将${member.name}设为${ROLES[role]}。`);
              }}
            >
              {Object.entries(ROLES).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="lab-permissions">
        <div className="lab-toolbar">
          <strong>{active.name}的权限</strong>
          <span className="lab-small lab-muted">{ROLES[active.role]}</span>
        </div>
        {PERMISSIONS.map((permission) => {
          const allowed = (permission.roles as readonly string[]).includes(active.role);
          return (
            <div className="lab-permission" key={permission.label}>
              <span>{permission.label}</span>
              <span className="lab-permission-value" data-allowed={allowed}>
                {allowed && <Check aria-hidden="true" />}
                {allowed ? '允许' : '无权限'}
              </span>
            </div>
          );
        })}
      </div>
      <form
        className="lab-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setNotice('请输入成员姓名。');
            return;
          }
          if (members.some((member) => member.name === name.trim())) {
            setNotice('该成员已在团队中。');
            return;
          }
          const id = nextId.current++;
          setMembers((items) => [...items, { id, name: name.trim(), role: 'viewer' }]);
          setSelected(id);
          setNotice(`已添加演示成员${name.trim()}，默认角色为查看者。`);
          setName('');
        }}
      >
        <input
          aria-label="新成员姓名"
          required
          maxLength={12}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="添加演示成员…"
          disabled={members.length >= 6}
        />
        <Button size="sm" type="submit" variant="outline" disabled={members.length >= 6}>
          添加成员
        </Button>
      </form>
      <Notice>{members.length >= 6 ? '演示团队最多可添加 6 位成员。' : notice}</Notice>
    </LabCard>
  );
}
