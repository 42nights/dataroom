export type ScrubMatch = {
  kind: string;
  start: number;
  end: number;
  preview: string;
};

export type ScrubResult = {
  text: string;
  matches: ScrubMatch[];
};

type Pattern = { kind: string; re: RegExp };

const PATTERNS: Pattern[] = [
  { kind: "anthropic-key", re: /sk-ant-[A-Za-z0-9_\-]{20,}/g },
  { kind: "openai-key", re: /sk-(?:proj-)?[A-Za-z0-9_\-]{20,}/g },
  { kind: "google-key", re: /AIza[0-9A-Za-z\-_]{30,}/g },
  { kind: "hf-token", re: /hf_[A-Za-z0-9]{20,}/g },
  { kind: "replicate-key", re: /r8_[A-Za-z0-9]{30,}/g },
  { kind: "github-pat", re: /gh[posu]_[A-Za-z0-9]{30,}/g },
  { kind: "aws-access-key", re: /AKIA[0-9A-Z]{16}/g },
  {
    kind: "aws-secret-key",
    re: /(?<=aws_secret_access_key\s*[=:]\s*["']?)[A-Za-z0-9/+=]{40}(?=["']?)/gi,
  },
  { kind: "stripe-key", re: /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { kind: "slack-token", re: /xox[abprs]-[A-Za-z0-9\-]{10,}/g },
  {
    kind: "slack-webhook",
    re: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/g,
  },
  {
    kind: "private-key",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    kind: "jwt",
    re: /eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g,
  },
];

export function scrubSecrets(input: string): ScrubResult {
  let text = input;
  const matches: ScrubMatch[] = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    text = text.replace(re, (match, offset: number) => {
      const preview = `${match.slice(0, 4)}…${match.slice(-2)}`;
      matches.push({ kind, start: offset, end: offset + match.length, preview });
      return `[REDACTED:${kind}]`;
    });
  }
  return { text, matches };
}

export function hasSecrets(input: string): boolean {
  return PATTERNS.some((p) => {
    p.re.lastIndex = 0;
    return p.re.test(input);
  });
}
