import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { chat, errorResult, textResult } from "../ai";

export default defineTool({
  name: "translate_text",
  title: "Translate text",
  description:
    "Translate text (for example text extracted from a photo) into a target language. Defaults to English.",
  inputSchema: {
    text: z.string().describe("The text to translate."),
    targetLanguage: z.string().optional().describe("Target language name, e.g. 'Spanish'. Defaults to English."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ text, targetLanguage }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(new Error("Not authenticated"));
    const input = text.trim();
    if (!input) return errorResult(new Error("text is required"));
    if (input.length > 8000) return errorResult(new Error("text too long (max 8000 chars)"));
    try {
      const output = await chat({
        system: `You are a professional translator. Translate the user's text into ${
          targetLanguage?.trim() || "English"
        }. Preserve line breaks, punctuation, and proper nouns. Reply with ONLY the translation.`,
        user: input,
      });
      return textResult(output, { translation: output });
    } catch (err) {
      return errorResult(err);
    }
  },
});