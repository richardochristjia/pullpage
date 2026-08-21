import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("getWhatsAppNumber seam", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  test("returns the configured business number when the env var is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "6281234567890");
    vi.stubEnv("NODE_ENV", "production");
    const { getWhatsAppNumber } = await import("@/lib/whatsapp-config");
    expect(getWhatsAppNumber()).toBe("6281234567890");
    expect(warn).not.toHaveBeenCalled();
  });

  test("returns undefined and logs a warning when the env var is unset in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "");
    vi.stubEnv("NODE_ENV", "production");
    const { getWhatsAppNumber } = await import("@/lib/whatsapp-config");
    expect(getWhatsAppNumber()).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("NEXT_PUBLIC_WHATSAPP_NUMBER");
  });

  test("returns undefined silently when the env var is unset outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "");
    vi.stubEnv("NODE_ENV", "test");
    const { getWhatsAppNumber } = await import("@/lib/whatsapp-config");
    expect(getWhatsAppNumber()).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
