import { Plugin } from "obsidian";
import {
  TodoKeeperSettings,
  DEFAULT_SETTINGS,
  TodoKeeperSettingTab,
} from "./settings";
import { TodoPanelView, VIEW_TYPE_TODO_PANEL } from "./todo-panel";
import type { Marker } from "./marker-parser";
import { parseAllFiles } from "./marker-parser";
import { createEditorExtension } from "./editor-decorator";
import { createPostProcessor } from "./preview-renderer";

export default class TodoKeeperPlugin extends Plugin {
  settings!: TodoKeeperSettings;
  private markers: Marker[] = [];
  private editorExtension: any = null;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TodoKeeperSettingTab(this.app, this));

    // Register the side panel view
    this.registerView(
      VIEW_TYPE_TODO_PANEL,
      (leaf) => new TodoPanelView(leaf, this)
    );

    // Register editor extension for CodeMirror highlighting
    this.editorExtension = createEditorExtension(() => this.settings);
    this.registerEditorExtension(this.editorExtension);

    // Register reading mode post-processor
    this.registerMarkdownPostProcessor(createPostProcessor(() => this.settings));

    // Ribbon icon
    this.addRibbonIcon("list-checks", "TodoKeeper", () => {
      this.activateView();
    });

    // Command: show panel
    this.addCommand({
      id: "show-todo-panel",
      name: "Show todo panel",
      callback: () => this.activateView(),
    });

    // Command: scan vault
    this.addCommand({
      id: "scan-vault",
      name: "Scan vault for markers",
      callback: async () => {
        await this.scanAndRefresh();
      },
    });

    // Command: toggle highlight
    this.addCommand({
      id: "toggle-highlight",
      name: "Toggle marker highlight",
      callback: async () => {
        this.settings.enableHighlight = !this.settings.enableHighlight;
        await this.saveSettings();
        this.refreshAll();
      },
    });

    // Listen for file changes and refresh
    this.registerEvent(
      this.app.vault.on("modify", async (_file) => {
        // Debounce: refresh markers after a short delay
        this.debouncedScan();
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", async (_file) => {
        this.debouncedScan();
      })
    );

    // Initial scan
    await this.scanMarkers();
    this.updatePanel();
  }

  onunload() {
    // Cleanup handled automatically by Obsidian
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private _debounceTimer: number | null = null;

  private debouncedScan() {
    if (this._debounceTimer !== null) {
      window.clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = window.setTimeout(async () => {
      this._debounceTimer = null;
      await this.scanMarkers();
      this.updatePanel();
    }, 500);
  }

  async scanMarkers() {
    this.markers = await parseAllFiles(this.app.vault, this.settings);
  }

  async scanAndRefresh() {
    await this.scanMarkers();
    this.updatePanel();
  }

  refreshAll() {
    // Update the side panel; editor decorations pick up setting
    // changes on the next ViewPlugin update cycle automatically.
    this.updatePanel();
  }

  private updatePanel() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TODO_PANEL);
    for (const leaf of leaves) {
      const view = leaf.view as TodoPanelView;
      if (view instanceof TodoPanelView) {
        view.setMarkers(this.markers);
      }
    }
  }

  async activateView() {
    const { workspace } = this.app;

    const existing = workspace.getLeavesOfType(VIEW_TYPE_TODO_PANEL)[0];
    if (existing) {
      workspace.revealLeaf(existing);
      this.updatePanel();
      return;
    }

    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_TODO_PANEL, active: true });

    workspace.revealLeaf(leaf);
    this.updatePanel();
  }
}
