# 章节绑定 KISS 设计方案

> **文档目的**：定义人物、地点、事件全部绑定章节的数据模型与流程设计。遵循 KISS 原则，不做任何合并，查询时通过 AI 做按需汇总。

**版本**：v1.0  
**最后更新**：2025-02-19

---

## 1. 背景与目标

### 1.1 设计动机

在现有设计中，Person 和 Place 是**跨章节聚合**的实体，存在以下复杂度：

- 需要判断「张良」在不同章节是否是同一人，涉及合并逻辑
- 合并时需要 LLM 辅助判断、人工确认
- `sourceChapterIds` 数组维护成本高，重跑某章提取会影响已有聚合记录

作为 KISS 狂热粉，我们希望**在写入阶段极简**：每处理一个章节，就提取一次人物、地点、事件，**全部与章节绑定**，不做任何合并。

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **不合并** | 不考虑人物、地点、事件的去重或合并 |
| **章节绑定** | 每条 Person、Place、Event 记录必须且仅属于一个 Chapter |
| **保留独立表** | Person、Place 仍为独立表，便于将来做按需汇总 |
| **按需汇总** | 查看某实体时，将相关章节信息发给 AI 做汇总，作为补充信息展示 |
| **审核不变** | 人物、地点仍需走 ReviewItem 审核流程 |

### 1.3 与现有文档的关系

- 本方案**取代** [ENTITY_FUSION_DESIGN.md](./ENTITY_FUSION_DESIGN.md) 中的跨章节聚合逻辑
- 与 [data-acquisition-and-merge-spec.md](../specs/data-acquisition-and-merge-spec.md) 中的「融合」「合并」流程**不兼容**，需简化
- 事件中心思想（[event-centric-data-spec.md](../specs/event-centric-data-spec.md)）保留，Event 仍为核心原子单元

---

## 2. 数据模型

### 2.1 整体关系

```
┌─────────────┐
│   Chapter   │
└──────┬──────┘
       │ 1
       │
       │ N
┌──────┴──────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                   │
│  │  Event  │    │ Person  │    │  Place  │                   │
│  │chapterId│    │chapterId│    │chapterId│                   │
│  └─────────┘    └─────────┘    └─────────┘                   │
│       │              │              │                         │
│       │              │              │                         │
│  actors[].personId ──┘              │                         │
│  (可选，关联同章节 Person)          │                         │
│                                     │                         │
│  locationName ──────────────────────┘                         │
│  (名称引用，可关联同章节 Place)                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**关键点**：

- Event、Person、Place 均有 `chapterId`，与 Chapter 一一绑定
- 同一人物在不同章节 → 多条 Person 记录（如「张良」在第五章和第十章 = 2 条 Person）
- 同一人物在同一章节多次出现 → **一条 Person 记录**（LLM 在本章内做一次汇总提取）
- Event.actors 中的 `personId` 可选，指向同章节的 Person，便于关联
- Place 同样：同章内一地一条记录，跨章同名地点为多条记录

### 2.2 Person 模型变更

**变更前**（跨章节聚合）：

```
Person
├── sourceChapterIds String[]   // 来源章节列表
└── (无 chapterId)
```

**变更后**（章节绑定）：

```
Person
├── chapterId        String    // 所属章节（必填）
├── relatedParagraphIds String[] // 相关段落 ID（可选，用于追溯）
└── (移除 sourceChapterIds)
```

**完整字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | String | ✓ | UUID |
| chapterId | String | ✓ | 所属章节 |
| name | String | ✓ | 姓名 |
| aliases | String[] | | 本章语境下的别称 |
| role | PersonRole | ✓ | 角色类型 |
| faction | Faction | ✓ | 阵营 |
| birthYear | String? | | 生年 |
| deathYear | String? | | 卒年 |
| biography | String | ✓ | 本章语境下的简介 |
| portraitUrl | String? | | 画像链接 |
| relatedParagraphIds | String[] | | 信息来源段落 ID |
| zi | String? | | 字，如「子房」 |
| birthDate | String? | | 生辰/诞辰（更精确） |
| birthPlace | String? | | 出生地 |
| deathPlace | String? | | 逝世地 |
| nativePlace | String? | | 籍贯 |
| status | ContentStatus | ✓ | 草稿/待审核/已发布等 |

**约束**：同一章节内，同一人物原则上只保留一条。由 LLM 提取时在本章内做一次汇总（若同一人有多个称呼如「张良」「子房」，合并为一条，其他称呼放入 aliases）。

**索引**：

- `@@index([chapterId])`
- `@@index([name])`
- `@@unique([chapterId, name])` — 可选，用于防止本章重复提取同一人

### 2.3 Place 模型变更

**变更前**：

```
Place
├── name @unique     // 全局唯一
└── sourceChapterIds String[]
```

**变更后**：

```
Place
├── chapterId        String    // 所属章节（必填）
├── name             String    // 移除 @unique
└── (移除 sourceChapterIds)
```

**完整字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | String | ✓ | UUID |
| chapterId | String | ✓ | 所属章节 |
| name | String | ✓ | 历史地名 |
| aliases | String[] | | 别名 |
| coordinatesLng/Lat | Float? | | 经纬度 |
| modernLocation | String? | | 现代位置描述 |
| modernAddress | String? | | 现代地址 |
| adminLevel1/2/3 | String? | | 行政隶属 |
| geographicContext | String? | | 地理背景 |
| featureType | String? | | 地点类型 |
| source | PlaceSource | | CHGIS/LLM/HYBRID/MANUAL |
| chgisId | String? | | CHGIS ID |
| timeRangeBegin/End | String? | | 存在时间范围 |
| relatedParagraphIds | String[] | | 相关段落 ID |
| status | ContentStatus | ✓ | |

**约束**：`@@unique([chapterId, name])` — 同章内同一地名一条记录。

**索引**：

- `@@index([chapterId])`
- `@@index([name])`
- `@@unique([chapterId, name])`

### 2.4 Event 模型（基本不变）

Event 已有 `chapterId`，保持现状。可选增强：

- `actors[].personId`：可选，关联同章节 Person，便于「从人物查事件」
- `locationName` / `locationPlaceId`：可选，关联同章节 Place

### 2.5 Chapter 模型变更

增加反向关联：

```
Chapter
├── ...
├── persons  Person[]
└── places   Place[]
```

### 2.6 ReviewItem（不变）

继续支持 `EVENT`、`PERSON`、`PLACE` 三种类型。`originalData` 中必须包含 `chapterId`。

### 2.7 ChangeLog 简化

- `mergedFrom`：可移除或置空，因不再有合并操作
- `ChangeAction.MERGE`：可保留供手动场景使用，或从枚举中移除

---

## 3. 提取流程

### 3.1 流程概览

```
章节文本 + 段落
        │
        ▼
