# 地点地图展示功能规格书

> **文档目的**：定义地点地图展示功能的用户价值、技术方案与实施计划，为开发团队提供统一的交付目标与验收依据。

---

## 1. 背景与目标

### 1.1 项目背景

在阅读历史文本时，地理位置的缺失是理解历史事件的重要障碍。读者往往需要：
- 了解事件发生地的具体位置
- 理解地理因素对历史事件的影响
- 构建空间维度的历史认知

当前系统虽然存储了事件的地点信息（`locationName`、`locationModernName`），但缺乏直观的地图可视化，用户无法快速建立地理空间认知。

### 1.2 产品愿景对齐

引用《历史阅读增强 App 产品规格书》：

> "让读者在阅读经典历史时，实时获得人物、地理、关系与事件的全景 context，像和历史导师对话一样深入理解背景。"

本功能通过地图可视化，增强用户对历史事件地理维度的理解，完善"全景 context"中的地理信息。

### 1.3 MVP 范围

**Phase 1（MVP）**：
- 支持事件中的地点展示
- 点击事件地点名称，在弹窗中显示 Google Maps
- 使用 CHGIS API 查询历史地名坐标
- 仅支持阅读页面的事件时间轴交互

**Phase 2（后续扩展）**：
- 地图模式：在阅读页面新增"地图"标签页
- 显示当前章节所有事件的地点标注
- 支持时间轴筛选，动态显示不同时期的事件
- 支持地点聚合（同一地点的多个事件）

---

## 2. 目标用户与场景

### 2.1 使用场景

1. **阅读事件时查看地点**
   - 用户在事件时间轴中看到"鸿门宴"事件，地点为"鸿门"
   - 用户点击地点名称，弹出地图窗口
   - 地图显示"鸿门"的现代位置（陕西省西安市临潼区）
   - 用户可以缩放、拖拽地图，查看周边地理环境

2. **理解地理关系**
   - 用户阅读楚汉战争相关事件
   - 通过地图查看"彭城"、"垓下"等地点位置
   - 理解刘邦、项羽的军事行动路线

3. **验证历史地名**
   - 用户对某个历史地名的现代位置有疑问
   - 通过地图查看，确认地名的准确性

### 2.2 用户价值

- **空间认知**：快速建立历史事件的地理空间认知
- **理解深度**：通过地理因素理解历史事件的背景
- **验证准确性**：验证历史地名的现代位置

---

## 3. 技术方案

### 3.1 数据源：CHGIS Temporal Gazetteer API

**API 文档**：https://chgis.hudci.org/tgw/

**核心功能**：
- 支持历史地名搜索（UTF-8 编码，支持中文）
- 支持按年份查询（-222 到 1911）
- 返回历史地名的现代坐标和名称

**API 端点**：

1. **Faceted Search**（推荐）
   ```
   GET http://maps.cga.harvard.edu/tgaz/placename?n={地名}&yr={年份}&fmt=json
   ```

2. **Canonical Placename**（已知 ID）
   ```
   GET http://maps.cga.harvard.edu/tgaz/placename/{UNIQUE_ID}?fmt=json
   ```

**查询示例**：
```
GET http://maps.cga.harvard.edu/tgaz/placename?n=鸿门&yr=前206&fmt=json
```

**响应格式**（JSON）：
```json
{
  "results": [
    {
      "id": "hvd_70435",
      "name": "鸿门县",
      "begin": "-190",
      "end": "29",
      "coordinates": [110.27951, 38.80217],
      "feature_type": "xian"
    }
  ]
}
```

**注意事项**：
- 年份格式：公元前使用负数或"前"前缀（如"前206"或"-206"）
- 坐标格式：`[经度, 纬度]`（注意顺序）
- 可能需要多次查询才能找到匹配结果（地名变化、年份不匹配等）

### 3.2 地图服务：Google Maps

**选择理由**：
- 成熟稳定，全球覆盖
- 支持中文地名搜索
- 提供丰富的交互功能（缩放、拖拽、标记等）
- 有良好的 React 集成方案（@react-google-maps/api）

**API Key 要求**：
- 需要在 Google Cloud Console 创建项目并启用 Maps JavaScript API
- 配置 API Key 限制（推荐限制为特定域名）
- 前端通过环境变量配置 API Key

