'use client';

import * as React from 'react';
import { useAutoTranslate, type TranslateConfig } from '@zui/i18n';
import { mergeLocale, zhCN, type DeepPartial, type ZuiLocale } from './locale';
import { ZuiConfigContext } from './useZuiConfig';

// `code` 是语言标识（BCP 47）而非文案段：排除在 AI 翻译段之外，
// 避免语言标签被翻译成非法 BCP 47 tag，导致 Intl 格式化抛 RangeError。
const LOCALE_SECTIONS = Object.keys(zhCN).filter(
  (key) => key !== 'code'
) as Array<keyof ZuiLocale>;

function translateLocaleValue(
  value: unknown,
  component: string,
  role: string,
  tSync: ReturnType<typeof useAutoTranslate>['tSync']
): unknown {
  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) return value;
    return tSync(value, { component, role });
  }
  if (Array.isArray(value))
    return value.map((item) => translateLocaleValue(item, component, role, tSync));
  if (value && typeof value === 'object') {
    const translated = {} as Record<string, unknown>;
    for (const key of Object.keys(value)) {
      Object.defineProperty(translated, key, {
        enumerable: true,
        get: () =>
          translateLocaleValue((value as Record<string, unknown>)[key], component, key, tSync),
      });
    }
    return translated;
  }
  return value;
}

/* ---------------------------------- 类型 ---------------------------------- */

export interface ConfigProviderProps {
  /** 与默认 zh-CN 深合并的文案覆盖（未提供的段/键保持默认） */
  locale?: DeepPartial<ZuiLocale>;
  /** AI 翻译配置：自动翻译组件内置文案。 */
  translate?: import('./translate').TranslateConfig;
  children?: React.ReactNode;
}

/* ------------------------------ ConfigProvider ----------------------------- */

/**
 * 全局配置 Provider：向子树提供 locale 文案等配置。
 * 多层嵌套时逐层深合并（内层覆盖外层）。
 */
export function ConfigProvider({ locale, translate, children }: ConfigProviderProps) {
  const parent = React.useContext(ZuiConfigContext);
  const sourceLocale = React.useMemo(
    () => mergeLocale(parent.sourceLocale ?? parent.locale, locale),
    [parent.sourceLocale, parent.locale, locale]
  );
  const config = translate ?? parent.translate;
  const ready =
    config &&
    config.targetLang.trim() &&
    (config.translateFn ||
      (config.provider === 'custom'
        ? config.endpoint?.trim()
        : config.provider === 'openai'
          ? config.key?.trim() ||
            config.apiKey?.trim() ||
            config.baseURL?.trim() ||
            config.endpoint?.trim()
          : config.provider === 'youdao'
            ? config.apiKey?.trim() && config.appSecret?.trim()
            : config.apiKey?.trim() || config.endpoint?.trim()));
  if (ready && config) {
    return (
      <TranslatedConfig sourceLocale={sourceLocale} config={config}>
        {children}
      </TranslatedConfig>
    );
  }
  return (
    <ZuiConfigContext.Provider value={{ locale: sourceLocale, sourceLocale, translate: config }}>
      {children}
    </ZuiConfigContext.Provider>
  );
}

/** 仅在访问 locale 字段时翻译内置文案；用户传入的组件 children/value 不会进入翻译器。 */
function TranslatedConfig({
  sourceLocale,
  config,
  children,
}: {
  sourceLocale: ZuiLocale;
  config: TranslateConfig;
  children?: React.ReactNode;
}) {
  const { tSync } = useAutoTranslate(config);
  const locale = {} as ZuiLocale;
  for (const component of LOCALE_SECTIONS) {
    Object.defineProperty(locale, component, {
      enumerable: true,
      get: () => translateLocaleValue(sourceLocale[component], component, '', tSync),
    });
  }
  return (
    <ZuiConfigContext.Provider value={{ locale, sourceLocale, translate: config }}>
      {children}
    </ZuiConfigContext.Provider>
  );
}