┌───────────────────┐
│  Step 1: 提取事件  │  ← 按块提取，带 relatedParagraphs
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Step 2: 提取人物  │  ← 仅基于本章，不查库、不融合
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Step 3: 提取地点  │  ← 仅基于本章，不查库、不融合
└─────────┬─────────┘
          │
          ▼
    创建 ReviewItem
    (EVENT / PERSON / PLACE)
```

### 3.2 与当前实现的差异

| 步骤 | 当前实现 | 新实现 |
|------|----------|--------|
| 提取人物 | 调用 `getExistingPersons(events)` 查询已有 Person，传入 `extractPersons` 做融合 | **不**查询已有 Person，直接提取本章人物 |
| 提取地点 | 调用 `getExistingPlaces(events)`，传入 `extractAndEnhanceLocations` 做融合 | **不**查询已有 Place，直接提取本章地点；可选调用 CHGIS 增强单条记录 |
| 输出 | Person/Place 带 `sourceChapterIds` | Person/Place 带 `chapterId` |

### 3.3 提取 Prompt 简化

- **人物**：不再传入 `existingPersons`，只基于本章文本和事件中的 actors 提取
- **地点**：不再传入 `existingPlaces`，只基于本章事件和文本提取
- 输出结构明确包含 `chapterId`，便于写入时校验

### 3.4 人物提取 Prompt 扩展（生辰、出生地等）

在人物提取的 JSON 输出格式中，增加以下可选字段，要求 LLM 在文本有相关表述时提取：

| 输出字段 | 说明 | 文本示例 |
|----------|------|----------|
| zi | 字 | 「张良字子房」「刘邦，字季」 |
| birthDate | 生辰/诞辰 | 「汉高帝十二年四月甲辰崩」可推出生卒更精确时间 |
| birthPlace | 出生地 | 「刘邦，沛丰邑中阳里人」「项羽，下相人也」 |
| deathPlace | 逝世地 | 「崩于长乐宫」「卒于乌江」 |
| nativePlace | 籍贯 | 「张良，其先韩人也」 |

Prompt 中需明确：
- 以上字段均为可选，文本无则留空或省略
- 日期格式与 birthYear/deathYear 保持一致（如「前256年」「前256年正月」）
- 地点使用历史地名，可与 Place 表关联

### 3.5 审核通过后的持久化

审核通过时：

```
ReviewItem (type=PERSON, status=APPROVED)
    → prisma.person.create({
        ...modifiedData/originalData,
        chapterId,  // 必填
        // 无 sourceChapterIds
      })
```

Place 同理。Event 若也走 ReviewItem，逻辑类似。

---

## 4. 查询与展示流程

### 4.1 按实体查看（如「张良」）

```
用户点击「张良」
        │
        ▼
