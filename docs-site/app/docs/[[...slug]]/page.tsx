import { permanentRedirect } from 'next/navigation';

interface LegacyDocsRedirectProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export default async function LegacyDocsRedirect({ params }: LegacyDocsRedirectProps) {
  const { slug = [] } = await params;
  const target = slug.length > 0 ? `/${slug.map(encodeURIComponent).join('/')}` : '/';

  permanentRedirect(target);
}
