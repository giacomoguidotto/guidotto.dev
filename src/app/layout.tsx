import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import { content } from "~/content";
import "./globals.css";

// Warm, optical, characterful serif — the display thesis voice (analog warmth in
// its forms, regardless of color). Loaded globally.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

// The engineering register — small labels, eyebrows, CTA.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const { site } = content;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.title,
    description: site.description,
    url: site.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  jobTitle: site.jobTitle,
  url: site.url,
  description: site.description,
  sameAs: site.sameAs,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={site.locale}>
      <body className={`${fraunces.variable} ${jetbrainsMono.variable}`}>
        {children}
        <script type="application/ld+json">
          {JSON.stringify(personJsonLd)}
        </script>
      </body>
    </html>
  );
}
