import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Nav } from '@/components/lensly/Nav';
import { UploadZone } from '@/components/lensly/UploadZone';
import { ResultsSkeleton } from '@/components/lensly/ResultsSkeleton';
import { ResultsDashboard } from '@/components/lensly/ResultsDashboard';
import { Chatbot } from '@/components/lensly/Chatbot';
import { analyzeImage, type AnalysisResponse } from '@/lib/analyze';
import aurora from '@/assets/aurora-hero.jpg';
import { RotateCcw } from 'lucide-react';

const Index = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    document.title = 'Lensly — AI Photo Analysis';
    const desc = 'Upload any photo and get instant AI vision analysis: descriptions, OCR, species, calories, landmarks, and next steps.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  const handleFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setData(null);
    setLoading(true);
    try {
      const res = await analyzeImage(file);
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      toast.error(msg);
      setImageUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setData(null);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Nav />
      <main className="container max-w-6xl px-4 py-8 md:py-16 space-y-8 md:space-y-10">
        {!imageUrl && (
          <section className="relative text-center space-y-5 md:space-y-6 pb-2 md:pb-6">
            <img
              src={aurora}
              alt=""
              aria-hidden
              width={1536}
              height={1024}
              className="pointer-events-none absolute inset-x-0 -top-20 mx-auto h-[420px] w-[900px] max-w-none object-cover opacity-60 blur-2xl -z-10"
            />
            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl leading-[1.05] max-w-3xl mx-auto">
              See anything. <span className="text-gradient">Understand everything.</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base md:text-lg px-2">
              Drop a photo and Lensly returns a precise description, detected objects with confidence,
              extracted text, contextual insight, and actionable next steps.
            </p>
          </section>
        )}

        {!imageUrl && <UploadZone onFile={handleFile} disabled={loading} />}

        {imageUrl && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {loading ? 'Analyzing…' : 'Result'}
              </p>
              <h2 className="font-display text-xl sm:text-2xl">Photo analysis</h2>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm hover:bg-secondary transition"
            >
              <RotateCcw className="size-4" /> New photo
            </button>
          </div>
        )}

        {loading && <ResultsSkeleton />}
        {!loading && imageUrl && data && <ResultsDashboard imageUrl={imageUrl} data={data} />}
      </main>
      <footer className="container max-w-6xl py-10 text-xs text-muted-foreground/70 font-mono">
        Lensly · AI Photo Analyst · Photos are processed in memory and never stored.
      </footer>
      <Chatbot analysisResult={data?.result} />
    </div>
  );
};

export default Index;
