# Tabsidian — AI 内联补全 Obsidian 插件设计文档

## 概述

Tabsidian 是一个 Obsidian 插件，提供类似 Cursor TAB 键的 AI 内联补全体验。用户在编辑器中输入文本后停顿片刻，插件自动调用 AI 生成续写建议，以半透明 ghost text 显示在光标后方。用户按 TAB 接受全部、Ctrl+→ 逐词接受、Ctrl+↓ 逐行接受、Esc 或继续输入取消。

## 架构

采用纯 CodeMirror 6 Extension 方案，分为 Editor 层和 Service 层。

### Editor 层（CM6 Extensions）

| 模块 | 类型 | 职责 |
|------|------|------|
| GhostTextWidget | WidgetType | 渲染半透明建议文本。单行用 inline `<span>`，多行首行 inline + 后续行 block widget |
| CompletionStateField | StateField | 管理补全状态机：idle → loading → showing → idle。存储当前建议文本、光标位置 |
| CompletionKeymap | keymap | 拦截 TAB（全部接受）、Ctrl+→（逐词）、Ctrl+↓（逐行）、Esc（取消）。仅在有活跃 ghost text 时拦截，否则保持原生行为 |
| DebounceTrigger | ViewPlugin | 监听文档变更，用户停顿 500ms（可配置）后触发补全请求。用户继续输入时取消进行中的请求 |

### Service 层

| 模块 | 职责 |
|------|------|
| ProviderManager | 管理多后端切换，根据设置实例化对应 Provider |
| ContextBuilder | 从光标位置提取 prefix/suffix 上下文，拼接用户自定义 system prompt |
| ExclusionFilter | 根据文件夹路径和笔记标签判断是否跳过补全 |
| UsageTracker | 记录 API 调用次数、接受次数、token 消耗量、接受率 |

### 数据流

```
用户停顿 500ms
  → DebounceTrigger 检测
  → ExclusionFilter 检查当前文件是否排除
  → ContextBuilder 构建 prefix/suffix + system prompt
  → ProviderManager 调用当前 AI 后端
  → CompletionStateField 存储返回的建议文本
  → GhostTextWidget 在光标位置渲染 ghost text

用户按 TAB → 将全部 ghost text 插入文档，清除状态
用户按 Ctrl+→ → 插入下一个词，更新 ghost text 显示剩余部分
用户按 Ctrl+↓ → 插入下一行，更新 ghost text 显示剩余部分
用户按 Esc / 继续输入 → 取消补全，清除 ghost text
```

## Ghost Text 渲染

- 使用 CM6 `Decoration.widget` 在光标位置插入 widget
- 单行补全：`<span>` inline 元素，`opacity: 0.4`，斜体，颜色继承编辑器前景色
- 多行补全：首行 inline `<span>`，后续行各自使用 block `Decoration.widget`
- 加载中状态：显示 spinner + "思考中..." 的小 widget
- 用户继续输入时立即通过 StateField 清除所有 decoration
- Ghost text 不影响文档内容，仅为视觉层

## Provider 接口

```typescript
interface CompletionProvider {
  complete(request: CompletionRequest): Promise<string>;
  validateConfig(): Promise<boolean>;
}

interface CompletionRequest {
  prefix: string;      // 光标前的文本
  suffix: string;      // 光标后的文本
  language: string;    // 文档语言 (markdown)
  maxTokens: number;   // 最大生成 token 数
  signal: AbortSignal; // 取消信号
}
```

### 支持的 Provider

| Provider | API 格式 | 说明 |
|----------|---------|------|
| OpenAI | OpenAI Chat Completions | 支持 gpt-4o、gpt-4o-mini 等 |
| Anthropic | Anthropic Messages API | 支持 Claude 系列模型 |
| Ollama | OpenAI 兼容格式 | 本地模型，base URL 指向 localhost:11434 |
| 自定义 | OpenAI 兼容格式 | 用户自定义 base URL，兼容 DeepSeek 等服务 |

