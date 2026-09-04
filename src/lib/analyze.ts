import imageCompression from 'browser-image-compression';
import { supabase } from '@/integrations/supabase/client';

export interface AnalysisTag { label: string; confidence: number }
export interface AnalysisRecommendation { title: string; description: string; icon: string }
export interface RelatedImage { query: string; caption: string }
export interface PricingPlatform { name: string; price: number; note: string }
export interface PricingInfo {
  isProduct: boolean;
  productName: string;
  currency: string;
  estimatedRange: { low: number; high: number };
  platforms: PricingPlatform[];
}
export interface VisualSearchObject {
  label: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  isProduct: boolean;
  estimatedRange?: { low: number; high: number };
  platforms?: PricingPlatform[];
  related_query: string;
}

export interface AnalysisResult {
  title: string;
  description: string;
  category: string;
  tags: AnalysisTag[];
  ocr: { hasText: boolean; text: string; language: string };
  insights: { headline: string; markdown: string };
  recommendations: AnalysisRecommendation[];
  quality: { score: number; notes: string };
  safety: { flagged: boolean; reason: string };
  related?: RelatedImage[];
  pricing?: PricingInfo;
  visual_search_objects?: VisualSearchObject[];
}

export interface AnalysisResponse {
  result: AnalysisResult;
  meta: { reqId: string; ms: number; model: string };
}

export async function compressImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function analyzeImage(file: File): Promise<AnalysisResponse> {
  const compressed = await compressImage(file);
  const dataUrl = await fileToDataUrl(compressed);
  const { data, error } = await supabase.functions.invoke('analyze-image', {
    body: { imageBase64: dataUrl },
  });
  if (error) throw new Error(error.message ?? 'Analysis failed');
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as AnalysisResponse;
}