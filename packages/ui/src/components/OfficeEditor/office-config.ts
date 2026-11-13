import type { OfficeEditorConfig } from './office-types';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined && typeof entry !== 'function')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

/** JWT rotation, presentation dimensions and callback references do not open a new document. */
export function officeConfigIdentity(config: OfficeEditorConfig): string {
  const { token: _token, events: _events, width: _width, height: _height, ...session } = config;
  const { title: _title, ...document } = config.document ?? {};
  return JSON.stringify(canonical({ ...session, document }));
}

export function officeServerIdentity(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Fills unset `editorConfig.customization` keys from the host. Each backend
 * value wins, so a signed configuration keeps its exact customization. The
 * merged object participates in the identity, meaning a customization change
 * recreates the editor instead of mutating the running canvas.
 */
export function officeCustomizationConfig(
  config: OfficeEditorConfig,
  customization?: Record<string, unknown>
): OfficeEditorConfig {
  if (!customization) return config;
  const existing = config.editorConfig?.customization;
  const merged =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...customization, ...existing }
      : { ...customization };
  return {
    ...config,
    editorConfig: { ...config.editorConfig, customization: merged },
  };
}

function copyData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copyData);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyData(entry)]));
  return value;
}

/** DocsAPI writes defaults into nested config objects, so give it its own data copy. */
export function nativeOfficeConfig(config: OfficeEditorConfig): OfficeEditorConfig {
  const { events: _events, ...data } = config;
  return copyData(data) as OfficeEditorConfig;
}
