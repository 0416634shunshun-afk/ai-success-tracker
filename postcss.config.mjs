#!/usr/bin/env python3
"""
analyze.py — AI事例の日本語分析スクリプト
==========================================
data/stories.json の各エントリを Claude / Gemini API で解析し、
以下の4項目を日本語で抽出して JSON を更新します:

  1. ja_summary          : 事例の要約（3行）
  2. ja_ai_tools         : 使用AIツールの組み合わせ
  3. ja_monetization     : 具体的なマネタイズ手法
  4. ja_japan_advice     : 日本の個人ビジネスへの転用アドバイス

使い方:
  python3 analyze.py                    # 未分析のみ処理
  python3 analyze.py --force            # 全件を再分析（上書き）
  python3 analyze.py --id 1 3           # 指定IDのみ処理
  python3 analyze.py --provider gemini  # Gemini を使用
  python3 analyze.py --dry-run          # API を呼ばずプロンプトだけ表示
  python3 analyze.py --delay 2.0        # API 呼び出し間隔を変更（秒）
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# ─── 依存チェック ──────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("python-dotenv が必要です: pip install python-dotenv")

# ─── 設定 ──────────────────────────────────────────────────────────────────

BASE_DIR  = Path(__file__).parent
DATA_FILE = BASE_DIR / "data" / "stories.json"
ENV_FILE  = BASE_DIR / ".env"

DEFAULT_PROVIDER   = "claude"
DEFAULT_DELAY      = 1.5    # API 呼び出し間隔（秒）
CLAUDE_MODEL       = "claude-opus-4-5"
GEMINI_MODEL       = "gemini-1.5-flash"

# ─── データクラス ──────────────────────────────────────────────────────────

@dataclass
class JapaneseAnalysis:
    """Claude / Gemini から抽出した日本語分析結果"""
    summary: str        # 要約3行
    ai_tools: str       # AIツールの組み合わせ
    monetization: str   # マネタイズ手法
    japan_advice: str   # 日本向けアドバイス
    model_used: str     # 使用モデル名
    analyzed_at: str    # 分析日時 (ISO-8601)


# ─── プロンプト ────────────────────────────────────────────────────────────

def build_prompt(story: dict) -> str:
    """分析プロンプトを組み立てる"""
    return f"""以下はAI活用事例の英語データです。このデータを日本語で詳しく分析してください。

=== 事例データ ===
企業名: {story.get('company', '不明')}
国: {story.get('country', '不明')}
業界: {story.get('industry', '不明')}
タイトル: {story.get('title', '')}
概要: {story.get('summary', '')}
インパクト: {story.get('impact', '')}
指標: {json.dumps(story.get('metrics', {}), ensure_ascii=False)}
タグ: {', '.join(story.get('tags', []))}
年: {story.get('year', '不明')}
================

以下の4点を、指定のJSON形式で出力してください。
余分な説明文・マークダウン・コードブロックは不要です。JSONのみを出力してください。

