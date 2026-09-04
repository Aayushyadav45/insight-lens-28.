import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const SYSTEM_PROMPT = `You are Lensly, an expert AI photo analyst with deep knowledge of objects, text, food, plants, animals, landmarks, art, and everyday scenes.

Analyze the provided image and return ONLY a valid JSON object matching this exact schema (no markdown, no commentary):

{
  "title": "short 2-5 word title for the image",
  "description": "2-3 sentence vivid, accurate general description",
  "category": "one of: food | plant | animal | landmark | document | product | person | scene | art | other",
  "tags": [{ "label": "string", "confidence": 0-100 }],   // 5-10 most relevant detected objects/concepts
  "ocr": { "hasText": boolean, "text": "extracted text verbatim or empty", "language": "ISO code or empty" },
  "insights": {
    "headline": "one-line contextual insight headline",
    "markdown": "rich markdown with details. For food: estimated calories per serving + a short recipe. For plants/animals: species name, family, habitat, care tips. For landmarks: name, location, historical context. For documents: summary. For products: type, likely brand/use. Use ## headings, **bold**, lists, and tables where useful."
  },
  "recommendations": [
    { "title": "short action", "description": "1 sentence why", "icon": "one of: translate | shop | recipe | learn | fix | share | save | search" }
  ],   // 3-5 actionable next steps
  "quality": { "score": 0-100, "notes": "blurry/dark/well-lit/etc" },
  "safety": { "flagged": boolean, "reason": "string or empty" },
  "related": [
    { "query": "2-4 word visual search query for a similar image", "caption": "1 sentence describing what this related image typically shows" }
  ],   // exactly 4 related image ideas closely matching the subject
  "pricing": {
    "isProduct": boolean,
    "productName": "best-guess specific product name to search for, or empty",
    "currency": "USD",
    "estimatedRange": { "low": number, "high": number },
    "platforms": [
      { "name": "one of: Amazon | eBay | Walmart | Best Buy | Target | AliExpress | Etsy", "price": number, "note": "short note like 'new', 'used', 'avg listing'" }
    ]   // 3-5 platforms with realistic estimated prices when isProduct is true; otherwise empty array
  },
  "visual_search_objects": [
    {
      "label": "short name of detected object (e.g. coffee cup)",
      "box_2d": [ymin, xmin, ymax, xmax], // normalized box coordinates 0-100 relative to image size as integers (e.g. [20, 15, 65, 80] representing ymin=20%, xmin=15%, ymax=65%, xmax=80%)
      "isProduct": boolean,
      "estimatedRange": { "low": number, "high": number },
      "platforms": [
        { "name": "Amazon | eBay | Walmart | Best Buy | Target | AliExpress | Etsy", "price": number, "note": "string" }
      ],
      "related_query": "specific visual search query string (e.g. 'starbucks ceramic coffee cup')"
    }
  ]   // 2-5 prominent objects/regions in the image with their coordinates
}

Be precise with confidence scores. If the image is unreadable, set quality.score low and explain in description.
For "related", always provide 4 queries that would surface visually similar real-world photos.
For "pricing": set isProduct=true ONLY when category is "product" or the image clearly shows a buyable consumer item. Provide realistic current US market price estimates based on your knowledge; mark notes appropriately. If not a product, set isProduct=false and platforms=[].
For "visual_search_objects": Detect 2-5 prominent objects or regions. For each, provide its label, normalized coordinates [ymin, xmin, ymax, xmax] as integers between 0 and 100 relative to the image size, pricing info (if buyable), and a related_query query string for visual search.`;

interface AnalyzeRequest {
  imageBase64: string;       // data URL or raw base64
  mimeType?: string;
  model?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractJson(text: string): unknown {
  // Strip markdown fences if model wrapped output
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }
  // Try to find first { ... last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  throw new Error('Model did not return valid JSON');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const reqId = crypto.randomUUID();
  const t0 = Date.now();

  try {
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: 'AI gateway is not configured' }, 500);
    }

    const body = (await req.json()) as AnalyzeRequest;
    if (!body?.imageBase64 || typeof body.imageBase64 !== 'string') {
      return jsonResponse({ error: 'imageBase64 is required' }, 400);
    }

    const dataUrl = body.imageBase64.startsWith('data:')
      ? body.imageBase64
      : `data:${body.mimeType ?? 'image/jpeg'};base64,${body.imageBase64}`;

    // Rough size guard (base64 ~33% larger than bytes)
    const approxBytes = (dataUrl.length * 3) / 4;
    if (approxBytes > 8 * 1024 * 1024) {
      return jsonResponse({ error: 'Image too large (max ~8MB after encoding)' }, 413);
    }

    console.log(JSON.stringify({ reqId, event: 'analyze.start', bytes: Math.round(approxBytes) }));

    const model = body.model ?? 'google/gemini-2.5-pro';

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this photo and return the JSON schema.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(JSON.stringify({ reqId, event: 'ai.error', status: aiRes.status, errText }));
      if (aiRes.status === 429) return jsonResponse({ error: 'Rate limit reached. Try again in a moment.' }, 429);
      if (aiRes.status === 402) return jsonResponse({ error: 'AI credits exhausted. Add credits in Workspace settings.' }, 402);
      return jsonResponse({ error: 'AI gateway error', detail: errText }, 502);
    }

    const ai = await aiRes.json();
    const content: string | undefined = ai?.choices?.[0]?.message?.content;
    if (!content) {
      return jsonResponse({ error: 'Empty AI response' }, 502);
    }

    const result = extractJson(content);
    const ms = Date.now() - t0;
    console.log(JSON.stringify({ reqId, event: 'analyze.ok', ms, model }));

    return jsonResponse({ result, meta: { reqId, ms, model } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(JSON.stringify({ reqId, event: 'analyze.fail', message }));
    return jsonResponse({ error: message }, 500);
  }
});