import { TFile, Vault } from "obsidian";
import type { TodoKeeperSettings } from "./settings";

export interface Marker {
  file: TFile;
  line: number;
  type: string;
  text: string;
}

function buildRegex(keywords: string[]): RegExp {
  if (keywords.length === 0) {
    return /(?!)/; // matches nothing
  }
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = `^.*?@(${escaped.join("|")}):\\s*(.+)$`;
  return new RegExp(pattern, "i");
}

function isIgnored(file: TFile, ignoreFolders: string[]): boolean {
  for (const folder of ignoreFolders) {
    if (folder && file.path.startsWith(folder + "/")) {
      return true;
    }
  }
  return false;
}

export async function parseAllFiles(
  vault: Vault,
  settings: TodoKeeperSettings
): Promise<Marker[]> {
  const regex = buildRegex(settings.markerKeywords);
  const files = vault.getMarkdownFiles();
  const markers: Marker[] = [];

  for (const file of files) {
    if (isIgnored(file, settings.ignoreFolders)) continue;
    const fileMarkers = await parseFile(vault, file, regex);
    markers.push(...fileMarkers);
  }

  return markers;
}

export async function parseFile(
  vault: Vault,
  file: TFile,
  regex: RegExp
): Promise<Marker[]> {
  const markers: Marker[] = [];
  const content = await vault.cachedRead(file);
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(regex);
    if (match) {
      markers.push({
        file,
        line: i + 1,
        type: match[1].toLowerCase(),
        text: match[2].trim(),
      });
    }
  }

  return markers;
}

export function parseCurrentFileContent(
  file: TFile,
  content: string,
  keywords: string[]
): Marker[] {
  const regex = buildRegex(keywords);
  const markers: Marker[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(regex);
    if (match) {
      markers.push({
        file,
        line: i + 1,
        type: match[1].toLowerCase(),
        text: match[2].trim(),
      });
    }
  }

  return markers;
}
