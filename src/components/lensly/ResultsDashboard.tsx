import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import {
  Copy, FileText, Lightbulb, Languages, ShoppingBag, ChefHat, GraduationCap, Wrench, Share2, Bookmark, Search,
  Images, Tag, ExternalLink, Download, Sparkles, Loader2, Volume2, Square, Globe,
} from 'lucide-react';
import { ConfidenceBar } from './ConfidenceBar';
import type { AnalysisResponse, VisualSearchObject } from '@/lib/analyze';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  translate: Languages, shop: ShoppingBag, recipe: ChefHat, learn: GraduationCap,
  fix: Wrench, share: Share2, save: Bookmark, search: Search,
};

// ISO 639-1 → human-readable language name (covers most OCR returns).
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese',
  nl: 'Dutch', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', pl: 'Polish',
  ru: 'Russian', uk: 'Ukrainian', cs: 'Czech', tr: 'Turkish', el: 'Greek', ro: 'Romanian',
  hu: 'Hungarian', bg: 'Bulgarian', sr: 'Serbian', hr: 'Croatian',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian',
  ms: 'Malay', tl: 'Tagalog',
  hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
  pa: 'Punjabi', ur: 'Urdu', ne: 'Nepali',
  ar: 'Arabic', he: 'Hebrew', fa: 'Persian',
};
const languageName = (code?: string) => {
  if (!code) return '';
  const base = code.toLowerCase().split(/[-_]/)[0];
  return LANG_NAMES[base] || code.toUpperCase();
};
// Map ISO 639-1 → BCP-47 tag for Web Speech API. Browser will pick best matching voice.
const speechLang = (code?: string) => {
  const base = (code || '').toLowerCase().split(/[-_]/)[0];
  const map: Record<string, string> = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-BR',
    nl: 'nl-NL', sv: 'sv-SE', pl: 'pl-PL', ru: 'ru-RU', tr: 'tr-TR',
    zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', hi: 'hi-IN', ar: 'ar-SA',
  };
  return map[base] || (base ? base : 'en-US');
};

const PLATFORM_SEARCH: Record<string, (q: string) => string> = {
  Amazon: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  eBay: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
  Walmart: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,
  'Best Buy': (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`,
  Target: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,
  AliExpress: (q) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}`,
  Etsy: (q) => `https://www.etsy.com/search?q=${encodeURIComponent(q)}`,
};

const googleImagesUrl = (query: string) =>
  `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
// Deterministic, always-loading thumbnail from picsum seeded by the query.
const thumbFor = (query: string) => {
  let h = 0;
  for (let i = 0; i < query.length; i++) h = (h * 31 + query.charCodeAt(i)) >>> 0;
  return `https://picsum.photos/seed/${h}/600/600`;
};

interface Props { imageUrl: string; data: AnalysisResponse }

