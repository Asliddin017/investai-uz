import { describe, expect, it } from "vitest";
import { isAgreementBlobPath } from "@/lib/storage";

const id = "cmv5rimm00003jr06h2uo15hs";

describe("isAgreementBlobPath", () => {
  it("accepts a plain file in the agreement's folder", () => {
    expect(isAgreementBlobPath(id, `agreements/${id}/Shartnoma_2026-AbC123.docx`)).toBe(true);
    expect(isAgreementBlobPath(id, `agreements/${id}/Шартнома.pdf`)).toBe(true);
  });

  it("refuses another agreement's folder", () => {
    expect(isAgreementBlobPath(id, "agreements/other/file.pdf")).toBe(false);
    expect(isAgreementBlobPath(id, `agreements/${id}x/file.pdf`)).toBe(false);
  });

  it("refuses anything that storage could resolve elsewhere", () => {
    expect(isAgreementBlobPath(id, `agreements/${id}/../other/file.pdf`)).toBe(false);
    expect(isAgreementBlobPath(id, `agreements/${id}/%2e%2e/other/file.pdf`)).toBe(false);
    expect(isAgreementBlobPath(id, `agreements/${id}/sub/file.pdf`)).toBe(false);
    expect(isAgreementBlobPath(id, `agreements/${id}/a\b.pdf`)).toBe(false);
    expect(isAgreementBlobPath(id, `agreements/${id}/..`)).toBe(false);
    expect(isAgreementBlobPath(id, `agreements/${id}/`)).toBe(false);
  });
});
