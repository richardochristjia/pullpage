import type { Metadata } from "next";
import { catalogCanonical, indexingPolicy, PRODUCTION_ORIGIN, SOCIAL_FALLBACK_URL } from "@/catalog/discoverability";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div id="app-content">
          <a className="skip-link" href="#main-content">Skip to main content</a>
          {children}
        </div>
        {modal}
      </body>
    </html>
  );
}
