# 数据目录

本目录用于存储项目所需的历史书籍数据。

## 目录结构

```
data/
├── raw/                    # 原始文本文件（从维基文库/CTEXT 下载）
│   ├── shiji/              # 史记原文
│   ├── hanshu/             # 汉书原文
│   ├── zizhitongjian/      # 资治通鉴原文
│   ├── houhanshu/          # 后汉书原文
│   └── zhanguoce/          # 战国策原文
├── processed/              # 处理后的数据
│   └── chapters/           # 章节数据（JSON 格式）
└── extracted/              # LLM 提取的数据
    ├── persons/            # 人物数据
    ├── relationships/      # 关系数据
    ├── places/            # 地点数据
    └── events/            # 事件数据
```

## 文件命名规范

### 原始文本文件

格式：`{book}_{chapter}_{title}.txt`

示例：
- `shiji_01_gaozu_benji.txt` - 史记·高祖本纪
- `hanshu_01_gaodi_ji.txt` - 汉书·高帝纪

### 处理后的章节数据

格式：`{book}_{chapter}_{title}.json`

示例：
- `shiji_01_gaozu_benji.json`

### 提取的数据

格式：`{book}_{chapter}_{type}.json`

示例：
- `shiji_01_persons.json`
- `shiji_01_relationships.json`
- `shiji_01_places.json`
- `shiji_01_events.json`

## 数据来源记录

每个原始文本文件应包含来源信息，建议在文件开头添加：

```
来源：《史记·高祖本纪》
获取渠道：维基文库 (https://zh.wikisource.org/wiki/史記/卷008)
获取日期：2024-12-01
版权状态：公共领域（Public Domain）
```

## 注意事项

1. **编码**：所有文本文件使用 UTF-8 编码
2. **格式**：保持原始文本格式，不要修改内容
3. **版本控制**：原始文本文件应提交到 Git
4. **处理后的数据**：可以提交到 Git，但提取的数据建议添加到 `.gitignore`

---

**相关文档**：
- 数据来源说明：`../docs/data/DATA_SOURCES.md`
- 推荐书籍：`../docs/data/RECOMMENDED_BOOKS.md`
- 数据准备流程：`../scripts/prepare_data.md`

