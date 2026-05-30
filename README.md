# AI PR 代码审查助手

> 粘贴一个 GitHub Pull Request 链接，AI 自动帮你做代码审查 —— 发现安全漏洞、代码质量问题，并给出风险评分和改进建议。

## 它能做什么？

你有没有遇到过这样的场景：一个 PR 改了 30 个文件，reviewer 看了半天只改了几个 typo，真正的安全问题反而漏掉了？

这个工具就是为了解决这个问题。它会：

1. **自动拉取 PR 数据** — 文件变更、diff、commit 信息，全部并行获取
2. **智能分析代码** — 先跑 7 条静态分析规则（快速、确定），再交给 DeepSeek LLM 做语义分析（深入、全面）
3. **生成风险评分** — 0-100 分，从安全、质量、性能、可维护性四个维度打分
4. **可视化展示** — 按文件分组、按严重程度高亮、可折叠查看详情

整个过程异步执行，提交 PR 链接后立即返回分析 ID，前端轮询等待结果。

---

## 核心功能

### 双引擎分析

| 分析方式 | 优势 | 覆盖范围 |
|---------|------|---------|
| **规则引擎**（7 条规则） | 快速、确定性、零 API 成本 | 硬编码密钥、SQL 注入、危险函数、空 catch、超大函数、魔法数字、TODO/FIXME |
| **LLM 语义分析**（DeepSeek） | 理解上下文、发现逻辑缺陷 | 安全漏洞、性能问题、代码质量、错误处理、架构问题 |

两套引擎的结果会自动合并 —— 当同一条代码同时被规则和 LLM 标记时，LLM 的分析结果会覆盖规则的结果（因为 LLM 能理解更多上下文）。

### 风险评分系统

评分范围 0-100，四个维度独立打分：

| 分数区间 | 风险等级 | 含义 |
|---------|---------|------|
| 0 - 15 | 低 | 代码质量良好，可以放心合并 |
| 16 - 40 | 中 | 有一些小问题，建议修复后合并 |
| 41 - 70 | 高 | 存在明显风险，需要认真审查 |
| 71 - 100 | 严重 | 存在严重问题，强烈建议打回 |

评分公式：`CRITICAL × 10 + ERROR × 5 + WARNING × 2 + INFO × 0.5`，按类别归一化到 0-100。

### 智能上下文构建

不是简单地把整个 diff 扔给 LLM。系统会：

1. **解析 diff** — 把 git patch 拆分成结构化的代码块（hunk）
2. **优先级评分** — 包含 `auth`、`password`、`secret` 的文件 +10 分，测试文件 -5 分
3. **Token 预算分配** — 高优先级文件分配 60% 的 token 预算，低优先级只给 15%
4. **上下文组装** — 每个代码块附带 10 行周围的上下文代码

这样 LLM 能看到的不只是改了什么，还能看到改的代码在什么上下文中。

---

## 工作流程详解

下面是一次完整分析的全流程：

