# 文本下载指南

本指南说明如何从维基文库或 CTEXT 下载历史书籍文本。

## 方法 1：从维基文库下载

### 步骤

1. **访问维基文库**
   - 网址：https://zh.wikisource.org

2. **搜索书籍**
   - 在搜索框输入书籍名称（如"史记"）
   - 或直接访问：https://zh.wikisource.org/wiki/史記

3. **选择章节**
   - 点击具体章节（如"高祖本纪"）
   - 或访问：https://zh.wikisource.org/wiki/史記/卷008

4. **复制文本**
   - 全选页面内容（Cmd/Ctrl + A）
   - 复制（Cmd/Ctrl + C）
   - 粘贴到文本编辑器

5. **保存文件**
   - 保存为 UTF-8 编码的文本文件
   - 文件名格式：`shiji_01_gaozu_benji.txt`
   - 保存到：`data/raw/shiji/`

### 推荐章节（史记）

- 高祖本纪：https://zh.wikisource.org/wiki/史記/卷008
- 项羽本纪：https://zh.wikisource.org/wiki/史記/卷007
- 秦始皇本纪：https://zh.wikisource.org/wiki/史記/卷006
- 萧相国世家：https://zh.wikisource.org/wiki/史記/卷053
- 留侯世家：https://zh.wikisource.org/wiki/史記/卷055
- 淮阴侯列传：https://zh.wikisource.org/wiki/史記/卷092

### 推荐章节（汉书）

- 高帝纪：https://zh.wikisource.org/wiki/漢書/卷001上
- 惠帝纪：https://zh.wikisource.org/wiki/漢書/卷002
- 文帝纪：https://zh.wikisource.org/wiki/漢書/卷004
- 萧何传：https://zh.wikisource.org/wiki/漢書/卷039

## 方法 2：从 CTEXT 下载

### 步骤

1. **访问 CTEXT**
   - 网址：https://ctext.org

2. **搜索书籍**
   - 在搜索框输入书籍名称
   - 或直接访问：https://ctext.org/shiji

3. **选择章节**
   - 点击具体章节
   - 或使用章节导航

4. **导出文本**
   - 点击"导出"或"下载"按钮
   - 选择文本格式
   - 保存文件

## 文本格式要求

### 文件编码
- **必须**：UTF-8 编码
- 不要使用 GBK、GB2312 等其他编码

### 文件内容格式

建议在文件开头添加来源信息：

```
来源：《史记·高祖本纪》
获取渠道：维基文库
URL：https://zh.wikisource.org/wiki/史記/卷008
获取日期：2024-12-01
版权状态：公共领域（Public Domain）

---

[章节标题]
[段落内容]
```

### 段落格式

- 每个段落用空行分隔
- 保持原始文本格式
- 不要删除标点符号
- 不要修改文字内容

## 快速下载脚本（可选）

可以使用浏览器扩展或脚本自动下载，但建议手动下载以确保质量。

## 验证下载的文本

下载后，检查：
- [ ] 文件编码为 UTF-8
- [ ] 文本完整（无缺失）
- [ ] 段落格式正确
- [ ] 来源信息已添加

## 下一步

下载文本后，使用预处理脚本处理：

```bash
python scripts/preprocess_text.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --output data/processed/chapters/shiji_01_gaozu_benji.json \
  --book "史记" \
  --chapter "高祖本纪" \
  --url "https://zh.wikisource.org/wiki/史記/卷008"
```

---

**相关文档**：
- 数据准备流程：`prepare_data.md`
- 推荐书籍：`../docs/data/RECOMMENDED_BOOKS.md`