**替代方案**（如 Google Maps 不可用）：
- 高德地图（国内用户友好，但需要企业认证）
- 百度地图（国内用户友好，但 API 限制较多）
- OpenStreetMap + Leaflet（开源免费，但需要自行处理中文地名）

### 3.3 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                      地点地图展示架构                            │
└─────────────────────────────────────────────────────────────────┘

前端（React）
│
├─ 事件时间轴组件（EventTimeline.tsx）
│  └─ 地点名称点击 → 触发地图弹窗
│
├─ 地图弹窗组件（LocationMapModal.tsx）【新增】
│  ├─ 调用后端 API 查询地点坐标
│  ├─ 加载 Google Maps
│  └─ 显示地点标记和信息卡片
│
└─ API 客户端（api.ts）
   └─ 新增：searchLocation(query, year?)

后端（Express）
│
├─ 地点查询 API（/api/locations/search）【新增】
│  ├─ 接收地点名称和年份
│  ├─ 调用 CHGIS API
│  ├─ 处理坐标转换（如需要）
│  └─ 返回标准化结果
│
└─ 缓存层（可选）
   └─ Redis 缓存查询结果（减少 API 调用）
```

### 3.4 数据流

```
用户点击地点名称
    ↓
前端：LocationMapModal 打开
    ↓
前端：调用 /api/locations/search?name=鸿门&year=前206
    ↓
后端：查询 CHGIS API
    ↓
后端：解析响应，提取坐标 [lng, lat]
    ↓
后端：返回 { name, coordinates: [lng, lat], modernName, ... }
    ↓
前端：使用坐标加载 Google Maps
    ↓
前端：在地图上显示标记和信息卡片
```

---

## 4. 功能设计

### 4.1 用户交互流程

**场景：用户在事件时间轴中点击地点名称**

1. **触发**
   - 用户在 `EventTimeline` 组件中看到事件卡片
   - 事件卡片显示地点信息：`📍 鸿门`
   - 用户点击地点名称（或图标）

2. **加载**
   - 弹出地图模态窗口（Modal）
   - 显示加载状态："正在查询地点信息..."
   - 后端调用 CHGIS API 查询坐标

3. **显示**
   - 如果查询成功：
     - 地图加载完成，显示地点标记
     - 标记位置：查询到的坐标 `[lng, lat]`
     - 信息卡片显示：
       - 历史地名：鸿门
       - 现代地名：陕西省西安市临潼区（如有）
       - 相关事件：鸿门宴（链接到事件详情）
   - 如果查询失败：
     - 显示错误提示："未找到该地点的坐标信息"
     - 提供"重试"按钮
     - 可选：显示"使用现代地名搜索"按钮（直接使用 `locationModernName` 在 Google Maps 中搜索）

4. **交互**
   - 用户可以缩放、拖拽地图
   - 点击标记，显示详细信息卡片
   - 点击"查看事件详情"，关闭地图，跳转到事件详情
   - 点击外部区域或关闭按钮，关闭地图

### 4.2 UI 组件设计

#### 4.2.1 事件时间轴中的地点显示

**当前实现**（EventTimeline.tsx）：
```tsx
{event.locationName && (
  <Text size="xs" c="dimmed">
    📍 {event.locationName}
  </Text>
)}
```

**改进后**：
```tsx
{event.locationName && (
  <Text
    size="xs"
    c="blue"
    style={{ cursor: 'pointer', textDecoration: 'underline' }}
    onClick={() => handleLocationClick(event.locationName, event.timeRangeStart)}
  >
    📍 {event.locationName}
  </Text>
)}
```

#### 4.2.2 地图模态窗口（LocationMapModal.tsx）

**组件结构**：
```tsx
<Modal
  opened={opened}
  onClose={onClose}
  title="地点位置"
  size="xl"
>
  <Stack>
    {/* 加载状态 */}
    {isLoading && <Loader />}
    
    {/* 错误状态 */}
    {error && <Alert>查询失败</Alert>}
    
    {/* 地图容器 */}
    {locationData && (
      <Box h={500}>
        <GoogleMap
          center={locationData.coordinates}
          zoom={12}
        >
          <Marker position={locationData.coordinates} />
          <InfoWindow>
            <Stack>
              <Text fw={600}>{locationData.name}</Text>
              {locationData.modernName && (
                <Text size="sm" c="dimmed">{locationData.modernName}</Text>
              )}
            </Stack>
          </InfoWindow>
        </GoogleMap>
      </Box>
    )}
    
    {/* 相关信息 */}
    {relatedEvent && (
      <Button onClick={handleViewEvent}>
        查看相关事件：{relatedEvent.name}
      </Button>
    )}
  </Stack>
