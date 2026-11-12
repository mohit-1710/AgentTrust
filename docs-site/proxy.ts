import { NextRequest, NextResponse } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { docsContentRoute, docsRoute } from '@/lib/shared';

const { rewrite: rewriteDocs } = rewritePath(
  `${docsRoute}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`,
);
const { rewrite: rewriteSuffix } = rewritePath(
  `${docsRoute}{/*path}.mdx`,
  `${docsContentRoute}{/*path}/content.md`,
);

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Rewritten Markdown retains Accept. Never rewrite its destination again,
  // or intercept API, image, legacy-redirect and framework asset routes.
  const reserved = [docsContentRoute, '/api', '/og', '/docs', '/_next'];
  if (reserved.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
      ['/llms.txt', '/llms-full.txt', '/favicon.svg'].includes(pathname)) {
    return NextResponse.next();
  }
  const result = rewriteSuffix(pathname);
  if (result) {
    return NextResponse.rewrite(new URL(result, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    const result = rewriteDocs(pathname);

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  return NextResponse.next();
}
