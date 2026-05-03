type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  } | string;
};

const DEFAULT_AI_BASE_URL = "https://api.llm7.io/v1";
const DEFAULT_AI_MODEL = "default";
const DEFAULT_JSON_MAX_TOKENS = 1200;
const DEFAULT_TEXT_MAX_TOKENS = 1200;

function getAiBaseUrl() {
  return (process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL).replace(/\/$/, "");
}

function getAiApiKey() {
  return process.env.AI_API_KEY || process.env.LLM7_API_KEY || "";
}

export function getAiModel() {
  return process.env.AI_MODEL || DEFAULT_AI_MODEL;
}

function readErrorMessage(json: ChatCompletionResponse) {
  if (typeof json.error === "string") return json.error;
  return json.error?.message;
}

function cleanJsonText(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function readValidJsonText(content: string) {
  const cleaned = cleanJsonText(content);
  JSON.parse(cleaned);
  return cleaned;
}

async function postChatCompletion(args: {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
}) {
  const apiKey = getAiApiKey();
  if (!apiKey) {
    throw new Error("AI_API_KEY or LLM7_API_KEY is not configured");
  }

  const controller = args.timeoutMs ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), args.timeoutMs) : null;

  try {
    const response = await fetch(`${getAiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getAiModel(),
        messages: args.messages,
        max_tokens: args.maxTokens ?? (args.jsonMode ? DEFAULT_JSON_MAX_TOKENS : DEFAULT_TEXT_MAX_TOKENS),
        temperature: args.temperature ?? 0.2,
        ...(args.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller?.signal,
    });

    const json = (await response.json()) as ChatCompletionResponse;
    const errorMessage = readErrorMessage(json);
    if (!response.ok || errorMessage) {
      throw new Error(errorMessage || `AI provider request failed with status ${response.status}`);
    }

    const content = json.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) {
      throw new Error("AI provider returned an empty response");
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI provider request timed out after ${args.timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function generateAiJson(args: {
  systemInstruction: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  requestAttempts?: number;
}) {
  const schemaPrompt = `Return only valid JSON for schema "${args.schemaName}". Do not include markdown, comments, or explanatory text.

JSON schema:
${JSON.stringify(args.schema)}`;

  const messages: ChatMessage[] = [
    { role: "system", content: `${args.systemInstruction}\n\n${schemaPrompt}` },
    { role: "user", content: args.prompt },
  ];

  const attempts = Math.max(1, args.requestAttempts ?? 1);
  let lastError: string | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const content = await postChatCompletion({
        messages:
          attempt === 0
            ? messages
            : [
                {
                  role: "system",
                  content: `${args.systemInstruction}\n\n${schemaPrompt}\n\nThe previous response was invalid. Return only parseable JSON.`,
                },
                { role: "user", content: args.prompt },
              ],
        maxTokens: args.maxTokens,
        temperature: args.temperature,
        timeoutMs: args.timeoutMs,
        jsonMode: false,
      });
      return readValidJsonText(content);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "AI provider request failed";
    }
  }

  throw new Error(lastError ?? "AI provider did not return valid JSON");
}

export async function generateAiText(args: {
  systemInstruction: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  return postChatCompletion({
    messages: [{ role: "system", content: args.systemInstruction }, ...args.messages],
    maxTokens: DEFAULT_TEXT_MAX_TOKENS,
    temperature: 0.3,
    timeoutMs: 60_000,
  });
}
