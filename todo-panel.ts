import { ItemView, MarkdownView, WorkspaceLeaf, TFile } from "obsidian";
import type TodoKeeperPlugin from "./main";
import type { Marker } from "./marker-parser";
import { getMarkerColor } from "./settings";

export const VIEW_TYPE_TODO_PANEL = "todo-keeper-panel";

export class TodoPanelView extends ItemView {
  plugin: TodoKeeperPlugin;
  private markers: Marker[] = [];
  private activeFilter: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: TodoKeeperPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_TODO_PANEL;
  }

  getDisplayText(): string {
    return "TodoKeeper";
  }

  getIcon(): string {
    return "list-checks";
  }

  setMarkers(markers: Marker[]) {
    this.markers = markers;
    this.render();
  }

  private render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("tk-panel");

    // Header
    const header = container.createDiv("tk-panel-header");

    const titleRow = header.createDiv("tk-panel-title-row");
    titleRow.createSpan({ text: "TodoKeeper", cls: "tk-panel-title" });

    const refreshBtn = titleRow.createEl("button", {
      text: "Refresh",
      cls: "tk-refresh-btn",
    });
    refreshBtn.addEventListener("click", () => {
      this.plugin.scanAndRefresh();
    });

    // Count
    if (this.markers.length > 0) {
      titleRow.createSpan({
        text: `${this.markers.length} markers`,
        cls: "tk-panel-count",
      });
    }

    // Filter bar
    const types = collectTypes(this.markers);
    if (types.length > 0) {
      const filterBar = header.createDiv("tk-filter-bar");

      const allChip = filterBar.createEl("button", {
        text: "All",
        cls: `tk-filter-chip ${this.activeFilter === null ? "tk-filter-active" : ""}`,
      });
      allChip.addEventListener("click", () => {
        this.activeFilter = null;
        this.render();
      });

      for (const type of types) {
        const color = getMarkerColor(this.plugin.settings, type);
        const chip = filterBar.createEl("button", {
          text: `@${type}`,
          cls: `tk-filter-chip ${this.activeFilter === type ? "tk-filter-active" : ""}`,
        });
        chip.style.cssText = `--tk-chip-color: ${color}`;
        chip.addEventListener("click", () => {
          this.activeFilter = this.activeFilter === type ? null : type;
          this.render();
        });
      }
    }

    // List
    const list = container.createDiv("tk-panel-list");

    const filtered = this.activeFilter
      ? this.markers.filter((m) => m.type === this.activeFilter)
      : this.markers;

    if (filtered.length === 0) {
      list.createDiv({
        text: this.markers.length === 0
          ? "No markers found. Add @todo: or @fixme: to your notes."
          : "No markers match the selected filter.",
        cls: "tk-empty-state",
      });
      return;
    }

    const grouped = groupByFile(filtered);

    for (const [file, fileMarkers] of grouped) {
      const group = list.createDiv("tk-file-group");

      const fileHeader = group.createDiv("tk-file-header");
      fileHeader.createSpan({ text: file.name, cls: "tk-file-name" });
      fileHeader.createSpan({
        text: file.path,
        cls: "tk-file-path",
      });

      fileHeader.addEventListener("click", () => {
        this.navigateToFile(file);
      });

      for (const marker of fileMarkers) {
        const color = getMarkerColor(this.plugin.settings, marker.type);
        const item = group.createDiv("tk-marker-item");
        item.style.cssText = `--tk-marker-color: ${color}`;
        item.setAttribute("data-tk-type", marker.type);
        item.addEventListener("click", () => {
          this.navigateToMarker(marker);
        });

        const badge = item.createSpan({
          text: marker.type,
          cls: `tk-marker-badge tk-marker-badge-${marker.type}`,
        });
        badge.style.cssText = `background-color: ${color}`;

        item.createSpan({
          text: truncate(marker.text, 100),
          cls: "tk-marker-text",
        });

        item.createSpan({
          text: `L${marker.line}`,
          cls: "tk-marker-line-num",
        });
      }
    }
  }

  private async navigateToFile(file: TFile) {
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private async navigateToMarker(marker: Marker) {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(marker.file);
    (leaf as any).setEphemeralState({ line: marker.line });

    const view = leaf.view;
    if (view instanceof MarkdownView) {
      const editor = view.editor;
      const pos = { line: marker.line - 1, ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ from: pos, to: pos }, true);
    }
  }
}

function collectTypes(markers: Marker[]): string[] {
  const set = new Set<string>();
  for (const m of markers) {
    set.add(m.type);
  }
  return Array.from(set).sort();
}

function groupByFile(markers: Marker[]): Map<TFile, Marker[]> {
  const map = new Map<TFile, Marker[]>();
  for (const m of markers) {
    const existing = map.get(m.file);
    if (existing) {
      existing.push(m);
    } else {
      map.set(m.file, [m]);
    }
  }
  return map;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}