</Modal>
```

### 4.3 API 设计

#### 4.3.1 后端 API

**端点**：`GET /api/locations/search`

**查询参数**：
- `name` (required): 历史地名，如"鸿门"
- `year` (optional): 年份，如"前206"或"-206"

**响应格式**：
```typescript
interface LocationSearchResponse {
  success: boolean
  data?: {
    id: string              // CHGIS ID，如 "hvd_70435"
    name: string            // 历史地名，如 "鸿门县"
    modernName?: string      // 现代地名（从 CHGIS 或 Event.locationModernName）
    coordinates: {
      lng: number           // 经度
      lat: number           // 纬度
    }
    timeRange?: {
      begin: string         // 开始年份，如 "-190"
      end: string           // 结束年份，如 "29"
    }
    featureType?: string    // 地点类型，如 "xian"
  }
  error?: string
}
```

**错误处理**：
- 404：未找到地点
- 500：CHGIS API 调用失败
- 400：参数错误

**示例请求**：
```
GET /api/locations/search?name=鸿门&year=前206
```

**示例响应**：
```json
{
  "success": true,
  "data": {
    "id": "hvd_70435",
    "name": "鸿门县",
    "modernName": "陕西省西安市临潼区",
    "coordinates": {
      "lng": 110.27951,
      "lat": 38.80217
    },
    "timeRange": {
      "begin": "-190",
      "end": "29"
    },
    "featureType": "xian"
  }
}
```

#### 4.3.2 前端 API 客户端

**函数签名**：
```typescript
// frontend/src/lib/api.ts

export interface LocationSearchResult {
  id: string
  name: string
  modernName?: string
  coordinates: {
    lng: number
    lat: number
  }
  timeRange?: {
    begin: string
    end: string
  }
  featureType?: string
}

