# 工具脚本

本目录包含数据准备相关的工具脚本。

## 环境设置

所有 Python 脚本都需要在虚拟环境中运行。

**首次使用**：
```bash
./scripts/setup_python_env.sh
```

**激活虚拟环境**：
```bash
source venv/bin/activate
```

**注意**：便捷脚本（如 `download_first_chapter_auto.sh`）会自动激活虚拟环境。

## 脚本列表

### 1. `extract_with_llm.py` - LLM 批量提取脚本

从历史文本中批量提取人物、关系、地点、事件数据。

### 2. `preprocess_text.py` - 文本预处理脚本

将原始文本文件处理成标准格式，添加段落编号等。

### 3. `prepare_data.md` - 数据准备流程文档

完整的数据准备流程说明。

### 4. `download_guide.md` - 文本下载指南

如何从维基文库或 CTEXT 下载历史书籍文本。

### 5. `quick_start_data.md` - 数据准备快速开始

快速上手数据准备的步骤指南。

### 6. `download_with_playwright.py` - 自动下载脚本（Playwright）

使用 Playwright 自动从维基文库下载文本，无需手动复制粘贴。

**安装要求**：
```bash
pip install playwright
playwright install chromium
```

**使用方法**：
```bash
python scripts/download_with_playwright.py \
  --url "https://zh.wikisource.org/wiki/史記/卷008" \
  --output "data/raw/shiji/shiji_01_gaozu_benji.txt" \
  --book "史记" \
  --chapter "高祖本纪"
```

### 7. `download_first_chapter_auto.sh` - 一键下载脚本

自动下载第一个章节的便捷脚本。

```bash
./scripts/download_first_chapter_auto.sh
```

### 8. `verify_file.py` - 文件验证脚本

验证下载的文本文件是否符合要求。

```bash
python scripts/verify_file.py data/raw/shiji/shiji_01_gaozu_benji.txt
```

---

## LLM 批量提取脚本

## 安装依赖

```bash
pip install openai
```

## 配置

设置环境变量（或使用命令行参数）：

```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api.openai.com/v1"  # 可选，用于自定义 API 地址
```

## 使用方法

### 1. 提取人物

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type person \
  --output data/extracted/persons/shiji_01_persons.json
```

### 2. 提取关系

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type relationship \
  --output data/extracted/relationships/shiji_01_relationships.json \
  --persons-file data/extracted/persons/shiji_01_persons.json  # 可选，提供人物列表以提高准确性
```

### 3. 提取地点

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type place \
  --output data/extracted/places/shiji_01_places.json
```

### 4. 提取事件

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type event \
  --output data/extracted/events/shiji_01_events.json
```

## 输出格式

输出的 JSON 文件格式：

```json
{
  "extractedAt": "2024-12-01T12:00:00",
  "sourceFile": "data/raw/shiji/shiji_01_gaozu_benji.txt",
  "type": "person",
  "count": 10,
  "data": [
    {
      "name": "刘邦",
      "aliases": ["汉高祖", "沛公"],
      "role": "EMPEROR",
      "biography": "..."
    }
  ]
}
```

## 文本预处理脚本

使用 `preprocess_text.py` 预处理原始文本：

```bash
python scripts/preprocess_text.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --output data/processed/chapters/shiji_01_gaozu_benji.json \
  --book "史记" \
  --chapter "高祖本纪" \
  --url "https://zh.wikisource.org/wiki/史記/卷008"
```

## 完整工作流程

1. **下载文本** → 查看 `download_guide.md`
2. **预处理文本** → 使用 `preprocess_text.py`
3. **提取数据** → 使用 `extract_with_llm.py`
4. **审核数据** → 使用管理后台 Review 工具
5. **导入数据库** → 使用管理后台批量导入

**快速开始**：查看 `quick_start_data.md`

## 导入到系统

提取完成后，使用管理后台的"批量导入"功能导入 JSON 文件。

## 注意事项

1. **API 费用**：使用 LLM API 会产生费用，建议先用小文本测试
2. **数据质量**：LLM 提取的数据需要人工审核，建议使用 Review 工具进行审核
3. **文本长度**：如果文本过长，可能需要分段处理
4. **坐标信息**：提取地点时，LLM 可能无法准确提供坐标，需要人工补充

## 相关文档

- 📖 数据准备流程：`prepare_data.md`
- 🚀 快速开始：`quick_start_data.md`
- 📥 下载指南：`download_guide.md`
- 📚 推荐书籍：`../docs/data/RECOMMENDED_BOOKS.md`

