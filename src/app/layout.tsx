import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pullpage Catalog",
  description: "Extended-art surrounds for Pokémon card collectors.",
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
