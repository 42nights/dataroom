import type { Finding, FindingSeverity, ComplianceLabel } from "./types";

export const REGEX_PASS_VERSION = "regex-v1";

type DetectorLabel = Exclude<ComplianceLabel, "clean">;

type Detector = {
  name: string;
  regex: RegExp;
  label: DetectorLabel;
  severity: FindingSeverity;
  contextWords?: string[]; // if set, only fires when one appears nearby
  contextRadius?: number; // chars on each side to scan for contextWords
  validate?: (match: string) => boolean; // extra check (Luhn, ABA, IBAN…)
};

// --- validators -------------------------------------------------------------

function luhnValid(raw: string): boolean {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ABA routing checksum: 3*(d1+d4+d7) + 7*(d2+d5+d8) + (d3+d6+d9) ≡ 0 (mod 10)
function abaValid(raw: string): boolean {
  const d = raw.replace(/[^\d]/g, "");
  if (d.length !== 9) return false;
  const n = d.split("").map(Number);
  const sum =
    3 * (n[0] + n[3] + n[6]) +
    7 * (n[1] + n[4] + n[7]) +
    1 * (n[2] + n[5] + n[8]);
  return sum % 10 === 0;
}

// ISO 7064 mod-97-10 IBAN checksum.
function ibanValid(raw: string): boolean {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= "A" && ch <= "Z" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const c of code) {
      remainder = (remainder * 10 + (c.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

// SSN sanity: reject obviously-invalid area/group/serial groupings.
function ssnPlausible(raw: string): boolean {
  const m = raw.match(/(\d{3})-(\d{2})-(\d{4})/);
  if (!m) return false;
  const [, area, group, serial] = m;
  if (area === "000" || area === "666" || area[0] === "9") return false;
  if (group === "00") return false;
  if (serial === "0000") return false;
  return true;
}

// --- detectors --------------------------------------------------------------

const CLINICAL_WORDS = [
  "diagnos",
  "patient",
  "icd",
  "symptom",
  "treatment",
  "clinical",
  "prescrib",
  "dx",
  "admitted",
  "discharge",
];

export const DETECTORS: Detector[] = [
  {
    name: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    label: "pii",
    severity: "block",
    validate: ssnPlausible,
  },
  {
    name: "credit-card",
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    label: "pci",
    severity: "block",
    validate: luhnValid,
  },
  {
    name: "cvv",
    regex: /\b\d{3,4}\b/g,
    label: "pci",
    severity: "block",
    contextWords: ["cvv", "cvc", "card code", "security code"],
    contextRadius: 30,
  },
  {
    name: "mrn",
    regex: /\bMRN[:\s#]*[A-Z0-9]{4,12}\b/gi,
    label: "phi",
    severity: "block",
  },
  {
    name: "icd-10",
    regex: /\b[A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?(?![0-9A-Za-z])/g,
    label: "phi",
    severity: "warn",
    contextWords: CLINICAL_WORDS,
    contextRadius: 50,
  },
  {
    name: "dob",
    regex:
      /\b(?:\d{1,2}[/\-]\d{1,2}[/\-](?:19|20)\d{2}|(?:19|20)\d{2}[/\-]\d{1,2}[/\-]\d{1,2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+(?:19|20)\d{2})\b/gi,
    label: "pii",
    severity: "warn",
    contextWords: ["dob", "date of birth", "born", "birth", "d.o.b"],
    contextRadius: 40,
  },
  {
    name: "phone",
    regex:
      /(?:\+?1[ .\-]?)?\(?\d{3}\)?[ .\-]\d{3}[ .\-]\d{4}\b/g,
    label: "pii",
    severity: "warn",
    contextWords: ["phone", "call", "mobile", "cell", "tel", "contact", "reach"],
    contextRadius: 40,
  },
  {
    name: "email",
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    label: "pii",
    severity: "warn",
  },
  {
    name: "driver-license",
    regex: /\b(?:[A-Z]\d{7}|[A-Z]\d{12}|\d{9})\b/g,
    label: "pii",
    severity: "block",
    contextWords: ["driver", "license", "licence", "dl#", "dl ", "dln"],
    contextRadius: 40,
  },
  {
    name: "passport",
    regex: /\b[A-Z]{1,2}\d{6,9}\b/g,
    label: "pii",
    severity: "warn",
    contextWords: ["passport", "travel document"],
    contextRadius: 40,
  },
  {
    name: "bank-account",
    regex: /\b\d{8,17}\b/g,
    label: "financial",
    severity: "warn",
    contextWords: ["account", "acct", "routing", "iban", "wire", "deposit"],
    contextRadius: 40,
  },
  {
    name: "routing",
    regex: /\b\d{9}\b/g,
    label: "financial",
    severity: "block",
    contextWords: ["routing", "aba", "rtn"],
    contextRadius: 40,
    validate: abaValid,
  },
  {
    name: "iban",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    label: "financial",
    severity: "block",
    validate: ibanValid,
  },
  {
    name: "attorney-confidential",
    regex:
      /ATTORNEY[- ]CLIENT PRIVILEGE[D]?|ATTORNEY WORK[- ]PRODUCT|CONFIDENTIAL\s*[—\-:]\s*LEGAL|PRIVILEGED (?:AND|&) CONFIDENTIAL/gi,
    label: "legal-confidential",
    severity: "warn",
  },
  {
    name: "private-key",
    regex:
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
    label: "secrets",
    severity: "block",
  },
];

function contextMatches(
  haystackLower: string,
  index: number,
  words: string[],
  radius: number,
): boolean {
  const start = Math.max(0, index - radius);
  const end = Math.min(haystackLower.length, index + radius);
  const window = haystackLower.slice(start, end);
  return words.some((w) => window.includes(w));
}

export function redactSnippet(
  text: string,
  start: number,
  length: number,
  pad = 30,
): string {
  const from = Math.max(0, start - pad);
  const to = Math.min(text.length, start + length + pad);
  const before = text.slice(from, start);
  const after = text.slice(start + length, to);
  const masked = "[…]"; // never echo the raw sensitive value into the report
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  return `${prefix}${before}${masked}${after}${suffix}`.replace(/\s+/g, " ").trim();
}

const SEV_RANK: Record<FindingSeverity, number> = { block: 1, warn: 0 };

export function regexComplianceScan(markdown: string): Finding[] {
  const lower = markdown.toLowerCase();
  // de-dupe identical (label, span) hits from overlapping detectors (e.g.
  // routing vs bank-account on the same 9-digit run), keeping the higher
  // severity regardless of detector order.
  const byKey = new Map<string, Finding>();

  for (const detector of DETECTORS) {
    detector.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = detector.regex.exec(markdown)) !== null) {
      const value = match[0];
      // zero-width guard against pathological regexes
      if (match.index === detector.regex.lastIndex) detector.regex.lastIndex++;

      if (detector.validate && !detector.validate(value)) continue;
      if (
        detector.contextWords &&
        !contextMatches(
          lower,
          match.index,
          detector.contextWords,
          detector.contextRadius ?? 40,
        )
      ) {
        continue;
      }

      const start = match.index;
      const end = match.index + value.length;
      const key = `${detector.label}:${start}:${end}`;
      const existing = byKey.get(key);
      if (existing && SEV_RANK[existing.severity] >= SEV_RANK[detector.severity]) {
        continue;
      }

      byKey.set(key, {
        detector: detector.name,
        label: detector.label,
        severity: detector.severity,
        startOffset: start,
        endOffset: end,
        snippet: redactSnippet(markdown, start, value.length),
      });
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0),
  );
}
