import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { chat, errorResult, imageUrlToDataUrl, textResult } from "../ai";

export default defineTool({
  name: "extract_text_from_image",
  title: "Extract text from image (OCR)",
  description:
    "Read any text visible in a photo from an https URL and return the extracted text plus the detected language.",
  inputSchema: {
    imageUrl: z.string().describe("Public https URL of the image to read text from."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ imageUrl }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(new Error("Not authenticated"));
    try {
      const dataUrl = await imageUrlToDataUrl(imageUrl);
      const raw = await chat({
        system:
          'You are an OCR engine. Return ONLY JSON: {"hasText": boolean, "text": "verbatim extracted text or empty", "language": "ISO 639-1 code or empty"}. Preserve line breaks in text.',
        json: true,
        user: [
          { type: "text", text: "Extract all visible text from this image." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      });
      const parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
      const summary = parsed.hasText
        ? `Language: ${parsed.language || "unknown"}\n\n${parsed.text}`
        : "No text detected in this image.";
      return textResult(summary, { ocr: parsed });
    } catch (err) {
      return errorResult(err);
    }
  },
});