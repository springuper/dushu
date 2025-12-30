# 事件中心数据架构规格书（MVP 精简版）

> **文档目的**：重新设计数据获取、提取、融合的完整流程和数据模型，解决当前实现中人物信息精简、关系单一等问题。本规格采用"Simple first, extend later"原则，MVP 阶段保持最简设计，为后续扩展留出空间。

---

## 1. 背景与目标

### 1.1 当前问题

在实际使用中，我们发现了以下关键问题：

#### 问题 1：人物信息过于精简

提取《史记·高祖本纪》时，人物数据往往只有基础字段：

```json
{
  "id": "person_刘盈",
  "name": "刘盈",
  "aliases": [],
  "chapterId": "3447ecca-059e-48ad-bea4-16bc919cb5d9"
}
```

缺少关键信息：`role`、`biography`、`keyEvents` 等，无法为读者提供有价值的上下文。

#### 问题 2：关系过于简单且静态

刘邦与项羽的关系被简化为单一记录：

```json
{
  "type": "ALLY",
  "description": "双方达成和议，以鸿沟为界中分天下。",
  "relatedEvent": "楚汉鸿沟和议"
}
```

实际上，他们的关系经历了复杂演变：
- 前208年：反秦联盟，盟友
- 前206年：鸿门宴，敌意/试探
- 前206-203年：楚汉战争，敌对
- 前203年：鸿沟和议，暂时和解
- 前202年：垓下之战，最终决战

当前数据库约束 `@@unique([sourceId, targetId, type])` 导致同类型关系只能有一条，无法表达这种复杂性。

#### 问题 3：数据模型过于复杂

当前设计有太多独立表（Person、Relationship、Event、Place 等），导致：
- 提取逻辑复杂
- 数据一致性难以维护
- 审核流程繁琐

### 1.2 核心洞察

**历史的基本单位是「事件」，关系可以通过事件推断**

当读者阅读《史记·高祖本纪》时，他们看到的是一系列事件的叙述：

```
斩白蛇起义 → 入关灭秦 → 鸿门宴 → 约法三章 → 彭城之战 → ... → 垓下之战
```

每个事件中：
- **人物** 通过参与事件被定义（刘邦在鸿门宴中的表现）
- **关系** 通过事件中的互动被展现（项羽在鸿门宴中对刘邦的态度）
- **时间和空间** 通过事件被组织

**关键简化**：关系不需要独立存储，可以通过"两人共同参与的事件"来推断和展示。

### 1.3 设计原则

1. **Simple first, extend later**：MVP 保持最简，为扩展留空间
2. **事件为中心**：事件是数据的原子单位
3. **关系通过事件推断**：不单独存储关系表
4. **JSON 内嵌优先**：减少表数量，简化查询
5. **动态生成优先**：章节视角等信息查询时生成，不预存储

### 1.4 产品愿景对齐

引用《历史阅读增强 App 产品规格书》：

> "让读者在阅读经典历史时，实时获得人物、地理、关系与事件的全景 context，像和历史导师对话一样深入理解背景。"

本规格书通过以下方式支撑这一愿景：
- 提供丰富的人物上下文（完整的 biography，而非精简的 name + id）
- 展示关系的演变历程（通过共同事件列表，而非单一静态关系）
- 支持章节视角的信息展示（动态生成，避免剧透）

---

## 2. MVP 数据模型

### 2.1 设计理念：核心三表

MVP 阶段需要 **3 个核心表**：`Event`、`Person` 和 `Place`。

