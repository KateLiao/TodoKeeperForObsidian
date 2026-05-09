import { MarkdownPostProcessorContext } from "obsidian";
import type { TodoKeeperSettings } from "./settings";

function buildRegex(keywords: string[]): RegExp {
  if (keywords.length === 0) return /(?!)/;
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`@(${escaped.join("|")}):\\s*(.+?)(?=@(?:${escaped.join("|")}):|$)`, "gi");
}

export function createPostProcessor(getSettings: () => TodoKeeperSettings) {
  return (el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
    const settings = getSettings();
    const regex = buildRegex(settings.markerKeywords);

    walkAndHighlight(el, regex, settings);
  };
}

function walkAndHighlight(
  el: HTMLElement,
  regex: RegExp,
  settings: TodoKeeperSettings
) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const replacements: { node: Text; fragment: DocumentFragment }[] = [];

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent;
    if (!text || !text.includes("@")) continue;

    // Reset regex lastIndex
    regex.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let hasMatch = false;

    while ((match = regex.exec(text)) !== null) {
      hasMatch = true;
      // Text before match
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index))
        );
      }

      const type = match[1].toLowerCase();
      const desc = match[2].trim();
      const color = settings.markerColors[type] ?? "#c0c0c0";

      const marker = createMarkerElement(type, desc, color);
      fragment.appendChild(marker);

      lastIndex = regex.lastIndex;
    }

    if (!hasMatch) continue;

    // Remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(
        document.createTextNode(text.slice(lastIndex))
      );
    }

    replacements.push({ node, fragment });
  }

  for (const { node, fragment } of replacements) {
    node.parentNode?.replaceChild(fragment, node);
  }
}

function createMarkerElement(
  type: string,
  desc: string,
  color: string
): HTMLElement {
  const span = document.createElement("span");
  span.className = `tk-marker tk-marker-${type}`;
  span.style.cssText = `
    background-color: ${color}30;
    padding: 1px 4px;
    border-radius: 3px;
    margin: 0 1px;
  `;
  span.setAttribute("data-tk-type", type);
  span.setAttribute("data-tk-desc", desc);

  const badge = document.createElement("span");
  badge.className = "tk-marker-badge";
  badge.style.cssText = `
    background-color: ${color};
    color: #fff;
    font-size: 0.75em;
    font-weight: 600;
    padding: 0px 4px;
    border-radius: 3px;
    margin-right: 4px;
  `;
  badge.textContent = type.toUpperCase();

  span.appendChild(badge);
  span.appendChild(document.createTextNode(desc));

  return span;
}
