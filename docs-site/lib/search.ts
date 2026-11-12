import type { SortedResult } from 'fumadocs-core/search';

export interface SearchPage {
  url: string;
  title: string;
  description: string;
  content: string;
}

// The small current corpus needs literal text matching, not a database or provider.
export function searchPages(pages: readonly SearchPage[], query: string): SortedResult[] {
  if (query.length > 200) return [];
  const terms = [...new Set(query.toLowerCase().trim().split(/\s+/).filter(Boolean))];
  if (!terms.length) return [];
  return pages
    .map((page) => {
      const title = page.title.toLowerCase();
      const description = page.description.toLowerCase();
      const text = `${title}\n${description}\n${page.content.toLowerCase()}`;
      const score = terms.every((term) => text.includes(term))
        ? 1 + terms.reduce((sum, term) => sum + (title.includes(term) ? 3 : 0) + (description.includes(term) ? 1 : 0), 0)
        : 0;
      return { page, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.page.url.localeCompare(b.page.url))
    .slice(0, 12)
    .flatMap(({ page }) => {
      const body = page.content.replace(/\s+/g, ' ').trim();
      const matchAt = body.toLowerCase().indexOf(terms.find((term) => body.toLowerCase().includes(term)) ?? '');
      const start = Math.max(0, matchAt - 60);
      const snippet = terms.some((term) => page.description.toLowerCase().includes(term))
        ? page.description
        : `${start ? '…' : ''}${body.slice(start, start + 200)}${body.length > start + 200 ? '…' : ''}`;
      return [
        { id: page.url, url: page.url, type: 'page' as const, content: page.title },
        { id: `${page.url}#description`, url: page.url, type: 'text' as const, content: snippet || page.description },
      ];
    });
}
