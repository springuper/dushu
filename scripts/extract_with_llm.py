#!/usr/bin/env python3
"""
LLM 批量提取脚本
从历史文本中提取人物、关系、地点、事件数据

支持 OpenAI 和 Google Gemini API

使用方法:
    python extract_with_llm.py --input chapters.txt --type person --output extracted_persons.json
"""

import json
import argparse
import os
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# 加载环境变量
from dotenv import load_dotenv

# 加载 .env 文件（从项目根目录）
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# 检测可用的 API
USE_GEMINI = False
USE_OPENAI = False

try:
    import google.generativeai as genai
    USE_GEMINI = True
except ImportError:
    pass

try:
    from openai import OpenAI
    USE_OPENAI = True
except ImportError:
    pass

if not USE_GEMINI and not USE_OPENAI:
    print("错误: 请安装以下任一库:")
    print("  - Google Gemini: pip install google-generativeai")
    print("  - OpenAI: pip install openai")
    exit(1)


class LLMExtractor:
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None, provider: str = "auto"):
        """
        初始化 LLM 提取器
        
        Args:
            api_key: API Key（OpenAI 或 Gemini）
            base_url: 自定义 API 地址（仅 OpenAI）
            model: 模型名称
            provider: API 提供商 ("openai", "gemini", "auto")
        """
        self.provider = provider
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        
        # 自动检测提供商
        if provider == "auto":
            if USE_GEMINI and (api_key or os.getenv("GOOGLE_API_KEY")):
                self.provider = "gemini"
            elif USE_OPENAI and (api_key or os.getenv("OPENAI_API_KEY")):
                self.provider = "openai"
            else:
                # 根据可用的库选择
                if USE_GEMINI:
                    self.provider = "gemini"
                elif USE_OPENAI:
                    self.provider = "openai"
                else:
                    raise ValueError("没有可用的 API 库")
        
        # 初始化对应的客户端
        if self.provider == "gemini":
            genai_key = api_key or os.getenv("GOOGLE_API_KEY")
            if not genai_key:
                raise ValueError("需要设置 GOOGLE_API_KEY 环境变量或通过 --api-key 参数提供")
            genai.configure(api_key=genai_key)
            self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
            self.client = genai.GenerativeModel(self.model)
        else:  # OpenAI
            self.client = OpenAI(
                api_key=api_key or os.getenv("OPENAI_API_KEY"),
                base_url=base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            )
            self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def extract_persons(self, text: str) -> List[Dict[str, Any]]:
        """提取人物信息"""
        prompt = f"""请从以下历史文本中提取所有主要人物信息，返回 JSON 数组格式。

要求：
1. 提取所有出现的主要人物（至少出现2次或对情节有重要影响）
2. 每个人物包含以下字段：
   - name: 人物姓名（必填）
   - aliases: 别名列表（可选，如字、号等）
   - role: 角色类型（EMPEROR/GENERAL/MINISTER/SCHOLAR/OTHER）
   - faction: 所属势力（可选）
   - birthYear: 出生年份（可选，格式：公元前XX年 或 公元XX年）
   - deathYear: 死亡年份（可选）
   - activePeriod: 活跃时期（可选，格式：{{"start": "公元前XX年", "end": "公元前XX年"}}）
   - biography: 人物简介（100-300字，必填）
   - keyEvents: 关键事件列表（可选，字符串数组）

3. 只返回 JSON 数组，不要其他说明文字

文本内容：
{text}

返回格式示例：
[
  {{
    "name": "刘邦",
    "aliases": ["汉高祖", "沛公"],
    "role": "EMPEROR",
    "faction": "汉",
    "birthYear": "公元前256年",
    "deathYear": "公元前195年",
    "activePeriod": {{"start": "公元前209年", "end": "公元前195年"}},
    "biography": "刘邦是汉朝开国皇帝...",
    "keyEvents": ["起义", "建立汉朝"]
  }}
]
"""

        if self.provider == "gemini":
            # Gemini API
            full_prompt = f"你是一个专业的历史文本分析助手，擅长从文本中提取结构化数据。\n\n{prompt}"
            response = self.client.generate_content(
                full_prompt,
                generation_config={
                    "temperature": 0.3,
                }
            )
            content = response.text.strip()
        else:
            # OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的历史文本分析助手，擅长从文本中提取结构化数据。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content.strip()
        
        # 尝试提取 JSON（可能包含 markdown 代码块）
        if content.startswith("```"):
            # 移除 markdown 代码块标记
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
        
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            print(f"JSON 解析错误: {e}")
            print(f"原始内容: {content[:500]}")
            return []

    def extract_relationships(self, text: str, persons: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """提取人物关系"""
        person_names = [p.get("name") for p in (persons or [])]
        person_list = ", ".join(person_names[:20])  # 限制长度
        
        prompt = f"""请从以下历史文本中提取人物之间的关系，返回 JSON 数组格式。

要求：
1. 提取所有明确提到的人物关系
2. 每个关系包含以下字段：
   - sourceId: 源人物ID（格式：person_姓名拼音，如 person_liubang）
   - targetId: 目标人物ID
   - type: 关系类型（ALLY/ENEMY/SUPERIOR/SUBORDINATE/KINSHIP/TEACHER_STUDENT/OTHER）
   - description: 关系描述（100-300字，必填）
   - referenceChapters: 参考章节列表（可选，字符串数组）
   - confidence: 可信等级（1-5，5最可信）
   - timeRange: 关系时间范围（可选，格式：{{"start": "公元前XX年", "end": "公元前XX年"}}）

3. 只返回 JSON 数组，不要其他说明文字

已知人物列表（供参考）：
{person_list}

文本内容：
{text}

返回格式示例：
[
  {{
    "sourceId": "person_liubang",
    "targetId": "person_xiaohe",
    "type": "SUPERIOR",
    "description": "刘邦与萧何是沛县同乡，萧何是刘邦的重要谋士和丞相，关系密切。",
    "referenceChapters": ["chapter_1"],
    "confidence": 5,
    "timeRange": {{"start": "公元前209年", "end": "公元前195年"}}
  }}
]
"""

        if self.provider == "gemini":
            full_prompt = f"你是一个专业的历史文本分析助手，擅长从文本中提取人物关系。\n\n{prompt}"
            response = self.client.generate_content(
                full_prompt,
                generation_config={
                    "temperature": 0.3,
                }
            )
            content = response.text.strip()
        else:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的历史文本分析助手，擅长从文本中提取人物关系。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
        
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            print(f"JSON 解析错误: {e}")
            print(f"原始内容: {content[:500]}")
            return []

    def extract_places(self, text: str) -> List[Dict[str, Any]]:
        """提取地点信息"""
        prompt = f"""请从以下历史文本中提取所有地点信息，返回 JSON 数组格式。

要求：
1. 提取所有明确提到的地点（城池、战场、河流、山脉等）
2. 每个地点包含以下字段：
   - name: 历史名称（必填）
   - modernName: 现代地理名称（可选，如 "江苏省徐州市沛县"）
   - coordinates: 经纬度坐标（必填，格式：{{"lng": 116.937, "lat": 34.729}}）
   - type: 地点类型（CITY/BATTLEFIELD/RIVER/MOUNTAIN/REGION/OTHER）
   - faction: 所属势力（可选）
   - relatedEvents: 相关事件列表（可选，字符串数组）
   - description: 地点描述（100-200字，必填）
   - firstAppearance: 首次出现位置（可选，格式：{{"chapterId": "chapter_1", "paragraphId": "para_1"}}）

3. 只返回 JSON 数组，不要其他说明文字

文本内容：
{text}

返回格式示例：
[
  {{
    "name": "沛县",
    "modernName": "江苏省徐州市沛县",
    "coordinates": {{"lng": 116.937, "lat": 34.729}},
    "type": "CITY",
    "faction": "汉",
    "relatedEvents": ["event_1"],
    "description": "刘邦的故乡，位于今江苏省北部，是汉朝的重要发源地。"
  }}
]
"""

        if self.provider == "gemini":
            full_prompt = f"你是一个专业的历史文本分析助手，擅长从文本中提取地理信息。\n\n{prompt}"
            response = self.client.generate_content(
                full_prompt,
                generation_config={
                    "temperature": 0.3,
                }
            )
            content = response.text.strip()
        else:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的历史文本分析助手，擅长从文本中提取地理信息。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
        
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            print(f"JSON 解析错误: {e}")
            print(f"原始内容: {content[:500]}")
            return []

    def extract_events(self, text: str) -> List[Dict[str, Any]]:
        """提取事件信息"""
        prompt = f"""请从以下历史文本中提取所有重要事件，返回 JSON 数组格式。

要求：
1. 提取所有对情节有重要影响的事件（战争、政治事件、人物重要行动等）
2. 每个事件包含以下字段：
   - name: 事件名称（必填）
   - timeRange: 时间范围（必填，格式：{{"start": "公元前XX年", "end": "公元前XX年", "lunarCalendar": false}}）
   - locationId: 地点ID（可选，格式：place_地点拼音）
   - chapterId: 章节ID（可选）
   - summary: 事件摘要（200-500字，必填）
   - type: 事件类型（WAR/POLITICS/ECONOMY/CULTURE/OTHER）
   - impact: 影响描述（可选，100-200字）
   - relatedParagraphs: 相关段落列表（可选，字符串数组）
   - participants: 参与者ID列表（可选，格式：["person_liubang", "person_xiangyu"]）

3. 只返回 JSON 数组，不要其他说明文字

文本内容：
{text}

返回格式示例：
[
  {{
    "name": "鸿门宴",
    "timeRange": {{"start": "公元前206年", "end": "公元前206年", "lunarCalendar": false}},
    "locationId": "place_hongmen",
    "summary": "刘邦与项羽在鸿门举行宴会，范增欲杀刘邦，但项羽未采纳...",
    "type": "POLITICS",
    "impact": "标志着楚汉之争的开始",
    "participants": ["person_liubang", "person_xiangyu"]
  }}
]
"""

        if self.provider == "gemini":
            full_prompt = f"你是一个专业的历史文本分析助手，擅长从文本中提取历史事件。\n\n{prompt}"
            response = self.client.generate_content(
                full_prompt,
                generation_config={
                    "temperature": 0.3,
                }
            )
            content = response.text.strip()
        else:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的历史文本分析助手，擅长从文本中提取历史事件。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
        
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            print(f"JSON 解析错误: {e}")
            print(f"原始内容: {content[:500]}")
            return []


def main():
    parser = argparse.ArgumentParser(description="LLM 批量提取脚本")
    parser.add_argument("--input", "-i", required=True, help="输入文本文件路径")
    parser.add_argument("--type", "-t", required=True, choices=["person", "relationship", "place", "event"],
                       help="提取类型")
    parser.add_argument("--output", "-o", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--api-key", help="API Key（OpenAI 或 Gemini，或设置环境变量）")
    parser.add_argument("--base-url", help="自定义 API 地址（仅 OpenAI，或设置 OPENAI_BASE_URL 环境变量）")
    parser.add_argument("--model", help="模型名称（默认: OpenAI=gpt-4o-mini, Gemini=gemini-2.5-flash）")
    parser.add_argument("--provider", choices=["openai", "gemini", "auto"], default="auto", 
                       help="API 提供商（默认: auto，自动检测）")
    parser.add_argument("--persons-file", help="人物 JSON 文件路径（提取关系时需要）")

    args = parser.parse_args()

    # 读取输入文件
    try:
        with open(args.input, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        print(f"错误: 文件不存在: {args.input}")
        return 1

    # 初始化提取器
    extractor = LLMExtractor(
        api_key=args.api_key, 
        base_url=args.base_url, 
        model=args.model,
        provider=args.provider
    )

    # 读取人物数据（如果需要）
    persons = None
    if args.type == "relationship" and args.persons_file:
        try:
            with open(args.persons_file, "r", encoding="utf-8") as f:
                persons = json.load(f)
        except FileNotFoundError:
            print(f"警告: 人物文件不存在: {args.persons_file}")

    # 提取数据
    print(f"正在提取 {args.type} 数据...")
    if args.type == "person":
        results = extractor.extract_persons(text)
    elif args.type == "relationship":
        results = extractor.extract_relationships(text, persons)
    elif args.type == "place":
        results = extractor.extract_places(text)
    elif args.type == "event":
        results = extractor.extract_events(text)
    else:
        print(f"错误: 未知类型: {args.type}")
        return 1

    # 保存结果
    output_data = {
        "extractedAt": datetime.now().isoformat(),
        "sourceFile": args.input,
        "type": args.type,
        "count": len(results),
        "data": results,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"✅ 提取完成: {len(results)} 条记录已保存到 {args.output}")
    return 0


if __name__ == "__main__":
    exit(main())