{{
  "summary": "事例の要約を3行で記述。1行目：何をしたか。2行目：どんな技術・仕組みを使ったか。3行目：どんな成果が出たか。各行を改行(\\n)で区切ること。",
  "ai_tools": "使用されているAIツール・技術・プラットフォームの組み合わせを具体的に列挙。不明な場合は事例から推測して記述。",
  "monetization": "このAI活用によって実現した具体的な収益化・コスト削減・価値創出の手法を詳しく説明。数字があれば必ず含めること。",
  "japan_advice": "日本の個人ビジネス（フリーランス・スモールビジネス・副業）がこの事例を参考にする際の、具体的で実践的なアドバイスを3〜5点。どのツールを使い、何から始めるべきかを明記すること。"
}}"""


# ─── API クライアント ──────────────────────────────────────────────────────

def call_claude(prompt: str, api_key: str) -> tuple[str, str]:
    """Claude API を呼び出してテキストと使用モデルを返す"""
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("anthropic ライブラリが必要です: pip install anthropic")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text, CLAUDE_MODEL


def call_gemini(prompt: str, api_key: str) -> tuple[str, str]:
    """Gemini API を呼び出してテキストと使用モデルを返す"""
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError(
            "google-generativeai ライブラリが必要です: pip install google-generativeai"
        )

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(prompt)
    return response.text, GEMINI_MODEL


def call_api(prompt: str, provider: str, api_key: str) -> tuple[str, str]:
    """プロバイダーに応じて API を呼び出す"""
    if provider == "claude":
        return call_claude(prompt, api_key)
    elif provider == "gemini":
        return call_gemini(prompt, api_key)
    else:
        raise ValueError(f"未知のプロバイダー: {provider}")


# ─── JSON パース ──────────────────────────────────────────────────────────

def extract_json(raw: str) -> dict:
    """
    LLM レスポンスから JSON を抽出してパース。
    コードブロックやプリアンブルが含まれていても対応。
    """
    # コードブロック除去
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()

    # 最初の { から最後の } を抽出
    start = cleaned.find("{")
    end   = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"JSONが見つかりません。レスポンス:\n{raw[:300]}")

    json_str = cleaned[start:end]
    return json.loads(json_str)


def parse_analysis(raw: str, model_used: str) -> JapaneseAnalysis:
    """API レスポンスを JapaneseAnalysis に変換"""
    from datetime import datetime, timezone

    data = extract_json(raw)

    def get(key: str) -> str:
        val = data.get(key, "")
        if not isinstance(val, str):
            val = str(val)
        return val.strip() or "（情報なし）"

    return JapaneseAnalysis(
        summary      = get("summary"),
        ai_tools     = get("ai_tools"),
        monetization = get("monetization"),
        japan_advice = get("japan_advice"),
        model_used   = model_used,
        analyzed_at  = datetime.now(timezone.utc).isoformat(),
    )


# ─── ログ設定 ──────────────────────────────────────────────────────────────

def setup_logging(verbose: bool) -> logging.Logger:
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        level=logging.DEBUG if verbose else logging.INFO,
    )
    return logging.getLogger("analyze")


# ─── メイン処理 ───────────────────────────────────────────────────────────

def load_stories(path: Path, log: logging.Logger) -> list[dict]:
    if not path.exists():
        log.error(f"ファイルが見つかりません: {path}")
        sys.exit(1)
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_stories(path: Path, stories: list[dict], log: logging.Logger) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.json")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(stories, f, ensure_ascii=False, indent=2)
    tmp.replace(path)   # アトミックな置換
    log.info(f"💾  保存: {path}  ({len(stories)} 件)")


def needs_analysis(story: dict, force: bool) -> bool:
    """分析が必要かどうか判定"""
    if force:
        return True
    ja = story.get("ja_analysis")
    if not ja:
        return True
    # 4項目が揃っているか確認
    required = ["summary", "ai_tools", "monetization", "japan_advice"]
    return not all(ja.get(k) for k in required)


def print_analysis(story: dict, analysis: JapaneseAnalysis, log: logging.Logger) -> None:
    """分析結果をコンソールに表示"""
    sep = "─" * 55
    log.info(sep)
    log.info(f"【{story['company']}】 {story['title']}")
    log.info(sep)
    log.info("📝 要約:")
    for line in analysis.summary.split("\n"):
        log.info(f"   {line}")
    log.info(f"🔧 AIツール: {analysis.ai_tools[:80]}{'...' if len(analysis.ai_tools)>80 else ''}")
    log.info(f"💰 マネタイズ: {analysis.monetization[:80]}{'...' if len(analysis.monetization)>80 else ''}")
    log.info(f"🇯🇵 日本向けアドバイス: {analysis.japan_advice[:80]}{'...' if len(analysis.japan_advice)>80 else ''}")
    log.info(f"   使用モデル: {analysis.model_used}  /  分析日時: {analysis.analyzed_at[:19]}")


def main() -> None:
    # ─ 引数パース ─
    parser = argparse.ArgumentParser(description="AI事例の日本語分析スクリプト")
    parser.add_argument("--force",    action="store_true",
                        help="既存の分析結果も上書き（全件再分析）")
    parser.add_argument("--id",       nargs="+", metavar="ID",
                        help="処理対象の ID を指定（例: --id 1 3 5）")
    parser.add_argument("--provider", choices=["claude", "gemini"], default=None,
                        help="使用する AI プロバイダー（.env の AI_PROVIDER より優先）")
    parser.add_argument("--dry-run",  action="store_true",
                        help="API を呼ばずプロンプトだけ表示")
    parser.add_argument("--delay",    type=float, default=DEFAULT_DELAY,
                        help=f"API 呼び出し間隔（秒、デフォルト: {DEFAULT_DELAY}）")
    parser.add_argument("--input",    default=str(DATA_FILE),
                        help=f"入力 JSON パス（デフォルト: {DATA_FILE}）")
    parser.add_argument("--verbose",  action="store_true",
                        help="デバッグログを表示")
    args = parser.parse_args()

    log = setup_logging(args.verbose)

    # ─ .env 読み込み ─
    load_dotenv(ENV_FILE)
    log.debug(f".env 読み込み: {ENV_FILE}")

    # ─ プロバイダー & APIキー決定 ─
    provider = args.provider or os.getenv("AI_PROVIDER", DEFAULT_PROVIDER).lower()
    log.info(f"プロバイダー: {provider}")

    api_key: Optional[str] = None
    if not args.dry_run:
        if provider == "claude":
            api_key = os.getenv("ANTHROPIC_API_KEY", "")
            if not api_key or api_key == "your_anthropic_api_key_here":
                log.error(
                    "ANTHROPIC_API_KEY が設定されていません。\n"
                    "  .env ファイルに ANTHROPIC_API_KEY=sk-ant-... を設定してください。"
                )
                sys.exit(1)
        elif provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY", "")
            if not api_key or api_key == "your_gemini_api_key_here":
                log.error(
                    "GEMINI_API_KEY が設定されていません。\n"
                    "  .env ファイルに GEMINI_API_KEY=AIza... を設定してください。"
                )
                sys.exit(1)

    # ─ データ読み込み ─
    input_path = Path(args.input)
    stories = load_stories(input_path, log)
    log.info(f"読み込み: {len(stories)} 件  ({input_path})")

    # ─ 対象フィルタリング ─
    target_ids = set(args.id) if args.id else None
    targets = [
        s for s in stories
        if (target_ids is None or str(s.get("id", "")) in target_ids)
        and needs_analysis(s, args.force)
    ]

    already_done = len(stories) - len(
        [s for s in stories if needs_analysis(s, args.force)]
    ) if not target_ids else 0

    log.info(
        f"処理対象: {len(targets)} 件  /  "
        f"スキップ（分析済み）: {already_done} 件"
    )

    if not targets:
        log.info("✅  処理対象がありません。--force で再分析できます。")
        return

    # ─ 分析ループ ─
    success = 0
    errors  = 0

    for i, story in enumerate(targets, 1):
        company = story.get("company", "?")
        sid     = story.get("id", "?")
        log.info(f"\n[{i}/{len(targets)}]  ID={sid}  {company}")

        prompt = build_prompt(story)

        if args.dry_run:
            log.info("--- DRY-RUN: プロンプト ---")
            print(prompt[:800] + "..." if len(prompt) > 800 else prompt)
            log.info("--- END ---")
            continue

        # API 呼び出し（リトライあり）
        last_error: Optional[Exception] = None
        raw_response = ""
        model_used   = ""

        for attempt in range(1, 4):
            try:
                log.debug(f"  API 呼び出し (試行 {attempt})…")
                raw_response, model_used = call_api(prompt, provider, api_key)
                log.debug(f"  レスポンス受信 ({len(raw_response)} 文字)")
                break
            except Exception as e:
                last_error = e
                log.warning(f"  API エラー (試行 {attempt}): {e}")
                if attempt < 3:
                    wait = args.delay * attempt * 2
                    log.info(f"  {wait:.1f}秒後にリトライ…")
                    time.sleep(wait)

        if not raw_response:
            log.error(f"  ⛔  {company}: API 失敗 → {last_error}")
            errors += 1
            continue

        # レスポンスをパース
        try:
            analysis = parse_analysis(raw_response, model_used)
        except (ValueError, json.JSONDecodeError) as e:
            log.error(f"  ⛔  {company}: JSON パース失敗 → {e}")
            log.debug(f"  生レスポンス:\n{raw_response[:500]}")
            errors += 1
            continue

        # story に ja_analysis を追加
        story["ja_analysis"] = {
            "summary":      analysis.summary,
            "ai_tools":     analysis.ai_tools,
            "monetization": analysis.monetization,
            "japan_advice": analysis.japan_advice,
            "model_used":   analysis.model_used,
            "analyzed_at":  analysis.analyzed_at,
        }

        print_analysis(story, analysis, log)
        success += 1

        # 1件ごとに保存（途中クラッシュ対策）
        save_stories(input_path, stories, log)

        # レート制限対策
        if i < len(targets):
            log.debug(f"  {args.delay}秒待機…")
            time.sleep(args.delay)

    # ─ 最終サマリー ─
    log.info("")
    log.info("=" * 55)
    log.info(f"  完了  ✅ 成功: {success} 件  ❌ 失敗: {errors} 件")
    if args.dry_run:
        log.info("  （Dry-run モード: ファイルは更新されていません）")
    log.info("=" * 55)


if __name__ == "__main__":
    main()
