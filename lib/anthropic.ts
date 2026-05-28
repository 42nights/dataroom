import Anthropic from "@anthropic-ai/sdk";
import { GENERATION_MODEL } from "./constants";
import { SUBMIT_ANSWER_TOOL, type SubmitAnswer, SubmitAnswerSchema } from "./citations";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export type ChatHistory = Array<{ role: "user" | "assistant"; content: string }>;

export async function callAnthropic(
  systemPrompt: string,
  userTurn: string,
  history: ChatHistory = [],
): Promise<{ raw: SubmitAnswer | null; rawText: string }> {
  const response = await client().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    tools: [SUBMIT_ANSWER_TOOL as any],
    tool_choice: { type: "tool", name: "submit_answer" },
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userTurn },
    ],
  });

  const toolBlock = response.content.find(
    (b: any) => b.type === "tool_use",
  ) as { type: "tool_use"; input: unknown } | undefined;

  if (!toolBlock) {
    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    return { raw: null, rawText: text };
  }
  const parsed = SubmitAnswerSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    return { raw: null, rawText: JSON.stringify(toolBlock.input) };
  }
  return { raw: parsed.data, rawText: "" };
}
