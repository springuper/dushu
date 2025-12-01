# 数据准备流程

本文档说明如何从历史书籍中提取数据，并导入到系统中。

## 整体流程

```
原始文本 → 预处理 → LLM 提取 → Review 审核 → 导入数据库
```

## 步骤 1：获取原始文本

**详细指南**：请查看 [download_guide.md](./download_guide.md)

### 1.1 从维基文库下载

1. 访问维基文库：https://zh.wikisource.org
2. 搜索书籍（如"史记"）
3. 选择具体章节
4. 复制文本或导出为 Markdown

### 1.2 从 CTEXT 下载

1. 访问 CTEXT：https://ctext.org
2. 搜索书籍
3. 选择章节
4. 导出为文本格式

### 1.3 保存格式

保存为 UTF-8 编码的文本文件到对应目录：

```
data/raw/shiji/
├── shiji_01_gaozu_benji.txt
├── shiji_02_xiangyu_benji.txt
└── ...
```

**文件命名规范**：`{book}_{chapter}_{title}.txt`

## 步骤 2：数据预处理

使用预处理脚本自动处理文本：

```bash
python scripts/preprocess_text.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --output data/processed/chapters/shiji_01_gaozu_benji.json \
  --book "史记" \
  --chapter "高祖本纪" \
  --url "https://zh.wikisource.org/wiki/史記/卷008"
```

脚本会自动：
- 提取章节标题
- 按段落分割文本
- 为每个段落添加编号
- 生成标准 JSON 格式

### 2.1 手动预处理（可选）

如果不使用脚本，需要：
- 确保每个章节是独立的文件
- 为每个段落添加编号（格式：`[段落 1]`、`[段落 2]`）
- 在文件开头添加来源信息

## 步骤 3：LLM 提取

### 3.1 提取人物

```bash
# 提取《史记·高祖本纪》中的人物
python scripts/extract_with_llm.py \
  --input data/raw/shiji/chapter_01_gaozu_benji.txt \
  --type person \
  --output data/extracted/persons/shiji_gaozu_persons.json
```

### 3.2 提取关系

```bash
# 需要先有人物列表
python scripts/extract_with_llm.py \
  --input data/raw/shiji/chapter_01_gaozu_benji.txt \
  --type relationship \
  --output data/extracted/relationships/shiji_gaozu_relationships.json \
  --persons-file data/extracted/persons/shiji_gaozu_persons.json
```

### 3.3 提取地点

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/chapter_01_gaozu_benji.txt \
  --type place \
  --output data/extracted/places/shiji_gaozu_places.json
```

### 3.4 提取事件

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/chapter_01_gaozu_benji.txt \
  --type event \
  --output data/extracted/events/shiji_gaozu_events.json
```

## 步骤 4：Review 审核

### 4.1 登录管理后台

1. 访问：http://localhost:5173/admin/login
2. 使用管理员账号登录

### 4.2 批量导入

1. 进入"批量导入"页面
2. 选择提取的 JSON 文件
3. 选择导入类型（人物/关系/地点/事件）
4. 点击"开始导入"

### 4.3 审核数据

1. 进入"Review"页面
2. 查看待审核的数据
3. 点击查看详情
4. 审核操作：
   - **通过**：数据正确，直接通过
   - **保存修改**：数据有误，修改后保存
   - **拒绝**：数据错误，拒绝导入

### 4.4 批量操作

- 选择多个项目
- 批量通过/拒绝

## 步骤 5：导入到数据库

### 5.1 通过审核的数据

审核通过的数据会自动标记为 `APPROVED` 状态。

### 5.2 发布数据

在"内容管理"页面：
- 人物管理：查看已审核的人物，可以编辑和发布
- 关系管理：查看已审核的关系
- 地点管理：查看已审核的地点
- 事件管理：查看已审核的事件

### 5.3 数据验证

- 检查数据完整性
- 验证人物关系
- 检查地理坐标
- 验证事件时间

## 数据质量检查清单

### 人物数据
- [ ] 姓名正确（无错别字）
- [ ] 角色类型正确
- [ ] 传记信息完整
- [ ] 时间信息准确

### 关系数据
- [ ] 源人物和目标人物都存在
- [ ] 关系类型正确
- [ ] 关系描述准确
- [ ] 参考章节正确

### 地点数据
- [ ] 地点名称正确
- [ ] 坐标准确（经纬度）
- [ ] 地点类型正确
- [ ] 描述信息完整

### 事件数据
- [ ] 事件名称准确
- [ ] 时间范围正确
- [ ] 参与者正确
- [ ] 事件描述完整

## 常见问题

### Q: LLM 提取的数据不准确怎么办？

A: 
1. 优化提示词（修改 `extract_with_llm.py` 中的 prompt）
2. 使用更高质量的模型（如 gpt-4）
3. 人工 Review 修正

### Q: 如何提高提取准确率？

A:
1. **分段提取**：将长文本分成小段，逐段提取
2. **交叉验证**：对比不同书籍中的同一人物/事件
3. **人工审核**：所有数据都需要人工 Review

### Q: 如何处理重复数据？

A:
1. 在导入时检查是否已存在
2. 使用"更新模式"而不是"新增模式"
3. 在 Review 时合并重复项

### Q: 坐标信息如何获取？

A:
1. LLM 可能无法准确提供坐标
2. 需要人工查找和补充
3. 可以使用现代地名查询坐标

## 最佳实践

1. **小批量处理**：每次处理 1-2 个章节，不要一次性处理太多
2. **及时审核**：提取后立即审核，不要积累太多待审核数据
3. **交叉验证**：对比不同书籍的数据，确保准确性
4. **记录问题**：记录提取和审核中发现的问题，持续改进
5. **版本控制**：对提取的数据进行版本管理，便于回溯

---

**最后更新**：2024-12-01

