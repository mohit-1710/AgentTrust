import { getPageImage, getPageMarkdownUrl, source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { DocsPageActions } from '@/components/docs/DocsPageActions';
import { DocsFooter } from '@/components/docs/DocsFooter';

const sectionLabels: Record<string, string> = {
  'getting-started': 'Getting started',
  programs: 'Programs',
  sdk: 'SDK',
  'integration-guides': 'Integration guides',
  reference: 'Reference',
};

const subsectionLabels: Record<string, string> = {
  'policy-vault': 'PolicyVault',
};

function getPageKicker(slug: string[] | undefined): string[] {
  if (!slug || slug.length === 0) return ['Introduction'];

  const [section, subsection] = slug;
  return [
    sectionLabels[section] ?? section,
    ...(subsection && subsectionLabels[subsection] ? [subsectionLabels[subsection]] : []),
  ];
}

interface DocsPageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export default async function Page(props: DocsPageProps) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const kicker = getPageKicker(params.slug);

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      breadcrumb={{ enabled: false }}
    >
      <div className="docs-page-kicker" aria-label="Page section">
        {kicker.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="docs-page-description mb-0">
        {page.data.description}
      </DocsDescription>
      <DocsPageActions markdownUrl={markdownUrl} />
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
      <DocsFooter />
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: DocsPageProps): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
