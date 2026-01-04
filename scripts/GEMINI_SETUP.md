# Google Gemini API 设置指南

本指南说明如何使用 Google Gemini API 进行数据提取。

## 获取 API Key

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 登录 Google 账号
3. 创建新的 API Key
4. 复制 API Key

## 设置环境变量

### 方法 1：使用 .env 文件（推荐）

```bash
# 从模板创建 .env 文件
./scripts/setup_env.sh

# 或手动创建
cp .env.example .env

# 编辑 .env 文件，填入 API Key
nano .env
# 或
vim .env
```

在 `.env` 文件中设置：

```env
GOOGLE_API_KEY=your-api-key-here
```

### 方法 2：设置系统环境变量

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

或者添加到 `~/.zshrc` 或 `~/.bashrc`：

```bash
echo 'export GOOGLE_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

## 使用方法

### 方法 1：使用便捷脚本（推荐）

```bash
# 设置 API Key
export GOOGLE_API_KEY="your-api-key"

# 提取所有类型数据
./scripts/extract_data.sh data/raw/shiji/shiji_01_gaozu_benji.txt all
```

### 方法 2：手动运行

```bash
# 激活虚拟环境
source venv/bin/activate

# 设置 API Key
export GOOGLE_API_KEY="your-api-key"

# 提取人物
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type person \
  --output data/extracted/persons/shiji_01_gaozu_benji_persons.json \
  --provider gemini
```

## 模型选择

Gemini 支持的模型：
- `gemini-1.5-flash`（默认，快速且经济）
- `gemini-1.5-pro`（更强大，适合复杂任务）
- `gemini-pro`（旧版本）

指定模型：

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type person \
  --output data/extracted/persons/shiji_01_gaozu_benji_persons.json \
  --provider gemini \
  --model gemini-1.5-pro
```

## 自动检测

如果不指定 `--provider`，脚本会自动检测：
1. 如果设置了 `GOOGLE_API_KEY`，优先使用 Gemini
2. 如果设置了 `OPENAI_API_KEY`，使用 OpenAI
3. 如果两者都设置了，优先使用 Gemini

## 优势

- ✅ **免费额度**：Gemini 提供更慷慨的免费额度
- ✅ **中文支持**：对中文文本处理效果优秀
- ✅ **速度快**：gemini-1.5-flash 响应速度快
- ✅ **成本低**：相比 OpenAI 更经济

## 注意事项

1. **API 限制**：注意 Google AI Studio 的速率限制
2. **数据质量**：所有提取的数据都需要人工审核
3. **错误处理**：如果 API 调用失败，检查 API Key 是否正确

---

**相关文档**：
- 操作手册：`../docs/OPERATION_MANUAL.md`
- 工具说明：`README.md`

