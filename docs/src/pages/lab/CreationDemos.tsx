import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@zui/react';
import { Calendar, Check, Clock, Copy, RotateCcw, Settings } from '@zui/icons';
import { Choices, LabCard, Notice, Person } from './shared';

const DAYS = [
  { date: '2026-11-09', label: '周一', day: '09' },
  { date: '2026-11-10', label: '周二', day: '10' },
  { date: '2026-11-11', label: '周三', day: '11' },
  { date: '2026-11-12', label: '周四', day: '12' },
  { date: '2026-11-13', label: '周五', day: '13' },
];
const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
const OCCUPIED = [
  '2026-11-09-10:00',
  '2026-11-10-14:00',
  '2026-11-11-09:00',
  '2026-11-12-11:00',
  '2026-11-13-16:00',
];

export function SchedulePicker() {
  const [day, setDay] = useState(DAYS[0].date);
  const [slot, setSlot] = useState<string | null>(null);
  const [reservation, setReservation] = useState<{ day: string; slot: string } | null>(null);
  const [notice, setNotice] = useState('先选日期，再选择一个可用时段。');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const slotRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    (pendingFocus.current === 'cancel'
      ? cancelRef.current
      : slotRefs.current.get(pendingFocus.current)
    )?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [reservation]);
  return (
    <LabCard
      number="09"
      name="SchedulePicker"
      title="把合适的时间留出来"
      description="日期与时段相邻呈现，选中、占用和预约结果一眼可分。"
      category="creation"
      icon={Calendar}
      features={['可用性状态', '预约 / 取消', '明确时区']}
    >
      <div className="lab-toolbar">
        <div>
          <span className="lab-overline">设计评审 · 30 分钟</span>
          <h3 className="lab-month">2026 年 11 月</h3>
        </div>
        <span className="lab-pill">
          <Clock aria-hidden="true" />
          上海 UTC+8
        </span>
      </div>
      <p className="lab-small lab-muted">固定示例周 · 11 月 9 日—13 日</p>
      <div className="lab-days" role="group" aria-label="预约日期">
        {DAYS.map((item) => (
          <button
            key={item.date}
            type="button"
            aria-pressed={day === item.date}
            disabled={reservation !== null}
            onClick={() => {
              setDay(item.date);
              setSlot(null);
            }}
          >
            <span>{item.label}</span>
            <strong>{item.day}</strong>
            <span className="lab-day-mark" aria-hidden="true" />
            <span className="lab-sr-only">2026年11月{Number(item.day)}日</span>
          </button>
        ))}
      </div>
      <div className="lab-slots" role="group" aria-label="预约时段">
        {SLOTS.map((time) => {
          const occupied =
            OCCUPIED.includes(`${day}-${time}`) ||
            (reservation?.day === day && reservation.slot === time);
          return (
            <button
              ref={(node) => {
                if (node) slotRefs.current.set(time, node);
                else slotRefs.current.delete(time);
              }}
              key={time}
              type="button"
              disabled={occupied || reservation !== null}
              data-occupied={occupied}
              aria-pressed={slot === time}
              onClick={() => setSlot(time)}
            >
              <strong>{time}</strong>
              <span>{occupied ? '已占用' : reservation ? '取消后可选' : '可预约'}</span>
            </button>
          );
        })}
      </div>
      <div className="lab-booking-summary">
        {reservation ? (
          <>
            <div>
              <Check aria-hidden="true" />
              <strong>已创建演示预约</strong>
            </div>
            <p>
              {reservation.day} · {reservation.slot} · 30 分钟
            </p>
            <button
              ref={cancelRef}
              type="button"
              className="lab-text-button"
              onClick={() => {
                pendingFocus.current = reservation.slot;
                setReservation(null);
                setSlot(null);
                setNotice('演示预约已取消，时段已释放。');
              }}
            >
              取消预约
            </button>
          </>
        ) : (
          <>
            <p>{slot ? `${day} · ${slot} · 30 分钟` : '选择时段后确认预约'}</p>
            <Button
              size="sm"
              disabled={!slot}
              onClick={() => {
                if (!slot) return;
                pendingFocus.current = 'cancel';
                setReservation({ day, slot });
                setSlot(null);
                setNotice(`已预约 ${day} ${slot}，这是本页演示预约。`);
              }}
            >
              确认预约
            </Button>
          </>
        )}
      </div>
      <Notice>{notice}</Notice>
    </LabCard>
  );
}