export async function searchLocation(
  name: string,
  year?: string
): Promise<LocationSearchResult> {
  const params = new URLSearchParams({ name })
  if (year) params.append('year', year)
  
  const response = await fetch(`/api/locations/search?${params}`)
  if (!response.ok) {
    throw new Error('查询地点失败')
  }
  
  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || '未找到地点')
  }
  
  return data.data
}
```

---

## 5. 实施计划

### 5.1 Phase 1：MVP（2-3 周）

#### Week 1：后端开发

**任务 1.1：创建地点查询 API**
- [ ] 创建 `/backend/src/routes/locations.ts`
- [ ] 实现 `GET /api/locations/search` 端点
- [ ] 集成 CHGIS API 调用
- [ ] 处理年份格式转换（"前206" → "-206"）
- [ ] 错误处理和日志记录

**任务 1.2：测试后端 API**
- [ ] 单元测试：年份格式转换
- [ ] 集成测试：CHGIS API 调用
- [ ] 手动测试：常见历史地名查询

#### Week 2：前端开发

**任务 2.1：安装依赖**
- [ ] 安装 `@react-google-maps/api`
- [ ] 配置 Google Maps API Key（环境变量）

**任务 2.2：创建地图组件**
- [ ] 创建 `LocationMapModal.tsx`
- [ ] 实现地图加载和标记显示
- [ ] 实现信息卡片
- [ ] 实现加载和错误状态

**任务 2.3：集成到事件时间轴**
- [ ] 修改 `EventTimeline.tsx`，添加地点点击处理
- [ ] 添加地图模态窗口状态管理
- [ ] 测试交互流程

#### Week 3：测试与优化

**任务 3.1：功能测试**
- [ ] 测试常见历史地名查询（鸿门、彭城、垓下等）
- [ ] 测试边界情况（地名不存在、年份不匹配等）
- [ ] 测试不同浏览器的兼容性

**任务 3.2：性能优化**
- [ ] 添加查询结果缓存（可选）
- [ ] 优化地图加载性能
- [ ] 优化错误提示用户体验

**任务 3.3：文档更新**
- [ ] 更新 API 文档
- [ ] 更新用户指南（如有）

### 5.2 Phase 2：地图模式（后续扩展，3-4 周）

#### 功能概述

在阅读页面新增"地图"标签页，显示当前章节所有事件的地点标注。

**核心功能**：
1. 地图视图：显示当前章节所有事件的地点
2. 时间筛选：按时间范围筛选显示的事件
3. 地点聚合：同一地点的多个事件聚合显示
4. 交互：点击标记，显示事件列表和信息

**实施任务**：
- [ ] 创建 `MapView.tsx` 组件
- [ ] 在 `InfoPanel.tsx` 中添加"地图"标签
- [ ] 实现批量地点查询和坐标聚合
- [ ] 实现时间轴筛选功能
- [ ] 实现标记点击交互

---

## 6. 技术细节

### 6.1 年份格式处理

CHGIS API 支持的年份格式：
- 负数：`-206`（公元前 206 年）
- 字符串：`"前206"`（需要转换）

**转换逻辑**：
```typescript
function normalizeYear(year: string): string {
  // 处理"前206"格式
  if (year.startsWith('前')) {
    const num = parseInt(year.slice(1))
    return `-${num}`
  }
  // 处理"206"格式（假设为公元后）
  if (/^\d+$/.test(year)) {
    return year
  }
  // 已经是负数格式
  if (year.startsWith('-')) {
    return year
  }
  return year
}
```

### 6.2 坐标格式处理

CHGIS API 返回的坐标格式：`[经度, 纬度]`

Google Maps 需要的格式：`{ lat: number, lng: number }`

**转换逻辑**：
```typescript
function convertCoordinates(chgisCoords: [number, number]) {
  return {
    lng: chgisCoords[0],
    lat: chgisCoords[1]
  }
}
```

### 6.3 错误处理策略

**CHGIS API 查询失败**：
1. 尝试使用 `locationModernName`（如果存在）在 Google Maps 中直接搜索
2. 显示提示："未找到历史坐标，已使用现代地名搜索"
3. 如果仍失败，显示错误提示

**Google Maps 加载失败**：
1. 检查 API Key 配置
2. 显示友好的错误提示
3. 提供"重试"按钮

### 6.4 缓存策略（可选）

**Redis 缓存**：
- Key 格式：`location:${name}:${year}`
- TTL：7 天（历史地名不会变化）
- 缓存命中时直接返回，减少 API 调用

**前端缓存**：
- 使用 React Query 缓存查询结果
- 同一会话中重复查询同一地点，直接使用缓存

---

## 7. 验收标准

### 7.1 功能验收

- [ ] 用户可以在事件时间轴中点击地点名称
- [ ] 地图模态窗口正确打开
- [ ] 能够成功查询常见历史地名的坐标（测试 10 个以上地点）
- [ ] 地图正确显示地点标记
- [ ] 信息卡片显示正确的地点信息
- [ ] 错误情况有友好的提示

### 7.2 性能验收

- [ ] 地点查询响应时间 < 2s（90% 请求）
- [ ] 地图加载时间 < 3s
- [ ] 页面交互流畅，无卡顿

### 7.3 兼容性验收

- [ ] Chrome、Firefox、Safari、Edge 浏览器正常使用
- [ ] 移动端浏览器基本可用（响应式设计）

---

## 8. 后续扩展方向

### 8.1 地图模式（Phase 2）

详见 5.2 节。

### 8.2 路线可视化

- 显示历史人物的行动路线
- 显示战役的行军路线
- 时间轴动画展示路线变化

### 8.3 地理分析

- 显示势力范围（通过事件地点推断）
- 显示重要地点的战略价值
- 地理因素对历史事件的影响分析

### 8.4 多地图源支持

- 支持切换不同的地图服务（Google Maps、高德地图、百度地图）
- 根据用户地理位置自动选择最佳地图源

---

## 9. 相关文档

- [历史阅读增强 App 产品规格书](./reading-app-spec.md)
- [事件中心数据架构规格书](./event-centric-data-spec.md)
- [CHGIS Temporal Gazetteer API 文档](https://chgis.hudci.org/tgw/)

---

## 10. 更新日志

### v1.0 (2024-12-29) - 初始版本

- 定义 MVP 功能范围
- 确定技术方案（CHGIS API + Google Maps）
- 设计用户交互流程
- 制定实施计划

---

**最后更新**：2024-12-29  
**版本**：1.0 (MVP)

