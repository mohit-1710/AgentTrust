import { cache } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";

export interface PostFrontmatter {
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly author: string;
}

export interface PostMeta extends PostFrontmatter {
  readonly slug: string;
  readonly readingTime: string;
  readonly coverImage: string;
}

export interface Post extends PostMeta {
  readonly content: string;
}

const POSTS_DIRECTORY = path.join(process.cwd(), "posts");

async function readPostFile(slug: string): Promise<Post | null> {
  const filePath = path.join(POSTS_DIRECTORY, `${slug}.mdx`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
  const parsed = matter(raw);
  const data = parsed.data as Partial<PostFrontmatter>;
  if (!data.title || !data.description || !data.date || !data.author) {
    return null;
  }
  const stats = readingTime(parsed.content);
  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    author: data.author,
    readingTime: stats.text,
    coverImage: `/blog/covers/${slug}.png`,
    content: parsed.content,
  };
}

export const getAllPosts = cache(async (): Promise<PostMeta[]> => {
  let entries: string[];
  try {
    entries = await fs.readdir(POSTS_DIRECTORY);
  } catch {
    return [];
  }
  const slugs = entries
    .filter((entry) => entry.endsWith(".mdx"))
    .map((entry) => entry.replace(/\.mdx$/, ""));
  const posts = await Promise.all(slugs.map(readPostFile));
  return posts
    .filter((post): post is Post => post !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ content, ...meta }) => { void content; return meta; });
});

export const getPost = cache(async (slug: string): Promise<Post | null> => {
  return readPostFile(slug);
});

export const getPostSlugs = cache(async (): Promise<string[]> => {
  const posts = await getAllPosts();
  return posts.map((post) => post.slug);
});

export function formatPostDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
