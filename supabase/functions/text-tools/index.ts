import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface Req {
  text?: string;
  action: 'translate' | 'summarize' | 'chat';
  targetLang?: string; // for translate, default English
  messages?: { role: 'system' | 'user' | 'assistant'; content: string }[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!LOVABLE_API_KEY) return json({ error: 'Missing LOVABLE_API_KEY' }, 500);

  let body: Req;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (body.action === 'chat') {
    const messages = body.messages || [];
    if (messages.length === 0) {
      return json({ error: 'messages is required for chat action' }, 400);
    }

    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: messages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429) return json({ error: 'Rate limited. Please try again shortly.' }, 429);
        if (res.status === 402) return json({ error: 'AI credits exhausted. Add credits in Settings.' }, 402);
        return json({ error: 'AI gateway error', detail: errText }, 502);
      }

      const data = await res.json();
      const output = data?.choices?.[0]?.message?.content?.trim() || '';
      return json({ action: 'chat', output });
    } catch (e) {
      return json({ error: 'Server error', detail: String(e) }, 500);
    }
  }

  const text = (body.text || '').trim();
  if (!text) return json({ error: 'text is required' }, 400);
  if (text.length > 8000) return json({ error: 'text too long (max 8000 chars)' }, 400);
  if (body.action !== 'translate' && body.action !== 'summarize') {
    return json({ error: 'action must be translate or summarize' }, 400);
  }

  const target = body.targetLang?.trim() || 'English';
  const system = body.action === 'translate'
    ? `You are a professional translator. Translate the user's text into ${target}. Preserve line breaks, punctuation, and proper nouns. Reply with ONLY the translation — no preamble, no quotes, no explanation.`
    : `You are a concise summarizer. Summarize the user's text in 2-4 sentences, preserving key facts, numbers, names, and intent. Reply with ONLY the summary.`;

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) return json({ error: 'Rate limited. Please try again shortly.' }, 429);
      if (res.status === 402) return json({ error: 'AI credits exhausted. Add credits in Settings.' }, 402);
      return json({ error: 'AI gateway error', detail: errText }, 502);
    }

    const data = await res.json();
    const output = data?.choices?.[0]?.message?.content?.trim() || '';
    return json({ action: body.action, output });
  } catch (e) {
    return json({ error: 'Server error', detail: String(e) }, 500);
  }
});