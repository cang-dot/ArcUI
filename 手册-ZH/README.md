# ArcUI — 通用 AI 对话前端

ArcUI 是一个独立的、可扩展插件的 AI 对话前端。接入任何 OpenAI 格式的 API 即可使用，自动识别 [Fact-ARC](https://github.com/cang-dot/Fact-ARC) 后端并展示验证轨迹与事实来源。

---

## 功能特性

- **独立运行** — 连接任何 OpenAI 兼容 API
- **自动识别 Fact-ARC** — 验证轨迹与来源展示（当可用时）
- **原生多模态** — 图片上传、音频录制（根据模型能力自动启用）
- **流式输出 SSE** — 节流打字机渲染效果
- **可编辑系统提示词** — 支持 `{{model}}`、`{{date}}`、`{{user_name}}` 变量
- **模型切换下拉栏** — 输入框下方实时切换模型
- **插件生态** — 每个插件包含 `plugin.json` + `plugin.js` + `capability.py`
- **内置 TTS** — 外部 API + 浏览器内置语音引擎回退
- **纯黑白灰美学** — 无彩色、无图标（仅顶栏汉堡菜单 SVG）
- **中/英多语言** — 顶栏按钮一键切换
- **暗色/浅色主题** — 持久化至 localStorage

---

## 快速开始

### 1. 安装后端依赖

```bash
cd ArcUI/backend
pip install -r requirements.txt
```

### 2. 启动后端

```bash
python server.py
```

ArcUI 后端运行在 `http://localhost:1011`。

### 3. 打开前端

在浏览器中打开 `index.html`，然后：

1. 点击顶栏的 **设置** 按钮（⚙）
2. 填入你的 **Base URL**（例如 `https://api.openai.com/v1`）和 **API Key**
3. 点击 **保存**，模型下拉栏自动填充
4. 开始聊天

---

## 项目结构

```
ArcUI/
├── index.html                     # 入口页：顶栏 + 侧边栏 + 聊天 + 设置
├── css/
│   ├── base.css                   # CSS 变量（暗/浅）、重置、动效
│   ├── components.css             # 按钮、输入框、下拉、开关、Toast
│   ├── layout.css                 # 顶栏、侧边栏、主区域、响应式
│   ├── chat.css                   # 消息气泡、验证轨迹、音频条
│   ├── settings.css               # 设置面板、提示词编辑器、广告卡片
│   └── plugins.css                # 插件管理面板
├── js/
│   ├── app.js                     # 入口：全局状态、初始化、DOM 绑定
│   ├── i18n.js                    # 中/英文词典、t() 函数
│   ├── theme.js                   # 暗/浅主题切换
│   ├── sidebar.js                 # 对话历史侧边栏
│   ├── chat.js                    # 发送消息、接收响应、渲染
│   ├── stream.js                  # SSE 流式处理、打字机渲染
│   ├── markdown.js                # Markdown 渲染（marked.js CDN）
│   ├── api.js                     # API 调用（非流式、流式、模型列表）
│   ├── identity.js                # Fact-ARC 后端探测
│   ├── multimodal.js              # 图片上传/预览/拖拽/粘贴
│   ├── system-prompt.js           # 系统提示词编辑器逻辑
│   ├── model-selector.js          # 模型下拉栏
│   ├── settings.js                # 设置面板逻辑
│   ├── tts.js                     # TTS 音频条组件
│   └── plugins.js                 # 插件运行时（PluginManager）
├── plugins/
│   └── tts/
│       ├── plugin.json            # 插件元信息 + 配置表单定义
│       ├── plugin.js              # 前端钩子 + UI 注入
│       └── capability.py          # Python TTS 能力
└── backend/
    ├── server.py                  # FastAPI 入口（端口 1011）
    ├── proxy.py                   # API 代理 + SSE 流式透传
    ├── plugin_engine.py           # Python 能力执行引擎
    ├── multimodal_handler.py      # 图片/音频处理
    ├── models.py                  # Pydantic 模型
    └── requirements.txt           # Python 依赖清单
```

---

## 后端 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查；返回 `has_identity` 用于 Fact-ARC 探测 |
| `/api/proxy` | POST | 通用 API 代理（非流式） |
| `/api/proxy/stream` | POST | SSE 流式代理 |
| `/api/proxy/models` | POST | 代理获取模型列表 |
| `/api/plugin/{plugin_id}/{capability}` | POST | 执行插件 Python 能力 |
| `/api/plugins` | GET | 列出所有已加载插件 |
| `/api/multimodal/image-to-base64` | POST | 缩放并重新编码图片 |
| `/api/multimodal/transcribe` | POST | 音频转文字（占位） |

---

## 设计原则

1. **所有颜色通过 CSS 变量引用** — 不硬编码颜色值
2. **不使用图标字体或 emoji 作为功能按钮** — 广告卡片中的 🙏 除外
3. **不使用任何 CSS/JS 框架** — 纯原生 HTML + CSS + JS
4. **Markdown 通过 marked.js CDN 渲染** — 无打包依赖
5. **`window.ArcUI` 命名空间** — 所有模块通过共享全局对象通信
6. **localStorage 持久化** — 配置、主题、语言、聊天记录、系统提示词
7. **支持 `prefers-reduced-motion`**
8. **代码注释用英文**；用户界面文案通过 `t()` 中英切换
9. **向后兼容** — 无 Fact-ARC 后端时所有功能正常工作
10. **插件 Python 文件不在沙箱中运行**（原型阶段，安全风险已知）

---

## 许可证

MIT
