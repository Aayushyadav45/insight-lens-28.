// Shared Lovable AI Gateway helpers for MCP tools.
// NOTE: every env read happens inside a function — this module must stay
// import-safe (no top-level env reads, I/O, or throws).

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function apiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway is not configured");
  return key;
}

type Content =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export async function chat(opts: {
  system: string;
  user: Content;
  model?: string;
  json?: boolean;
}): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 429) throw new Error("Rate limited. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`AI gateway error (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Download an image URL and turn it into a data URL the vision model accepts. */
export async function imageUrlToDataUrl(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Only https image URLs are supported");

  const res = await fetch(parsed.toString());
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);

  const mime = res.headers.get("content-type") ?? "image/jpeg";
  if (!/^image\//.test(mime)) throw new Error(`URL is not an image (${mime})`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 6 * 1024 * 1024) throw new Error("Image too large (max 6MB)");

  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export function textResult(text: string, structured?: Record<string, unknown>) {
  return structured
    ? { content: [{ type: "text" as const, text }], structuredContent: structured }
    : { content: [{ type: "text" as const, text }] };
}

export function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return { content: [{ type: "text" as const, text: message }], isError: true };
}