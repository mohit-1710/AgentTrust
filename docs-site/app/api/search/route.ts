import { source } from '@/lib/source';
import { searchPages, type SearchPage } from '@/lib/search';

let corpus: Promise<SearchPage[]> | undefined;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('query') ?? '';
  if (!query.trim() || query.length > 200) return Response.json([]);
  corpus ??= Promise.all(source.getPages().map(async (page) => ({
    url: page.url,
    title: page.data.title,
    description: page.data.description ?? '',
    content: await page.data.getText('processed'),
  }))).catch((error) => {
    corpus = undefined;
    throw error;
  });
  return Response.json(searchPages(await corpus, query));
}
