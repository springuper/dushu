# 数据准备快速开始

本指南提供数据准备的快速开始步骤，帮助您快速上手。

## 前置要求

1. **Python 3.8+**（用于运行预处理和提取脚本）
2. **OpenAI API Key**（或兼容的 LLM API）
3. **已启动项目**（前端和后端运行中）

## 快速开始（5 步）

### 步骤 1：下载第一个章节文本

**方法 1：自动下载（推荐，使用 Playwright）**

首先设置 Python 虚拟环境（首次使用）：

```bash
# 运行设置脚本（会自动创建虚拟环境并安装依赖）
./scripts/setup_python_env.sh
```

或者手动设置：

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r scripts/requirements.txt

# 安装 Playwright 浏览器驱动
playwright install chromium
```

然后运行自动下载脚本：

```bash
# 自动下载《史记·高祖本纪》
./scripts/download_first_chapter_auto.sh
```

或者手动指定 URL（需要先激活虚拟环境）：

```bash
# 激活虚拟环境
source venv/bin/activate

# 运行下载脚本
python scripts/download_with_playwright.py \
  --url "https://zh.wikisource.org/wiki/史記/卷008" \
  --output "data/raw/shiji/shiji_01_gaozu_benji.txt" \
  --book "史记" \
  --chapter "高祖本纪"
```

**方法 2：手动下载**

如果自动下载失败，可以手动下载：

1. 运行下载指南脚本（会打开浏览器）：
   ```bash
   ./scripts/download_first_chapter.sh
   ```

2. 或直接访问：https://zh.wikisource.org/wiki/史記/卷008
3. 复制文本内容
4. 保存为：`data/raw/shiji/shiji_01_gaozu_benji.txt`
5. 参考格式：`data/raw/shiji/EXAMPLE_FORMAT.txt`

**验证文件**：

```bash
# 确保虚拟环境已激活
source venv/bin/activate

# 验证下载的文件是否符合要求
python scripts/verify_file.py data/raw/shiji/shiji_01_gaozu_benji.txt
```

### 步骤 2：预处理文本

```bash
# 确保虚拟环境已激活
source venv/bin/activate

python scripts/preprocess_text.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --output data/processed/chapters/shiji_01_gaozu_benji.json \
  --book "史记" \
  --chapter "高祖本纪" \
  --url "https://zh.wikisource.org/wiki/史記/卷008"
```

**预期输出**：
```
✅ 处理完成：XX 个段落
   输出文件：data/processed/chapters/shiji_01_gaozu_benji.json
```

### 步骤 3：提取人物数据

```bash
# 确保虚拟环境已激活
source venv/bin/activate

# 设置 API Key（如果还没有）
export OPENAI_API_KEY="your-api-key"

# 提取人物
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type person \
  --output data/extracted/persons/shiji_01_persons.json
```

**预期输出**：
```
正在提取 person 数据...
✅ 提取完成: XX 条记录已保存到 data/extracted/persons/shiji_01_persons.json
```

### 步骤 4：导入并审核数据

1. **登录管理后台**
   - 访问：http://localhost:5173/admin/login
   - 使用管理员账号登录

2. **批量导入**
   - 进入"批量导入"页面
   - 选择文件：`data/extracted/persons/shiji_01_persons.json`
   - 选择类型：人物
   - 点击"开始导入"

3. **审核数据**
   - 进入"Review"页面
   - 查看待审核的人物数据
   - 点击查看详情，审核每条数据
   - 通过/拒绝/保存修改

### 步骤 5：提取其他类型数据

重复步骤 3-4，提取关系、地点、事件：

```bash
# 提取关系（需要先有人物列表）
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type relationship \
  --output data/extracted/relationships/shiji_01_relationships.json \
  --persons-file data/extracted/persons/shiji_01_persons.json

# 提取地点
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type place \
  --output data/extracted/places/shiji_01_places.json

# 提取事件
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type event \
  --output data/extracted/events/shiji_01_events.json
```

## 推荐的工作流程

### 第一阶段：单章节测试

1. 选择一个章节（如《史记·高祖本纪》）
2. 完成完整流程（下载 → 预处理 → 提取 → 审核 → 导入）
3. 验证数据质量
4. 优化提取脚本（如需要）

### 第二阶段：批量处理

1. 下载多个章节
2. 批量预处理
3. 批量提取
4. 批量审核

## 常见问题

### Q: LLM 提取的数据不准确？

A: 
1. 检查原始文本质量
2. 优化提示词（修改 `extract_with_llm.py`）
3. 使用更高质量的模型（如 gpt-4）
4. 人工 Review 修正

### Q: 如何提高提取准确率？

A:
1. **分段提取**：将长文本分成小段
2. **交叉验证**：对比不同书籍的数据
3. **人工审核**：所有数据都需要 Review

### Q: 预处理脚本报错？

A:
1. 检查文件编码（必须是 UTF-8）
2. 检查文件格式（段落用空行分隔）
3. 检查 Python 版本（需要 3.8+）

## 下一步

- 📖 查看完整流程：`prepare_data.md`
- 📥 下载指南：`download_guide.md`
- 📚 推荐书籍：`../docs/data/RECOMMENDED_BOOKS.md`

---

**提示**：建议先从一个小章节开始，熟悉流程后再批量处理。

