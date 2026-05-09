import { App, PluginSettingTab, Setting } from "obsidian";
import type TodoKeeperPlugin from "./main";

export const DEFAULT_MARKER_KEYWORDS = ["todo", "fixme", "review"];
export const DEFAULT_IGNORE_FOLDERS = [".obsidian", "_templates"];

export const DEFAULT_MARKER_COLORS: Record<string, string> = {
  todo: "#e06c75",
  fixme: "#e5c07b",
  review: "#61afef",
};

const PALETTE_COLORS = [
  "#e06c75", "#e5c07b", "#61afef", "#98c379", "#c678dd",
  "#d19a66", "#56b6c2", "#ef596f", "#89ca78", "#2bbac5",
  "#e5c07b", "#be5046", "#7c3aed", "#059669", "#db2777",
];

export interface TodoKeeperSettings {
  markerKeywords: string[];
  ignoreFolders: string[];
  enableHighlight: boolean;
  markerColors: Record<string, string>;
}

export const DEFAULT_SETTINGS: TodoKeeperSettings = {
  markerKeywords: [...DEFAULT_MARKER_KEYWORDS],
  ignoreFolders: [...DEFAULT_IGNORE_FOLDERS],
  enableHighlight: true,
  markerColors: { ...DEFAULT_MARKER_COLORS },
};

export function getMarkerColor(
  settings: TodoKeeperSettings,
  type: string
): string {
  return settings.markerColors[type] ?? "#c0c0c0";
}

export class TodoKeeperSettingTab extends PluginSettingTab {
  plugin: TodoKeeperPlugin;
  private colorSectionEl: HTMLElement | null = null;

  constructor(app: App, plugin: TodoKeeperPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "TodoKeeper Settings" });

    new Setting(containerEl)
      .setName("Marker keywords")
      .setDesc(
        "Comma-separated list of keywords to detect (e.g. todo,fixme,review). Markers are matched as @keyword: description."
      )
      .addText((text) => {
        text
          .setPlaceholder("todo,fixme,review")
          .setValue(this.plugin.settings.markerKeywords.join(","))
          .onChange(async (value) => {
            this.plugin.settings.markerKeywords = value
              .split(",")
              .map((k) => k.trim().toLowerCase())
              .filter((k) => k.length > 0);
            await this.plugin.saveSettings();
            this.plugin.refreshAll();
            this.renderColorSection();
          });
      });

    new Setting(containerEl)
      .setName("Ignore folders")
      .setDesc(
        "Comma-separated list of folders to exclude from scanning (e.g. .obsidian,_templates)."
      )
      .addText((text) => {
        text
          .setPlaceholder(".obsidian,_templates")
          .setValue(this.plugin.settings.ignoreFolders.join(","))
          .onChange(async (value) => {
            this.plugin.settings.ignoreFolders = value
              .split(",")
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            await this.plugin.saveSettings();
            this.plugin.refreshAll();
          });
      });

    new Setting(containerEl)
      .setName("Enable highlight")
      .setDesc("Highlight marker lines in the editor.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableHighlight)
          .onChange(async (value) => {
            this.plugin.settings.enableHighlight = value;
            await this.plugin.saveSettings();
            this.plugin.refreshAll();
          });
      });

    this.colorSectionEl = containerEl.createDiv("tk-settings-color-section");
    this.renderColorSection();
  }

  private renderColorSection(): void {
    if (!this.colorSectionEl) return;
    this.colorSectionEl.empty();

    this.colorSectionEl.createEl("h3", { text: "Marker Colors" });

    const keywords = this.plugin.settings.markerKeywords;
    if (keywords.length === 0) {
      this.colorSectionEl.createEl("p", {
        text: "Add keywords above to configure their colors.",
        cls: "setting-item-description",
      });
      return;
    }

    for (const keyword of keywords) {
      if (!this.plugin.settings.markerColors[keyword]) {
        this.plugin.settings.markerColors[keyword] = PALETTE_COLORS[
          (keywords.indexOf(keyword) * 3) % PALETTE_COLORS.length
        ];
      }

      new Setting(this.colorSectionEl)
        .setName(`@${keyword}`)
        .addColorPicker((picker) => {
          picker
            .setValue(this.plugin.settings.markerColors[keyword])
            .onChange(async (value) => {
              this.plugin.settings.markerColors[keyword] = value;
              await this.plugin.saveSettings();
              this.plugin.refreshAll();
            });
        })
        .addExtraButton((btn) => {
          btn.setIcon("palette");
          btn.setTooltip("Pick from presets");
          btn.onClick(() => {
            this.showPalettePopup(keyword, btn.extraSettingsEl);
          });
        });
    }
  }

  private showPalettePopup(keyword: string, anchor: HTMLElement): void {
    // Remove any existing popup
    const existing = document.querySelector(".tk-palette-popup");
    if (existing) existing.remove();

    const popup = document.createElement("div");
    popup.className = "tk-palette-popup";
    popup.style.cssText = `
      position: absolute;
      z-index: 1000;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 6px;
      padding: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      width: 200px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    for (const color of PALETTE_COLORS) {
      const swatch = document.createElement("div");
      swatch.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 4px;
        background-color: ${color};
        cursor: pointer;
        border: 2px solid ${this.plugin.settings.markerColors[keyword] === color ? "var(--interactive-accent)" : "transparent"};
      `;
      swatch.addEventListener("click", async () => {
        this.plugin.settings.markerColors[keyword] = color;
        await this.plugin.saveSettings();
        this.plugin.refreshAll();
        this.renderColorSection();
        popup.remove();
      });

      // Preview marker style on hover
      swatch.addEventListener("mouseenter", () => {
        swatch.style.transform = "scale(1.2)";
        swatch.style.transition = "transform 0.1s";
      });
      swatch.addEventListener("mouseleave", () => {
        swatch.style.transform = "scale(1)";
      });

      popup.appendChild(swatch);
    }

    // Position the popup near the anchor
    const rect = anchor.getBoundingClientRect();
    popup.style.left = `${rect.right + 8}px`;
    popup.style.top = `${rect.top}px`;

    document.body.appendChild(popup);

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node)) {
        popup.remove();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeHandler);
    }, 0);
  }
}