```
┌─────────────────────────────────────────────────────────────────┐
│                     MVP 最小数据模型                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│       Event         │         │       Person        │         │       Place         │
├─────────────────────┤         ├─────────────────────┤         ├─────────────────────┤
│ id                  │         │ id                  │         │ id                  │
│ name                │         │ name                │         │ name                │
│ type                │         │ aliases[]           │         │ aliases[]           │
│ timeRangeStart      │         │ role                │         │ coordinatesLng      │
│ timeRangeEnd        │         │ faction             │         │ coordinatesLat      │
│ summary             │◄───────►│ biography           │         │ modernLocation      │
│ impact              │  JSON   │ sourceChapterIds[]  │         │ sourceChapterIds[]  │
│ chapterId           │  内嵌   │ status              │         │ status              │
│                     │         └─────────────────────┘         └─────────────────────┘
│ actors: [           │
│   { personId,       │
│     name,           │  ← 参与者信息内嵌在 Event 中
│     roleType,       │     不需要独立的 EventParticipant 表
│     description }   │
│ ]                   │
│                     │
│ locationName        │  ← 地点名称引用（关联到 Place 表）
│ locationModernName  │     地点详细信息存储在 Place 表中
└─────────────────────┘

【关系如何处理？】
不存储！查询时通过"两人共同参与的事件"动态推断。
```

**说明**：
- **Place 表**：地点信息较为关键，包含坐标、现代位置等结构化数据，因此作为独立表存储，类似 Person 表
- **Event.locationName**：作为地点名称引用，可关联到 Place 表
- **Place 知识库**：支持跨章节的地点信息聚合和增强（如通过 CHGIS API 获取坐标）

### 2.2 精简对比

| 内容 | 原方案 | MVP 方案 | 说明 |
|------|--------|----------|------|
| Relationship | 独立表 | ❌ 删除 | 通过事件推断 |
| EventRelationship | 独立表 | ❌ 删除 | 通过事件 actors 推断 |
| EventParticipant | 独立表 | → JSON 内嵌 | 简化为 Event.actors[] |
| ChapterPerson | 独立表 | ❌ 删除 | 查询时动态生成 |
| RelationshipSummary | 独立表 | ❌ 删除 | 查询时聚合 |
| Place | 独立表 | ✅ 保留 | 地点信息关键，类似 Person 表 |
| **总计** | **6-7 个表** | **3 个表** | 大幅简化 |

### 2.3 Event（事件）模型

```prisma
model Event {
  id                String        @id @default(uuid())
  
  // 基本信息
  name              String        // 事件名称，如"鸿门宴"
  type              EventType     // 事件类型
  
  // 时间信息
  timeRangeStart    String        // 开始时间，如"前206年12月"
  timeRangeEnd      String?       // 结束时间（可选）
  timePrecision     TimePrecision @default(YEAR) // 时间精度
  
  // 地点信息（JSON 内嵌，MVP 不单独建表）
  locationName      String?       // 历史地名，如"鸿门"
  locationModernName String?      // 现代地名，如"陕西省西安市临潼区"
  
  // 内容
  summary           String        @db.Text  // 事件摘要（≤500字）
  impact            String?       @db.Text  // 历史影响（≤300字）
  
  // 参与者（JSON 内嵌，不单独建表）
  // 格式：[{ personId, name, roleType, description }]
  actors            Json          @default("[]")
  
  // 来源追踪
  chapterId         String        // 首次提取自哪个章节
  chapter           Chapter       @relation(fields: [chapterId], references: [id])
  relatedParagraphs String[]      // 相关段落 ID 列表
  
  // 状态和元数据
  status            ContentStatus @default(DRAFT)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  @@index([name])
  @@index([type])
  @@index([chapterId])
  @@index([timeRangeStart])
}

enum EventType {
  MILITARY   // 军事事件（战役、会战）
  POLITICAL  // 政治事件（政变、联盟、封赏）
  DIPLOMATIC // 外交事件（会盟、谈判）
  PERSONAL   // 人物事件（出生、死亡、婚姻）
  ECONOMIC   // 经济事件（改革、灾荒）
  CULTURAL   // 文化事件（著作、学术）
  OTHER      // 其他
}

enum TimePrecision {
  EXACT_DATE  // 精确到日
  MONTH       // 精确到月
  SEASON      // 精确到季节
  YEAR        // 精确到年
  DECADE      // 精确到十年
  APPROXIMATE // 约（不确定）
}
```

#### Event.actors 字段格式

