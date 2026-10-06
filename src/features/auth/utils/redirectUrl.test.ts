import { describe, it, expect } from "vitest";
import { getSafeRedirectUrl } from "./redirectUrl";

describe("getSafeRedirectUrl", () => {
  it("returns fallback when no query string is provided", () => {
    expect(getSafeRedirectUrl("")).toBe("/treasury");
    expect(getSafeRedirectUrl("?foo=bar")).toBe("/treasury");
  });

  it("extracts redirectTo param correctly", () => {
    expect(getSafeRedirectUrl("?redirectTo=%2Ftreasury%2Fdues")).toBe("/treasury/dues");
    expect(getSafeRedirectUrl("?redirectTo=/profile")).toBe("/profile");
    expect(getSafeRedirectUrl("?redirectTo=/organization/roles?page=2")).toBe(
      "/organization/roles?page=2"
    );
  });

  it("extracts redirect param correctly as alternative", () => {
    expect(getSafeRedirectUrl("?redirect=%2Ftreasury%2Finvoices")).toBe(
      "/treasury/invoices"
    );
  });

  it("defaults root '/' to fallback '/treasury'", () => {
    expect(getSafeRedirectUrl("?redirectTo=/")).toBe("/treasury");
    expect(getSafeRedirectUrl("?redirect=/")).toBe("/treasury");
  });

  it("prevents self-redirect loops to /login", () => {
    expect(getSafeRedirectUrl("?redirectTo=/login")).toBe("/treasury");
    expect(getSafeRedirectUrl("?redirectTo=/login?some=param")).toBe("/treasury");
  });

  it("blocks open redirects and protocol-relative URLs", () => {
    expect(getSafeRedirectUrl("?redirectTo=https://evil.com")).toBe("/treasury");
    expect(getSafeRedirectUrl("?redirectTo=http://evil.com")).toBe("/treasury");
    expect(getSafeRedirectUrl("?redirectTo=//evil.com")).toBe("/treasury");
    expect(getSafeRedirectUrl("?redirectTo=javascript:alert(1)")).toBe("/treasury");
  });

  it("supports custom fallback", () => {
    expect(getSafeRedirectUrl("", "/custom")).toBe("/custom");
    expect(getSafeRedirectUrl("?redirectTo=https://evil.com", "/custom")).toBe(
      "/custom"
    );
  });
});
