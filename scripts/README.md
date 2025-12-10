# 工具脚本目录

本目录包含数据准备相关的工具脚本。

## 📋 脚本列表

### 数据提取

- **`extract_with_llm.py`** - LLM 批量提取脚本
  - 从历史文本中提取人物、关系、地点、事件数据
  - 支持 OpenAI 和 Google Gemini API

- **`extract_data.sh`** - 数据提取便捷脚本
  - 自动提取所有类型数据
  - 自动激活虚拟环境

### 数据下载

- **`download_with_playwright.py`** - 使用 Playwright 下载文本
  - 从维基文库等网站下载历史文本

- **`download_first_chapter_auto.sh`** - 自动下载第一个章节

### 数据预处理

- **`preprocess_text.py`** - 文本预处理脚本
  - 将原始文本转换为结构化 JSON 格式

### 环境设置

- **`setup_python_env.sh`** - Python 环境设置脚本
- **`setup_env.sh`** - 环境变量设置脚本

### 使用指南

- **`prepare_data.md`** - 数据准备流程（已整合到 [数据获取与融合规格书](../specs/data-acquisition-and-merge-spec.md)）
- **`INCREMENTAL_WORKFLOW.md`** - 渐进式工作流指南
  - 从最小单元开始，逐步扩展数据
  - 适合第一次使用或验证流程

### 快速开始

- **`quick_start_stage1.sh`** - 阶段 1 快速开始脚本
  - 一键开始数据准备的第一阶段

## 📖 相关文档

- [数据获取与融合规格书](../specs/data-acquisition-and-merge-spec.md) - 完整的技术规范
- [数据来源说明](../docs/data/DATA_SOURCES.md) - 数据来源介绍
- [渐进式工作流指南](./INCREMENTAL_WORKFLOW.md) - 详细的操作指南

---

**最后更新**：2024-12-08
