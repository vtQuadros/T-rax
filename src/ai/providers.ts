import { ipc } from "@/lib/ipc";
import { type AiSettings, newId } from "@/lib/store";

export type ToolCall = { id: string; name: string; args: string };
export type Msg =
  | { role: "system"; content: string }
  | { role: "user"; content: string; images?: { mime: string; data: string }[] }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; content: string; toolCallId: string; name: string };

export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };

export type ChatRequest = {
  settings: AiSettings;
  messages: Msg[];
  tools?: ToolDef[];
  model?: string;
  maxTokens?: number;
  onText?: (delta: string) => void;
  signal?: AbortSignal;
};

export type ChatResult = { text: string; toolCalls: ToolCall[] };

/** Feeds raw chunks and yields complete SSE `data:` payloads. */
function sseParser(onData: (payload: string) => void) {
  let buf = "";
  return (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) onData(line.slice(5).trim());
    }
  };
}

async function streamHttp(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  onPayload: (p: string) => void,
  signal?: AbortSignal,
) {
  const requestId = newId("ai");
  let status = 0;
  let errorBody = "";
  let streamError: unknown = null;
  const feed = sseParser(onPayload);
  const abort = () => void ipc.aiCancel(requestId);
  signal?.addEventListener("abort", abort);
  try {
    await ipc.aiStream(requestId, url, headers, JSON.stringify(body), (e) => {
      if (e.type === "status") status = e.status;
      else if (status >= 400) errorBody += e.data;
      else if (!streamError) {
        try {
          feed(e.data);
        } catch (err) {
          streamError = err;
        }
      }
    });
  } finally {
    signal?.removeEventListener("abort", abort);
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (streamError) throw streamError;
  if (status >= 400) {
    let msg = errorBody;
    try {
      const j = JSON.parse(errorBody);
      msg = j.error?.message ?? j.message ?? errorBody;
    } catch {}
    throw new Error(`HTTP ${status}: ${msg.slice(0, 500)}`);
  }
}

async function chatOpenAI(req: ChatRequest): Promise<ChatResult> {
  const { settings: s } = req;
  const messages = req.messages.map((m) => {
    if (m.role === "assistant")
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls?.length
          ? m.toolCalls.map((t) => ({ id: t.id, type: "function", function: { name: t.name, arguments: t.args || "{}" } }))
          : undefined,
      };
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    if (m.role === "user" && m.images?.length)
      return {
        role: "user",
        content: [
          { type: "text", text: m.content },
          ...m.images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.data}` } })),
        ],
      };
    return { role: m.role, content: m.content };
  });
  const body: Record<string, unknown> = {
    model: req.model || s.model,
    messages,
    stream: true,
    max_tokens: req.maxTokens,
  };
  if (req.tools?.length)
    body.tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (s.apiKey) headers.authorization = `Bearer ${s.apiKey}`;

  let text = "";
  const calls: ToolCall[] = [];
  await streamHttp(
    `${s.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    headers,
    body,
    (p) => {
      if (p === "[DONE]") return;
      let j: any;
      try {
        j = JSON.parse(p);
      } catch {
        return;
      }
      const d = j.choices?.[0]?.delta;
      if (!d) return;
      if (d.content) {
        text += d.content;
        req.onText?.(d.content);
      }
      for (const tc of d.tool_calls ?? []) {
        const i = tc.index ?? calls.length;
        calls[i] ??= { id: tc.id ?? newId("call"), name: "", args: "" };
        if (tc.id) calls[i].id = tc.id;
        if (tc.function?.name) calls[i].name += tc.function.name;
        if (tc.function?.arguments) calls[i].args += tc.function.arguments;
      }
    },
    req.signal,
  );
  return { text, toolCalls: calls.filter(Boolean) };
}

async function chatAnthropic(req: ChatRequest): Promise<ChatResult> {
  const { settings: s } = req;
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const out: { role: "user" | "assistant"; content: any[] }[] = [];
  const push = (role: "user" | "assistant", block: unknown) => {
    const last = out[out.length - 1];
    if (last?.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };
  for (const m of req.messages) {
    if (m.role === "user") {
      for (const i of m.images ?? []) push("user", { type: "image", source: { type: "base64", media_type: i.mime, data: i.data } });
      push("user", { type: "text", text: m.content });
    }
    else if (m.role === "tool") push("user", { type: "tool_result", tool_use_id: m.toolCallId, content: m.content });
    else if (m.role === "assistant") {
      if (m.content) push("assistant", { type: "text", text: m.content });
      for (const t of m.toolCalls ?? []) {
        let input = {};
        try {
          input = JSON.parse(t.args || "{}");
        } catch {}
        push("assistant", { type: "tool_use", id: t.id, name: t.name, input });
      }
    }
  }
  const body: Record<string, unknown> = {
    model: req.model || s.model,
    max_tokens: req.maxTokens ?? 8192,
    system: system || undefined,
    messages: out,
    stream: true,
  };
  if (req.tools?.length) body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  const base = s.baseUrl.includes("anthropic") ? s.baseUrl.replace(/\/+$/, "") : "https://api.anthropic.com/v1";

  let text = "";
  const blocks: Record<number, ToolCall> = {};
  await streamHttp(
    `${base}/messages`,
    { "content-type": "application/json", "x-api-key": s.apiKey, "anthropic-version": "2023-06-01" },
    body,
    (p) => {
      let j: any;
      try {
        j = JSON.parse(p);
      } catch {
        return;
      }
      if (j.type === "content_block_start" && j.content_block?.type === "tool_use") {
        blocks[j.index] = { id: j.content_block.id, name: j.content_block.name, args: "" };
      } else if (j.type === "content_block_delta") {
        if (j.delta?.type === "text_delta") {
          text += j.delta.text;
          req.onText?.(j.delta.text);
        } else if (j.delta?.type === "input_json_delta" && blocks[j.index]) {
          blocks[j.index].args += j.delta.partial_json;
        }
      } else if (j.type === "error") {
        throw new Error(j.error?.message ?? "Anthropic stream error");
      }
    },
    req.signal,
  );
  return { text, toolCalls: Object.values(blocks) };
}

export function chat(req: ChatRequest): Promise<ChatResult> {
  return req.settings.provider === "anthropic" ? chatAnthropic(req) : chatOpenAI(req);
}

export const PROVIDER_PRESETS: { label: string; provider: AiSettings["provider"]; baseUrl: string; model: string }[] = [
  { label: "OpenAI", provider: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  { label: "Anthropic", provider: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-5-5" },
  { label: "LM Studio (local)", provider: "openai", baseUrl: "http://localhost:1234/v1", model: "local-model" },
  { label: "Ollama (local)", provider: "openai", baseUrl: "http://localhost:11434/v1", model: "qwen2.5-coder" },
  { label: "Groq", provider: "openai", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { label: "OpenRouter", provider: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4.1-mini" },
];
