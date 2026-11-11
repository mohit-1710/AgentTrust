import { promises as fs } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getPost, getPostSlugs } from "@/lib/posts";

export const runtime = "nodejs";
export const dynamic = "force-static";

interface OgRouteContext {
  readonly params: Promise<{ slug: string }>;
}

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

async function loadFont(filename: string): Promise<ArrayBuffer | null> {
  try {
    const buf = await fs.readFile(path.join(FONTS_DIR, filename));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    return null;
  }
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function GET(_req: Request, context: OgRouteContext) {
  const { slug } = await context.params;
  const post = await getPost(slug);
  if (!post) notFound();

  const [fraunces, geistMono] = await Promise.all([
    loadFont("Fraunces-SemiBold.ttf"),
    loadFont("GeistMono-Medium.ttf"),
  ]);

  const fonts = [];
  if (fraunces) {
    fonts.push({
      name: "Fraunces",
      data: fraunces,
      style: "normal" as const,
      weight: 600 as const,
    });
  }
  if (geistMono) {
    fonts.push({
      name: "Geist Mono",
      data: geistMono,
      style: "normal" as const,
      weight: 500 as const,
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fbfaf9",
          padding: "64px 72px",
          position: "relative",
          fontFamily: "Fraunces, serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 4,
            background: "#6f4cff",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(10, 10, 10, 0.16) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.18,
            maskImage:
              "linear-gradient(135deg, rgba(0,0,0,1), rgba(0,0,0,0) 70%)",
            WebkitMaskImage:
              "linear-gradient(135deg, rgba(0,0,0,1), rgba(0,0,0,0) 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            position: "relative",
          }}
        >
          <div
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: 18,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#6f4cff",
              display: "flex",
            }}
          >
            AGENTTRUST
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              maxWidth: 980,
            }}
          >
            <div
              style={{
                fontFamily: "Fraunces, serif",
                fontWeight: 600,
                fontSize: 64,
                lineHeight: 1.05,
                letterSpacing: "-0.04em",
                color: "#0a0a0a",
                display: "flex",
              }}
            >
              {post.title}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "Geist Mono, monospace",
              fontSize: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(10, 10, 10, 0.55)",
            }}
          >
            <span style={{ display: "flex" }}>{post.author}</span>
            <span style={{ display: "flex" }}>agenttrust.tech</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
