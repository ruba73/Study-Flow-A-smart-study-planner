const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  error?: string;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getOllamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
}

export function getOllamaModel() {
  return process.env.OLLAMA_MODEL || "llama3.1";
}

function cleanJsonText(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

function readValidJsonText(content: string) {
  const cleaned = cleanJsonText(content);
  JSON.parse(cleaned);
  return cleaned;
}

export async function generateOllamaJson(args: {
  systemInstruction: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  requestAttempts?: number;
}) {
  const numPredict = args.maxTokens ?? 4000;
  const temperature = args.temperature ?? 0.2;
  const messages: ChatMessage[] = [
    { role: "system", content: args.systemInstruction },
    { role: "user", content: args.prompt },
  ];

  const requestBodies = [
    {
      model: getOllamaModel(),
      messages,
      format: args.schema,
      stream: false,
      options: {
        num_predict: numPredict,
        temperature,
      },
    },
    {
      model: getOllamaModel(),
      messages,
      format: "json",
      stream: false,
      options: {
        num_predict: numPredict,
        temperature,
      },
    },
    {
      model: getOllamaModel(),
      messages: [
        { role: "system", content: `${args.systemInstruction} Return only valid JSON. Do not include markdown.` },
        { role: "user", content: args.prompt },
      ],
      stream: false,
      options: {
        num_predict: numPredict,
        temperature,
      },
    },
  ];

  let lastError: string | null = null;
  const attempts = Math.max(1, Math.min(args.requestAttempts ?? requestBodies.length, requestBodies.length));

  for (const body of requestBodies.slice(0, attempts)) {
    try {
      const content = await postOllamaChat(body, args.timeoutMs);
      if (content) return readValidJsonText(content);
      lastError = "Ollama returned an empty response";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Ollama request failed";
    }
  }

  throw new Error(lastError ?? "Ollama request failed");
}

async function postOllamaChat(body: Record<string, unknown>, timeoutMs?: number) {
  const controller = timeoutMs ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response: Response;
  try {
    response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "connection failed";
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Ollama is unavailable at ${getOllamaBaseUrl()}. Start Ollama and pull ${getOllamaModel()}. Details: ${detail}`);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const json = (await response.json()) as OllamaChatResponse;
  if (!response.ok || json.error) {
    throw new Error(json.error || `Ollama request failed: ${JSON.stringify(json)}`);
  }

  const content = json.message?.content ?? "";
  if (!content.trim()) {
    throw new Error("Ollama returned an empty response");
  }

  return content;
}

export async function generateOllamaText(args: {
  systemInstruction: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  return postOllamaChat({
    model: getOllamaModel(),
    messages: [{ role: "system", content: args.systemInstruction }, ...args.messages],
    stream: false,
    options: {
      num_predict: 4000,
      temperature: 0.3,
    },
  });
}
