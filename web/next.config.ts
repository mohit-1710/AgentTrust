import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
    rehypePlugins: [],
  },
});

const nextConfig: NextConfig = {
  devIndicators: false,
  // The local SDK uses NodeNext .js specifiers for its TypeScript sources.
  experimental: { extensionAlias: { ".js": [".ts", ".tsx", ".js"] } },
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  turbopack: {
    root: path.dirname(configDirectory),
  },
};

export default withMDX(nextConfig);
