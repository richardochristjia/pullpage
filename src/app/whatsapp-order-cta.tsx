import { Button } from "@/components/ui/button";

export function WhatsAppOrderCta({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <Button asChild>
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Order via WhatsApp">
        Order via WhatsApp
      </a>
    </Button>
  );
}
