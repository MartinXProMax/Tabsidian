# Tabsidian

[中文说明](#中文说明)

Tabsidian is an Obsidian plugin that provides inline AI completion with ghost text for Markdown notes.

It is designed for note-taking rather than chat: the model receives local writing context around the cursor and returns short continuations that can be accepted inline.

## Features

- Inline ghost-text completion inside Obsidian's Markdown editor
- Full, word, and line acceptance flows
- Mid-sentence completion using prefix/suffix context
- Multiple providers:
  - OpenAI
  - Anthropic
  - Google Gemini via OpenAI-compatible endpoint
  - OpenRouter
  - Qwen compatible endpoint
  - SiliconFlow
  - Ollama local models
  - Custom OpenAI-compatible APIs
- Provider connection testing from settings
- Optional thinking mode for supported providers
- Excluded folders and excluded tags
- Debug mode with request/response inspection

## Project Structure

- `src/`: plugin source code
- `tests/`: unit tests
- `manifest.json`: Obsidian plugin manifest
- `styles.css`: plugin styles
- `esbuild.config.mjs`: build script

## Development

Install dependencies:

```powershell
npm install
```

Run type-check and build:

```powershell
npx tsc -noEmit -skipLibCheck
npm run build
```

Run watch mode during development:

```powershell
npm run dev
```

Run tests:

```powershell
npm test
```

## Install In Obsidian

Build the plugin first:

```powershell
npm run build
```

Then copy these files into your vault plugin directory:

- `manifest.json`
- `main.js`
- `styles.css`

Target path:

```text
<YourVault>/.obsidian/plugins/tabsidian/
```

After copying:

1. Open Obsidian
2. Go to `Settings > Community plugins`
3. Enable `Tabsidian`

## Provider Notes

### OpenAI-compatible providers

These providers use the same core request pipeline:

- OpenAI
- Gemini compatible endpoint
- OpenRouter
- Qwen compatible endpoint
- SiliconFlow
- Custom OpenAI-compatible APIs

Not every OpenAI-compatible backend supports the same optional parameters. Thinking mode is intentionally limited to providers that have explicit handling in this project.

### Anthropic

Anthropic uses the Messages API and supports an optional thinking budget when thinking mode is enabled.

### Ollama

Ollama uses the native `/api/chat` API. For local reasoning models such as Qwen or DeepSeek-style models, Tabsidian can send explicit thinking controls.

Default local endpoint:

```text
http://localhost:11434
```

## Current Workflow

The current completion flow is:

1. User types in a Markdown note
2. Tabsidian waits for a short debounce interval
3. The plugin builds prefix/suffix context around the cursor
4. The selected provider is called
5. Returned text is post-processed to reduce prompt leakage and overlap
6. Ghost text is rendered inline
7. The user accepts the suggestion using the configured accept key

## Notes

- `main.js` is generated build output and is not committed by default in this repository
- `node_modules` is ignored
- Local helper folders such as `.claude` and `.superpowers` are ignored

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

---

## 中文说明

Tabsidian 是一个 Obsidian 插件，用于在 Markdown 笔记编辑时提供行内 AI 补全与 ghost text 效果。

它的目标不是聊天，而是面向写作与记笔记场景：模型会收到光标附近的上下文，并返回一小段可以直接插入的续写内容。

### 主要功能

- 在 Obsidian Markdown 编辑器中显示行内补全
- 支持整段接受、按词接受、按行接受
- 支持句中补全，使用光标前后文进行推断
- 支持多种模型提供方：
  - OpenAI
  - Anthropic
  - 通过 OpenAI-compatible 接口接入的 Gemini
  - OpenRouter
  - Qwen compatible endpoint
  - SiliconFlow
  - Ollama 本地模型
  - 自定义 OpenAI-compatible API
- 在设置页中测试模型连接
- 对部分 provider 提供思考模式控制
- 支持排除文件夹与标签
- 支持调试模式，便于排查请求与响应

### 项目结构

- `src/`：插件源码
- `tests/`：单元测试
- `manifest.json`：Obsidian 插件清单
- `styles.css`：插件样式
- `esbuild.config.mjs`：构建脚本

### 本地开发

安装依赖：

```powershell
npm install
```

类型检查并构建：

```powershell
npx tsc -noEmit -skipLibCheck
npm run build
```

开发模式：

```powershell
npm run dev
```

运行测试：

```powershell
npm test
```

### 在 Obsidian 中安装

先构建插件：

```powershell
npm run build
```

然后把以下文件复制到你的 vault 插件目录：

- `manifest.json`
- `main.js`
- `styles.css`

目标目录通常为：

```text
<你的Vault>/.obsidian/plugins/tabsidian/
```

复制完成后：

1. 打开 Obsidian
2. 进入 `Settings > Community plugins`
3. 启用 `Tabsidian`

### Provider 说明

#### OpenAI-compatible providers

以下 provider 共用一套核心请求流程：

- OpenAI
- Gemini compatible endpoint
- OpenRouter
- Qwen compatible endpoint
- SiliconFlow
- Custom OpenAI-compatible APIs

但并不是所有 OpenAI-compatible 后端都支持相同的可选参数，所以项目只对已明确适配的 provider 开启思考模式控制。

#### Anthropic

Anthropic 使用 Messages API，并在开启思考模式时支持 thinking budget。

#### Ollama

Ollama 使用原生 `/api/chat` 接口。对于本地推理模型，例如 Qwen 或 DeepSeek 风格模型，Tabsidian 可以显式传递思考模式控制参数。

默认本地地址：

```text
http://localhost:11434
```

### 当前工作流

当前补全流程如下：

1. 用户在 Markdown 笔记中输入内容
2. Tabsidian 等待一个较短的防抖间隔
3. 插件围绕光标构建前后文
4. 调用当前选中的 provider
5. 对返回结果做后处理，减少提示词泄漏与重复
6. 在编辑器中渲染 ghost text
7. 用户通过配置的接受按键插入补全

### 备注

- `main.js` 是构建产物，默认不会提交到仓库
- `node_modules` 已被忽略
- `.claude`、`.superpowers` 等本地辅助目录已被忽略

### 许可证

本项目采用 MIT License，详见 [LICENSE](LICENSE)。
