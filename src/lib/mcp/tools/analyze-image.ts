import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { chat, errorResult, imageUrlToDataUrl, textResult } from "../ai";

const SYSTEM = `You are Lensly, an expert AI photo analyst.
Analyze the image and return ONLY valid JSON:
{
  "title": "2-5 word title",
  "description": "2-3 sentence accurate description",
  "category": "food | plant | animal | landmark | document | product | person | scene | art | other",
  "tags": [{ "label": "string", "confidence": 0-100 }],
  "insights": "short markdown with the most useful context for this subject",
  "quality": { "score": 0-100, "notes": "string" }
}`;

export default defineTool({
  name: "analyze_image",
  title: "Analyze image",
  description:
    "Analyze a photo from an https URL and return a title, description, category, tags with confidence scores, contextual insights, and a quality score.",
  inputSchema: {
    imageUrl: z.string().describe("Public https URL of the image to analyze."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ imageUrl }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(new Error("Not authenticated"));
    try {
      const dataUrl = await imageUrlToDataUrl(imageUrl);
      const raw = await chat({
        system: SYSTEM,
        json: true,
        user: [
          { type: "text", text: "Analyze this photo and return the JSON schema." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      });
      const parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
      return textResult(JSON.stringify(parsed, null, 2), { analysis: parsed });
    } catch (err) {
      return errorResult(err);
    }
  },
});