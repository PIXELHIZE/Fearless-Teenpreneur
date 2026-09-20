import "server-only";

const URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.8-flash";
const PROVIDER = process.env.OPENROUTER_PROVIDER ?? "google-ai-studio";

export function aiEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export type JsonSchema = Record<string, unknown>;

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

interface ToolCall {
  function?: { name?: string; arguments?: string };
}

interface CompletionResponse {
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  error?: { message?: string };
}

async function post(payload: Record<string, unknown>): Promise<CompletionResponse> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AiError("OPENROUTER_API_KEY 가 설정되지 않았습니다.");

  const response = await fetch(URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "x-title": "teum",
    },
    body: JSON.stringify({ model: MODEL, provider: { only: [PROVIDER], allow_fallbacks: false }, ...payload }),
  });

  const data = (await response.json().catch(() => null)) as CompletionResponse | null;
  if (!response.ok) throw new AiError(data?.error?.message ?? `AI 호출 실패 (${response.status})`);
  if (!data) throw new AiError("AI 응답을 읽지 못했습니다.");
  return data;
}

export class AiError extends Error {}

/**
 * 도구 호출을 강제해 구조화된 결과만 받는다.
 * 모델이 JSON 을 문자열로 돌려주므로 반드시 파싱해서 쓴다.
 */
export async function askForJson<T>(options: {
  system: string;
  messages: ChatMessage[];
  name: string;
  description: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  const payload = {
    messages: [{ role: "system", content: options.system }, ...options.messages],
    tools: [
      {
        type: "function",
        function: { name: options.name, description: options.description, parameters: options.schema },
      },
    ],
    tool_choice: { type: "function", function: { name: options.name } },
    max_tokens: options.maxTokens ?? 8000,
  };

  // 모델이 가끔 도구를 부르지 않고 글로 답한다. 그럴 때는 한 번 더 시도한다.
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const data = await post(payload);
    const call = data.choices?.[0]?.message?.tool_calls?.find((c) => c.function?.name === options.name);
    if (call?.function?.arguments) {
      try {
        return JSON.parse(call.function.arguments) as T;
      } catch {
        lastError = new AiError("AI 응답을 해석하지 못했습니다.");
        continue;
      }
    }
    lastError = new AiError("AI 가 결과를 만들지 못했습니다.");
  }
  throw lastError ?? new AiError("AI 가 결과를 만들지 못했습니다.");
}

/** 도구 없이 대화 형태로 답을 받는다. */
export async function askForText(options: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<string> {
  const data = await post({
    messages: [{ role: "system", content: options.system }, ...options.messages],
    max_tokens: options.maxTokens ?? 2000,
  });
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** 문자열 배열 스키마 헬퍼 */
export const stringArray = (description: string): JsonSchema => ({
  type: "array",
  description,
  items: { type: "string" },
});
