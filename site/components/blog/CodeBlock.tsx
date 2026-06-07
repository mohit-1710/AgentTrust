import CopyButton from "@/components/blog/CopyButton";
import { getHighlighter, normalizeLang } from "@/lib/highlighter";

import styles from "@/components/blog/CodeBlock.module.css";

interface CodeBlockProps {
  readonly code: string;
  readonly lang?: string;
}

export default async function CodeBlock({ code, lang }: CodeBlockProps) {
  const normalized = normalizeLang(lang);
  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(code, {
    lang: normalized,
    theme: "vesper",
  });

  return (
    <div className={`${styles.shell} codeBlockShell`}>
      <span className={styles.langLabel}>{normalized}</span>
      <div className={styles.scroll} dangerouslySetInnerHTML={{ __html: html }} />
      <CopyButton value={code} />
    </div>
  );
}
