export interface LinkAttributes {
  readonly rel?: "noopener noreferrer";
  readonly target?: "_blank";
}

export function getExternalLinkAttributes(href: string): LinkAttributes {
  if (!href.startsWith("http")) {
    return {};
  }

  return {
    rel: "noopener noreferrer",
    target: "_blank",
  };
}