```typescript
interface EventActor {
  personId: string       // 关联的 Person ID（可能为空，表示未匹配）
  name: string           // 人物名称（用于显示和匹配）
  roleType: ParticipantRole  // 在事件中的角色
  description?: string   // 在此事件中的具体表现（≤200字）
}

enum ParticipantRole {
  PROTAGONIST = 'PROTAGONIST'  // 主角/主导者
  ALLY = 'ALLY'               // 盟友/支持者
  OPPOSING = 'OPPOSING'       // 对立方/敌对者
  ADVISOR = 'ADVISOR'         // 谋士/顾问
  EXECUTOR = 'EXECUTOR'       // 执行者
  OBSERVER = 'OBSERVER'       // 旁观者/见证者
  OTHER = 'OTHER'             // 其他
}
```

#### Event 示例数据

```json
{
  "id": "event_hongmen",
  "name": "鸿门宴",
  "type": "POLITICAL",
  "timeRangeStart": "前206年12月",
  "timeRangeEnd": null,
  "timePrecision": "MONTH",
  "locationName": "鸿门",
  "locationModernName": "陕西省西安市临潼区",
  "summary": "项羽在鸿门设宴邀请刘邦，范增多次示意项庄舞剑刺杀刘邦，但项羽犹豫不决。张良召樊哙闯帐，刘邦借故如厕逃脱，从间道回军营。",
  "impact": "刘邦成功脱险，保存实力。楚汉矛盾公开化，为日后楚汉战争埋下伏笔。",
  "actors": [
    { "personId": "person_liubang", "name": "刘邦", "roleType": "PROTAGONIST", "description": "率军赴宴，化解危机，借故脱身" },
    { "personId": "person_xiangyu", "name": "项羽", "roleType": "OPPOSING", "description": "设宴试探，态度犹豫，最终未动手" },
    { "personId": "person_fanzeng", "name": "范增", "roleType": "ADVISOR", "description": "多次示意杀刘邦，未果" },
    { "personId": "person_zhangliang", "name": "张良", "roleType": "ADVISOR", "description": "辅助刘邦化解危机" },
    { "personId": "person_fankuai", "name": "樊哙", "roleType": "EXECUTOR", "description": "闯帐护主" }
  ],
  "chapterId": "chapter_gaozu",
  "relatedParagraphs": ["para_15", "para_16", "para_17"],
  "status": "PUBLISHED"
}
```

### 2.4 Person（人物）模型

```prisma
model Person {
  id              String        @id @default(uuid())
  
  // 基本信息
  name            String        // 主要姓名，如"刘邦"
  aliases         String[]      // 别名列表，如["汉高祖", "刘季", "沛公"]
  
  // 角色和阵营
  role            PersonRole    // 角色类型
  faction         Faction       // 所属阵营
  
  // 时间信息（可选）
  birthYear       String?       // 生年，如"前256年"
  deathYear       String?       // 卒年，如"前195年"
  
  // 描述（包含性格、特点、生平，后续可扩展为结构化特质）
  biography       String        @db.Text
  
  // 来源追踪
  sourceChapterIds String[]     // 哪些章节贡献了信息
  
  // 首次出现
  firstAppearanceChapterId    String?
  firstAppearanceParagraphId  String?
  
  // 状态
  status          ContentStatus @default(DRAFT)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  @@index([name])
  @@index([role])
  @@index([faction])
  @@index([status])
}

enum PersonRole {
  MONARCH          // 君主
  ADVISOR          // 谋士
  GENERAL          // 将领
  CIVIL_OFFICIAL   // 文臣
  MILITARY_OFFICIAL // 武将
  RELATIVE         // 外戚
  EUNUCH           // 宦官
  MERCHANT         // 商人
  SCHOLAR          // 学者
  OTHER            // 其他
}

enum Faction {
  HAN      // 汉
  CHU      // 楚
  QIN      // 秦
  WEI      // 魏
  ZHAO     // 赵
  YAN      // 燕
  QI       // 齐
  NEUTRAL  // 中立
  OTHER    // 其他
}
```

