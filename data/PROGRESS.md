# 数据准备进度

本文档记录数据准备的进度和状态。

## 当前进度

### ✅ 已完成

1. **环境设置**
   - ✅ Python 虚拟环境已创建
   - ✅ Playwright 和 OpenAI 库已安装
   - ✅ 所有工具脚本已就绪

2. **第一个章节下载**
   - ✅ 《史记·高祖本纪》已下载
   - ✅ 文件路径：`data/raw/shiji/shiji_01_gaozu_benji.txt`
   - ✅ 文件大小：34.47 KB
   - ✅ 段落数：92 个
   - ✅ 文件验证通过

3. **文本预处理**
   - ✅ 已预处理为 JSON 格式
   - ✅ 输出文件：`data/processed/chapters/shiji_01_gaozu_benji.json`
   - ✅ 包含 92 个段落，每个段落有编号和 ID

### 🔄 下一步

1. **数据提取**（需要 OPENAI_API_KEY）
   - ⏳ 提取人物数据
   - ⏳ 提取关系数据
   - ⏳ 提取地点数据
   - ⏳ 提取事件数据

2. **数据审核**
   - ⏳ 在管理后台导入数据
   - ⏳ 使用 Review 工具审核
   - ⏳ 修正错误数据

3. **数据发布**
   - ⏳ 发布已审核的数据
   - ⏳ 验证数据完整性

## 渐进式工作流（推荐）

**第一次使用？** 建议按照渐进式工作流开始：

1. 查看详细指南：`scripts/INCREMENTAL_WORKFLOW.md`
2. 快速开始阶段 1：
   ```bash
   ./scripts/quick_start_stage1.sh
   ```

这个工作流会引导你从 1 个人物开始，逐步扩展到完整的数据集。

## 快速命令

### 提取数据

```bash
# 设置 API Key
export OPENAI_API_KEY="your-api-key"

# 提取所有类型数据
./scripts/extract_data.sh data/raw/shiji/shiji_01_gaozu_benji.txt all

# 或只提取人物
./scripts/extract_data.sh data/raw/shiji/shiji_01_gaozu_benji.txt person
```

### 手动提取

```bash
# 激活虚拟环境
source venv/bin/activate

# 提取人物
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type person \
  --output data/extracted/persons/shiji_01_gaozu_benji_persons.json

# 提取关系（需要先有人物数据）
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type relationship \
  --output data/extracted/relationships/shiji_01_gaozu_benji_relationships.json \
  --persons-file data/extracted/persons/shiji_01_gaozu_benji_persons.json
```

## 文件清单

### 原始文本
- `data/raw/shiji/shiji_01_gaozu_benji.txt` ✅

### 处理后的数据
- `data/processed/chapters/shiji_01_gaozu_benji.json` ✅

### 提取的数据（待生成）
- `data/extracted/persons/shiji_01_gaozu_benji_persons.json` ⏳
- `data/extracted/relationships/shiji_01_gaozu_benji_relationships.json` ⏳
- `data/extracted/places/shiji_01_gaozu_benji_places.json` ⏳
- `data/extracted/events/shiji_01_gaozu_benji_events.json` ⏳

## 注意事项

1. **API Key**：提取数据需要设置 `OPENAI_API_KEY` 环境变量
2. **API 费用**：使用 LLM API 会产生费用，建议先用小文本测试
3. **数据质量**：所有提取的数据都需要人工审核
4. **提取顺序**：建议先提取人物，再提取关系（关系提取需要人物列表）

---

**最后更新**：2024-12-01

