# 工具脚本目录

本目录包含数据准备相关的工具脚本。

## 📋 脚本列表

### 核心脚本

**数据下载和预处理（Node.js）**：
- **`download_with_playwright.js`** - 从维基文库下载文本
  - 使用方式：`node scripts/download_with_playwright.js --url "..." --output "..."`
- **`preprocess_text.js`** - 将原始文本转换为结构化 JSON
  - 使用方式：`node scripts/preprocess_text.js --input "..." --output "..."`

**数据提取（Python）**：
- **`extract_with_llm.py`** - LLM 批量提取脚本
  - 从历史文本中提取人物、关系、地点、事件数据
  - 支持 OpenAI 和 Google Gemini API

### 便捷脚本

- **`download_first_chapter_auto.sh`** - 自动下载第一个章节（一键下载《史记·高祖本纪》）
- **`extract_data.sh`** - 数据提取便捷脚本（自动提取所有类型数据）

### 环境设置

- **`setup_env.sh`** - 环境变量设置脚本（创建 .env 文件）

## 📖 使用指南

### 快速开始

**完整操作流程**：
👉 **[完整操作手册](../docs/OPERATION_MANUAL.md)** - 从数据准备到发布的完整流程

**第一次使用？**：
👉 **[渐进式工作流指南](./INCREMENTAL_WORKFLOW.md)** - 从最小单元开始，逐步扩展

### 相关文档

- [数据获取与融合规格书](../specs/data-acquisition-and-merge-spec.md) - 完整技术规范
- [操作手册](../docs/OPERATION_MANUAL.md) - 日常操作参考
- [数据来源说明](../docs/data/DATA_SOURCES.md) - 数据来源介绍
- [推荐书籍](../docs/data/RECOMMENDED_BOOKS.md) - 推荐的历史书籍

---

**最后更新**：2024-12-08
