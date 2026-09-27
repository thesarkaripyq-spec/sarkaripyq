import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SarkariPYQ – SSC Previous Year Questions, Free PYQ Practice",
    template: "%s – SarkariPYQ",
  },
  icons: {
    icon: "/favicon.svg",
  },
  description:
    "Practice real SSC previous year questions by exam, subject, year and shift. Free SSC CGL, CHSL, MTS, CPO, GD Constable and Stenographer PYQs with full explanations.",
  keywords: [
    "SSC PYQ",
    "SSC previous year questions",
    "SSC CGL PYQ",
    "SSC CHSL PYQ",
    "SSC MTS PYQ",
    "SSC CPO PYQ",
    "SSC GD PYQ",
    "SSC free mock test",
    "SSC exam preparation",
  ],
  openGraph: {
    type: "website",
    siteName: "SarkariPYQ",
    locale: "en_IN",
    title: "SarkariPYQ – SSC Previous Year Questions",
    description:
      "Practice real SSC previous year questions by exam, subject, year and shift — free, with full explanations.",
    images: [{ url: "/ssc-logo.webp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SarkariPYQ – SSC Previous Year Questions",
    description: "Practice real SSC previous year questions — free, with full explanations.",
    images: ["/ssc-logo.webp"],
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport = {
  themeColor: "#2563eb",
  viewportFit: "cover" as const,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "SarkariPYQ",
      url: siteUrl,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "SarkariPYQ",
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem("theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header user={user ? { email: user.email ?? "" } : null} />
        <main className="min-h-[60vh] pb-16 md:pb-0">{children}</main>
        <Footer />
        <MobileNav isAuthed={!!user} />
      </body>
    </html>
  );
}
