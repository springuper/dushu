# 渐进式数据准备工作流

> **注意**：本文档是操作指南，技术规范请参考 [数据获取与融合规格书](../specs/data-acquisition-and-merge-spec.md)。

本文档提供一个渐进式的工作流，从最小单元开始，逐步扩展数据。适合第一次使用或想要验证流程的场景。

## 🎯 工作流概览

```
阶段 1: 验证流程（1个人物）
  ↓
阶段 2: 扩展人物（章节所有主要人物）
  ↓
阶段 3: 添加关系（人物之间的关系）
  ↓
阶段 4: 添加地点和事件（完善数据）
  ↓
阶段 5: 扩展到更多章节
```

---

## 📋 前置检查清单

在开始之前，请确认：

- [ ] Node.js 依赖已安装（运行过 `npm install` 和 `npx playwright install chromium`）
- [ ] Python 虚拟环境已设置（用于 LLM 提取脚本，运行过 `python3 -m venv venv` 和 `pip install -r scripts/requirements.txt`）
- [ ] API Key 已配置（`.env` 文件中有 `OPENAI_API_KEY` 或 `GOOGLE_API_KEY`）
- [ ] 数据库已启动（`podman compose up -d` 或本地 PostgreSQL）
- [ ] 后端服务已启动（`npm run dev:backend`）
- [ ] 前端服务已启动（`npm run dev:frontend`）
- [ ] 管理后台可以访问（http://localhost:5173/admin/login）
- [ ] 已有原始文本文件（`data/raw/shiji/shiji_01_gaozu_benji.txt`）

---

## 🚀 阶段 1：验证流程（从 1 个人物开始）

**目标**：验证整个流程是否正常工作，从提取到审核到导入。

**预计时间**：15-20 分钟

### 步骤 1.1：准备测试文本（可选）

如果你想从更小的文本开始测试，可以创建一个只包含刘邦相关段落的测试文件：

```bash
# 创建测试文件（只包含前 10 个段落）
head -n 50 data/raw/shiji/shiji_01_gaozu_benji.txt > data/raw/shiji/shiji_01_gaozu_test.txt
```

或者直接使用完整文件。

### 步骤 1.2：提取人物数据

```bash
# 激活虚拟环境（如果还没激活）
source venv/bin/activate

# 提取人物数据
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type person \
  --output data/extracted/persons/shiji_01_gaozu_test_persons.json
```

**检查点**：
- [ ] 脚本运行成功，没有错误
- [ ] 生成了 JSON 文件
- [ ] JSON 文件格式正确（可以用 `cat` 或文本编辑器查看）

### 步骤 1.3：查看提取结果

```bash
# 查看提取的人物数据
cat data/extracted/persons/shiji_01_gaozu_test_persons.json | python -m json.tool | head -n 50
```

**检查点**：
- [ ] 至少提取到了"刘邦"这个人物
- [ ] 数据格式正确（有 name, biography 等字段）
- [ ] 数据质量看起来合理

### 步骤 1.4：导入到管理后台

1. 打开浏览器，访问：http://localhost:5173/admin/login
2. 使用管理员账号登录
3. 进入"批量导入"页面
4. 选择文件：`data/extracted/persons/shiji_01_gaozu_test_persons.json`
5. 选择类型：**人物**
6. 点击"开始导入"

**检查点**：
- [ ] 导入成功，显示导入的记录数
- [ ] 没有错误提示

### 步骤 1.5：审核数据

1. 进入"Review"页面
2. 查看待审核的人物数据
3. 点击一个记录查看详情
4. 检查数据：
   - 姓名是否正确
   - 传记信息是否完整
   - 是否有明显错误
5. 如果数据正确，点击"通过"
6. 如果有错误，可以"保存修改"后通过

**检查点**：
- [ ] 能够查看数据详情
- [ ] 能够通过审核
- [ ] 审核后的数据状态变为 `APPROVED`

### 步骤 1.6：验证数据已导入