```
用户提交 PR URL
    │
    ▼
┌─────────────────────────────────────┐
│  POST /api/analyze                  │
│  解析 URL → owner/repo/prNumber     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  GitHub API（并行请求）              │
│  ├── fetchPRInfo()    → PR 元信息    │
│  ├── fetchPRFiles()   → 变更文件列表  │
│  ├── fetchPRCommits() → commit 记录  │
│  └── fetchPRDiff()    → 原始 diff    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Analysis Service                    │
│  1. 创建 Analysis 记录（状态：PENDING）│
│  2. 异步启动分析流水线                │
│  3. 立即返回 analysisId              │
└─────────────┬───────────────────────┘
              │（异步）
              ▼
┌─────────────────────────────────────┐
│  上下文构建流水线                     │
│  ① Chunk — diff 解析为代码块         │
│  ② Score — 每个文件计算优先级分数     │
│  ③ Budget — 按优先级分配 token 预算   │
│  ④ Assemble — 组装最终上下文         │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  AI 引擎（Composite 策略）           │
│                                     │
│  第一步：规则引擎（快）               │
│  ├── 硬编码密钥检测                   │
│  ├── SQL 注入检测                    │
│  ├── 危险函数检测                    │
│  ├── 空 catch 块检测                 │
│  ├── 超大函数检测                    │
│  ├── 魔法数字检测                    │
│  └── TODO/FIXME 标记检测             │
│                                     │
│  第二步：LLM 分析（深）               │
│  ├── 逐文件调用 DeepSeek API         │
│  ├── 输出结构化 JSON 评论            │
│  └── 单文件失败不影响其他文件         │
│                                     │
│  第三步：结果合并                     │
│  └── LLM 评论覆盖同位置的规则评论     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  风险评分计算                        │
│  按严重程度加权 → 四维度归一化 → 0-100 │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  数据库持久化（事务）                 │
│  ├── 更新 Analysis 状态为 COMPLETED  │
│  ├── 保存风险评分和摘要              │
│  └── 批量写入 ReviewComment 记录     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  前端 Dashboard                      │
│  ├── 状态轮询（每 3 秒）             │
│  ├── 风险评分卡片                    │
│  ├── 严重程度标签统计                │
│  └── 按文件分组的评论列表（可折叠）   │
└─────────────────────────────────────┘
```

---

## 使用指南

### 前置准备

使用前你需要准备两个 API Key：