#### Person 示例数据

```json
{
  "id": "person_liubang",
  "name": "刘邦",
  "aliases": ["汉高祖", "刘季", "沛公", "汉王"],
  "role": "MONARCH",
  "faction": "HAN",
  "birthYear": "前256年",
  "deathYear": "前195年",
  "biography": "汉朝开国皇帝，沛县丰邑人。性格豁达大度，善于用人，知人善任。早年为沛县亭长，秦末响应陈胜吴广起义，率沛县子弟起兵反秦。后与项羽争霸天下，历经鸿门宴、彭城之战等，最终在垓下击败项羽，建立汉朝。其成功关键在于能够重用萧何、韩信、张良等人才。",
  "sourceChapterIds": ["chapter_gaozu"],
  "firstAppearanceChapterId": "chapter_gaozu",
  "firstAppearanceParagraphId": "para_1",
  "status": "PUBLISHED"
}
```

---

## 3. 关系处理：通过事件推断

### 3.1 核心思路

**不存储独立的 Relationship 表**，而是通过查询"两人共同参与的事件"来推断和展示关系。

```
【传统方式】（复杂，需要维护独立关系表）
刘邦 ──Relationship表──→ 项羽
       type: ALLY
       description: "..."

【简化方式】（通过事件推断）
刘邦 ──参与──→ 巨鹿之战 ←──参与── 项羽  → 推断：盟友
刘邦 ──参与──→ 鸿门宴   ←──参与── 项羽  → 推断：敌意
刘邦 ──参与──→ 垓下之战 ←──参与── 项羽  → 推断：敌对

查询"刘邦和项羽的关系"= 返回他们共同参与的事件列表（按时间排序）
```

### 3.2 关系查询实现

```typescript
// API: GET /api/relationships?personA=xxx&personB=yyy
async function getRelationshipBetween(personAId: string, personBId: string) {
  // 获取人物信息
  const [personA, personB] = await Promise.all([
    prisma.person.findUnique({ where: { id: personAId } }),
    prisma.person.findUnique({ where: { id: personBId } })
  ])
  
  // 获取所有事件
  const allEvents = await prisma.event.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { timeRangeStart: 'asc' }
  })
  
  // 筛选两人共同参与的事件
  const sharedEvents = allEvents.filter(event => {
    const actors = event.actors as EventActor[]
    const hasPersonA = actors.some(a => 
      a.personId === personAId || a.name === personA?.name
    )
    const hasPersonB = actors.some(a => 
      a.personId === personBId || a.name === personB?.name
    )
    return hasPersonA && hasPersonB
  })
  
  // 构建关系时间线
  const timeline = sharedEvents.map(event => {
    const actors = event.actors as EventActor[]
    const personARole = actors.find(a => 
      a.personId === personAId || a.name === personA?.name
    )
    const personBRole = actors.find(a => 
      a.personId === personBId || a.name === personB?.name
    )
    
    return {
      eventId: event.id,
      eventName: event.name,
      time: event.timeRangeStart,
      summary: event.summary,
      personARole: personARole?.roleType,
      personADescription: personARole?.description,
      personBRole: personBRole?.roleType,
      personBDescription: personBRole?.description,
      // 推断关系类型
      inferredRelationType: inferRelationType(personARole?.roleType, personBRole?.roleType)
    }
  })
  
  return {
    personA: { id: personA?.id, name: personA?.name },
    personB: { id: personB?.id, name: personB?.name },
    sharedEventCount: sharedEvents.length,
    timeline
  }
}

// 根据两人在事件中的角色推断关系类型
function inferRelationType(roleA?: string, roleB?: string): string {
  if (!roleA || !roleB) return 'UNKNOWN'
  
  // 简单推断规则
  if (roleA === 'PROTAGONIST' && roleB === 'ALLY') return 'ALLY'
  if (roleA === 'ALLY' && roleB === 'PROTAGONIST') return 'ALLY'
  if (roleA === 'PROTAGONIST' && roleB === 'OPPOSING') return 'ENEMY'
  if (roleA === 'OPPOSING' && roleB === 'PROTAGONIST') return 'ENEMY'
  if (roleA === 'ADVISOR' && roleB === 'PROTAGONIST') return 'SUBORDINATE'
  if (roleA === 'PROTAGONIST' && roleB === 'ADVISOR') return 'SUPERIOR'
  
  return 'RELATED'
}
```

