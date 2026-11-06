/**
 * OpenAI 适配器（chat/completions）—— system prompt 注明组件上下文，见 CONTRACTS-V3 §2。
 * 零重依赖：只用 fetch。
 */
import type {
  TranslateContext,
  TranslateProviderOptions,
  TranslateRequest,
} from '../useAutoTranslate.js';

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/** Host-only base URLs use /v1; versioned or proxied paths keep their prefix. */
function chatCompletionsURL(baseURL: string): string {
  const base = baseURL.replace(/\/+$/, '');
  const path = new URL(base, 'https://zui.invalid').pathname;
  return `${base}${path === '/' ? '/v1' : ''}/chat/completions`;
}

/** 组件上下文 → 自然语言提示片段：'这是 Select 组件的 placeholder' */
export function describeContext(context?: TranslateContext): string {
  if (context?.component && context?.role)
    return `这是 ${context.component} 组件的 ${context.role}（UI 内置文案）`;
  if (context?.component) return `这是 ${context.component} 组件的内置文案`;
  if (context?.role) return `这是 UI 组件的 ${context.role}`;
  return '';
}

/** 组装 system prompt：翻译要求 + 语言方向 + 组件上下文注入 */
export function buildSystemPrompt(request: TranslateRequest, context?: TranslateContext): string {
  const lines = [
    `你是 ZUI 组件库的 UI 文案翻译引擎。把用户消息从 ${request.sourceLang} 翻译成 ${request.targetLang}。`,
    '要求：只输出译文本身，不要解释、不要引号、保持占位符与术语一致，语气符合 UI 控件用语（简洁、祈使、无句末标点偏好与原文一致）。',
  ];
  const hint = describeContext(context);
  if (hint) lines.push(hint);
  return lines.join('\n');
}

/** Each request keeps its own context; bound concurrency to avoid serial latency and request bursts. */
const MAX_CONCURRENT_REQUESTS = 3;

/** OpenAI chat/completions 翻译：逐条保留上下文，最多同时发送三条请求 */
export async function translateWithOpenAI(
  request: TranslateRequest,
  options: TranslateProviderOptions = {}
): Promise<string[]> {
  const endpoint =
    options.endpoint ?? (options.baseURL ? chatCompletionsURL(options.baseURL) : DEFAULT_ENDPOINT);
  const model = options.model ?? DEFAULT_MODEL;
  const results = new Array<string>(request.texts.length);
  let nextIndex = 0;
  let firstError: unknown;
  const translateNext = async (): Promise<void> => {
    while (firstError === undefined && nextIndex < request.texts.length) {
      const i = nextIndex++;
      const context = request.contexts?.[i];
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: buildSystemPrompt(request, context) },
              { role: 'user', content: request.texts[i] },
            ],
          }),
        });
        if (!res.ok) throw new Error(`OpenAI 翻译失败：HTTP ${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.length === 0) {
          throw new Error('OpenAI 翻译失败：响应缺少 choices[0].message.content');
        }
        results[i] = content.trim();
      } catch (error) {
        firstError = error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, request.texts.length) }, () =>
      translateNext()
    )
  );
  if (firstError !== undefined) throw firstError;
  return results;
}
