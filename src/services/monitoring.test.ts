import { describe, expect, it } from "vitest";
import { IGNORED_ERRORS } from "./monitoring";

const isIgnored = (message: string): boolean =>
  IGNORED_ERRORS.some((pattern) => pattern.test(message));

const prefix =
  "AbortError: Failed to register a ServiceWorker for scope ('https://example.com/') with script ('https://example.com/sw.js'):";

describe("IGNORED_ERRORS", () => {
  it("ignores a transient failure while fetching the service worker", () => {
    expect(
      isIgnored(
        `${prefix} An unknown error occurred when fetching the script.`,
      ),
    ).toBe(true);
  });

  it("keeps reporting a service worker missing from the deploy", () => {
    expect(
      isIgnored(
        `${prefix} A bad HTTP response code (404) was received when fetching the script.`,
      ),
    ).toBe(false);
  });

  it("keeps reporting unrelated errors", () => {
    expect(isIgnored("TypeError: x is not a function")).toBe(false);
  });
});
