# 章节翻译与实体高亮设计

> **文档目的**：定义「段落现代文翻译」和「人物/地点 LLM 精确标注」两个功能的完整设计，包括数据模型、API、LLM 调用和前端展示。

**版本**：v1.0  
**最后更新**：2026-02-19

---

## 1. 概述

### 1.1 功能目标

| 功能 | 说明 |
|------|------|
| **段落翻译** | 每个段落提供现代文翻译，方便读者理解古文 |
| **实体高亮** | 原文中的人物、地点使用不同样式高亮，悬停展示详情卡片 |
| **高亮精度** | 使用 LLM 做精确 span 标注，避免正则匹配导致「将」误高亮「将军」等问题 |

### 1.2 与现有流程的关系

- **翻译**：在章节处理页面触发，依赖已有段落文本
- **实体标注**：依赖已提取的 Person、Place（`relatedParagraphIds`），将实体列表与段落文本一并发给 LLM，获取精确提及位置

### 1.3 入口设计

在 **ChapterProcessPage**（章节处理）增加 Tabs：

```
数据提取 | 翻译 | 实体标注
```

- **数据提取**：现有逻辑，提取事件和人物
- **翻译**：选择章节 → 触发翻译 → 逐段写入 Paragraph.translation
- **实体标注**：选择章节 → 将人物、地点、段落发给 LLM → 写入 TextMention

---

## 2. 数据模型

### 2.1 Paragraph 变更

```prisma
model Paragraph {
  id            String   @id @default(uuid())
  chapterId     String
  order         Int
  text          String   @db.Text
  translation   String?  @db.Text   // 新增：现代文翻译
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  chapter       Chapter      @relation(...)
  annotations   Annotation[]
  mentions      TextMention[]  // 新增：实体提及
}
```

### 2.2 TextMention 新增

```prisma
model TextMention {
  id          String   @id @default(uuid())
  paragraphId String
  entityType  String   // "PERSON" | "PLACE"
  entityId    String   // Person.id 或 Place.id
  startIndex  Int      // 字符起始位置（含）
  endIndex    Int      // 字符结束位置（不含）
  createdAt   DateTime @default(now())

  paragraph   Paragraph @relation(fields: [paragraphId], references: [id], onDelete: Cascade)

  @@unique([paragraphId, startIndex, endIndex, entityType, entityId])
  @@index([paragraphId])
  @@index([entityType, entityId])
}
```

**说明**：

- `startIndex` / `endIndex`：0-based，与 `String.substring(start, end)` 语义一致
- 同一 span 可能被不同实体引用（理论上罕见），unique 包含 entityType、entityId 以支持
- 若同一 span 只允许一个实体，可简化为 `@@unique([paragraphId, startIndex, endIndex])`

### 2.3 迁移

迁移文件：`prisma/migrations/20260219120000_add_translation_and_mentions/migration.sql`

若存在数据库 drift，可直接执行：
```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260219120000_add_translation_and_mentions/migration.sql
```

---

## 3. 段落翻译

### 3.1 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/chapters/:id/translate` | 对指定章节所有段落执行 LLM 翻译 |

**请求**：无 body（或可选 `{ force?: boolean }` 用于覆盖已有翻译）

**响应**：

```json
{
  "success": true,
  "translatedCount": 42,
  "skippedCount": 0
}
```

### 3.2 实现逻辑

1. 查询章节及其段落（`orderBy: order`）
2. 若 `force !== true`，可跳过已有 `translation` 的段落（或全部重翻）
3. 按段落或批量调用 LLM（见 3.3）
4. 更新 `Paragraph.translation`
5. 返回翻译数量

### 3.3 LLM 调用

**输入**：

- 书籍名、章节标题（上下文）
- 段落列表：`[{ id, text }]`

**输出格式**（JSON）：

```json
{
  "translations": [
    { "paragraphId": "uuid-1", "translation": "现代文译文..." },
    { "paragraphId": "uuid-2", "translation": "..." }
  ]
}
```

**Prompt 要点**：

- 说明原文为文言文/古文，要求输出通俗现代汉语
- 保持段落一一对应，不要合并或拆分
- 专有名词（人名、地名）可保留原文或加注
- 输出严格 JSON，无多余 markdown

**批量策略**：

- 单次可发送多段（如 5–10 段）以节省调用次数
- 若单段过长，可单独发送
- 失败时支持断点续传（仅翻译缺失 translation 的段落）

### 3.4 前端：ChapterProcessPage 翻译 Tab

- 选择书籍、章节
- 展示段落数、已有翻译数
- 按钮：「开始翻译」/「重新翻译」
- 加载中显示 Progress
- 成功后刷新状态

### 3.5 前端：阅读页翻译展示

- 每段下方展示 `translation`（若存在）
- Switch：「显示现代文」，默认开启
- 段落结构示例：

```
┌─────────────────────────────────────┐
│ ① 原文（含注释、实体高亮）            │
│ 高祖，沛丰邑中阳里人...               │
├─────────────────────────────────────┤
│  modern 现代文（根据开关显隐）         │
│  高祖是沛县丰邑中阳里人...            │
└─────────────────────────────────────┘
```

---

## 4. 实体高亮（LLM 精确标注）