### 3.3 关系查询响应示例

```json
{
  "personA": { "id": "person_liubang", "name": "刘邦" },
  "personB": { "id": "person_xiangyu", "name": "项羽" },
  "sharedEventCount": 5,
  "timeline": [
    {
      "eventId": "event_julu",
      "eventName": "巨鹿之战",
      "time": "前207年",
      "summary": "项羽率军击败秦军主力...",
      "personARole": "ALLY",
      "personBRole": "PROTAGONIST",
      "inferredRelationType": "ALLY"
    },
    {
      "eventId": "event_hongmen",
      "eventName": "鸿门宴",
      "time": "前206年12月",
      "summary": "项羽在鸿门设宴试探刘邦...",
      "personARole": "PROTAGONIST",
      "personBRole": "OPPOSING",
      "inferredRelationType": "ENEMY"
    },
    {
      "eventId": "event_pengcheng",
      "eventName": "彭城之战",
      "time": "前205年",
      "summary": "项羽大败刘邦联军...",
      "personARole": "OPPOSING",
      "personBRole": "PROTAGONIST",
      "inferredRelationType": "ENEMY"
    },
    {
      "eventId": "event_honggou",
      "eventName": "鸿沟和议",
      "time": "前203年",
      "summary": "双方约定以鸿沟为界...",
      "personARole": "PROTAGONIST",
      "personBRole": "PROTAGONIST",
      "inferredRelationType": "RELATED"
    },
    {
      "eventId": "event_gaixia",
      "eventName": "垓下之战",
      "time": "前202年",
      "summary": "刘邦联军围困项羽于垓下...",
      "personARole": "PROTAGONIST",
      "personBRole": "OPPOSING",
      "inferredRelationType": "ENEMY"
    }
  ]
}
```

---

## 4. 章节视角：动态生成

### 4.1 核心思路

**不预存储 ChapterPerson 表**，而是查询时动态生成章节视角信息。

### 4.2 实现方式

```typescript
// API: GET /api/persons/:id?chapterId=xxx
async function getPersonWithChapterContext(personId: string, chapterId?: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId }
  })
  
  if (!person) return null
  
  // 如果没有指定章节，返回全局信息
  if (!chapterId) {
    return { person, chapterContext: null }
  }
  
  // 获取该人物在该章节参与的事件
  const eventsInChapter = await prisma.event.findMany({
    where: {
      chapterId,
      status: 'PUBLISHED'
    },
    orderBy: { timeRangeStart: 'asc' }
  })
  
  // 筛选该人物参与的事件
  const participatedEvents = eventsInChapter.filter(event => {
    const actors = event.actors as EventActor[]
    return actors.some(a => a.personId === personId || a.name === person.name)
  })
  
  // 提取该人物在各事件中的角色
  const eventSummaries = participatedEvents.map(event => {
    const actors = event.actors as EventActor[]
    const role = actors.find(a => a.personId === personId || a.name === person.name)
    return {
      eventId: event.id,
      eventName: event.name,
      roleType: role?.roleType,
      description: role?.description
    }
  })
  
  // 生成章节视角摘要（可以用 LLM 动态生成，或简单拼接）
  const summaryInChapter = generateChapterSummary(person, eventSummaries)
  
  return {
    person,
    chapterContext: {
      chapterId,
      eventCount: participatedEvents.length,
      events: eventSummaries,
      summaryInChapter
    }
  }
}

function generateChapterSummary(person: Person, events: EventSummary[]): string {
  if (events.length === 0) {
    return `${person.name}在本章中被提及。`
  }
  
  const eventNames = events.map(e => e.eventName).join('、')
  const mainRole = events[0].roleType === 'PROTAGONIST' ? '主角' : '参与者'
  
  return `${person.name}在本章中作为${mainRole}参与了${eventNames}等事件。`
}
```

