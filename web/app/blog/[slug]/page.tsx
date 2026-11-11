import type { Metadata } from "next";
import type { ComponentType } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlogTopBar from "@/components/blog/BlogTopBar";
import { PUBLIC_LINKS } from "@/data/links";
import { formatPostDate, getPost, getPostSlugs } from "@/lib/posts";

import styles from "@/app/blog/blog.module.css";

interface BlogPostRouteParams {
  readonly slug: string;
}

interface BlogPostPageProps {
  readonly params: Promise<BlogPostRouteParams>;
}

export async function generateStaticParams(): Promise<BlogPostRouteParams[]> {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    return { title: "Not found | AgentTrust" };
  }
  const url = `${PUBLIC_LINKS.site}/blog/${post.slug}`;
  const ogImage = `${PUBLIC_LINKS.site}/og/blog/${post.slug}`;
  return {
    title: `${post.title} | AgentTrust`,
    description: post.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      publishedTime: post.date,
      modifiedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  };
}

async function loadPostComponent(slug: string): Promise<ComponentType | null> {
  try {
    const mod = await import(`@/posts/${slug}.mdx`);
    return mod.default as ComponentType;
  } catch {
    return null;
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    notFound();
  }

  const PostBody = await loadPostComponent(slug);
  if (!PostBody) {
    notFound();
  }

  const url = `${PUBLIC_LINKS.site}/blog/${post.slug}`;
  const ogImage = `${PUBLIC_LINKS.site}/og/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    author: {
      "@type": "Person",
      name: post.author,
      url: PUBLIC_LINKS.site,
    },
    datePublished: post.date,
    dateModified: post.date,
    image: ogImage,
    mainEntityOfPage: url,
    publisher: {
      "@type": "Organization",
      name: "AgentTrust",
      logo: {
        "@type": "ImageObject",
        url: `${PUBLIC_LINKS.site}/icon.svg`,
      },
    },
  };

  return (
    <div className={styles.page}>
      <BlogTopBar />
      <main className={styles.postShell} aria-label={post.title}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <article className={styles.postCard}>
          <header className={styles.postHeader}>
            <Link href="/blog" className={styles.postBack}>
              <span aria-hidden="true">&larr;</span> Back to blog
            </Link>
            <p className={styles.eyebrow}>AGENTTRUST</p>
            <h1 className={styles.postTitle}>{post.title}</h1>
            <p className={styles.postAuthor}>
              {post.author} &middot;{" "}
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            </p>
          </header>
          <div className={styles.postBody}>
            <PostBody />
          </div>
        </article>
      </main>
    </div>
  );
}
