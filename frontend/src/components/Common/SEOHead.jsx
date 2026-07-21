import React, { memo } from 'react';
import { Helmet } from 'react-helmet-async';

const SEOHead = memo(({ 
  title, 
  description, 
  keywords = [], 
  ogImage,
  ogType = 'website',
  canonicalUrl,
  noIndex = false,
  structuredData,
  breadcrumbs,
  faqData,
  articleData,
  pageUrl
}) => {
  const siteName = 'SarkariPYQ';
  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} - SSC Previous Year Questions Free Online Practice`;
  const defaultDescription = 'Practice 1 Lakh+ SSC Previous Year Questions (PYQ) FREE with detailed answers & explanations. SSC CGL, CHSL, GD, CPO, MTS PYQ 2024-2025 in Hindi & English. No ads, instant results.';
  const metaDescription = (description || defaultDescription).substring(0, 160);
  const defaultOgImage = '/ssc-logo.webp';
  const siteUrl = 'https://sarkaripyq.com';
  const safeKeywords = Array.isArray(keywords) ? keywords : [];
  const resolvedCanonical = canonicalUrl || (pageUrl ? `${siteUrl}${pageUrl}` : siteUrl);
  const resolvedOgImage = ogImage?.startsWith('http') ? ogImage : `${siteUrl}${ogImage || defaultOgImage}`;

  // Default high-value keywords if none provided
  const defaultKeywords = [
    'SSC PYQ', 'SSC Previous Year Questions', 'SSC CGL PYQ', 'SSC CHSL PYQ',
    'SSC GD PYQ', 'SSC MTS PYQ', 'SSC CGL Previous Year Papers',
    'SSC Practice Set', 'SSC Mock Test', 'SSC Question Bank',
    'Government Exam PYQ', 'Sarkari PYQ', 'SSC Questions Hindi'
  ];
  const mergedKeywords = [...new Set([...safeKeywords, ...defaultKeywords])];

  // BreadcrumbList schema
  const breadcrumbSchema = breadcrumbs ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": crumb.name,
      "item": crumb.url ? `${siteUrl}${crumb.url}` : undefined
    }))
  } : null;

  // FAQPage schema for featured snippets
  const faqSchema = faqData && faqData.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  } : null;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={mergedKeywords.join(', ')} />
      <meta name="author" content="SarkariPYQ" />
      <meta name="language" content="Hindi, English" />
      <meta name="revisit-after" content="1 day" />
      
      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={description?.substring(0, 60) || 'SarkariPYQ - Free SSC Previous Year Questions Practice'} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="hi_IN" />
      <meta property="og:locale:alternate" content="en_US" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={resolvedOgImage} />
      <meta name="twitter:image:alt" content={description?.substring(0, 60) || 'SarkariPYQ - Free SSC Previous Year Questions Practice'} />
      <meta name="twitter:url" content={resolvedCanonical} />
      <meta name="twitter:site" content="@sarkaripyq" />
      <meta name="twitter:creator" content="@sarkaripyq" />

      {/* Canonical URL */}
      <link rel="canonical" href={resolvedCanonical} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}

      {/* Breadcrumb Schema */}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}

      {/* FAQ Schema for Featured Snippets */}
      {faqSchema && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}

      {/* Article Schema */}
      {articleData && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": articleData.headline || fullTitle,
            "description": metaDescription,
            "image": articleData.image || ogImage || defaultOgImage,
            "datePublished": articleData.datePublished,
            "dateModified": articleData.dateModified,
            "author": {
              "@type": "Person",
              "name": "SarkariPYQ"
            },
            "publisher": {
              "@type": "Organization",
              "name": siteName,
              "logo": {
                "@type": "ImageObject",
                "url": `${siteUrl}/ssc-logo.webp`
              }
            }
          })}
        </script>
      )}
    </Helmet>
  );
});

SEOHead.displayName = 'SEOHead';

export default SEOHead;