1. 进入"内容管理" → "人物管理"
2. 查看已审核的人物
3. 确认能看到刚才审核通过的人物

**检查点**：
- [ ] 人物出现在列表中
- [ ] 可以查看详情
- [ ] 数据完整

---

## 📚 阶段 2：扩展人物（章节所有主要人物）

**目标**：提取章节中的所有主要人物，建立人物库。

**预计时间**：20-30 分钟

### 步骤 2.1：提取完整人物列表

使用完整文件提取所有人物：

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type person \
  --output data/extracted/persons/shiji_01_gaozu_persons.json
```

**检查点**：
- [ ] 提取了多个人物（至少 5-10 个）
- [ ] 包括主要人物：刘邦、项羽、萧何、张良等

### 步骤 2.2：查看提取结果

```bash
# 查看提取了多少人物
cat data/extracted/persons/shiji_01_gaozu_persons.json | python -m json.tool | grep -c '"name"'
```

**检查点**：
- [ ] 人物数量合理（《高祖本纪》应该有 10-20 个主要人物）
- [ ] 主要人物都在列表中

### 步骤 2.3：导入和审核

1. 在管理后台导入人物数据
2. 批量审核：
   - 先快速浏览所有待审核项
   - 标记明显错误的项
   - 逐个审核或批量操作

**检查点**：
- [ ] 所有主要人物都已导入
- [ ] 数据质量良好
- [ ] 没有重复的人物

---

## 🔗 阶段 3：添加关系（人物之间的关系）

**目标**：提取人物之间的关系，建立关系网络。

**预计时间**：20-30 分钟

### 步骤 3.1：提取关系数据

**注意**：关系提取需要人物列表作为参考。

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type relationship \
  --output data/extracted/relationships/shiji_01_gaozu_relationships.json \
  --persons-file data/extracted/persons/shiji_01_gaozu_persons.json
```

**检查点**：
- [ ] 提取了多个关系（至少 5-10 个）
- [ ] 关系类型多样（ALLY, SUPERIOR, KINSHIP 等）

### 步骤 3.2：查看提取结果

```bash
cat data/extracted/relationships/shiji_01_gaozu_relationships.json | python -m json.tool | head -n 80
```

**检查点**：
- [ ] 关系描述准确
- [ ] sourceId 和 targetId 格式正确（person_xxx）
- [ ] 关系类型合理

### 步骤 3.3：导入和审核

1. 在管理后台导入关系数据
2. 审核时注意：
   - 检查源人物和目标人物是否都存在
   - 关系类型是否准确
   - 关系描述是否合理

**检查点**：
- [ ] 关系数据已导入
- [ ] 关系网络可以查看（如果有可视化功能）

---

## 🗺️ 阶段 4：添加地点和事件（完善数据）

**目标**：提取地点和事件，完善数据维度。

**预计时间**：30-40 分钟

### 步骤 4.1：提取地点数据

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type place \
  --output data/extracted/places/shiji_01_gaozu_places.json
```

**注意**：LLM 可能无法准确提供坐标，需要人工补充。

### 步骤 4.2：提取事件数据

```bash
python scripts/extract_with_llm.py \
  --input data/raw/shiji/shiji_01_gaozu_benji.txt \
  --type event \
  --output data/extracted/events/shiji_01_gaozu_events.json
