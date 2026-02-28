# 地图模式设计

> **文档目的**：定义阅读页「地图模式」功能的完整设计，包括阅读/地图模式切换、地图展示所有事件地点、前后事件导航、与事件列表的联动等。

**版本**：v1.0  
**最后更新**：2026-02-27

---

## 1. 概述

### 1.1 背景与目标

| 问题 | 现状 | 目标 |
|------|------|------|
| 空间感知缺失 | 阅读时事件发生地点分散，读者难以形成地域脉络 | 提供地图视角，直观看到事件的地理分布与顺序 |
| 单一阅读视角 | 只有正文+事件列表的线性阅读 | 支持在地图模式下按空间浏览事件 |
| 事件与地点关系 | 地点散落在事件卡片中，需逐条点击 | 地图一次性展示本章所有有地点的事件 |

### 1.2 功能目标

1. **模式切换**：通过 SegmentedControl 在「阅读模式」与「地图模式」间切换
2. **地图主视图**：在地图模式下，正文区域被大尺寸地图取代，右侧保留事件列表
3. **事件序号标注**：地图上展示所有有地点的事件，按事件顺序标号（1、2、3…），一事件多地点共用同一序号
4. **前后事件导航**：地图右上角提供「上一个/下一个」事件控制，方便逐步浏览
5. **与事件列表联动**：当前高亮事件在右侧列表自动滚动到可见位置，并高亮边框
6. **无地点事件**：无 `locationName` 的事件在地图模式中跳过（不参与序号、不显示在地图上）

---

## 2. 布局设计

### 2.1 顶部模式切换（SegmentedControl）

在阅读页**顶部导航栏**（Breadcrumbs 右侧、开关组左侧）增加模式切换：

```
[ 阅读模式 ] [ 地图模式 ]
```

- **阅读模式**（默认）：保持现有布局，正文 + 信息面板
- **地图模式**：正文区域变为大地图，信息面板仍保留且默认显示事件 tab

### 2.2 地图模式下的主布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  返回 |  breadcrumb  | [阅读|地图] | 翻译 高亮 | 面板折叠                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                    │                                         │
│   ┌─────────────────────────┐      │   ┌─────────────────────────────┐       │
│   │                         │      │   │  事件 | 人物                 │       │
│   │                         │      │   ├─────────────────────────────┤       │
│   │      地   图            │      │   │  共 X 个事件  [精简|中等|详细]│       │
│   │                         │      │   │                             │       │
│   │   ① ②    ③             │      │   │  • 事件1 (高亮边框)          │       │
│   │        ④               │      │   │  • 事件2                     │       │
│   │                         │      │   │  • 事件3                     │       │
│   │  [上一个] [下一个]       │      │   │  ...                         │       │
│   └─────────────────────────┘      │   └─────────────────────────────┘       │
│                                    │                                         │
│   (地图占原正文区域，比例约 2:1)      │   (事件列表，与阅读模式一致)               │
└─────────────────────────────────────────────────────────────────────────────┘
```

- 左侧：大地图（原正文 Card 区域），高度占满可用空间
- 右侧：InfoPanel 不变，仍包含「事件」「人物」tab
- 地图模式默认聚焦事件 tab，便于与地图联动

---

## 3. 地图展示设计

### 3.1 数据过滤

从 `events`（已按章节+importance 筛选）中过滤出「有地点」的事件：

```typescript
// 有地点的事件：locationName 非空
const eventsWithLocation = events.filter(e => e.locationName?.trim())
```

- 过滤后的列表按**原有事件顺序**排序（与 EventTimeline 一致）
- 地图上显示的事件序号 = 在 `eventsWithLocation` 中的索引 + 1

### 3.2 地点解析与地理编码

- **解析**：`locationName` 可能包含多个地点，逗号分隔，如 `"鸿门, 新丰"`，需按 `[,，]` 拆分
- **地理编码**：复用 `searchLocation(name, event.timeRangeStart)` API
- 一个事件若有多个地点（如鸿门宴涉及多个地点），所有 marker 共用**同一个序号**
- 无地点或地理编码失败的事件：从 `eventsWithLocation` 中排除（或 marker 不显示，但序号逻辑需统一：建议统一过滤）

**建议**：只对「至少有一个地点能成功地理编码」的事件参与地图展示，否则不参与序号。

### 3.3 Marker 序号与样式

| 元素 | 说明 |
|------|------|
| 序号标签 | 1、2、3… 阿拉伯数字，显示在 marker 上 |
| **等级颜色** | 按事件 importance 区分：L1=红、L2=橙、L3=灰，与事件列表卡片中的 Badge 颜色一致 |
| 当前高亮 | 当前选中的事件的 marker 使用更大尺寸/加粗边框，颜色仍按 importance 保持 |
| 多地点同号 | 同一事件的多个地点，所有 marker 显示相同序号和颜色 |

**等级颜色映射**（与 EventTimeline 中 importance Badge 一致）：

| importance | 颜色 | 说明 |
|------------|------|------|
| L1 | 红 (`red`) | 核心事件 |
| L2 | 橙 (`orange`) | 重要事件 |
| L3 及其他 | 灰 (`gray`) | 一般/次要 |

### 3.4 地图初始视野

- 若有 marker：`fitBounds` 包含所有 marker，并留适当 padding
- 若无 marker：使用默认中心（如中国中心 `lat: 35, lng: 105`）和合适 zoom

### 3.5 Marker 交互

- **点击 marker**：选中对应事件，更新「当前高亮」；右侧事件列表滚动到该事件并高亮
- **点击 InfoWindow**：可展示事件名称、时间、摘要摘要，提供「查看详情」跳转

---

## 4. 前后事件导航

### 4.1 位置与样式

在地图容器**右上角**（叠加在地图之上），放置导航控制：

```
                    [ 上一个 ] [ 下一个 ]
