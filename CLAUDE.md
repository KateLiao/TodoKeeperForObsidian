# TodoKeeper - Obsidian 断点标记插件

## 需求分析

用户在写文档时频繁跳跃编辑段落，容易遗忘未完成的段落。需要：
1. 用特殊字符标记/高亮"断点"（未完成的段落）
2. 在统一位置查看所有断点
3. 能一键跳转到对应断点

## 实现思路

### 1. 标记语法设计

支持两种标记方式，用户可配置：

**行内标记（推荐默认）**：
```
@todo: 这里还需要补充性能分析的说明
@fixme: 这段逻辑描述有误，需要修正
@review: 需要复查这部分引用
```

**备注块标记**（多行/长描述场景）：
```
%%TODO
这里需要详细展开 Kubernetes 部署的步骤：
- 创建 Deployment
- 配置 Service
- 设置 Ingress
%%
```

优点：行内标记输入成本低、一眼可见；备注块使用 Obsidian 原生 `%%` 注释语法，编辑和预览模式都不影响正文渲染。

### 2. 插件架构

```
ob-todoKeeper/
├── main.ts              # 插件入口，注册所有功能模块
├── settings.ts          # 配置面板：自定义标记关键字、颜色、忽略目录等
├── marker-parser.ts     # 解析器：扫描 vault 中所有 markdown 文件，提取断点
├── editor-decorator.ts  # 编辑器增强：CodeMirror 6 扩展，在编辑器中高亮标记行
├── preview-renderer.ts  # 预览增强：MarkdownPostProcessor，在阅读模式下渲染标记
└── todo-panel.ts        # 侧边栏面板：ItemView，列出所有断点并支持跳转
```

### 3. 各模块职责

#### settings.ts — 配置管理
- 标记关键字列表（默认 `todo`, `fixme`, `review`）
- 标记颜色 / 图标 / CSS class
- 忽略目录（如 `.obsidian`, `_templates`）
- 是否启用实时扫描 vs 手动刷新
- 使用 Obsidian 的 `PluginSettingTab` 实现配置 UI

#### marker-parser.ts — 解析器
- 核心正则：`/@(\w+):\s*(.+)$/` 匹配行内标记，`/%%(\w+)\n([\s\S]*?)%%/` 匹配备注块
- 遍历 `app.vault.getMarkdownFiles()` 获取所有 md 文件
- 对每个文件读取内容并提取：文件名、行号、标记类型、描述文本
- 返回统一数据结构 `Marker[]`：
```ts
interface Marker {
  file: TFile;
  line: number;        // 行号（1-indexed）
  type: string;        // todo | fixme | review | 自定义
  text: string;        // 描述文本
  col?: number;        // 列位置（用于精确跳转）
}
```

#### editor-decorator.ts — 编辑器高亮
- 使用 CodeMirror 6 的 `ViewPlugin` + `Decoration` 机制
- 创建 `Decoration.line` 给匹配行添加 CSS class（如 `.todo-marker-line`），实现整行高亮
- 同时用 `Decoration.mark` 精确高亮 `@todo:` 关键字本身
- 样式：左侧彩色竖线 + 文字背景色（类似 VS Code 的 TODO highlight）
- 依赖 `editorExtension` 生命周期钩子注册到 Live Preview 和 Source Mode

#### preview-renderer.ts — 阅读模式渲染
- 通过 `registerMarkdownPostProcessor` 拦截渲染流程
- 将匹配到的 `@todo: xxx` 替换为带样式的 HTML 元素
- 点击标记可触发跳转到侧边面板（可选功能）

#### todo-panel.ts — 侧边栏面板
- 继承 `ItemView`，通过 `registerView` 注册
- UI 使用 `view.containerEl` 构建 DOM 列表，每个条目包含：
  - 图标（按类型区分颜色/icon）
  - 文件名（可点击跳转）
  - 行号
  - 描述文本摘要
- 点击条目调用 `app.workspace.openLinkText()` 跳转到文件对应行
- 支持按类型筛选、按文件分组
- 显示统计：每种类型的计数
- 响应文件变更事件（`vault.on('modify')` / `metadataCache.on('changed')`）自动刷新
- 提供手动刷新按钮

### 4. 数据流

```
文件变更事件
    │
    ▼
marker-parser.ts  ←── 扫描 vault 所有 .md 文件
    │
    ▼
Marker[] 数据
    │
    ├──▶ editor-decorator.ts  → CodeMirror 高亮（编辑模式）
    ├──▶ preview-renderer.ts  → HTML 渲染（阅读模式）
    └──▶ todo-panel.ts        → 侧边栏列表（统一查看 & 跳转）
```

### 5. 关键技术点

| 技术点 | Obsidian API |
|--------|-------------|
| 获取所有 md 文件 | `app.vault.getMarkdownFiles()` |
| 读取文件内容 | `app.vault.cachedRead(file)` |
| 编辑器扩展 | `Plugin.registerEditorExtension()` |
| 阅读模式渲染 | `Plugin.registerMarkdownPostProcessor()` |
| 自定义视图 | `Plugin.registerView()` + `ItemView` |
| 打开文件跳转行 | `app.workspace.openLinkText(filePath, sourcePath, { active: true })` 或通过 leaf.openFile() + setEphemeralState |
| 配置面板 | `Plugin.loadSettings()` + `PluginSettingTab` |
| 监听文件变更 | `app.vault.on('modify', callback)` |

### 6. 触发/激活方式

- 左侧 Ribbon 图标（列表图标），点击打开/关闭 Todo Panel
- 命令面板命令：
  - `TodoKeeper: Show todo panel` — 打开面板
  - `TodoKeeper: Scan vault` — 手动全量扫描
  - `TodoKeeper: Toggle todo highlight` — 开关高亮

### 7. 开发环境

- 使用 `obsidian-dev-utils` 或官方模板搭建 TypeScript 项目
- 打包工具：esbuild（Obsidian 官方推荐）
- Node.js + TypeScript，输出 `main.js` + `manifest.json` + `styles.css`

### 8. 待决策项

- [x] 是否需要支持"仅当前文件"vs"全 Vault"扫描模式切换? 决定：需要
- [x] 标记是否需要状态流转（todo → in_progress → done）还是保持简单？ 决定：保持简单
- [x] 是否需要数据持久化（标记完成状态），还是完全依赖文件内容解析？ 决定：不需要持久化
- [x] 是否支持通过面板直接添加/删除断点，还是仅作为查看器？ 决定：不需要

### 9. MVP 范围建议

第一版只做核心闭环：
1. 行内 `@todo:` 标记支持
2. 编辑器内高亮
3. 侧边栏面板查看 + 跳转
4. 基础配置（忽略目录、关键字列表）

第二步迭代再加备注块支持、阅读模式渲染、自动刷新优化等。