┌─────────────────────────────────────┐
│ 1. 即时展示：原始提取信息（按章节列表）  │
│    - 查询 Person WHERE name = '张良'   │
│      OR aliases @> ['张良']            │
│    - 按 chapterId 分组，附带章节标题    │
│    - 每条展示：本章的 biography、role 等 │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 2. 异步加载：AI 汇总（补充信息）        │
│    - GET /api/persons/aggregate?name=张良 │
│    - 收集所有匹配的 Person + 相关 Event  │
│    - 构建 Prompt，调用 LLM 生成综述      │
│    - 展示在原始信息下方                  │
└─────────────────────────────────────┘
```

### 4.2 跨章节同一实体的查询逻辑

同一人物/地点在不同章节会有多条记录，聚合前需先**按名称收集所有相关记录**。以下逻辑适用于人物和地点的查询与 AI 汇总。

#### 查询条件：name + aliases

人物、地点的 `name` 和 `aliases` 共同作为匹配条件：

```sql
-- 人物：查 name 或 aliases 中包含目标名称的记录
SELECT * FROM "Person"
WHERE name = '张良' OR '张良' = ANY(aliases)
ORDER BY chapter.order ASC;
```

Prisma 示例：

```ts
await prisma.person.findMany({
  where: {
    OR: [
      { name: '张良' },
      { aliases: { has: '张良' } },
    ],
  },
  include: { chapter: { include: { book: true } } },
  orderBy: { chapter: { order: 'asc' } },
})
```

#### 为何能找全？

- 提取时，LLM 会在本章内将同一人物的不同称呼合并为一条 Person，主称放入 `name`，其余放入 `aliases`
- 例：第五章 `name: "张良", aliases: ["子房"]`，第十章 `name: "张良", aliases: []`
- 用 `name = '张良'` 或 `aliases has '张良'` 都能命中这些记录

#### 边界情况

| 情况 | 处理方式 |
|------|----------|
| 别名分散 | `name` 和 `aliases` 都要匹配，例如查「子房」也能找到 `aliases` 含「子房」的记录 |
| 同名人 | 会一并查出，AI 汇总时可结合章节、事件上下文尝试区分，或保留多条供用户判断 |
| 繁简体 | 如「張良/张良」，可在查询前做 normalize，或入库时统一形式 |
| 跨书籍 | 不做 books 级过滤，按 name 全局查，史记和汉书中的「张良」都会出现在聚合结果中 |

#### 地点查询

Place 的查询逻辑相同：`name = '鸿门' OR '鸿门' IN aliases`。

### 4.3 聚合 API 设计

**人物聚合**：`GET /api/persons/aggregate?name=张良` 或 `GET /api/persons/:id/aggregate`

1. 按 4.2 节逻辑（name/aliases）查询所有 Person 记录
2. 可选：查询这些 Person 所在章节的 Event，筛选 actors 中含该人物的
3. 将 Person 列表 + 相关 Event 摘要打包成上下文
4. 调用 LLM：综合以上信息，生成该人物的整体介绍（200–500 字）
5. 返回：`{ persons: [...], events: [...], summary: "..." }`
6. 可选：对 `(name, bookId)` 做缓存，TTL 如 24h

**地点聚合**：`GET /api/places/aggregate?name=鸿门` 类似实现，查询逻辑同样见 4.2 节。

### 4.4 展示结构

```
┌─────────────────────────────────────────────────────────┐
│ 张良                                                     │
├─────────────────────────────────────────────────────────┤
│ 【原始提取信息】（按章节）                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 史记·留侯世家 - 第 X 章                               │ │
│ │ 角色：谋士 | 阵营：汉 | 简介：……                      │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 史记·高祖本纪 - 第 Y 章                               │ │
│ │ 角色：谋士 | 阵营：汉 | 简介：……                      │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ 【AI 汇总】（异步加载，可缓存）                            │
│ 张良，字子房……（综合各章节信息的概述）                     │
└─────────────────────────────────────────────────────────┘
```

---

## 5.  schema 变更清单

### 5.1 Person

```prisma
model Person {
  id                 String        @id @default(uuid())
  chapterId          String        // 新增：所属章节（必填）
  name               String
  aliases            String[]      @default([])
  zi                 String?       // 字，如「子房」
  role               PersonRole
  faction            Faction
  birthYear          String?       // 生年，如「前256年」
  birthDate          String?       // 生辰/诞辰，更精确的出生时间，如「前256年正月」
  birthPlace         String?       // 出生地
  deathYear          String?       // 卒年
  deathPlace         String?       // 逝世地
  nativePlace        String?       // 籍贯（祖籍）
  biography          String        @db.Text
  portraitUrl        String?
  relatedParagraphIds String[]      @default([])  // 新增：替代来源追踪
  status             ContentStatus @default(DRAFT)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  chapter            Chapter       @relation(fields: [chapterId], references: [id], onDelete: Cascade)

  @@unique([chapterId, name])  // 同章内同一人不重复
  @@index([chapterId])
  @@index([name])
  @@index([faction])
  @@index([role])
  @@index([status])
}
```

**人物扩展字段说明**（生辰、出生地等）：

| 字段 | 类型 | 说明 | 提取要点 |
|------|------|------|----------|
| zi | String? | 字 | 史书常见「X字Y」格式，如张良字子房 |
| birthDate | String? | 生辰/诞辰 | 比 birthYear 更精确，含月日时可用原文或公元纪年 |
| birthPlace | String? | 出生地 | 史书常有「X，Y人也」等表述 |
| deathPlace | String? | 逝世地 | 如「崩于长乐宫」「卒于某地」 |
| nativePlace | String? | 籍贯 | 祖籍，与出生地可能不同，史书常见 |

上述字段均为可选，文本中若有则提取，无则留空。提取时在人物 Prompt 中明确要求 LLM 输出这些字段。

### 5.2 Place

```prisma
model Place {
  id                 String        @id @default(uuid())
  chapterId          String        // 新增：所属章节（必填）
  name               String        // 移除 @unique
  aliases            String[]      @default([])
  // ... 其余字段保持不变 ...
  relatedParagraphIds String[]      @default([])  // 新增：替代 sourceChapterIds
  status             ContentStatus @default(DRAFT)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  chapter            Chapter       @relation(fields: [chapterId], references: [id], onDelete: Cascade)

  @@unique([chapterId, name])  // 同章内同一地名不重复
  @@index([chapterId])
  @@index([name])
  @@index([source])
  @@index([status])
}
```

### 5.3 Chapter

```prisma
model Chapter {
  // ... 现有字段 ...
  persons  Person[]
  places   Place[]
}
```

### 5.4 ChangeLog（可选）

- 移除或弃用 `mergedFrom`
- 可选移除 `ChangeAction.MERGE`

---

## 6. 迁移与兼容

### 6.1 数据迁移

若已有 Person/Place 使用 `sourceChapterIds`：

1. 为每条 Person 的每个 `sourceChapterIds` 中的 chapterId 创建一条新 Person 记录（复制主要字段，`chapterId` = 该章节）
2. 删除旧 Person 记录
3. Place 同理

**注意**：若旧数据为多章节融合结果（biography 等为合并后的内容），迁移后每条新记录的 biography 会相同，可能不完全贴合单章语境。可接受为过渡方案，后续可针对单章重跑提取优化。

若无历史数据，可直接应用新 schema。

### 6.2 向后兼容

- 聚合 API 为新增，不影响现有查询
- 前端可先实现「原始信息列表」，聚合功能后续迭代

---

## 7. 优缺点总结

### 优点

- **写入极简**：无融合、无去重，提取逻辑清晰
- **数据可追溯**：每条记录 100% 对应某一章节，无合并污染
- **易重跑**：按章重跑提取不影响他章数据
- **灵活扩展**：汇总策略可随时调整，仅影响读路径
- **保留独立表**：Person、Place 仍可单独查询、索引，便于后续功能

### 权衡

- **存储**：同一人物多章出现会有多条 Person，存储略增，可接受
- **查询**：按 name 查人物需扫描多行，通过索引可控
- **汇总延迟**：AI 汇总需 1–3 秒，通过异步加载和缓存缓解

---

## 8. 实施顺序建议

1. **Phase 1**：Schema 变更 + Migration（含 Person 扩展字段：zi、birthDate、birthPlace、deathPlace、nativePlace）
2. **Phase 2**：修改 LLM 提取逻辑（移除 getExistingPersons/getExistingPlaces 及融合逻辑，并更新人物提取 Prompt 支持扩展字段）
3. **Phase 3**：修改 ReviewItem 审核通过后的持久化逻辑（写入带 chapterId 的 Person/Place）
4. **Phase 4**：实现聚合 API + 前端展示（原始信息 + AI 汇总）

---

## 附录 A：与 ENTITY_FUSION_DESIGN 的对比

| 维度 | ENTITY_FUSION_DESIGN | 本章节绑定方案 |
|------|----------------------|----------------|
| 写入 | 追加后可能合并 | 仅追加，不合并 |
| Person/Place 归属 | 跨章节 (sourceChapterIds) | 单章节 (chapterId) |
| 聚合时机 | 查看时异步 LLM 汇总 | 相同 |
| 表结构 | Person/Place 无 chapterId | Person/Place 必有 chapterId |

两者在「读取时聚合」的理念上一致，本章节绑定方案进一步简化了写入和建模。