```

- 使用 SegmentedControl 或两个按钮并排
- 半透明背景，确保在地图上可读

### 4.2 行为

| 操作 | 行为 |
|------|------|
| 上一个 | 将「当前高亮事件」设为 `eventsWithLocation` 中前一个；若已是第一个则禁用或循环 |
| 下一个 | 将「当前高亮事件」设为 `eventsWithLocation` 中后一个；若已是最后一个则禁用或循环 |

**推荐**：首/尾时按钮禁用（灰色），不做循环，逻辑更清晰。

### 4.3 联动效果

- 地图：当前事件的 marker 高亮，并 `panTo` 将地图中心移至该事件（若多地点则取第一个或中心）
- 事件列表：滚动到对应事件项，并加高亮边框（与阅读模式中 `selectedEventId` 的高亮一致）

---

## 5. 事件列表联动

### 5.1 滚动与高亮

- `selectedEventId` 由 ReadingPage 管理，地图模式和阅读模式共用
- 地图模式下：
  - 用户点击 marker 或使用「上一个/下一个」→ 更新 `selectedEventId`
  - EventTimeline 已有 `useEffect` 监听 `selectedEventId`，会 `scrollIntoView`
  - 高亮样式：`backgroundColor`、`borderColor` 与阅读模式一致（当前已实现）

### 5.2 点击列表项

- 用户点击右侧事件列表中的事件 → `onEventClick` → 更新 `selectedEventId`
- 地图需响应：若该事件有地点，地图 `panTo` 到该事件，并高亮对应 marker
- **双向联动**：列表 ↔ 地图 保持同步

### 5.3 事件无地点时的处理

- 无地点事件不在地图上显示
- 若用户从列表点击了「无地点事件」：地图无变化，仅列表高亮；「上一个/下一个」基于 `eventsWithLocation`，不会跳到无地点事件
- 可选：在事件列表中对无地点事件加小标识（如「无地点」），提示用户该事件不在地图模式中展示

---

## 6. 数据流与状态

### 6.1 状态定义

| 状态 | 类型 | 说明 |
|------|------|------|
| `viewMode` | `'reading' \| 'map'` | 阅读/地图模式 |
| `selectedEventId` | `string \| null` | 当前选中的事件（两种模式共用） |
| `events` | `Event[]` | 章节事件（含 importance 筛选） |
| `eventsWithLocation` | `Event[]` | 派生：有地点且至少一个能地理编码的事件 |

### 6.2 组件职责

| 组件 | 职责 |
|------|------|
| **ReadingPage** | 管理 `viewMode`、`selectedEventId`；根据 `viewMode` 渲染正文或 `ChapterMapView` |
| **ChapterMapView**（新建） | 接收 `events`、`selectedEventId`、`onEventSelect`；负责地图渲染、前后导航、marker 点击 |
| **EventTimeline** | 保持不变，接收 `selectedEventId`，滚动与高亮已有 |
| **EventLocationsMap** | 现有单事件地图，可复用其中的 `parseLocations`、`searchLocation` 逻辑；ChapterMapView 独立实现批量地理编码与多事件展示 |

---

## 7. API 与数据

### 7.1 已有能力

- `getEventsByChapter(chapterId, { importance })`：获取章节事件
- `Event.locationName`：事件地点，可能为 `"地点A, 地点B"` 格式
- `searchLocation(name, year)`：地理编码，返回 `LocationSearchResult` 含 `coordinates`

### 7.2 地理编码策略

- **按需请求**：进入地图模式时，对 `eventsWithLocation` 的每个地点调用 `searchLocation`
- **缓存**：使用 `useQueries` 或 React Query，按 `[name, year]` 缓存，避免重复请求
- **去重**：多个事件可能引用同一地名，相同 `(name, year)` 只请求一次
- **加载态**：地理编码进行中时，地图显示 Loading；部分完成时，已有点先展示

### 7.3 无 Google Maps API Key 时

- 若 `VITE_GOOGLE_MAPS_API_KEY` 未配置：地图模式可隐藏或禁用，或显示「请配置地图 API Key」提示
- 与现有 `EventLocationsMap` 行为一致

---

## 8. 技术实现要点

### 8.1 新建组件

- **ChapterMapView**：章节级地图
  - Props：`events: Event[]`、`selectedEventId`、`onEventSelect`
  - 内部：过滤有地点事件 → 批量地理编码 → 渲染 Google Map + 带序号 Marker
  - 右上角：上一个/下一个按钮

### 8.2 复用与扩展

- 复用 `EventLocationsMap` 中的 `parseLocations`、`useJsApiLoader`、`searchLocation` 用法
- `LocationSearchResult` 与 `searchLocation` 接口保持不变

### 8.3 序号与 event 映射

```typescript
// 建立「地图序号」到 event 的映射
const eventIndexMap = new Map<number, Event>()
eventsWithLocation.forEach((event, idx) => {
  eventIndexMap.set(idx + 1, event)
})
// currentIndex 用于「上一个/下一个」
const currentIndex = eventsWithLocation.findIndex(e => e.id === selectedEventId)
```

---

## 9. 边界情况

| 情况 | 处理 |
|------|------|
| 章节无事件 | 地图显示空状态，如「本章暂无事件」 |
| 所有事件无地点 | 地图显示空状态，如「本章事件均无地点信息」 |
| 地理编码全失败 | 同上 |
| 仅 1 个事件有地点 | 正常显示，前后按钮均禁用 |
| 切换回阅读模式 | `selectedEventId` 保留，正文滚动到对应段落（若有关联） |

---

## 10. 实施优先级与依赖

| 优先级 | 任务 | 依赖 | 预估 |
|--------|------|------|------|
| P0 | 顶部 SegmentedControl（阅读/地图模式） | 无 | 0.5 天 |
| P0 | ReadingPage 根据 viewMode 切换正文/地图区域 | P0 | 0.5 天 |
| P1 | ChapterMapView 基础：过滤有地点事件、批量地理编码、地图 + Marker | EventLocationsMap 可参考 | 1–2 天 |
| P1 | Marker 序号、等级颜色、当前高亮样式 | P1 | 0.5 天 |
| P1 | 地图右上角「上一个/下一个」导航 | P1 | 0.5 天 |
| P2 | 事件列表与地图双向联动（点击列表 → 地图 panTo） | 已有 selectedEventId 联动 | 0.5 天 |
| P2 | 无地点事件的列表展示优化（可选标识） | 无 | 0.5 天 |

---

## 11. 附录

### 11.1 与现有组件衔接

- **ReadingPage**：新增 `viewMode` state，顶部增加 SegmentedControl；主内容区根据 `viewMode` 渲染 `<ChapterContent />` 或 `<ChapterMapView />`
- **InfoPanel / EventTimeline**：无需改动，已支持 `selectedEventId` 滚动与高亮
- **EventLocationsMap**：保留，用于事件详情弹窗等地；ChapterMapView 为独立组件

### 11.2 地图 Marker 等级颜色常量（实现参考）

```typescript
// 与 EventTimeline importance Badge 保持一致
const importanceMarkerColors: Record<string, string> = {
  L1: 'red',      // 核心
  L2: 'orange',   // 重要
  L3: 'gray',    // 一般
}
// 无 importance 或 L4/L5 等默认用 gray
```

### 11.3 可选增强（后续迭代）

- 地图上绘制事件之间的连线（表示人物/军队移动轨迹）
- 地图类型切换（标准/卫星/地形）
- 导出本章事件地理数据为 GeoJSON