| Key | 用途 | 获取方式 |
|-----|------|---------|
| **GitHub Token** | 调用 GitHub API 拉取 PR 数据 | [GitHub Settings → Tokens](https://github.com/settings/tokens)，勾选 `repo` 权限 |
| **DeepSeek API Key** | 调用 DeepSeek LLM 进行语义分析 | [DeepSeek Platform](https://platform.deepseek.com) |

> GitHub Token 是可选的 —— 不配置也能用，但会受到 GitHub API 的频率限制（每小时 60 次）。配置后提升到每小时 5000 次。
> DeepSeek API Key 是必需的 —— 没有它，LLM 语义分析部分无法运行。

### 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/les-yu/ai-pr-review-assistant.git
cd ai-pr-review-assistant

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 GitHub Token 和 DeepSeek API Key

# 4. 启动 PostgreSQL（需要 Docker）
docker compose -f docker/docker-compose.yml up -d db

# 5. 初始化数据库
npx prisma migrate dev

# 6. 启动开发服务器
npm run dev
```

打开浏览器访问 `http://localhost:3000`，你会看到一个简洁的输入框。

### 分析一个 PR

1. 在输入框中粘贴任意 GitHub PR 的完整链接，例如：
   ```
   https://github.com/vercel/next.js/pull/12345
   ```
2. 点击「开始分析」按钮
3. 页面自动跳转到分析结果页，显示加载动画
4. 等待 30 秒到 2 分钟（取决于 PR 大小），结果自动展示

### 理解分析结果

**风险评分卡片** — 顶部的大数字是整体风险评分（0-100），旁边标注风险等级（低/中/高/严重）。下方四个小数字分别对应安全、质量、性能、可维护性四个维度。

**严重程度标签** — 每个问题都有一个严重程度标签：
- **严重**（红色）— 必须修复，如硬编码密钥、SQL 注入
- **错误**（橙色）— 强烈建议修复，如使用 `eval()` 等危险函数
- **警告**（黄色）— 建议修复，如空 catch 块、超大函数
- **提示**（灰色）— 可以关注，如魔法数字、TODO 标记

**问题列表** — 按文件分组展示，最严重的文件排在前面。每个文件可以折叠/展开，点击文件名可以看到该文件下的所有问题。

### API 接口

如果你想在自己的工具中集成，可以直接调用 API：

**提交分析**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"prUrl": "https://github.com/owner/repo/pull/123"}'
```

响应：
```json
{
  "success": true,
  "data": {
    "analysisId": "clx1234..."
  }
}
```

**查询结果**
```bash
curl http://localhost:3000/api/result/{analysisId}
```

响应：
```json
{
  "success": true,
  "data": {
    "status": "COMPLETED",
    "riskScore": {
      "overall": 35,
      "level": "medium",
      "breakdown": {
        "security": 20,
        "quality": 45,
        "performance": 30,
        "maintainability": 40
      }
    },
    "summary": "PR 存在 2 个安全问题和 5 个代码质量问题...",
    "comments": [...]
  }
}
```

---

## 技术架构

### 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | Next.js 16 + React 19 |
| UI 组件 | shadcn/ui + TailwindCSS |
| 后端 | Next.js Route Handlers |
| 数据库 | PostgreSQL 16 + Prisma ORM |
| AI 引擎 | DeepSeek API（OpenAI 兼容协议） |
| 外部集成 | GitHub REST API |
| 部署 | Docker + GitHub Actions CI |
| 测试 | Vitest（204 个测试用例） |

### 项目结构

```
src/
├── app/                          # Next.js 页面和 API 路由
│   ├── page.tsx                  # 首页（PR URL 输入）
│   ├── analyze/[id]/page.tsx     # 分析结果页
│   └── api/
│       ├── analyze/route.ts      # POST /api/analyze
│       └── result/[id]/route.ts  # GET /api/result/:id
│
├── components/
│   ├── ui/                       # shadcn/ui 基础组件
│   └── analysis/                 # 业务组件
│       ├── analysis-status.tsx   # 状态标签
│       ├── risk-score-card.tsx   # 风险评分卡片
│       ├── comment-list.tsx      # 评论列表
│       ├── file-group.tsx        # 文件分组（可折叠）
│       └── severity-badge.tsx    # 严重程度标签
│
├── ai/                           # AI 分析模块
│   ├── engine.ts                 # AI 引擎入口（单例）
│   ├── strategies/               # 分析策略（Strategy 模式）
│   │   ├── composite.strategy.ts # 组合策略：规则 + LLM
│   │   ├── rule.strategy.ts      # 规则策略
│   │   ├── llm.strategy.ts       # LLM 策略
│   │   └── rules/                # 7 条内置规则
│   │       ├── hardcoded-secret.rule.ts
│   │       ├── sql-injection.rule.ts
│   │       ├── dangerous-function.rule.ts
│   │       ├── empty-catch.rule.ts
│   │       ├── oversized-function.rule.ts
│   │       ├── magic-number.rule.ts
│   │       └── todo-fixme.rule.ts
│   ├── context/                  # 上下文构建流水线
│   │   ├── context-builder.ts    # 4 阶段流水线
│   │   ├── chunker.ts            # diff 解析 + 代码块生成
│   │   ├── file-priority.ts      # 文件优先级评分
│   │   └── token-estimator.ts    # token 预算分配
│   ├── providers/                # LLM Provider 抽象
│   │   ├── provider.interface.ts # 接口定义
│   │   └── deepseek.provider.ts  # DeepSeek 实现
│   └── prompts/                  # Prompt 模板系统
│       ├── review.prompt.ts      # 代码审查 prompt
│       ├── risk.prompt.ts        # 风险评估 prompt
│       └── summary.prompt.ts     # PR 摘要 prompt
│
├── domain/analysis/              # 核心业务逻辑
│   ├── analysis.service.ts       # 编排层（异步流水线）
│   ├── analysis.repository.ts    # 数据库操作
│   └── analysis.types.ts         # 领域类型
│
├── integrations/github/          # GitHub API 集成
│   ├── github.client.ts          # API 客户端（重试 + 限流）
│   ├── github.parser.ts          # URL 解析器
│   └── github.types.ts           # 类型定义
│
├── infrastructure/               # 基础设施
│   ├── config/env.ts             # 环境变量（Zod 校验）
│   ├── logger/logger.ts          # 日志（pino）
│   └── db/prisma.ts              # Prisma 客户端
│
└── types/                        # 共享类型
    ├── analysis.ts               # 分析相关类型
    └── api.ts                    # API 响应类型
```

### 架构设计亮点

**1. 领域驱动设计（DDD）**

业务逻辑（`domain/`）和外部集成（`integrations/`）严格分离。`analysis.service.ts` 是编排中心，它不关心 GitHub API 怎么调、LLM 怎么调，只负责把它们串起来。

**2. 策略模式（Strategy Pattern）**

分析引擎使用策略模式，规则引擎和 LLM 分析是两个独立的策略。想加新的分析方式？实现 `AnalysisStrategy` 接口就行，不用改现有代码。

**3. LLM Provider 抽象**

LLM 调用通过 `LLMProvider` 接口抽象。当前用的是 DeepSeek，但换 OpenAI、Claude 或其他模型只需要实现同一个接口。

**4. Prompt 模板版本化**

所有 prompt 都注册在 `PromptRegistry` 中，按 `id@version` 索引。未来调优 prompt 时，可以同时保留多个版本做 A/B 测试。

**5. 异步流水线**

`startAnalysis()` 创建分析记录后立即返回 ID，分析流水线在后台异步执行。前端通过轮询获取状态，不会阻塞用户操作。

**6. 中间结果持久化**

分析过程中的每个阶段（上下文、规则结果、LLM 结果）都会保存到数据库。这意味着你可以事后回溯某次分析的完整过程。

---

## 环境变量

在项目根目录创建 `.env` 文件：

```env
# 必需：PostgreSQL 连接字符串
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_pr_review"

# 可选：GitHub Token（提升 API 频率限制）
GITHUB_TOKEN="github_pat_xxx"

# 必需：DeepSeek API Key
DEEPSEEK_API_KEY="sk-xxx"

# 可选：DeepSeek API 地址（默认值即可）
DEEPSEEK_BASE_URL="https://api.deepseek.com"

# 开发环境
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 测试

```bash
# 运行全部测试
npm test

# 监听模式（文件变更自动重跑）
npm run test:watch
```

测试覆盖：

| 模块 | 测试内容 |
|------|---------|
| 7 条规则 | 每条规则的正向/负向/边界场景 |
| 组合策略 | 规则 + LLM 结果合并、去重逻辑 |
| LLM 策略 | JSON 解析、错误处理、token 统计 |
| Diff 解析 | patch 解析、代码块生成、语言检测 |
| 文件优先级 | 路径权重、变更大小、类型加减分 |
| Token 预算 | 估算精度、分层分配、截断逻辑 |
| Prompt 渲染 | 模板变量替换 |
| API 路由 | 正常路径 + 错误路径 |

---

## Docker 部署

```bash
# 一键启动（PostgreSQL + 应用）
docker compose -f docker/docker-compose.yml up -d

# 只启动数据库（本地开发用）
docker compose -f docker/docker-compose.yml up -d db
```

Docker 镜像采用 3 阶段构建（deps → build → runner），最终镜像基于 `node:20-alpine`，以非 root 用户运行，体积最小化。

---

## CI/CD

项目配置了 GitHub Actions，每次 push 或 PR 到 `main` 分支时自动触发：

1. 启动 PostgreSQL 服务容器
2. 安装依赖 + Prisma generate
3. 执行数据库迁移
4. 构建项目
5. 运行全部测试

---

## 设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 规则引擎先于 LLM | 先跑规则，再跑 LLM | 规则零成本、速度快，能快速给出基线结果 |
| LLM 覆盖规则 | 同位置冲突时 LLM 优先 | LLM 理解上下文更深，误报率更低 |
| 异步分析 | 提交后立即返回 ID | 避免用户等待，支持并发分析 |
| Token 预算分层 | 高优先级 60%，低优先级 15% | 有限的 token 要用在刀刃上 |
| 单文件独立 LLM 调用 | 每个文件一次 API 调用 | 单文件失败不影响其他文件，且能精确到行号 |
| 中间结果持久化 | context + rule + LLM 结果都存 DB | 支持事后审计和调试 |
