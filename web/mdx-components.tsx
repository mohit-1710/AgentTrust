import type { MDXComponents } from "mdx/types";
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import CodeBlock from "@/components/blog/CodeBlock";
import { DataPanel, DataRow } from "@/components/blog/DataPanel";
import Note from "@/components/blog/Note";
import { Pillar, PillarGrid } from "@/components/blog/Pillar";
import Quote from "@/components/blog/Quote";
import { Stat, StatGrid } from "@/components/blog/Stat";

function getStringChild(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getStringChild).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getStringChild(node.props.children);
  }
  return "";
}

function extractLang(className: string | undefined): string | undefined {
  if (!className) return undefined;
  const match = className.match(/language-([\w-]+)/);
  return match ? match[1] : undefined;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Note,
    Quote,
    Stat,
    StatGrid,
    Pillar,
    PillarGrid,
    DataPanel,
    DataRow,
    pre: ({ children }) => {
      if (
        isValidElement<{ className?: string; children?: ReactNode }>(children) &&
        (children as ReactElement<{ className?: string }>).type === "code"
      ) {
        const codeEl = children as ReactElement<{
          className?: string;
          children?: ReactNode;
        }>;
        const lang = extractLang(codeEl.props.className);
        const value = getStringChild(codeEl.props.children).replace(/\n$/, "");
        return <CodeBlock code={value} lang={lang} />;
      }
      return <pre>{children}</pre>;
    },
    ...components,
  };
}
