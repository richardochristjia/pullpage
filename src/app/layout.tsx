import type { Metadata } from "next";
import { Outfit, Work_Sans } from "next/font/google";
import { catalogCanonical, indexingPolicy, PRODUCTION_ORIGIN, SOCIAL_FALLBACK_URL } from "@/catalog/discoverability";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans" });

const description = "Browse Pullpage's read-only catalog of extended card art for card binders.";
const socialImage = {
  url: SOCIAL_FALLBACK_URL,
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Pullpage — Pull The Art. Own The Page.",
};

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_ORIGIN),
  title: { default: "Pullpage", template: "%s | Pullpage" },
  applicationName: "Pullpage",
  description,
  alternates: { canonical: catalogCanonical() },
  robots: {
    ...indexingPolicy(),
    googleBot: { ...indexingPolicy(), "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "Pullpage",
    locale: "en_US",
    title: "Pullpage",
    description,
    url: catalogCanonical(),
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pullpage",
    description,
    images: [{ url: SOCIAL_FALLBACK_URL, alt: socialImage.alt }],
  },
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${workSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <div id="app-content">
              <a className="skip-link" href="#main-content">Skip to main content</a>
              {children}
            </div>
            {modal}
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