const ACCENTS = [
  { name: '青玉', value: '#137365' },
  { name: '海蓝', value: '#245bd6' },
  { name: '鸢尾', value: '#7542ac' },
  { name: '陶土', value: '#a84914' },
] as const;

export function StyleConfigurator() {
  const id = useId();
  const [accent, setAccent] = useState<string>(ACCENTS[0].value);
  const [radius, setRadius] = useState(16);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [notice, setNotice] = useState('调整参数，卡片预览会即时更新。');
  const [followed, setFollowed] = useState(false);
  const gap = density === 'comfortable' ? 16 : 10;
  const css = `--accent: ${accent};\n--radius: ${radius}px;\n--space: ${gap}px;`;
  const style = {
    '--preview-accent': accent,
    '--preview-radius': `${radius}px`,
    '--preview-space': `${gap}px`,
  } as CSSProperties;
  return (
    <LabCard
      number="10"
      name="StyleConfigurator"
      title="把风格，调成你的"
      description="调节色彩、圆角与密度，观察同一张卡片如何改变气质。"
      category="creation"
      icon={Settings}
      features={['实时主题', '密度与圆角', '复制 CSS']}
    >
      <div className="lab-configurator">
        <div className="lab-config-controls">
          <fieldset className="lab-fieldset">
            <legend>强调色</legend>
            <div className="lab-swatches">
              {ACCENTS.map((color) => (
                <button
                  type="button"
                  key={color.value}
                  aria-label={color.name}
                  aria-pressed={accent === color.value}
                  onClick={() => setAccent(color.value)}
                >
                  <span style={{ backgroundColor: color.value }} aria-hidden="true">
                    {accent === color.value && <Check />}
                  </span>
                  <small>{color.name}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="lab-radius">
            <label htmlFor={`${id}-radius`}>
              圆角 <strong>{radius}px</strong>
            </label>
            <input
              id={`${id}-radius`}
              type="range"
              min="0"
              max="24"
              step="2"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            />
          </div>
          <fieldset className="lab-fieldset">
            <legend>内容密度</legend>
            <Choices
              label="内容密度"
              value={density}
              items={[
                { value: 'comfortable', label: '舒适' },
                { value: 'compact', label: '紧凑' },
              ]}
              onChange={setDensity}
            />
          </fieldset>
        </div>
        <div className="lab-style-preview" style={style} aria-label="实时样式预览">
          <div className="lab-preview-cover">
            <span>
              MAKE SPACE
              <br />
              FOR GOOD IDEAS.
            </span>
            <span className="lab-preview-orbit" aria-hidden="true" />
          </div>
          <div className="lab-preview-body">
            <span className="lab-preview-badge">DESIGN SYSTEM</span>
            <h3>好想法，值得好呈现</h3>
            <p>让日常协作多一点秩序，也多一点灵感。</p>
            <div className="lab-toolbar">
              <div className="lab-inline-actions">
                <Person name="林悦" />
                <span className="lab-small">林悦的工作空间</span>
              </div>
              <button
                type="button"
                aria-pressed={followed}
                onClick={() => setFollowed((value) => !value)}
              >
                {followed ? '已关注' : '关注'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="lab-config-code">
        <code>{css}</code>
        <div className="lab-inline-actions">
          <button
            type="button"
            className="lab-icon-button"
            aria-label="重置样式"
            onClick={() => {
              setAccent(ACCENTS[0].value);
              setRadius(16);
              setDensity('comfortable');
              setNotice('已恢复默认样式。');
            }}
          >
            <RotateCcw />
          </button>
          <button
            type="button"
            className="lab-icon-button"
            aria-label="复制样式 CSS"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(css);
                setNotice('样式 CSS 已复制到剪贴板。');
              } catch {
                setNotice('未能访问剪贴板，可选择左侧 CSS 文本手动复制。');
              }
            }}
          >
            <Copy />
          </button>
        </div>
      </div>
      <Notice>{notice}</Notice>
    </LabCard>
  );
}
