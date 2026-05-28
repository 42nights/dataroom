import { describe, it, expect } from "vitest";
import { scrubSecrets, hasSecrets } from "../lib/scrubber";

describe("scrubSecrets", () => {
  it("redacts an anthropic-style key", () => {
    const input = "Token: sk-ant-abc1234567890abcdef1234567890";
    const { text, matches } = scrubSecrets(input);
    expect(text).toContain("[REDACTED:anthropic-key]");
    expect(matches.length).toBe(1);
    expect(matches[0].kind).toBe("anthropic-key");
  });

  it("redacts a github PAT", () => {
    const input = "auth=ghp_1234567890abcdef1234567890ABCDEF1234";
    const { text } = scrubSecrets(input);
    expect(text).toContain("[REDACTED:github-pat]");
  });

  it("redacts an AWS access key", () => {
    const input = "AWS_KEY=AKIAIOSFODNN7EXAMPLE";
    const { text } = scrubSecrets(input);
    expect(text).toContain("[REDACTED:aws-access-key]");
  });

  it("redacts a PEM private key block", () => {
    const input = `-----BEGIN PRIVATE KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm\n-----END PRIVATE KEY-----`;
    const { text } = scrubSecrets(input);
    expect(text).toContain("[REDACTED:private-key]");
  });

  it("leaves clean text untouched", () => {
    const input = "This is a normal contract about hot dogs.";
    const { text, matches } = scrubSecrets(input);
    expect(text).toBe(input);
    expect(matches.length).toBe(0);
    expect(hasSecrets(input)).toBe(false);
  });
});
