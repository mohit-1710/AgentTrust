import type { MetadataRoute } from "next";
import { PUBLIC_LINKS } from "@/data/links";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${PUBLIC_LINKS.site}/sitemap.xml`,
  };
}
