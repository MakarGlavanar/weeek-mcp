import { describe, it, expect } from "vitest";
import { splitWeeekDate } from "../../src/tools/write/_dates.js";

describe("splitWeeekDate", () => {
  it("maps a calendar date to { date }", () => {
    expect(splitWeeekDate("2026-07-20")).toEqual({ date: "2026-07-20" });
  });

  it("trims surrounding whitespace on a date", () => {
    expect(splitWeeekDate("  2026-07-20 ")).toEqual({ date: "2026-07-20" });
  });

  it("keeps a UTC 'Z' timestamp as { dateTime } without millis", () => {
    expect(splitWeeekDate("2026-07-20T14:30:00Z")).toEqual({
      dateTime: "2026-07-20T14:30:00Z",
    });
  });

  it("converts an offset timestamp to UTC Z", () => {
    // +03:00 → 11:30 UTC
    expect(splitWeeekDate("2026-07-20T14:30:00+03:00")).toEqual({
      dateTime: "2026-07-20T11:30:00Z",
    });
  });

  it("treats a naive datetime (no zone) as UTC", () => {
    expect(splitWeeekDate("2026-07-20 14:30:00")).toEqual({
      dateTime: "2026-07-20T14:30:00Z",
    });
  });

  it("throws a descriptive error on an unparseable value", () => {
    expect(() => splitWeeekDate("not-a-date")).toThrow(/Invalid date/);
  });
});