---

## 5. 数据提取流程

### 5.1 整体流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MVP 数据提取与发布流程                              │
└─────────────────────────────────────────────────────────────────────────┘

原始文本 ──▶ 预处理 ──▶ 上传章节 ──▶ LLM 提取 ──▶ 审核 ──▶ 发布
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │     提取结果 (ReviewItem)     │
                         ├──────────────────────────────┤
                         │ • Event（事件，含内嵌 actors）│
                         │ • Person（人物）              │
                         └──────────────────────────────┘
                                        │
                                   审核通过
                                        ▼
                         ┌──────────────────────────────┐
                         │     发布处理                  │
                         ├──────────────────────────────┤
                         │ • 创建/更新 Event            │
                         │ • 创建/更新 Person           │
                         │ • 对齐 Event.actors.personId │
                         └──────────────────────────────┘
```

### 5.2 LLM 提取提示词

#### 事件提取

```
你是历史事件抽取助手。请从以下章节文本中提取所有重要历史事件。

对于每个事件，请提供：

1. **基本信息**
   - name: 事件名称（简洁，如"鸿门宴"）
   - type: 事件类型（MILITARY/POLITICAL/DIPLOMATIC/PERSONAL/ECONOMIC/CULTURAL/OTHER）
   - timeRangeStart: 开始时间（如"前206年12月"，不确定则写"约前206年"）
   - timeRangeEnd: 结束时间（如适用）
   - timePrecision: 时间精度（EXACT_DATE/MONTH/SEASON/YEAR/DECADE/APPROXIMATE）

2. **地点信息**
   - locationName: 历史地名（如"鸿门"）
   - locationModernName: 现代地名（如知道，如"陕西省西安市临潼区"）

3. **参与者**（列出所有重要参与者）
   - actors: [
       { 
         name: "人物名称（使用最常见的称呼）", 
         roleType: "PROTAGONIST/ALLY/OPPOSING/ADVISOR/EXECUTOR/OBSERVER/OTHER",
         description: "该人物在此事件中的具体表现（≤100字）"
       }
     ]

4. **内容**
   - summary: 事件摘要（≤400字，要点式）
   - impact: 历史影响（≤200字）
   - relatedParagraphs: ["para_1", "para_2"] // 相关段落 ID

输出格式（JSON）：
{
  "events": [...],
  "truncatedEvents": ["被截断的事件名称（如有）"]
}

约束：
- 每次最多提取 30 个事件，按重要性排序
- 确保每个事件至少有 1 个参与者
- 人物名称使用最常见的称呼（如"刘邦"而非"高祖"）
- 不确定的信息留空，不要杜撰
- 只输出 JSON，不要其他文字

已知人物列表（优先匹配这些名称）：
${existingPersons.map(p => `- ${p.name}${p.aliases.length ? ` (${p.aliases.join(', ')})` : ''}`).join('\n')}

章节文本：
${chapterText}
```

#### 人物补全提取

```
你是历史人物信息补全助手。基于以下章节文本和已提取的事件，为每个人物补全详细信息。

输入：
- 章节：${chapterTitle}
- 已提取的事件中出现的人物：${personNames.join(', ')}

对于每个人物，请提供：
- name: 主要名称
- aliases: 别名数组（如["汉高祖", "刘季", "沛公"]）
- role: 角色类型（MONARCH/ADVISOR/GENERAL/CIVIL_OFFICIAL/MILITARY_OFFICIAL/RELATIVE/EUNUCH/MERCHANT/SCHOLAR/OTHER）
- faction: 所属阵营（HAN/CHU/QIN/WEI/ZHAO/YAN/QI/NEUTRAL/OTHER）
- birthYear: 生年（如"前256年"，不确定则留空）
- deathYear: 卒年（如"前195年"，不确定则留空）
- biography: 人物简介（≤300字，包含：身份背景、主要事迹、性格特点）

