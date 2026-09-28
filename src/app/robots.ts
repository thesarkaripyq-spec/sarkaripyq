import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/profile",
          "/dashboard",
          "/bookmarks",
        ],
      },
      // Content-scraping bots that ignore crawl-delay/robots conventions on
      // most sites still choose to respect an explicit disallow far more
      // often than a generic "*" rule; naming the common ones is cheap
      // defense-in-depth even though it's not enforceable on its own.
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "AhrefsBot", disallow: "/" },
      { userAgent: "SemrushBot", disallow: "/" },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
