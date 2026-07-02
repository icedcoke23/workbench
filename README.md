# Scratch 教学工作台

> 一款专为 Scratch 编程教师打造的 Windows 桌面工作台 —— 备课、授课、课后反馈、事务管理一体化。

基于 Electron + Vue 3 + TypeScript + Ant Design Vue 4 + SQLite3 构建，内嵌 Scratch GUI 编辑器，覆盖教师日常教学全流程。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [常用脚本](#常用脚本)
- [数据模型](#数据模型)
- [IPC 通信契约](#ipc-通信契约)
- [键盘快捷键](#键盘快捷键)
- [Scratch GUI 集成](#scratch-gui-集成)
- [数据备份与恢复](#数据备份与恢复)
- [打包发布](#打包发布)
- [代码规范](#代码规范)
- [常见问题](#常见问题)
- [许可](#许可)

---

## 功能特性

### 七大核心视图

| 视图 | 路由 | 说明 |
|------|------|------|
| 工作看板 | `/dashboard` | 顶部统计卡片、CSS 图表（每日课时分布 / 班级学生数 / 反馈状态）、AI 课表导入、智能待办看板（三列拖拽）、本周课程周视图 |
| 学生管理 | `/students` | 学生 CRUD、头像上传、标签筛选、学习历史抽屉（课次时间线、统计、班级归属） |
| 班级管理 | `/classes` | 班级 CRUD（常规 / 集训 / 试听）、成员管理、排课规则 |
| 备课中心 | `/prep` | 点子库（多版本管理）、教案编辑器（多维就绪度 + 知识点标签）、教案模板库、资源库、关联文档挂载、备课进度看板（就绪度趋势曲线 + 知识点覆盖度/缺口）、语雀文档嵌入（webview） |
| 授课中心 | `/teaching` | 内嵌 Scratch GUI、随机点名（加权 + 时间衰减）、课堂记录、积分调整 |
| 课后中心 | `/post` | 周反馈生成（AI 辅助）、反馈模板库（内置 + 自定义）、PDF 导出、微信发送 |
| 设置 | `/settings` | AI 配置、同步配置、企业微信配置、Scratch 配置、数据备份（导出 / 导入） |

### 关键能力

- **内嵌 Scratch GUI**：通过 `<webview>` 加载本地 Scratch 编辑器，`electron-bridge.js` 拦截 postMessage 实现作品自动保存到工作台
- **AI 课表解析**：粘贴课表文本或上传截图，AI 自动解析班级、科目、时间、学生名单
- **加权随机点名**：基于学生历史参与度与时间衰减的公平点名算法
- **智能待办**：自动生成备课 / 反馈 / 反思三类待办（基于课次状态与备课就绪度），事件驱动刷新（课次/教案/反馈变更后即时同步）+ 每小时定时兜底，支持看板拖拽
- **备课就绪度**：7 维清单（目标/重难点/准备/过程/时长/素材/环节平衡）量化教案完整度，分 draft/partial/ready 三档；统计、提醒、待办三处口径同源；每日幂等快照绘制近 30 天就绪率趋势曲线
- **知识点轴线**：教案打知识点标签 → 跨班级覆盖度看板 → 覆盖缺口提醒 → 按知识点检索可复用教案，形成「标签→覆盖→缺口→复用」闭环
- **教案模板与克隆**：内置 + 自定义教案模板库，一键克隆教案到新版本（复制内容与素材/文档关联，追溯派生血统树）
- **反馈模板系统**：4 个内置模板（通用 / 表扬 / 建议 / 进度）+ 自定义模板，支持变量占位符
- **数据备份**：一键导出全部 18 张表为 JSON，事务性导入（反向依赖删除 + 顺序插入）
- **键盘快捷键**：完整菜单系统 + Ctrl+1~7 视图切换、Ctrl+N 新增、Ctrl+R 刷新、Ctrl+B 折叠侧栏等
- **全局异常捕获**：`uncaughtException` / `unhandledRejection` / `render-process-gone` 全覆盖，日志落盘 + 5MB 轮转 + 14 天清理

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 运行时 | Electron | ^31.7.0 |
| 构建 | electron-vite | ^2.3.0 |
| 前端框架 | Vue 3 | ^3.5.12 |
| 类型系统 | TypeScript | ^5.5.4 |
| UI 组件库 | Ant Design Vue | ^4.2.6 |
| 路由 | vue-router | ^4.4.5 |
| 数据库 | better-sqlite3 | ^11.3.0 |
| 日期处理 | dayjs | ^1.11.13 |
| 压缩 | jszip | ^3.10.1 |
| 打包 | electron-builder | ^25.0.0 |
| 图像处理 | sharp | ^0.33.0 |
| 代码规范 | ESLint 9 + typescript-eslint + eslint-plugin-vue | - |

---

## 项目结构

```
workbench/
├── build/                      # 应用图标资源
│   ├── icon.svg                # 图标源文件
│   ├── icon.ico                # Windows 图标（多尺寸）
│   ├── icon.png                # 通用 PNG 图标
│   └── icon-{16,24,32,48,64,128,256}.png
├── scripts/
│   ├── apply-scratch-mods.sh   # 应用 Scratch GUI 修改
│   └── generate-icon.mjs       # 从 SVG 生成 ICO/PNG
├── src/
│   ├── main/                   # 主进程
│   │   ├── index.ts            # 入口：窗口创建、生命周期、全局异常
│   │   ├── menu.ts             # 应用菜单 + 快捷键加速器
│   │   ├── database/
│   │   │   ├── db.ts           # 连接管理、迁移、种子
│   │   │   ├── schema.sql      # 18 张表 + 索引 + 触发器
│   │   │   ├── seed.ts         # 内置数据初始化
│   │   │   └── repositories/   # 仓储模块
│   │   ├── services/           # 业务服务
│   │   │   ├── ai.ts           # AI 调用（课表解析、反馈生成）
│   │   │   ├── data.ts         # 数据备份/恢复
│   │   │   ├── feedback.ts     # 反馈生成与发送
│   │   │   ├── file.ts         # 文件操作
│   │   │   ├── history.ts      # 学生历史聚合
│   │   │   ├── logger.ts       # 文件日志 + 轮转
│   │   │   ├── lesson-plan.ts  # 教案服务（就绪度/知识点覆盖/缺口/导出/AI 评估）
│   │   │   ├── pdf.ts          # PDF 导出
│   │   │   ├── scratch.ts      # Scratch GUI 集成
│   │   │   ├── schedule.ts     # 课表解析逻辑
│   │   │   ├── sync.ts         # 文件同步
│   │   │   ├── todos.ts        # 仪表盘聚合 + 图表 + 自动待办
│   │   │   └── wechat.ts       # 微信发送自动化
│   │   ├── ipc/
│   │   │   └── index.ts        # IPC 处理器注册
│   │   └── lib/
│   │       └── prompts.ts      # AI 提示词模板
│   ├── preload/
│   │   ├── index.ts            # 主预加载脚本（API 桥接）
│   │   └── scratch.ts          # Scratch webview 预加载
│   ├── renderer/               # 渲染进程
│   │   ├── App.vue             # 根布局（侧边栏 + 快捷键集成）
│   │   ├── main.ts             # 渲染进程入口
│   │   ├── router/
│   │   │   └── index.ts        # 路由配置
│   │   ├── api/
│   │   │   └── index.ts        # call() 包装器
│   │   ├── components/
│   │   │   ├── StudentHistoryDrawer.vue
│   │   │   └── WeekSchedule.vue
│   │   ├── composables/
│   │   │   └── useShortcuts.ts # 快捷键 composable + 事件总线
│   │   └── views/
│   │       ├── DashboardView.vue
│   │       ├── StudentsView.vue
│   │       ├── ClassesView.vue
│   │       ├── PrepView.vue
│   │       ├── TeachingView.vue
│   │       ├── PostView.vue
│   │       └── SettingsView.vue
│   └── shared/
│       ├── api.ts              # WorkbenchAPI 类型契约
│       ├── types.ts            # 全局类型定义
│       └── sql.d.ts            # SQL 模块声明
├── scratch-gui/                # Scratch GUI 子模块（独立仓库）
├── electron.vite.config.ts     # Vite 配置
├── electron-builder.yml        # 打包配置
├── eslint.config.mjs           # ESLint flat config
├── tsconfig.json               # TS 项目引用根
├── tsconfig.node.json          # 主进程 / preload / shared TS 配置
└── tsconfig.web.json           # 渲染进程 TS 配置
```

---

## 环境要求

- **Node.js** ≥ 18.18（推荐 20.x LTS）
- **pnpm** ≥ 8（推荐 10.x，项目 `.npmrc` 已配置 `node-linker=hoisted`）
- **Windows 10/11** x64（构建目标平台）
- **Git**（用于克隆 Scratch GUI 子模块）

> better-sqlite3 是原生模块，首次安装会通过 `electron-rebuild` 自动为 Electron 重编译。

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/icedcoke23/workbench.git
cd workbench
```

### 2. 安装依赖

```bash
pnpm install
```

> `postinstall` 脚本会自动执行 `electron-rebuild` 重编译 better-sqlite3。

### 3. 准备 Scratch GUI（可选，仅授课中心需要）

```bash
git clone https://github.com/scratchfoundation/scratch-gui.git scratch-gui
cd scratch-gui
npm install
npm run build:webpack
cd ..

bash scripts/apply-scratch-mods.sh
```

### 4. 启动开发服务器

```bash
pnpm dev
```

应用窗口将自动打开，开发服务器支持热重载。

---

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（热重载） |
| `pnpm build` | 构建主进程 + preload + 渲染进程产物到 `out/` |
| `pnpm preview` | 预览构建产物 |
| `pnpm typecheck` | 全量类型检查（node + web） |
| `pnpm lint` | ESLint 检查 |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm icon` | 从 `build/icon.svg` 重新生成 ICO 和 PNG |
| `pnpm rebuild` | 重编译 better-sqlite3 原生模块 |
| `pnpm build:win` | 构建并打包 Windows x64 安装包到 `release/` |
| `pnpm build:dir` | 构建并打包为目录（免安装，用于测试） |

---

## 数据模型

数据库使用 SQLite（WAL 模式），共 18 张表：

| 表 | 说明 |
|----|------|
| `students` | 学生信息（姓名、头像、年级、标签） |
| `classes` | 班级（常规 / 集训 / 试听） |
| `enrollments` | 班级-学生多对多关联（含总分） |
| `ideas` | 备课点子 |
| `idea_versions` | 点子版本（文件路径、备注） |
| `lesson_plans` | 教案（目标/重难点/准备/过程/反思/时长/知识点标签/克隆血统） |
| `lessons` | 课次（时间、状态、关联点子版本、课后反思、达成度评估） |
| `lesson_records` | 课堂记录（积分变化、是否被点名、参与备注） |
| `todos` | 待办（自动 / 手动，三态） |
| `resources` | 资源库（文件路径、类型、标签） |
| `plan_resources` | 教案-资源结构化关联（按章节挂载，含排序与备注） |
| `feedbacks` | 反馈报告（草稿 / 已发布） |
| `doc_links` | 文档链接（语雀等，支持教案级挂载） |
| `feedback_templates` | 反馈模板（内置 + 自定义） |
| `lesson_plan_templates` | 教案模板（内置 + 自定义，分类管理） |
| `prep_readiness_snapshots` | 备课就绪度日快照（每日幂等，供趋势曲线） |
| `settings` | 键值设置 |
| `sync_state` | 同步状态（设备 ID、最后推送/拉取时间） |

所有带 `updated_at` 的表通过触发器自动维护更新时间，用于 last-write-wins 同步策略。

---

## IPC 通信契约

采用 **命名空间代理 + 事件注册** 模式，确保类型安全：

### API 命名空间

`src/shared/api.ts` 定义 `WorkbenchAPI` 接口，`src/preload/index.ts` 通过 `apiNamespaces` 数组自动暴露所有命名空间到 `window.api`：

```typescript
import { call } from '@renderer/api'

const students = await call(window.api.student.list({ keyword: '张' }))
const feedback = await call(window.api.feedback.generate(lessonId))
const history = await call(window.api.studentHistory.get(studentId))
```

### 支持的命名空间

`student` · `class` · `lesson` · `idea` · `todo` · `resource` · `feedback` · `feedbackTemplate` · `schedule` · `scratch` · `settings` · `dashboard` · `data` · `studentHistory` · `doc` · `file`

### 事件（WorkbenchEvents）

主进程通过 `mainWindow.webContents.send` 推送事件，渲染进程通过 `window.api.on(channel, callback)` 订阅：

- `scratch:save-request` — Scratch 作品保存请求
- `feedback:chunk` — AI 反馈流式生成增量
- `sync:status` — 同步状态变化
- `menu:action` — 菜单 / 快捷键动作

---

## 键盘快捷键

通过 Electron 原生菜单加速器实现，全局可用：

| 快捷键 | 动作 |
|--------|------|
| `Ctrl+1` ~ `Ctrl+7` | 切换到工作看板 / 学生 / 班级 / 备课 / 授课 / 课后 / 设置 |
| `Ctrl+N` | 新增（当前视图上下文） |
| `Ctrl+R` | 刷新当前视图 |
| `Ctrl+B` | 折叠 / 展开侧栏 |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | 放大 / 缩小 / 重置界面缩放 |
| `Ctrl+Shift+E` | 导出数据 |
| `Ctrl+Shift+I` | 导入数据 |
| `Ctrl+Shift+R` | 重载窗口 |
| `Ctrl+Shift+I`（开发模式） | 切换开发者工具 |
| `Ctrl+Q` | 退出 |

渲染进程通过 `useShortcuts` composable 订阅 `menu:action` 事件，并通过 `subscribeRefresh` / `subscribeNewItem` 事件总线分发到当前激活的视图。

---

## Scratch GUI 集成

工作台通过 `<webview>` 标签内嵌本地构建的 Scratch GUI：

1. **预加载桥接**：`src/preload/scratch.ts` 注入到 webview，拦截 Scratch GUI 的 `postMessage` 调用
2. **作品保存**：学生保存作品时，自动通过 IPC 保存 `.sb3` 文件到工作台资源目录
3. **作品加载**：从工作台资源库直接加载 `.sb3` 文件到 Scratch 编辑器
4. **应用修改**：`scripts/apply-scratch-mods.sh` 将桥接代码注入 Scratch GUI 构建产物

> Scratch GUI 是独立仓库，不纳入工作台主仓库版本控制。工作台仅通过 `electron-bridge.js` 进行运行时桥接。

---

## 数据备份与恢复

### 导出

设置 → 数据备份 → 立即导出，将所有 18 张表导出为 JSON 文件：

```json
{
  "version": 1,
  "exportedAt": "2026-06-26T10:00:00.000Z",
  "appVersion": "0.1.0",
  "tables": {
    "students": [...],
    "classes": [...]
  }
}
```

### 导入

选择 JSON 文件后，按反向依赖顺序删除现有数据，再顺序插入新数据，整个过程在一个事务中完成，失败自动回滚。

> ⚠️ 导入会覆盖现有数据，请谨慎操作。建议先导出当前数据作为备份。

---

## 打包发布

### 生成 Windows 安装包

```bash
pnpm build:win
```

产物位于 `release/0.1.0/` 目录：

- `Scratch教学工作台 Setup 0.1.0.exe` — NSIS 安装程序
- `Scratch教学工作台-0.1.0-win-x64.exe` — 免安装版

### electron-builder 配置

见 `electron-builder.yml`，关键配置：

- `appId`: `com.icedcoke23.workbench`
- `productName`: `Scratch教学工作台`
- `win.icon`: `build/icon.ico`
- `nsis`: 非一键安装，允许自定义安装路径，创建桌面快捷方式
- `extraResources`: 将 `better_sqlite3.node` 打包到资源目录

### 重新生成图标

修改 `build/icon.svg` 后执行：

```bash
pnpm icon
```

会重新生成 `icon.ico`（含 16/24/32/48/64/128/256 七种尺寸）和各尺寸 PNG。

---

## 代码规范

### ESLint

采用 ESLint 9 flat config（`eslint.config.mjs`），集成：

- `@eslint/js` 推荐规则
- `typescript-eslint` 推荐规则
- `eslint-plugin-vue` flat/recommended

关键规则调整：

- `@typescript-eslint/no-explicit-any`: off（Electron 场景较多 any）
- `@typescript-eslint/consistent-type-imports`: warn（推荐 `import type`）
- `vue/multi-word-component-names`: off（视图组件单单词命名）
- `vue/attribute-hyphenation`: off（Ant Design Vue 的 `v-model:activeKey` 必须 camelCase）
- `no-console`: 仅生产环境 warn

### TypeScript

- 严格模式（`strict: true`）
- 项目引用（`tsconfig.json` 引用 `tsconfig.node.json` 和 `tsconfig.web.json`）
- 路径别名：`@shared/*`、`@main/*`、`@renderer/*`

---

## 常见问题

### Q: 启动时报 `better-sqlite3.node` 无法加载？

A: 原生模块未正确编译。执行 `pnpm rebuild` 重新为 Electron 编译。

### Q: 授课中心 Scratch 编辑器白屏？

A: 未构建 Scratch GUI。参考 [快速开始 - 准备 Scratch GUI](#3-准备-scratch-gui可选仅授课中心需要)。

### Q: 微信发送失败？

A: 微信发送依赖 Windows 上的微信桌面客户端运行中，且使用了 PowerShell + WScript.Shell 模拟按键。请确保：
1. 微信桌面客户端已登录
2. PowerShell 执行策略允许运行脚本
3. 微信窗口未被最小化

### Q: AI 课表解析不工作？

A: 需要在设置中配置 AI 接口（API Key、Base URL、模型名）。支持 OpenAI 兼容接口（智谱 GLM、DeepSeek、通义千问、Moonshot 等）。

### Q: 数据存储在哪里？

A: SQLite 数据库位于 `app.getPath('userData')/workbench.db`，日志位于 `app.getPath('userData')/logs/`，资源文件位于 `app.getPath('userData')/resources/`。

### Q: 快捷键不生效？

A: 快捷键通过 Electron 应用菜单加速器实现，需要应用窗口处于焦点状态。如果焦点在其他应用，快捷键不会触发。

---

## 许可

MIT License © icedcoke23