输出格式（JSON）：
{
  "persons": [...]
}

约束：
- biography 应包含该人物的性格特点（如"豁达大度"、"善于用人"）
- biography 应基于本章节内容，不要包含本章节之后的事迹
- 不确定的信息留空，不要杜撰
- 只输出 JSON，不要其他文字

章节文本：
${chapterText}
```

### 5.3 实体对齐

提取完成后，需要将 Event.actors 中的人物名称对齐到已有的 Person 记录：

```typescript
async function alignEventActors(events: ExtractedEvent[], existingPersons: Person[]) {
  for (const event of events) {
    event.actors = event.actors.map(actor => {
      // 尝试匹配已有人物
      const matchedPerson = existingPersons.find(p => 
        p.name === actor.name || 
        p.aliases.includes(actor.name)
      )
      
      return {
        ...actor,
        personId: matchedPerson?.id || null
      }
    })
  }
  return events
}
```

---

## 6. API 设计

### 6.1 事件 API

```
# 获取事件列表
GET /api/events?chapterId=xxx&type=MILITARY&page=1&pageSize=20

# 获取事件详情
GET /api/events/:id

# 创建事件（管理）
POST /api/admin/events

# 更新事件（管理）
PUT /api/admin/events/:id

# 删除事件（管理）
DELETE /api/admin/events/:id
```

### 6.2 人物 API

```
# 获取人物列表
GET /api/persons?chapterId=xxx&faction=HAN&role=GENERAL&page=1&pageSize=20

# 获取人物详情（支持章节视角）
GET /api/persons/:id?chapterId=xxx

# 获取人物参与的事件
GET /api/persons/:id/events?chapterId=xxx

# 创建人物（管理）
POST /api/admin/persons

# 更新人物（管理）
PUT /api/admin/persons/:id
```

### 6.3 关系 API（动态推断）

```
# 获取两人之间的关系（通过共同事件推断）
GET /api/relationships?personA=xxx&personB=yyy

# 获取某人的所有关系（查找共同事件）
GET /api/persons/:id/relationships?limit=10
```

### 6.4 章节提取 API

```
# 触发章节提取
POST /api/admin/chapters/:id/extract

请求体:
{
  "options": {
    "maxEvents": 30,
    "includePersonCompletion": true
  }
}

响应:
{
  "success": true,
  "results": {
    "events": [...],
    "persons": [...]
  },
  "reviewItems": [...],
  "meta": {
    "processingTime": 15000,
    "tokenUsage": 4500
  }
}
```

---

## 7. 审核流程

### 7.1 ReviewItem 类型

MVP 阶段需要三种 ReviewItem 类型：

```prisma
enum ReviewItemType {
  EVENT   // 事件
  PERSON  // 人物
  PLACE   // 地点
}
```

**说明**：
- **EVENT**：事件信息，包含参与者、地点、时间等
- **PERSON**：人物信息，包含别名、角色、传记等
- **PLACE**：地点信息，包含坐标、现代位置、地理背景等（类似 Person，信息关键且需要跨章节聚合）

### 7.2 审核界面

#### 事件审核卡片

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 事件 #1/15                                                      [PENDING]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 【基本信息】                                                            │
│ 事件名称: [鸿门宴                    ]                                  │
│ 类型:     [POLITICAL ▼]                                                │
│ 时间:     [前206年12月    ] 精度: [MONTH ▼]                            │
│ 地点:     [鸿门          ] → 现代: [陕西省西安市临潼区]                │
│                                                                         │
│ 【参与者】                                                              │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 姓名     │ 角色       │ 描述                              │ 操作  │ │
│ ├──────────┼────────────┼───────────────────────────────────┼───────┤ │
│ │ 刘邦     │ PROTAGONIST│ 率军赴宴，化解危机，成功脱身      │ [编辑]│ │
│ │ 项羽     │ OPPOSING   │ 设宴试探，态度犹豫                │ [编辑]│ │
│ │ 范增     │ ADVISOR    │ 多次示意杀刘邦，未果              │ [编辑]│ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ [+ 添加参与者]                                                          │
│                                                                         │
│ 【事件摘要】                                                            │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ [多行文本编辑器]                                                    │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ 【历史影响】                                                            │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ [多行文本编辑器]                                                    │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│                           [✓ 通过] [✗ 拒绝] [💾 保存修改]              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. 实施路径

### 8.1 Phase 1：MVP 重构（2-3 周）

**目标**：实现极简双表模型，替换现有实现

**任务**：
1. 创建新的 Prisma schema（Event、Person）
2. 重写 LLMExtractor（事件中心提取）
3. 更新审核流程（支持 Event 审核）
4. 实现关系动态推断 API
5. 迁移现有数据（可选）

**产出**：
- 新的数据模型
- 新的提取 API
- 新的审核页面

### 8.2 Phase 2：功能完善（1-2 周）

**目标**：完善用户体验

**任务**：
1. 实现章节视角动态生成
2. 优化关系查询性能
3. 更新前端人物详情页
4. 更新前端关系展示

**产出**：
- 完整的 API
- 更新的前端页面

### 8.3 后续扩展路径

```
MVP (2个表)                  Phase 3                    Phase 4
─────────────────────────────────────────────────────────────────────
Event                        → + 地点独立表             → + 时间线可视化
  actors: JSON 内嵌            (Place)                    
  location: JSON 内嵌                                   

