import { auth, defineMcp } from "@lovable.dev/mcp-js";
import analyzeImageTool from "./tools/analyze-image";
import extractTextTool from "./tools/extract-text";
import translateTextTool from "./tools/translate-text";
import summarizeTextTool from "./tools/summarize-text";

// The OAuth issuer must be the direct Supabase host, built from the project ref
// (inlined by Vite at build time, so this stays import-safe).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lensly-mcp",
  title: "Lensly Photo Analysis",
  version: "0.1.0",
  instructions:
    "Tools for Lensly, an AI photo analysis app. Use `analyze_image` to describe and tag a photo from an https URL, `extract_text_from_image` for OCR, and `translate_text` / `summarize_text` to work with the extracted text.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [analyzeImageTool, extractTextTool, translateTextTool, summarizeTextTool],
});