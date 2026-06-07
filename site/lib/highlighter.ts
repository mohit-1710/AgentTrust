import { cache } from "react";
import { createHighlighter, type Highlighter } from "shiki";

const SUPPORTED_LANGS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "rust",
  "bash",
  "shell",
  "md",
  "mdx",
  "html",
  "css",
  "toml",
  "yaml",
] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const getHighlighter = cache(async (): Promise<Highlighter> => {
  return createHighlighter({
    themes: ["vesper"],
    langs: [...SUPPORTED_LANGS],
  });
});

export function normalizeLang(input: string | undefined): SupportedLang {
  if (!input) return "ts";
  const lower = input.toLowerCase();
  if ((SUPPORTED_LANGS as readonly string[]).includes(lower)) {
    return lower as SupportedLang;
  }
  if (lower === "typescript") return "ts";
  if (lower === "javascript") return "js";
  if (lower === "sh" || lower === "zsh") return "bash";
  return "ts";
}
