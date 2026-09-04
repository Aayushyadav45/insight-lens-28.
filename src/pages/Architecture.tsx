import { useEffect } from 'react';
import { Nav } from '@/components/lensly/Nav';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PAYLOAD = `POST https://ai.gateway.lovable.dev/v1/chat/completions
Authorization: Bearer $LOVABLE_API_KEY
Content-Type: application/json

{
  "model": "google/gemini-2.5-pro",
  "messages": [
    { "role": "system", "content": "You are Lensly, an expert AI photo analyst..." },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Analyze this photo and return the JSON schema." },
        { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,/9j/4AAQ..." } }
      ]
    }
  ],
  "response_format": { "type": "json_object" }
}`;

const RESPONSE = `{
  "result": {
    "title": "Golden Retriever in park",
    "description": "A young golden retriever sits on a sunlit grass field...",
    "category": "animal",
    "tags": [{ "label": "golden retriever", "confidence": 96 }, { "label": "dog", "confidence": 99 }],
    "ocr": { "hasText": false, "text": "", "language": "" },
    "insights": {
      "headline": "Golden Retriever — friendly family breed",
      "markdown": "## Species\\nCanis lupus familiaris...\\n\\n## Care tips\\n- Daily exercise..."
    },
    "recommendations": [
      { "title": "Find local groomers", "description": "...", "icon": "search" }
    ],
    "quality": { "score": 87, "notes": "well-lit, sharp" },
    "safety": { "flagged": false, "reason": "" }
  },
  "meta": { "reqId": "...", "ms": 2840, "model": "google/gemini-2.5-pro" }
}`;

const DIAGRAM = String.raw`
┌────────────────┐   compressed   ┌──────────────────────┐  vision  ┌──────────────────┐
│  Browser (UI)  │  base64 image  │  Edge Function       │  request │  Lovable AI      │
│  React + Vite  │ ─────────────► │  /analyze-image      │ ───────► │  Gateway         │
│  - drag/drop   │                │  - validate (zod)    │          │  Gemini 2.5 Pro  │
│  - camera      │                │  - rate limit        │ ◄─────── │  (multimodal)    │
│  - compress    │ ◄───────────── │  - JSON parse        │   JSON   └──────────────────┘
│  - dashboard   │   JSON result  │  - structured log    │
└────────────────┘                └──────────────────────┘
`;

const MD = `
## Overview
Lensly is a production-ready AI photo analysis app. The browser handles upload, compression, and rendering; an edge function adds validation, logging, and proxies to the Lovable AI Gateway, which returns structured multimodal vision results.

## Stack
| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite + TS + Tailwind + shadcn | Fast SPA, premium UI primitives |
| Backend | Lovable Cloud edge functions (Deno) | Zero-config TS server, secrets handled |
| Vision | Lovable AI Gateway → \`google/gemini-2.5-pro\` | Strong multimodal reasoning, no key setup |
| Storage | In-memory (base64 → AI). Optional Cloud Storage bucket created | Ephemeral by design, no PII at rest |
| Compression | \`browser-image-compression\` | ≤1.5MB, 1600px max, WebWorker offload |
| Markdown | \`react-markdown\` + \`remark-gfm\` | Insights rendering |
| Animation | \`framer-motion\` | Result entrance |

## System diagram
\`\`\`
${DIAGRAM}
\`\`\`

## Endpoints
- **POST \`/functions/v1/analyze-image\`** — body: \`{ imageBase64, mimeType?, model? }\` → structured analysis JSON.
- Invoked from the client via \`supabase.functions.invoke('analyze-image', { body })\`.

## AI request payload
\`\`\`http
${PAYLOAD}
\`\`\`

## AI response (parsed)
\`\`\`json
${RESPONSE}
\`\`\`

## Security
- Secrets (\`LOVABLE_API_KEY\`) live server-side only; never shipped to the browser.
- Strict size guard (~8 MB) + mime allowlist (JPEG/PNG/WEBP/HEIC).
- CORS preflight handled; structured JSON logs include request ID + duration.
- No image persistence by default; the optional \`photo-analysis\` bucket is opt-in and ephemeral.
- 429 / 402 surfaced to the UI with actionable copy.

## Performance
- Client-side compression to ≤1.5 MB before transit, WebWorker-based.
- Single round-trip: edge function → AI → browser.
- Skeleton UI during inference; markdown insights render progressively.

## Testing strategy
- Unit: schema parser & compression utility (Vitest).
- Integration: invoke edge function with golden fixtures.
- Manual: blurry / dark / multilingual OCR / landmark / food samples.

## Deployment
- Frontend ships automatically with Lovable.
- Edge functions deploy on save — no Docker or CI/CD setup required for the default flow.
- For a custom FastAPI/Vercel split, replace \`supabase.functions.invoke\` with \`fetch('/api/analyze-image')\` and reuse the same JSON schema.
`;

const Architecture = () => {
  useEffect(() => {
    document.title = 'Architecture — Lensly';
  }, []);
  return (
    <div className="min-h-screen bg-surface">
      <Nav />
      <main className="container max-w-4xl px-4 py-10 md:py-20">
        <header className="space-y-3 mb-8 md:mb-10">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Docs</span>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl">Architecture</h1>
          <p className="text-muted-foreground max-w-xl">
            How Lensly turns a photo into structured insight — end to end.
          </p>
        </header>
        <article className="prose prose-sm md:prose-base prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-pre:bg-card prose-pre:border prose-pre:border-border prose-pre:rounded-2xl prose-pre:overflow-x-auto prose-pre:text-xs prose-code:before:hidden prose-code:after:hidden prose-a:text-primary prose-strong:text-foreground prose-table:text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{MD}</ReactMarkdown>
        </article>
      </main>
    </div>
  );
};

export default Architecture;