import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import type { TodoKeeperSettings } from "./settings";

function buildRegex(keywords: string[]): RegExp {
  if (keywords.length === 0) return /(?!)/;
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`@(${escaped.join("|")}):`, "gi");
}

function buildDecorations(
  view: EditorView,
  settings: TodoKeeperSettings
): DecorationSet {
  if (!settings.enableHighlight) return Decoration.none;

  const regex = buildRegex(settings.markerKeywords);
  const decorations: { from: number; to: number; value: Decoration }[] = [];
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);

    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const type = match[1].toLowerCase();
      const color = settings.markerColors[type] ?? "#c0c0c0";
      const matchStart = from + match.index;

      // Find end of line containing this marker
      const lineEnd = text.indexOf("\n", regex.lastIndex);
      const descEnd =
        lineEnd === -1 ? from + text.length : from + lineEnd;

      // Mark from @tag: to end of line
      if (descEnd > matchStart) {
        decorations.push({
          from: matchStart,
          to: descEnd,
          value: Decoration.mark({
            class: "tk-editor-marker",
            attributes: {
              "data-tk-type": type,
              style: `--tk-color: ${color}`,
            },
          }),
        });
      }
    }
  }

  return Decoration.set(decorations, true);
}

export function createEditorExtension(
  getSettings: () => TodoKeeperSettings
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, getSettings());
      }

      update(update: ViewUpdate) {
        // Always rebuild — cheap enough for visible ranges only,
        // and ensures settings changes are immediately reflected.
        this.decorations = buildDecorations(update.view, getSettings());
      }
    },
    { decorations: (v) => v.decorations }
  );
}
