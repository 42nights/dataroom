import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="max-w-2xl mx-auto px-8 py-16">
      <Link
        href="/sources"
        className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        ← Data Room
      </Link>

      <h1 className="font-serif text-4xl tracking-tight mt-8">How it works</h1>
      <p className="mt-3 text-muted-foreground">
        The 42nights data room is a local-only chat-with-your-files tool.
        Everything runs on your machine — there's no cloud DB and no
        third-party hosting. This page explains what happens between a
        question and an answer.
      </p>

      <Section title="Pipeline">
        <p>
          Files dropped into the data room are content-hashed and stored once
          under <Code>./data/files/</Code>. Re-uploading the same bytes is a
          no-op. The bytes are parsed into plain markdown, scrubbed for
          secrets, chunked, and embedded with{" "}
          <Code>text-embedding-3-small</Code>. Each chunk's embedding is
          unit-normalized and persisted as a SQLite <Code>BLOB</Code>.
        </p>
        <p>
          On app start, every embedding is hydrated into an in-memory{" "}
          <Code>Map&lt;chunkId, Float32Array&gt;</Code>. Searching a question
          embeds it the same way, then dot-products against every chunk —
          which is exactly cosine similarity when both sides are normalized.
          At 20 files / ~1k chunks this is a sub-5ms loop.
        </p>
      </Section>

      <Section title="Grounding">
        <p>
          The top results — plus one chunk of context on either side — are
          formatted inside delimited <Code>&lt;source&gt;</Code> blocks and
          handed to Claude with a tool-use schema that forces the answer into
          a known shape: <Code>answer</Code>, <Code>citations[]</Code>,{" "}
          <Code>confidence</Code>, <Code>followups</Code>,{" "}
          <Code>answerable</Code>.
        </p>
        <p>
          After the model returns, the server runs a deterministic check:
          every citation's quote must actually appear in the chunk text.
          Invalid citations are dropped. If the answer asserts a fact but no
          citation survives validation, we retry once with a stricter nudge.
          If the retry still produces no valid citation, we override to{" "}
          <em>"I couldn't ground that in the data room"</em>.
        </p>
        <p>
          In front of the LLM, an <strong>answerability gate</strong>
          short-circuits the call entirely if the top retrieval score is
          below threshold — you get a canned "I don't have that" with zero
          tokens spent.
        </p>
      </Section>

      <Section title="Local-only by design">
        <p>
          The only network calls this app makes are to{" "}
          <Code>api.openai.com</Code> (embeddings) and{" "}
          <Code>api.anthropic.com</Code> (generation). No analytics, no
          telemetry, no third-party DB. All persistent state lives in{" "}
          <Code>./data/dataroom.db</Code> and <Code>./data/files/</Code>.
          Deleting <Code>./data/</Code> resets the app.
        </p>
      </Section>

      <Section title="Security">
        <p>
          File uploads run through a secret-pattern scrubber server-side
          (Anthropic / OpenAI keys, GitHub PATs, AWS access keys, Slack
          tokens, PEM private keys, Stripe keys, JWTs). Source text is
          wrapped in delimited tags before it's handed to the model, and the
          model is told to treat anything inside them as untrusted material —
          not instructions. Set <Code>APP_PASSCODE</Code> in{" "}
          <Code>.env.local</Code> if you want a single-field gate on top.
        </p>
      </Section>

      <Section title="Known limits">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            PDFs with complex tables can lose structure with the default
            <Code>pdfjs-dist</Code> parser.
          </li>
          <li>
            Pure vector search, no full-text fallback yet. Hybrid (vector +
            FTS5) is a v0.5 upgrade.
          </li>
          <li>No streaming — answers complete in a single shot.</li>
          <li>
            Designed for ≤ 20 files. Past ~10k chunks the in-memory index
            grows and an actual ANN index would help.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 space-y-3 text-sm leading-relaxed text-foreground/85">
      <h2 className="font-serif text-2xl text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[12px] bg-muted px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}
