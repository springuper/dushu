# 地点坐标准确性分析

> 针对「鸿门」「蓝田」等历史地名在地图上显示错误位置的问题分析

**日期**：2026-02-27

---

## 1. 问题现象

| 地点 | 显示位置 | 正确位置（史记楚汉战争语境） |
|------|----------|------------------------------|
| 鸿门 | 榆林更北（陕北） | 西安临潼附近（鸿门宴遗址） |
| 蓝田 | 福建 | 陕西西安东南（蓝田县） |

---

## 2. 根本原因分析

### 2.1 同名异地（多义地名）

中国历史地名存在大量「同名不同地」：

- **鸿门**：
  - 鸿门宴之「鸿门」：戏西的小地名（鸿门堡/寨），今西安临潼区，约 109.2°E, 34.4°N
  - CHGIS 中的「鸿门县」：河西郡下属县，约 110.28°E, 38.80°N，在陕北榆林以北
  - 两者完全不同，但名称相似

- **蓝田**：
  - 陕西蓝田县：京兆尹辖县，今西安东南，约 109.15°E, 34.24°N
  - 福建等地有蓝田镇、蓝田乡等
  - 楚汉战争语境下应为陕西蓝田

### 2.2 CHGIS 数据局限

**鸿门**：实测 CHGIS `n=鸿门`（无年份）返回鸿门县（河西郡，陕北）。鸿门宴发生地「鸿门堡」不在 CHGIS 中。

**蓝田**：**根因已确认**（见下节）。

### 2.3 蓝田根因（已查库确认）

经查数据库 ChangeLog 和 CHGIS API：

| 证据 | 说明 |
|------|------|
| 创建时数据 | coordinates: 116.22804, 23.68785；modernLocation: 潮州府 (Chaozhou Fu) |
| source | HYBRID（CHGIS + LLM），但 chgisId 为 null |
| 坐标+格式 | 与 CHGIS 潮州府蓝田（村镇, 1820年）完全一致 |

**CHGIS 实测**：
- `n=蓝田`**无年份**：返回 26 条，`results[0]` = 潮州府蓝田（116.23, 23.69）✓ 与错误数据一致
- `n=蓝田&yr=-207`：仅返回 1 条 = 京兆尹蓝田县（109.15, 34.24）✓ 正确

**结论**：提取时 CHGIS 请求**未带上年份参数**（或年份解析失败）。无年份时 CHGIS 返回多条结果，`llmExtractor.ts` 用 `results[0]` 取第一条，恰好是潮州府的蓝田村镇（粤东，用户感知为「福建」附近），而非陕西蓝田县。

### 2.4 数据库查询无歧义消除

`backend/src/routes/locations.ts` 中的查询逻辑：

```typescript
let place = await prisma.place.findFirst({
  where: {
    OR: [
      { name: searchName },
      { aliases: { has: searchName } },
    ],
  },
})
```

存在的问题：

1. **无 `orderBy`**：`findFirst` 返回任意一条匹配记录
2. **无 chapterId**：不按章节筛选，无法利用上下文
3. **无 year 约束**：不按时代筛选
4. **无 region 约束**：不按 modernLocation/adminLevel1 过滤

当数据库中有多条「鸿门」或「蓝田」时，可能返回与当前书本/事件无关的一条。

### 2.5 数据来源与错误 propagation

Place 数据可能来自：

1. **LLM 提取 + CHGIS**：`llmExtractor.ts` 中 `const result = results[0]`，对 CHGIS 多结果未做筛选
2. **仅 LLM**：无 CHGIS 时，LLM 可能把「蓝田」对应到福建等其他地区
3. **审核流程**：Review 通过后写入 DB，错误会被固化

---

## 3. 改进方案

### 3.1 短期：修正现有错误数据（推荐）

在管理后台或通过脚本，对已知错误地点做人工修正：

| 地名 | 正确坐标 (lng, lat) | 现代位置 |
|------|---------------------|----------|
| 鸿门 | 109.21, 34.38 | 陕西省西安市临潼区鸿门宴遗址 |
| 蓝田 | 109.15, 34.24 | 陕西省西安市蓝田县 |

### 3.2 中期：增强 locations API 歧义消除

**方案 A：传入 chapterId，优先同章地点**

```typescript
// GET /api/locations/search?name=鸿门&year=前206&chapterId=xxx
// 1. 先查同 chapter 的 Place
// 2. 若无，再查全书其他 Place
// 3. 可按 modernLocation 过滤（如含「陕西」「西安」）
```

**方案 B：利用 modernLocation / adminLevel1 做区域过滤**

- 若事件发生地已知在关中（如咸阳、戏、霸上），可优先选择 modernLocation 含「陕西」「西安」「临潼」等的记录

### 3.3 长期：CHGIS 多结果智能选择

在 `llmExtractor.ts` 的 `queryCHGIS` 中：

1. 当 `results.length > 1` 时，不直接取 `results[0]`
2. 结合书本时空范围（如楚汉战争：关中、中原、彭城等）做筛选
3. 优先选择 `parent name` 含「京兆」「内史」「三辅」等关中相关词的记录
4. 对鸿门、蓝田等建立**别名/歧义表**，显式映射到正确 CHGIS 记录或坐标

### 3.4 建立「同名异地」知识表

维护一个 `place_disambiguation` 表或 JSON 配置：

```json
{
  "鸿门": {
    "contextKeywords": ["鸿门宴", "戏", "项羽", "刘邦", "楚汉"],
    "preferredCoordinates": { "lng": 109.21, "lat": 34.38 },
    "preferredModernLocation": "陕西省西安市临潼区",
    "avoidChgisIds": ["hvd_70435"]
  },
  "蓝田": {
    "contextKeywords": ["刘邦", "秦军", "关中", "京兆"],
    "preferredChgisId": "hvd_70749",
    "preferredCoordinates": { "lng": 109.15, "lat": 34.24 }
  }
}
```

在提取与查询时优先使用该表，再回退到 CHGIS / 数据库。

---

## 4. 实施优先级建议

| 优先级 | 任务 | 预估 | 说明 |
|--------|------|------|------|
| P0 | 人工修正鸿门、蓝田等已知错误坐标 | 0.5h | 最快见效 |
| P1 | locations API 支持 chapterId，同章优先 | 1d | 需前端传入 chapterId |
| P2 | 建立 place_disambiguation 配置并接入 | 1d | 可逐步扩充 |
| P3 | CHGIS 多结果智能筛选逻辑 | 2d | 需历史地理知识规则 |

---

## 5. 参考

- CHGIS 鸿门县：https://chgis.hudci.org/tgaz/placename/hvd_70435
- CHGIS 蓝田县：https://chgis.hudci.org/tgaz/placename/hvd_70749
- 《史记》鸿门宴发生地：戏西鸿门，今西安市临潼区新丰街道鸿门堡村
