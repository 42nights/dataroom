import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { regexComplianceScan } from "../lib/compliance/regex";

function readFixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

describe("regexComplianceScan", () => {
  it("phi fixture triggers MRN detector at block severity", () => {
    const md = readFixture("fixture_compliance_phi.md");
    const findings = regexComplianceScan(md);
    expect(
      findings.some((f) => f.detector === "mrn" && f.severity === "block"),
    ).toBe(true);
  });

  it("phi fixture flags ICD-10 in clinical context (warn)", () => {
    const md = readFixture("fixture_compliance_phi.md");
    const findings = regexComplianceScan(md);
    expect(
      findings.some((f) => f.detector === "icd-10" && f.label === "phi"),
    ).toBe(true);
  });

  it("phi fixture flags DOB near a name (warn)", () => {
    const md = readFixture("fixture_compliance_phi.md");
    const findings = regexComplianceScan(md);
    expect(
      findings.some((f) => f.detector === "dob" && f.severity === "warn"),
    ).toBe(true);
  });

  it("pii fixture triggers SSN detector at block severity", () => {
    const md = readFixture("fixture_compliance_pii.csv");
    const findings = regexComplianceScan(md);
    expect(
      findings.some((f) => f.detector === "ssn" && f.severity === "block"),
    ).toBe(true);
  });

  it("clean fixture produces no findings", () => {
    const md = readFixture("fixture_compliance_clean.md");
    const findings = regexComplianceScan(md);
    expect(findings.length).toBe(0);
  });

  it("never echoes the raw sensitive value into the snippet", () => {
    const md = readFixture("fixture_compliance_pii.csv");
    const findings = regexComplianceScan(md);
    const ssn = findings.find((f) => f.detector === "ssn")!;
    expect(ssn.snippet).not.toContain("123-45-6789");
    expect(ssn.snippet).toContain("[…]");
  });
});

describe("checksum validators", () => {
  it("flags a Luhn-valid credit card as pci/block", () => {
    const findings = regexComplianceScan("Card on file: 4111 1111 1111 1111.");
    expect(
      findings.some((f) => f.detector === "credit-card" && f.label === "pci"),
    ).toBe(true);
  });

  it("ignores a Luhn-invalid 16-digit run", () => {
    const findings = regexComplianceScan("Ref number 4111 1111 1111 1112.");
    expect(findings.some((f) => f.detector === "credit-card")).toBe(false);
  });

  it("flags a valid IBAN as financial/block", () => {
    const findings = regexComplianceScan("Wire to GB82WEST12345698765432 today.");
    expect(
      findings.some((f) => f.detector === "iban" && f.severity === "block"),
    ).toBe(true);
  });

  it("flags an ABA-valid routing number only with context", () => {
    const withCtx = regexComplianceScan("Routing number: 021000021.");
    const noCtx = regexComplianceScan("Order id 021000021 shipped.");
    expect(withCtx.some((f) => f.detector === "routing")).toBe(true);
    expect(noCtx.some((f) => f.detector === "routing")).toBe(false);
  });
});

// The semantic pass needs a live API key. Skip when unset so `npm test` is
// green in CI; runs locally when ANTHROPIC_API_KEY is present.
describe.skipIf(!process.env.ANTHROPIC_API_KEY)("llmComplianceScan", () => {
  it("finds DOB context the regex missed", async () => {
    const { llmComplianceScan } = await import("../lib/compliance/llm");
    const md = "Maria Lopez, born March 14, 1978, is the patient.";
    const findings = await llmComplianceScan(md);
    expect(
      findings.some(
        (f) =>
          (f.label === "pii" || f.label === "phi") &&
          /born|dob|birth|1978/i.test(f.snippet + (f.rationale ?? "")),
      ),
    ).toBe(true);
  });
});
