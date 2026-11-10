import { useId, type ReactNode } from 'react';
import type { IconProps } from '@zui/icons';

export type LabCategory = 'insight' | 'collaboration' | 'team' | 'creation';
export const CATEGORIES: Record<LabCategory, string> = {
  insight: '数据洞察',
  collaboration: '文件协作',
  team: '团队效率',
  creation: '创作配置',
};

export function LabCard({
  number,
  name,
  title,
  description,
  category,
  icon: Icon,
  children,
  features,
}: {
  number: string;
  name: string;
  title: string;
  description: string;
  category: LabCategory;
  icon: React.ComponentType<IconProps>;
  children: ReactNode;
  features: string[];
}) {
  const id = useId();
  return (
    <article className="lab-card" aria-labelledby={id} data-category={category}>
      <header className="lab-card-head">
        <span className="lab-card-icon" aria-hidden="true">
          <Icon />
        </span>
        <div>
          <span className="lab-card-name">
            {number} / {name}
          </span>
          <h2 id={id}>{title}</h2>
        </div>
        <span className="lab-card-category">{CATEGORIES[category]}</span>
        <p>{description}</p>
      </header>
      <div className="lab-stage">{children}</div>
      <footer className="lab-card-foot">
        {features.map((feature) => (
          <span key={feature}>{feature}</span>
        ))}
      </footer>
    </article>
  );
}

export function Choices<T extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="lab-choices" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Person({ name, tone = 'green' }: { name: string; tone?: string }) {
  return (
    <span className="lab-person" data-tone={tone} aria-hidden="true">
      {name.slice(-1)}
    </span>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="lab-notice" role="status">
      {children}
    </p>
  );
}
