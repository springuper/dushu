#!/bin/bash
# 从 ~/.claude/settings.json 加载环境变量

CLAUDE_SETTINGS="$HOME/.claude/settings.json"

if [ ! -f "$CLAUDE_SETTINGS" ]; then
    echo "错误: 配置文件不存在: $CLAUDE_SETTINGS"
    exit 1
fi

# 使用 Python 或 Node.js 解析 JSON 并导出环境变量
# 这里使用 Python，因为它通常已经安装
python3 << 'PYTHON_SCRIPT'
import json
import os
import sys

settings_path = os.path.expanduser("~/.claude/settings.json")

try:
    with open(settings_path, 'r') as f:
        settings = json.load(f)
    
    if 'env' in settings:
        env_vars = settings['env']
        for key, value in env_vars.items():
            # 输出 export 命令
            print(f'export {key}="{value}"')
    else:
        print("警告: 配置文件中没有 'env' 字段", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"错误: 无法读取配置文件: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT
