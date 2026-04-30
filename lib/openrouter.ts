const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface OpenRouterChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
    code?: string | number;
  };
}

type OpenRouterMessageContent = NonNullable<NonNullable<OpenRouterChoice["message"]>["content"]>;

function getApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your_openrouter_api_key_here") {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return apiKey;
}

export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
}

function readContent(content?: OpenRouterMessageContent) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? "").join("");
  return "";
}

export async function generateOpenRouterJson(args: {
  systemInstruction: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  plugins?: Array<Record<string, unknown>>;
}) {
  const messages = [
    { role: "system", content: args.systemInstruction },
    { role: "user", content: args.prompt },
  ];

  const requestBodies = [
    {
      model: getOpenRouterModel(),
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: args.schemaName,
          strict: true,
          schema: args.schema,
        },
      },
    },
    {
      model: getOpenRouterModel(),
      messages,
      response_format: {
        type: "json_object",
      },
    },
    {
      model: getOpenRouterModel(),
      messages: [
        { role: "system", content: `${args.systemInstruction} Return only valid JSON. Do not include markdown.` },
        { role: "user", content: args.prompt },
      ],
    },
  ];

  let lastError: string | null = null;

  for (const body of requestBodies) {
    try {
      const content = await postOpenRouterJson({
        ...body,
        ...(args.plugins && body.response_format?.type === "json_schema" ? { plugins: args.plugins } : {}),
      });

      if (content) return content;
      lastError = "OpenRouter returned an empty response";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "OpenRouter request failed";
    }
  }

  throw new Error(lastError ?? "OpenRouter request failed");
}

async function postOpenRouterJson(body: Record<string, unknown>) {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "StudyFlow",
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as OpenRouterResponse;
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `OpenRouter request failed: ${JSON.stringify(json)}`);
  }

  const content = readContent(json.choices?.[0]?.message?.content);
  if (!content.trim()) {
    throw new Error("OpenRouter returned an empty response");
  }

  return content;
}

export async function generateOpenRouterText(args: {
  systemInstruction: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "StudyFlow",
    },
    body: JSON.stringify({
      model: getOpenRouterModel(),
      messages: [{ role: "system", content: args.systemInstruction }, ...args.messages],
      temperature: 0.3,
    }),
  });

  const json = (await response.json()) as OpenRouterResponse;
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `OpenRouter request failed: ${JSON.stringify(json)}`);
  }

  const content = readContent(json.choices?.[0]?.message?.content);
  if (!content.trim()) {
    throw new Error("OpenRouter returned an empty response");
  }

  return content;
}
