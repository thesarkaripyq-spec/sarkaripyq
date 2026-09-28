import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { siteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();

  // /search is intentionally excluded: it's noindex'd in its own metadata,
  // so listing it here would contradict that directive.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/ssc`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/practice`, changeFrequency: "weekly", priority: 0.9 },
  ];

  const { data: exams } = await supabase
    .from("exams")
    .select("slug")
    .eq("is_active", true);

  const examRoutes: MetadataRoute.Sitemap = (exams ?? []).flatMap((e) => [
    { url: `${siteUrl}/ssc/${e.slug}`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${siteUrl}/ssc/${e.slug}/pyq`, changeFrequency: "weekly" as const, priority: 0.8 },
  ]);

  const { data: years } = await supabase
    .from("papers")
    .select("year, exams!inner(slug)")
    .eq("is_published", true)
    .returns<{ year: number; exams: { slug: string } }[]>();

  const seenYearRoutes = new Set<string>();
  const yearRoutes: MetadataRoute.Sitemap = [];
  for (const row of years ?? []) {
    const key = `${row.exams.slug}/${row.year}`;
    if (seenYearRoutes.has(key)) continue;
    seenYearRoutes.add(key);
    yearRoutes.push({
      url: `${siteUrl}/ssc/${row.exams.slug}/pyq/${row.year}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    });
  }

  const { data: subjects } = await supabase.from("subjects").select("slug");
  const subjectRoutes: MetadataRoute.Sitemap = (subjects ?? []).map((s) => ({
    url: `${siteUrl}/practice/${s.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const { data: papers } = await supabase
    .from("papers")
    .select("year, slug, exams!inner(slug)")
    .eq("is_published", true)
    .limit(45000) // stay comfortably under the 50k-URL-per-sitemap-file limit
    .returns<{ year: number; slug: string; exams: { slug: string } }[]>();

  const now = new Date();
  const paperRoutes: MetadataRoute.Sitemap = (papers ?? []).map((p) => ({
    url: `${siteUrl}/ssc/${p.exams.slug}/pyq/${p.year}/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...examRoutes, ...yearRoutes, ...subjectRoutes, ...paperRoutes];
}