### 4.1 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/chapters/:id/extract-mentions` | 提取章节内人物、地点的精确提及 span |
| GET | `/api/chapters/:id` | 响应中 paragraphs 需包含 `mentions`（或通过现有 include） |

### 4.2 实现逻辑

1. 查询章节的 paragraphs、persons、places
2. 若 persons 与 places 为空，返回提示「请先完成数据提取」
3. 构造 LLM 输入：段落 + 人物/地点列表（含 id、name、aliases）
4. 调用 LLM，解析 mentions
5. 校验：`paragraph.text.substring(start, end)` 与预期一致
6. 删除本章段落已有 mentions，批量插入新结果
7. 返回 `{ success, mentionCount }`

### 4.3 LLM 调用

**输入**：

```json
{
  "paragraphs": [
    { "id": "para-1", "text": "高祖，沛丰邑中阳里人，姓刘氏，字季。父曰太公，母曰刘媪。" }
  ],
  "persons": [
    { "id": "person-1", "name": "刘邦", "aliases": ["高祖", "沛公", "汉王"] },
    { "id": "person-2", "name": "太公", "aliases": [] }
  ],
  "places": [
    { "id": "place-1", "name": "沛", "aliases": ["沛县"] },
    { "id": "place-2", "name": "丰邑", "aliases": ["丰"] }
  ]
}
```

**输出格式**（JSON）：

```json
{
  "mentions": [
    { "paragraphId": "para-1", "entityType": "PERSON", "entityId": "person-1", "startIndex": 0, "endIndex": 2 },
    { "paragraphId": "para-1", "entityType": "PERSON", "entityId": "person-2", "startIndex": 20, "endIndex": 22 },
    { "paragraphId": "para-1", "entityType": "PLACE", "entityId": "place-1", "startIndex": 3, "endIndex": 4 }
  ]
}
```

**索引规则**：

- `startIndex`：首字符下标（0-based）
- `endIndex`：末字符下标 + 1（不含）
- 示例：`"高祖"` → startIndex=0, endIndex=2

**Prompt 要点**：

- 仅标注出现在 persons/places 列表中的实体
- 同一 span 只标注一次（取最具体实体，如「沛丰邑」中的「沛」「丰邑」分别标）
- 别名需正确映射到对应 entityId
- 若某字为多义词（如「将」），仅在人名/地名含义时标注，不标「将军」中的「将」

### 4.4 批处理策略

- **按段调用**：每段独立请求，上下文清晰，容错好
- **批量调用**：一次多段，降低成本，但需在输出中带 paragraphId

建议：先按段实现，验证效果后再评估批量。

### 4.5 前端：ChapterProcessPage 实体标注 Tab

- 选择书籍、章节
- 展示：本章人物数、地点数、已标注 mention 数
- 按钮：「开始标注」
- 依赖检查：若无 Person/Place，提示先执行数据提取

### 4.6 前端：阅读页高亮展示

- 从章节 API 获取 paragraphs（含 mentions）
- 合并 annotations 与 mentions，按 position/startIndex 排序
- 渲染规则：
  - **Annotation**：沿用现有 Popover（注释）
  - **TextMention (PERSON)**：人物样式 + HoverCard（阵营色边框等）
  - **TextMention (PLACE)**：地点样式 + HoverCard（如绿色系）
- Switch：「高亮人物和地点」，默认开启
- 需按 chapterId 拉取 Person、Place 详情用于 HoverCard

---

## 5. 依赖关系

```
导入章节 → 数据提取（事件、人物、地点）→ 翻译（可选）
                                    → 实体标注（依赖 Person/Place）
```

- 翻译可与实体标注独立进行
- 实体标注依赖数据提取产生的 Person、Place

---

## 6. 实现顺序建议

1. **数据模型**：Paragraph.translation、TextMention 及迁移
2. **翻译**：API、LLM prompt、ChapterProcessPage Tab、阅读页展示
3. **实体标注**：API、LLM prompt、ChapterProcessPage Tab、阅读页展示（替代现有正则高亮）
4. 可选：将正则高亮保留为 fallback（无 mentions 时使用）

---

## 7. 附录

### 7.1 章节 API 返回结构（含 mentions）

```json
{
  "id": "ch-1",
  "title": "高祖本纪",
  "paragraphs": [
    {
      "id": "p-1",
      "order": 1,
      "text": "高祖，沛丰邑中阳里人...",
      "translation": "高祖是沛县丰邑中阳里人...",
      "annotations": [...],
      "mentions": [
        { "entityType": "PERSON", "entityId": "person-1", "startIndex": 0, "endIndex": 2 },
        { "entityType": "PLACE", "entityId": "place-1", "startIndex": 3, "endIndex": 4 }
      ]
    }
  ]
}
```

### 7.2 阅读页合并渲染伪代码

```ts
// 将 annotations 和 mentions 转为统一 { position, length, type, data } 结构
const spans = [
  ...annotations.map(a => ({ start: a.position, end: a.position + a.targetText.length, type: 'annotation', data: a })),
  ...mentions.map(m => ({ start: m.startIndex, end: m.endIndex, type: 'mention', data: m }))
].sort((a, b) => a.start - b.start)

// 按 span 顺序截取 text，交错渲染普通文本 / 注释 / 提及
```
