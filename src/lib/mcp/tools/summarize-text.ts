import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { chat, errorResult, textResult } from "../ai";

export default defineTool({
  name: "summarize_text",
  title: "Summarize text",
  description: "Summarize text in a few sentences, preserving key facts, numbers, names, and intent.",
  inputSchema: { text: z.string().describe("The text to summarize.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ text }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(new Error("Not authenticated"));
    const input = text.trim();
    if (!input) return errorResult(new Error("text is required"));
    if (input.length > 8000) return errorResult(new Error("text too long (max 8000 chars)"));
    try {
      const output = await chat({
        system:
          "You are a concise summarizer. Summarize the user's text in 2-4 sentences, preserving key facts, numbers, names, and intent. Reply with ONLY the summary.",
        user: input,
      });
      return textResult(output, { summary: output });
    } catch (err) {
      return errorResult(err);
    }
  },
});