# 项目文档

本目录包含项目的使用指南和开发文档。

> **注意**：功能规格文档（Spec）请查看 [specs/](../specs/) 目录。

## 文档结构

### 📚 [setup/](./setup/) - 设置和快速开始

- **[QUICK_START.md](./setup/QUICK_START.md)** - 快速开始指南
  - 环境要求
  - 安装步骤
  - 数据库设置
  - 启动项目

### 🛠️ [development/](./development/) - 开发相关

- **[roadmap.md](./development/roadmap.md)** - 开发路线图
  - 里程碑规划
  - 功能点清单
  - 验收标准
  - 时间估算

### 📊 [data/](./data/) - 数据相关

- **[DATA_SOURCES.md](./data/DATA_SOURCES.md)** - 数据来源与版权说明
  - 版权状态说明
  - 推荐的历史书籍资源
  - 免费获取渠道
  - 版权注意事项

- **[RECOMMENDED_BOOKS.md](./data/RECOMMENDED_BOOKS.md)** - 推荐书籍（聚焦秦汉/西汉）
  - 5 本推荐书籍的详细介绍
  - 选择理由和互补性分析
  - 重点章节和内容
  - 获取渠道

### 📖 [操作手册](./OPERATION_MANUAL.md) - 日常操作指南

- **[OPERATION_MANUAL.md](./OPERATION_MANUAL.md)** - 数据提取与发布操作手册
  - 快速开始指南
  - 完整操作流程
  - 详细步骤说明
  - 常见问题解答
  - 最佳实践建议

### 🧪 [testing/](./testing/) - 测试相关

- **[TESTING.md](./testing/TESTING.md)** - 测试指南
  - 测试策略
  - 测试用例
  - 测试流程

## 相关文档

### 产品规格（Specs）

- **[../specs/](../specs/)** - 产品规格文档目录
  - [历史阅读增强 App 产品规格书](../specs/reading-app-spec.md) - 主产品规格
  - [数据获取与融合规格书](../specs/data-acquisition-and-merge-spec.md) - 数据相关规格

### 工具脚本

- **[../scripts/README.md](../scripts/README.md)** - 脚本使用说明
- **[OPERATION_MANUAL.md](./OPERATION_MANUAL.md)** - 完整操作手册（数据准备到发布）
- **[../scripts/INCREMENTAL_WORKFLOW.md](../scripts/INCREMENTAL_WORKFLOW.md)** - 渐进式工作流指南

### 后端文档

- **[../backend/DATABASE_SETUP.md](../backend/DATABASE_SETUP.md)** - 数据库设置指南

## 快速导航

- 🚀 **新手上路**：从 [setup/QUICK_START.md](./setup/QUICK_START.md) 开始
- 📖 **操作手册**：查看 [OPERATION_MANUAL.md](./OPERATION_MANUAL.md) - 数据提取与发布完整流程
- 📋 **了解项目**：查看 [development/roadmap.md](./development/roadmap.md)
- 📚 **准备数据**：参考 [data/RECOMMENDED_BOOKS.md](./data/RECOMMENDED_BOOKS.md) 和 [OPERATION_MANUAL.md](./OPERATION_MANUAL.md)
- 🧪 **运行测试**：查看 [testing/TESTING.md](./testing/TESTING.md)

---

**最后更新**：2024-12-08

## 重要更新

### v2.0 (2024-12-08)

- ✅ **新增操作手册**：[OPERATION_MANUAL.md](./OPERATION_MANUAL.md) - 完整的数据提取与发布操作指南
- ✅ **流程优化**：简化数据提取和发布流程，从 5-6 步减少到 3-4 步
- ✅ **系统集成**：LLM 提取功能已集成到系统中，无需线下脚本
- ✅ **批量操作**：支持批量审核和发布，提高操作效率