export const ResultsDashboard = ({ imageUrl, data }: Props) => {
  const r = data.result;
  const [selectedObj, setSelectedObj] = useState<VisualSearchObject | null>(null);

  const [busy, setBusy] = useState<null | 'translate' | 'summarize'>(null);
  const [toolOutput, setToolOutput] = useState<{ kind: 'translate' | 'summarize'; text: string } | null>(null);
  const [speaking, setSpeaking] = useState<null | 'original' | 'tool'>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop any speech and reset selection when component unmounts or new analysis arrives.
  useEffect(() => {
    setSelectedObj(null);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [r]);

  const speak = (text: string, lang: string, kind: 'original' | 'tool') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Your browser does not support speech synthesis');
      return;
    }
    // Toggle: if already speaking this section, stop.
    if (speaking === kind) {
      window.speechSynthesis.cancel();
      setSpeaking(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = speechLang(lang);
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => setSpeaking(null);
    utter.onerror = () => setSpeaking(null);
    utterRef.current = utter;
    setSpeaking(kind);
    window.speechSynthesis.speak(utter);
  };

  const runTextTool = async (action: 'translate' | 'summarize') => {
    if (!r.ocr.hasText) return;
    setBusy(action);
    try {
      const { data: res, error } = await supabase.functions.invoke('text-tools', {
        body: { text: r.ocr.text, action, targetLang: 'English' },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      const output = (res as any)?.output as string;
      if (!output) throw new Error('Empty response');
      setToolOutput({ kind: action, text: output });
      toast.success(action === 'translate' ? 'Translated to English' : 'Summary ready');
    } catch (e: any) {
      toast.error(e?.message ?? 'AI request failed');
    } finally {
      setBusy(null);
    }
  };

  const downloadText = () => {
    const blob = new Blob([r.ocr.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted-text.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      <div className="grid md:grid-cols-[2fr,3fr] gap-6">
        <div className="relative rounded-3xl overflow-hidden glass max-w-full w-fit mx-auto select-none">
          <img src={imageUrl} alt={r.title} className="max-w-full max-h-[450px] object-contain block h-auto rounded-3xl" />
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-3 py-1 text-xs font-mono uppercase tracking-wider z-10">
            <span className="size-1.5 rounded-full bg-aurora" /> {r.category}
          </div>

          {/* Render Google Lens Target Dots */}
          {r.visual_search_objects?.map((obj, idx) => {
            const [ymin, xmin, ymax, xmax] = obj.box_2d;
            const centerY = (ymin + ymax) / 2;
            const centerX = (xmin + xmax) / 2;
            const isSelected = selectedObj === obj;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedObj(isSelected ? null : obj)}
                className="absolute size-6 -ml-3 -mt-3 flex items-center justify-center group focus:outline-none transition-transform active:scale-95 z-20"
                style={{ top: `${centerY}%`, left: `${centerX}%` }}
                title={`Search: ${obj.label}`}
              >
                {/* Outer pulsing ring */}
                <span className={`absolute size-full rounded-full animate-ping opacity-75 ${
                  isSelected ? 'bg-primary' : 'bg-white'
                }`} />
                {/* Core dot */}
                <span className={`relative size-3 rounded-full border shadow-elegant transition-all duration-200 group-hover:scale-125 ${
                  isSelected 
                    ? 'bg-primary border-primary scale-110 shadow-primary/50' 
                    : 'bg-white border-foreground/30 group-hover:bg-primary group-hover:border-primary'
                }`} />
                
                {/* Label tooltip on hover */}
                <span className="absolute top-7 bg-background/90 text-foreground text-[10px] font-medium px-2 py-0.5 rounded-full border border-border shadow-elegant opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                  {obj.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-4xl md:text-5xl leading-tight">{r.title}</h2>
            <p className="mt-3 text-muted-foreground text-base leading-relaxed">{r.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {r.tags.slice(0, 8).map((t) => (
              <ConfidenceBar key={t.label} label={t.label} value={t.confidence} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
            <span>Quality {r.quality.score}/100</span>
            <span className="hidden sm:inline">·</span>
            <span>{data.meta.ms}ms</span>
            <span className="hidden sm:inline">·</span>
            <span className="truncate">{data.meta.model}</span>
          </div>
        </div>
      </div>

      {selectedObj ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-primary/40 bg-aurora/5 p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-9 rounded-xl bg-primary/10 items-center justify-center border border-primary/20">
                <Search className="size-4 text-primary" />
              </span>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Visual Search Selection</span>
                <h3 className="font-display text-2xl text-foreground font-semibold">{selectedObj.label}</h3>
              </div>
            </div>
            <button
              onClick={() => setSelectedObj(null)}
              className="text-xs font-mono border border-border rounded-full px-3 py-1.5 hover:bg-secondary transition"
            >
              Clear selection &times;
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Visual Match / Related Images */}
            <section className="space-y-4">
              <header className="flex items-center gap-2 text-sm font-medium">
                <Images className="size-4 text-primary" /> Visual Matches
              </header>
              <p className="text-sm text-muted-foreground">
                Find similar images and matches for "{selectedObj.label}" across the web.
              </p>
              <a
                href={googleImagesUrl(selectedObj.related_query)}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card/40 hover:border-primary/40 hover:bg-card transition"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-aurora/10 overflow-hidden flex items-center justify-center shrink-0 border border-border">
                    <Search className="size-5 text-muted-foreground group-hover:text-primary transition" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Search Google Images</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Query: "{selectedObj.related_query}"</p>
                  </div>
                </div>
                <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground transition" />
              </a>
            </section>

            {/* Shopping & Price Comparison */}
            <section className="space-y-4">
              <header className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="size-4 text-primary" /> Price comparison
                </div>
                {selectedObj.isProduct && selectedObj.estimatedRange && (
                  <div className="text-xs font-mono text-muted-foreground">
                    Est. USD ${selectedObj.estimatedRange.low}–${selectedObj.estimatedRange.high}
                  </div>
                )}
              </header>

              {selectedObj.isProduct && selectedObj.platforms && selectedObj.platforms.length > 0 ? (
                <div className="grid gap-2">
                  {selectedObj.platforms.map((p) => {
                    const url = PLATFORM_SEARCH[p.name]?.(selectedObj.related_query) ?? googleImagesUrl(`${p.name} ${selectedObj.related_query}`);
                    return (
                      <a
                        key={p.name}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/20 hover:border-primary/30 hover:bg-card/40 transition"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-xs flex items-center gap-1.5">
                            {p.name}
                            <span className="text-[9px] text-muted-foreground font-mono">({p.note || 'Estimated'})</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="font-mono text-sm font-medium">${p.price}</p>
                          <ExternalLink className="size-3 text-muted-foreground group-hover:text-foreground transition" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-2xl bg-card/10">
                  <ShoppingBag className="size-6 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">
                    This item does not appear to be a standard retail product.
                  </p>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(selectedObj.label + ' buy online')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline mt-2 inline-flex items-center gap-1"
                  >
                    Try general web shopping search <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </section>
          </div>
        </motion.div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-3xl glass p-6 space-y-3">
          <header className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="size-4 text-primary" /> Contextual insights
          </header>
          <h3 className="font-display text-2xl">{r.insights.headline}</h3>
          <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.insights.markdown}</ReactMarkdown>
          </div>
        </section>

        <section className="rounded-3xl glass p-6 space-y-4">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4 text-primary" /> Extracted text (OCR)
            </div>
            {r.ocr.hasText && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(r.ocr.text);
                    toast.success('Copied to clipboard');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  <Copy className="size-3.5" /> Copy
                </button>
                <button
                  onClick={downloadText}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  <Download className="size-3.5" /> .txt
                </button>
              </div>
            )}
          </header>
          {r.ocr.hasText ? (
            <>
              {r.ocr.language && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-aurora/10 px-3 py-1 text-xs font-mono">
                  <Globe className="size-3.5 text-primary" />
                  <span className="text-muted-foreground">Detected:</span>
                  <span className="font-medium text-foreground">{languageName(r.ocr.language)}</span>
                  <span className="text-muted-foreground uppercase">({r.ocr.language})</span>
                </div>
              )}
              <pre className="rounded-2xl bg-background/60 border border-border p-4 text-sm font-mono whitespace-pre-wrap max-h-72 overflow-auto">
{r.ocr.text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => speak(r.ocr.text, r.ocr.language, 'original')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-aurora/10 px-3 py-1.5 text-xs font-medium hover:bg-aurora/20 transition"
                >
                  {speaking === 'original' ? <Square className="size-3.5 text-primary" /> : <Volume2 className="size-3.5 text-primary" />}
                  {speaking === 'original' ? 'Stop' : 'Read aloud'}
                </button>
                <button
                  onClick={() => runTextTool('translate')}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-aurora/10 px-3 py-1.5 text-xs font-medium hover:bg-aurora/20 transition disabled:opacity-50"
                >
                  {busy === 'translate' ? <Loader2 className="size-3.5 animate-spin" /> : <Languages className="size-3.5 text-primary" />}
                  Translate to English
                </button>
                <button
                  onClick={() => runTextTool('summarize')}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-aurora/10 px-3 py-1.5 text-xs font-medium hover:bg-aurora/20 transition disabled:opacity-50"
                >
                  {busy === 'summarize' ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-primary" />}
                  Summarize
                </button>
              </div>
              {toolOutput && (
                <div className="rounded-2xl border border-primary/20 bg-background/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono uppercase tracking-wider text-primary">
                      {toolOutput.kind === 'translate' ? 'Translation' : 'Summary'}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => speak(toolOutput.text, toolOutput.kind === 'translate' ? 'en' : r.ocr.language, 'tool')}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {speaking === 'tool' ? <Square className="size-3" /> : <Volume2 className="size-3" />}
                        {speaking === 'tool' ? 'Stop' : 'Listen'}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(toolOutput.text);
                          toast.success('Copied');
                        }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3" /> Copy
                      </button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{toolOutput.text}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No legible text detected in this image.</p>
          )}
        </section>
      </div>
      )}

      <section className="rounded-3xl glass p-6 space-y-4">
        <header className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="size-4 text-primary" /> Recommended next steps
        </header>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {r.recommendations.map((rec, i) => {
            const Icon = ICONS[rec.icon] ?? Lightbulb;
            return (
              <div key={i} className="group rounded-2xl border border-border bg-card/40 p-4 hover:border-primary/40 hover:bg-card transition">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-aurora/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{rec.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {r.related && r.related.length > 0 && (
        <section className="rounded-3xl glass p-6 space-y-4">
          <header className="flex items-center gap-2 text-sm font-medium">
            <Images className="size-4 text-primary" /> Related images
          </header>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {r.related.map((rel, i) => (
              <a
                key={i}
                href={googleImagesUrl(rel.query)}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl overflow-hidden border border-border bg-card/40 hover:border-primary/40 transition block"
              >
                <div className="relative aspect-square bg-aurora/10 overflow-hidden">
                  <img
                    src={thumbFor(rel.query)}
                    alt={rel.caption}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-end p-2 bg-gradient-to-t from-background/80 via-background/10 to-transparent pointer-events-none">
                    <ExternalLink className="size-3.5 text-foreground/80" />
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">
                    {rel.query}
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{rel.caption}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {r.pricing?.isProduct && r.pricing.platforms.length > 0 && (
        <section className="rounded-3xl glass p-6 space-y-4">
          <header className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tag className="size-4 text-primary" /> Price comparison
              {r.pricing.productName && (
                <span className="text-muted-foreground font-normal">· {r.pricing.productName}</span>
              )}
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              Est. {r.pricing.currency} ${r.pricing.estimatedRange.low}–${r.pricing.estimatedRange.high}
            </div>
          </header>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...r.pricing.platforms]
              .sort((a, b) => a.price - b.price)
              .map((p, i) => {
                const query = r.pricing!.productName || r.title;
                const url = PLATFORM_SEARCH[p.name]?.(query) ?? googleImagesUrl(`${p.name} ${query}`);
                const isLowest = i === 0;
                return (
                  <a
                    key={p.name}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={`group rounded-2xl border p-4 transition hover:bg-card ${
                      isLowest ? 'border-primary/60 bg-aurora/5' : 'border-border bg-card/40 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {p.name}
                          {isLowest && (
                            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                              Best
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{p.note}</p>
                      </div>
                      <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                    </div>
                    <p className="font-display text-2xl mt-3">
                      {r.pricing!.currency === 'USD' ? '$' : ''}
                      {p.price.toLocaleString()}
                    </p>
                  </a>
                );
              })}
          </div>
          <p className="text-[11px] text-muted-foreground/70 font-mono">
            Prices are AI-estimated. Tap a card to see live listings.
          </p>
        </section>
      )}
    </motion.div>
  );
};