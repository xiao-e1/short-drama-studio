# 短剧智能工坊 Short Drama Studio

> 🎓 本项目是一名大学生使用 **Claude Code AI 编程助手** 独立开发的首个全栈项目，非常渴望得到大家的指导和建议！欢迎 Star ⭐️ 和 Issue 💬

短剧智能工坊把一句大白话创意变成可管理的多集短剧项目：先生成剧情和分镜脚本，再生成关键帧与视频片段，最后用 ffmpeg 合并成片。项目采用原生前端和轻量 Express 后端，适合学习、二次开发和本地创作。

## 核心功能

- 大白话创意转多集剧情，自动补充冲突、反转和集尾钩子
- 剧情转可拍摄分镜脚本，提取场景用于后续生成
- Agnes AI 文字、图片、视频能力统一接入
- 项目、步骤和生成结果在浏览器本地持久化
- 关键帧懒加载、渐进式占位与错误状态展示
- 视频提示词自动携带剧名、完整角色设定、前情上下文和连续性约束
- 视频片段状态管理、失败重做、播放与 ffmpeg 顺序合并
- API Key 首次访问时配置，前端源码不保存密钥
- Jest + Supertest 后端测试，外部 Agnes 请求全部 mock

## 特色亮点

1. **完整创作链路**：创意、剧情、脚本、关键帧、视频和成片在一个页面内完成。
2. **人物连续性优先**：视频 prompt 包含人物年龄、脸型、发型、服装、配饰、上一镜头和镜头方向，尽量降低角色漂移。
3. **密钥不进前端**：Key 由本机 Express 服务持有，默认重启即失效；用户可主动选择写入被 Git 忽略的 `.env`。
4. **零前端构建**：前端使用原生 HTML/CSS 和 ES Modules，便于初学者阅读与修改。
5. **边界清晰**：后端按 text/image/video 路由拆分，服务、配置、错误处理与路由相互独立。

## 快速开始

### 1. 环境要求

- Node.js 18 或更高版本
- npm 9 或更高版本
- ffmpeg（仅“合并全部片段”需要）
- Agnes AI API Key

确认环境：

```bash
node -v
npm -v
ffmpeg -version
```

### 2. 注册 Agnes AI 并获取 API Key

