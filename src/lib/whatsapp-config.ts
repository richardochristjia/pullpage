import "server-only";

const envValue = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
if (!envValue && process.env.NODE_ENV === "production") {
  console.warn(
    "[Pullpage] NEXT_PUBLIC_WHATSAPP_NUMBER is not set; the Order via WhatsApp button is disabled.",
  );
}

export function getWhatsAppNumber(): string | undefined {
  return envValue && envValue.length > 0 ? envValue : undefined;
}