Person                       → + 人物特质结构化         → + AI 人物分析
  biography: 文本              (PersonTraits)

关系：动态推断               → + RelationshipCache     → + 关系图谱可视化
                               (缓存热点关系)
```

### 8.4 时间线总结

```
Week 1:    数据模型迁移 + LLMExtractor 重写
Week 2:    审核流程更新 + 关系 API 实现
Week 3:    前端适配 + 测试优化
Week 4:    （可选）章节视角完善 + 性能优化
```

总计：约 3-4 周

---

## 9. 附录

### 9.1 术语表

| 术语 | 定义 |
|------|------|
| 事件中心 | 以事件为数据组织的核心单位 |
| 动态推断 | 查询时计算，而非预存储 |
| JSON 内嵌 | 将关联数据存储为 JSON 字段，减少表数量 |
| 章节视角 | 从特定章节的角度描述人物信息 |

### 9.2 与旧方案的对比

| 方面 | 旧方案（v2.0） | MVP 方案（v3.0） |
|------|---------------|------------------|
| 核心表数量 | 6-7 个 | 2 个 |
| 关系存储 | 独立 Relationship 表 | 通过事件推断 |
| 参与者存储 | EventParticipant 表 | JSON 内嵌 |
| 章节视角 | ChapterPerson 表 | 动态生成 |
| 复杂度 | 高 | 低 |
| 扩展性 | 固定结构 | 灵活扩展 |

### 9.3 相关文档

- [历史阅读增强 App 产品规格书](./reading-app-spec.md)
- [数据获取与融合规格书 v2.0](./data-acquisition-and-merge-spec.md)（本文档替代）

---

**最后更新**：2024-12-10
**版本**：3.0 (MVP 精简版)

## 更新日志

### v3.0 (2024-12-10) - MVP 精简版

**设计原则**：
- ✅ Simple first, extend later
- ✅ 极简双表模型（Event + Person）
- ✅ 关系通过事件推断，不单独存储
- ✅ JSON 内嵌减少表数量
- ✅ 动态生成优先于预存储

**架构变更**：
- 删除 Relationship、EventRelationship 表 → 通过事件推断
- 删除 EventParticipant 表 → JSON 内嵌到 Event.actors
- 删除 ChapterPerson 表 → 动态生成
- 删除 RelationshipSummary 表 → 查询时聚合
- 简化 Place → JSON 内嵌到 Event

**实施计划**：
- MVP 重构：2-3 周
- 功能完善：1-2 周
- 为后续扩展预留空间