1. 打开 [Agnes AI 官网](https://agnes-ai.com)。
2. 点击注册或登录，按页面提示使用邮箱或支持的第三方账号完成账户创建。
3. 登录后进入 [Agnes AI 控制台](https://platform.agnes-ai.com)。
4. 在控制台找到 **API Keys**（有时位于 Settings / API Keys）。
5. 点击 **Create**、**Create API Key** 或同类按钮，填写便于识别的名称，例如 `short-drama-studio`。
6. 创建后立即复制以 `sk-` 开头的 Key。出于安全原因，控制台通常不会再次完整显示它。
7. 不要把 Key 发到 Issue、截图、聊天记录或提交到 Git。若曾泄露，请立即在控制台撤销并重新创建。

控制台菜单可能随平台更新而调整；如果找不到入口，请从官网登录后查找 `Console`、`API Keys` 或 `Developer`。

### 3. 安装与启动

```bash
git clone https://github.com/YOUR_USERNAME/short-drama-studio.git
cd short-drama-studio/backend
npm install
npm start
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。首次进入会显示 Key 设置对话框：

- 不勾选“保存到 `backend/.env`”：Key 只存在后端进程内存中，重启服务后需重新输入。
- 勾选该项：Key 写入本机 `backend/.env`，重启后仍可使用。该文件已加入 `.gitignore`。

也可以手动配置：

```bash
cd backend
copy .env.example .env
```

然后编辑 `.env`：

```dotenv
AGNES_API_KEY=sk-your-agnes-api-key
PORT=3000
```

### 4. 安装 ffmpeg

- Windows：从 [ffmpeg.org](https://ffmpeg.org/download.html) 选择可信构建，将 `ffmpeg` 加入 `PATH`。
- macOS：`brew install ffmpeg`
- Ubuntu/Debian：`sudo apt update && sudo apt install ffmpeg`

若不加入 `PATH`，可在 `.env` 中设置 `FFMPEG_PATH` 为可执行文件绝对路径。

## 使用说明

1. 在“说想法”输入故事创意，设置集数和每集时长。
2. 生成剧情，检查剧名、角色设定、每集冲突和结尾钩子，可直接编辑并保存。
3. 生成分镜脚本。建议保留 `场景1：...` 格式，系统据此拆分关键帧。
4. 生成关键帧。失败的场景会显示具体错误，不会阻塞其他场景结果。
5. 进入视频步骤。每个视频请求都会携带完整角色设定和前后场景上下文。
6. 在片段管理面板查看状态、播放或重做失败片段。
7. 所有片段完成后点击“合并全部片段”。合并结果保存在 `outputs/`。

## 技术架构

```text
Browser (HTML / CSS / ES Modules)
  |-- state.js: localStorage 项目状态
  |-- ui.js: 页面渲染与渐进式资源展示
  |-- main.js: 五步工作流编排
  `-- api.js: 统一错误处理
                 |
                 v
Express API (Node.js)
  |-- /api/config: Key 配置
  |-- /api/generate-text: 文字生成
  |-- /api/generate-image: 图片生成与本地下载
  |-- /api/create-video + /api/query-video: 视频任务
  `-- /api/merge-videos: ffmpeg 合并
                 |
                 v
       Agnes AI API + local outputs/
```

## 项目结构

```text
short-drama-studio/
├── backend/
│   ├── config/store.js
│   ├── middleware/errors.js
│   ├── routes/
│   │   ├── config.js
│   │   ├── text.js
│   │   ├── image.js
│   │   └── video.js
│   ├── services/
│   │   ├── agnes.js
│   │   └── merge.js
│   ├── tests/
│   │   ├── text.test.js
│   │   ├── image.test.js
│   │   └── video.test.js
│   ├── app.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── api.js
│   ├── state.js
│   ├── ui.js
│   ├── utils.js
│   └── main.js
├── docs/index.html
├── images/
├── outputs/
├── .gitignore
├── LICENSE
└── README.md
```

## 截图展示

将宣传图放入 `images/` 后，可取消下面示例注释并替换文件名：

```html
<img src="images/workflow.png" alt="短剧智能工坊工作流" width="100%">
```

可用于生成宣传图的英文 AI 绘图提示词：

1. `A futuristic AI film studio interface for creating vertical short dramas, dark professional dashboard, screenplay timeline, cinematic keyframes and video clips, realistic Chinese UI product screenshot, teal and coral accents, crisp typography, 16:9`
2. `A college student creator working at a compact desk with an AI short drama production dashboard on a widescreen monitor, cinematic night lighting, authentic workspace, optimistic independent developer story, photorealistic, 16:9`
3. `A polished product showcase of an AI short drama workflow from plain-language idea to plot, storyboard, keyframe and final vertical video, dark technology interface, clear visual hierarchy, realistic software UI, high detail, 16:9`

## 测试

```bash
cd backend
npm test
npm run test:coverage
```

测试不会调用真实 Agnes API，也不会消耗额度。

## 已知不足与改进方向

- 视频生成受模型排队和限流影响，整体速度较慢；后续可增加任务队列与并发策略。
- 人物一致性依赖关键帧和提示词，仍可能出现脸部、服装或配饰漂移；后续可接入角色参考图或多关键帧能力。
- 项目数据目前主要保存在 localStorage，跨设备同步和大项目容量有限；后续可增加数据库与导入导出。
- ffmpeg 使用无转码快速合并，要求片段编码参数一致；后续可提供兼容性转码模式和转场。
- 目前测试聚焦后端路由，前端仍缺少浏览器端单元测试和端到端测试。
- Key 的“验证”目前检查格式，真实有效性会在首次 Agnes 请求时确认；后续可在平台提供稳定验证接口后增加主动校验。

## 如何贡献

1. Fork 本仓库并从 `main` 创建功能分支：`git switch -c feature/your-feature`。
2. 保持改动聚焦，新增行为请补充测试和文档。
3. 运行 `npm test`，确保测试通过。
4. 提交清晰的 Commit，并向本仓库发起 Pull Request。
5. Bug、建议和设计讨论都欢迎先提交 Issue，请附复现步骤、系统环境和必要截图，但不要附 API Key。

## 安全说明

- 永远不要提交 `backend/.env`。
- 已经进入 Git 历史的 Key 应视为泄露，仅从当前文件删除并不够，必须到 Agnes 控制台撤销。
- 本项目面向本地开发。若部署到公网，必须增加登录鉴权、HTTPS、请求限流和独立的服务端密钥管理。

## 许可证

本项目采用 [MIT License](LICENSE)。

---

这是我的第一个全栈开源项目。若它对你有一点帮助，恳请点一个 Star；发现问题请提 Issue；愿意一起完善功能则非常欢迎 PR。每一条具体建议都会帮助这个项目和作者继续成长。