所有 Provider 通过 system prompt + user message（prefix + suffix）的 chat completion 格式调用。Ollama 和自定义 Provider 复用 OpenAI 兼容的请求格式，只需修改 base URL。

## 设置面板

### AI 后端设置
- **Provider** — 下拉选择：OpenAI / Anthropic Claude / Ollama / 自定义 OpenAI 兼容
- **API Key** — 密码输入框，本地存储于 Obsidian data.json，不上传
- **Model** — 文本输入，可自定义模型名称（默认 gpt-4o-mini）
- **API Base URL** — 可选，自定义端点地址

### 补全行为
- **触发延迟** — 停止输入后等待时间，默认 500ms，范围 200-2000ms
- **最大补全行数** — 单次建议最大行数，默认 5，范围 1-20
- **System Prompt** — 自定义 AI 补全的系统提示词，默认值为通用写作助手提示

### 排除规则
- **排除文件夹** — 多行文本，每行一个文件夹路径，该文件夹下的笔记不触发补全
- **排除标签** — 带有指定标签的笔记不触发补全

### 用量统计（只读显示）
- 总请求次数
- 已接受次数
- 总 Tokens 消耗
- 接受率（已接受 / 总请求）
- 可重置统计数据

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| API 请求失败 | 静默失败，console 记录错误。连续 3 次失败后暂停 30s 自动退避。状态栏显示 ⚠️ |
| API Key 未配置 | 首次启用时 Notice 提示设置。补全静默禁用。状态栏显示 🔑 |
| 用户继续输入 | AbortController 取消进行中的请求，立即清除 ghost text |
| 响应超时 | 默认 10s 超时，清除加载状态，不影响后续请求 |
| 并发防抖 | 同一时刻仅一个进行中的请求，新请求自动取消旧请求 |
| TAB 键冲突 | 仅在有活跃 ghost text 时拦截 TAB，否则保持原生缩进行为。优先级低于 Obsidian 内置补全 |

## 项目文件结构

```
Tabsidian/
├── manifest.json           # Obsidian 插件清单
├── package.json            # 依赖与构建脚本
├── tsconfig.json           # TypeScript 配置
├── esbuild.config.mjs      # 构建配置
├── styles.css              # Ghost text 样式
├── src/
│   ├── main.ts             # 插件入口，注册 CM6 extension
│   ├── settings.ts         # 设置面板 & 数据定义
│   ├── editor/
│   │   ├── ghost-text.ts   # GhostTextWidget 渲染
│   │   ├── completion-state.ts  # CompletionStateField 状态管理
│   │   ├── keymap.ts       # 键位绑定（TAB/Esc/Ctrl+→/Ctrl+↓）
│   │   └── trigger.ts      # DebounceTrigger 停顿检测
│   ├── providers/
│   │   ├── base.ts         # CompletionProvider 接口定义
│   │   ├── openai.ts       # OpenAI 实现
│   │   ├── anthropic.ts    # Anthropic Claude 实现
│   │   └── ollama.ts       # Ollama 实现（复用 OpenAI 兼容格式）
│   └── services/
│       ├── context-builder.ts   # 上下文构建
│       ├── exclusion-filter.ts  # 排除规则判断
│       └── usage-tracker.ts     # 用量统计
```

## 技术栈

- **语言**: TypeScript
- **构建**: esbuild (Obsidian 标准方案)
- **编辑器集成**: CodeMirror 6 (StateField, ViewPlugin, WidgetType, keymap)
- **API 调用**: Obsidian `requestUrl`（内置 HTTP 客户端，避免 CORS 问题）
- **数据持久化**: Obsidian `loadData()` / `saveData()`（设置和统计数据）

## 测试策略

- **单元测试**: Provider 接口实现、ContextBuilder、ExclusionFilter、UsageTracker
- **集成测试**: CM6 Extension 的状态转换（idle → loading → showing → idle）
- **手动测试**: Ghost text 渲染效果、键位交互、多行补全、加载状态
