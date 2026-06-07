import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ComponentPropsWithoutRef } from 'react';
import { KaniProofBadge } from './docs/KaniProofBadge';
import { ProgramIdsTable } from './docs/ProgramIdsTable';

function ScrollableTable(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="docs-table-scroll" role="region" aria-label="Scrollable table">
      <table {...props} />
    </div>
  );
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    table: ScrollableTable,
    KaniProofBadge,
    ProgramIdsTable,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
