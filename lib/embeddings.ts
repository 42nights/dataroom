import { z } from "zod";
import { EMBEDDING_DIM, EMBEDDING_MODEL } from "./constants";

const EMBED_URL = "https://api.openai.com/v1/embeddings";

const RespSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })),
});

export const EMBED_DIM = EMBEDDING_DIM;

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`embeddings ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = RespSchema.parse(await res.json());
  return json.data.map((d) => normalize(new Float32Array(d.embedding)));
}

export async function embedOne(text: string): Promise<Float32Array> {
  const [v] = await embedBatch([text]);
  return v;
}

export function normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}
