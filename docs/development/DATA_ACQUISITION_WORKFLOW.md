# 数据获取流程设计（下载、预处理、导入）

> **目标**：统一下载、预处理、导入的入口，减少脚本与后台之间的切换。

**版本**：v1.0  
**最后更新**：2025-02-19

---

## 1. 当前问题

| 步骤 | 当前位置 | 说明 |
|------|----------|------|
| 下载 | scripts/download_with_playwright.js | 命令行执行，需 Node + Playwright |
| 预处理 | scripts/preprocess_text.js | 命令行执行，需手动传参 |
| 导入 | 后台 POST /api/admin/chapters/import | 仅支持 JSON，需先跑预处理脚本 |

**痛点**：用户需在「终端跑脚本」和「后台网页操作」之间切换，流程割裂。

---

## 2. 设计原则

1. **双路径可选**：命令行脚本（批量/自动化） + 后台网页（单章/快速）
2. **预处理内聚**：预处理逻辑统一，脚本和后台共用同一套规则
3. **减少步骤**：后台支持原始文本，省去「先跑预处理再上传」的中间步骤

---

## 3.  unified 流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                        两种入口，同一终点                              │
└─────────────────────────────────────────────────────────────────────┘

【路径 A：命令行（适合批量）】
  scripts/download_and_prepare.sh --url "..." --book "史记" --chapter "高祖本纪"
       │
       ├── 1. 下载原始文本 (download_with_playwright.js)
       ├── 2. 预处理 → JSON (preprocess_text.js 逻辑)
       └── 3. 输出 data/processed/chapters/xxx.json
               │
               └──► 用户到后台「导入章节」上传该 JSON

【路径 B：后台直传（适合单章）】
  后台「导入章节」页面
       │
       ├── 上传 .txt（原始文本）→ 后端自动预处理 → 导入 DB
       └── 上传 .json（预处理后）→ 直接导入 DB
```

---

## 4. 实现方案

### 4.1 后端

- **扩展 `POST /api/admin/chapters/import`**：
  - 支持 `file` 为 `.txt` 或 `.json`
  - 若为 `.txt`：调用内置预处理逻辑，转为章节结构后再入库
  - 若为 `.json`：保持现有逻辑，校验后入库

- **预处理逻辑**（从 preprocess_text.js 移植）：
  - 跳过 `---` 前的元数据
  - 按空行分段落
  - 过滤元数据行、过短段落
  - 生成 `{ title, source, paragraphs: [{ order, text, id }] }`

- **Multer 配置**：允许 `application/json` 和 `text/plain`

### 4.2 前端

- **ChaptersPage 导入区域**：
  - 文件类型：支持 `.json` 和 `.txt`
  - 上传 `.txt` 时，预览显示「将自动预处理为 X 个段落」

### 4.3 脚本

- **新增 `download_and_prepare.sh`**（或改造 `download_first_chapter_auto.sh`）：
  - 执行：下载 → 预处理
  - 输出：`data/processed/chapters/{book}_{chapter}.json`
  - 打印：下一步「到后台导入该文件」的提示

- **保留**：
  - `download_with_playwright.js`：仅下载
  - `preprocess_text.js`：可单独使用（如处理非维基文库来源）

---

## 5. 用户操作流程（更新后）

### 方式一：命令行 + 后台

```bash
./scripts/download_and_prepare.sh \
  --url "https://zh.wikisource.org/wiki/史記/卷008" \
  --book "史记" \
  --chapter "高祖本纪"
# → 得到 data/processed/chapters/shiji_gaozu_benji.json
```

然后：后台 → 章节管理 → 导入章节 → 选择书籍 → 选择该 JSON → 导入

### 方式二：纯后台

1. 从维基文库复制文本（或上传已下载的 .txt）
2. 后台 → 章节管理 → 导入章节 → 选择书籍 → 上传 .txt
3. 系统自动预处理并导入

---

## 6. 与操作手册的衔接

- 更新 `docs/OPERATION_MANUAL.md` 中的「步骤 1、2」描述
- 更新 `scripts/README.md` 中的流程说明