```

### 步骤 4.3：审核和补充

1. 导入地点数据，注意：
   - 检查坐标是否准确（可能需要手动查找）
   - 地点类型是否正确
   
2. 导入事件数据，注意：
   - 时间范围是否准确
   - 参与者是否正确
   - 事件描述是否完整

**检查点**：
- [ ] 地点数据已导入（坐标可能需要后续补充）
- [ ] 事件数据已导入
- [ ] 数据质量良好

---

## 📖 阶段 5：扩展到更多章节

**目标**：将流程应用到更多章节，建立更大的数据集。

**预计时间**：每章节 1-2 小时

### 步骤 5.1：选择下一个章节

建议顺序：
1. 《史记·项羽本纪》（与高祖本纪相关，人物有重叠）
2. 《史记·萧相国世家》（重要人物）
3. 《史记·留侯世家》（张良）

### 步骤 5.2：重复流程

对每个新章节：
1. 下载原始文本（如果还没有）
2. 预处理（如果需要）
3. 提取人物 → 导入 → 审核
4. 提取关系 → 导入 → 审核
5. 提取地点 → 导入 → 审核
6. 提取事件 → 导入 → 审核

### 步骤 5.3：处理重复数据

当处理多个章节时，可能会遇到：
- 重复的人物（如刘邦在多个章节出现）
- 重复的关系
- 重复的地点

**处理策略**：
- 在导入时，系统应该检测重复
- 在审核时，可以合并或更新已有数据
- 保持数据一致性

---

## 🛠️ 使用便捷脚本

如果不想手动输入命令，可以使用便捷脚本：

```bash
# 提取所有类型数据
./scripts/extract_data.sh data/raw/shiji/shiji_01_gaozu_benji.txt all

# 或只提取人物
./scripts/extract_data.sh data/raw/shiji/shiji_01_gaozu_benji.txt person
```

---

## ⚠️ 常见问题和解决方案

### 问题 1：API 调用失败

**症状**：脚本报错，提示 API Key 无效或网络错误

**解决**：
1. 检查 `.env` 文件中的 API Key 是否正确
2. 检查网络连接
3. 检查 API 配额是否用完

### 问题 2：提取的数据质量不好

**症状**：提取的人物信息不准确，有错别字或错误信息

**解决**：
1. 在审核时手动修正
2. 如果问题普遍，考虑优化提示词（修改 `extract_with_llm.py`）
3. 使用更高质量的模型（如 gpt-4）

### 问题 3：坐标信息缺失或不准确

**症状**：地点数据没有坐标或坐标错误

**解决**：
1. 这是正常的，LLM 可能无法准确提供历史坐标
2. 需要人工查找和补充
3. 可以使用现代地名查询坐标（如百度地图、高德地图）

### 问题 4：导入时出现重复

**症状**：导入时提示数据已存在

**解决**：
1. 这是正常的，系统会检测重复
2. 可以选择更新已有数据或跳过
3. 在审核时合并重复项

---

## 📊 进度跟踪

建议在 `data/PROGRESS.md` 中记录进度：

```markdown
## 当前进度

### 阶段 1：验证流程 ✅
- [x] 提取测试人物
- [x] 导入和审核
- [x] 验证流程

### 阶段 2：扩展人物 ✅
- [x] 提取所有人物
- [x] 导入和审核
- [x] 人物库建立

### 阶段 3：添加关系 🔄
- [x] 提取关系
- [ ] 导入和审核（进行中）

### 阶段 4：添加地点和事件 ⏳
- [ ] 待开始

### 阶段 5：扩展到更多章节 ⏳
- [ ] 待开始
```

---

## 🎉 完成标准

当你完成所有阶段后，你应该有：

- ✅ 至少 1 个章节的完整数据（人物、关系、地点、事件）
- ✅ 所有数据都已审核通过
- ✅ 熟悉整个工作流程
- ✅ 能够独立处理新章节

---

## 💡 下一步建议

1. **优化提取质量**：根据审核中发现的问题，优化提示词
2. **建立数据标准**：制定数据质量标准，确保一致性
3. **自动化流程**：考虑编写更多自动化脚本
4. **扩展数据源**：处理更多书籍和章节
5. **处理重复数据**：当从不同书籍提取到同一个人物时，使用融合功能（详见 [人物融合指南](./PERSON_MERGE_GUIDE.md)）

---

**最后更新**：2024-12-01

**需要帮助？** 查看：
- [完整操作手册](../docs/OPERATION_MANUAL.md)
- [README](../README.md)
- [快速开始指南](../docs/setup/QUICK_START.md)

