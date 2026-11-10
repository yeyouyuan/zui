import { useEffect, useId, useState } from 'react';
import { validateCssDeclarations } from './builder-design';

export function BuilderCssField({
  label,
  value = '',
  onChange,
  readOnly,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(value);
    setError('');
  }, [value]);
  return (
    <div className="studio-css-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={draft}
        rows={6}
        disabled={readOnly}
        spellCheck={false}
        placeholder={'border-radius: 24px;\nbackground: linear-gradient(135deg, #eef2ff, #faf5ff);'}
        onChange={(event) => {
          setDraft(event.target.value);
          setError('');
        }}
      />
      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          try {
            const next = validateCssDeclarations(draft);
            onChange(next);
            setError('');
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'CSS 格式不正确');
          }
        }}
      >
        应用{label}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
