#!/usr/bin/env python3
"""
scraper.py — AI Workflow / Content Automation article scraper
============================================================
対象ソース:
  1. Zapier Blog           https://zapier.com/blog/feeds/latest/
  2. Make.com Blog         https://www.make.com/en/blog/feed
  3. TechCrunch (AI)       https://techcrunch.com/category/artificial-intelligence/feed/

取得した記事 (title / url / published_date / source / tags) を
data/stories.json に重複なく追記します。

使い方:
  python3 scraper.py              # 通常実行
  python3 scraper.py --dry-run    # 保存せず結果だけ表示
  python3 scraper.py --limit 10   # ソースごとの取得上限を変更 (デフォルト 20)
"""

import argparse
import hashlib
import json
import logging
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from email.utils import parsedate_to_datetime

try:
    import feedparser
    import requests
except ImportError:
    sys.exit(
        "依存ライブラリが見つかりません。\n"
        "  pip install feedparser requests"
    )

# ─── 設定 ──────────────────────────────────────────────────────────────────

DATA_FILE = Path(__file__).parent / "data" / "stories.json"

SOURCES = [
    {
        "name": "Zapier Blog",
        "feed_url": "https://zapier.com/blog/feeds/latest/",
        "category": "Automation",
    },
    {
        "name": "Make.com Blog",
        "feed_url": "https://www.make.com/en/blog/feed",
        "category": "Automation",
    },
    {
        "name": "TechCrunch AI",
        "feed_url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "category": "AI",
    },
]

# キーワードフィルター（いずれかが title/summary に含まれれば採用）
KEYWORDS = [
    "automation", "workflow", "ai workflow", "content automation",
    "no-code", "low-code", "zapier", "make.com", "integromat",
    "automate", "ai agent", "llm", "gpt", "generative ai",
    "artificial intelligence", "machine learning",
    "rpa", "process automation", "n8n", "airtable",
]

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; AI-Success-Tracker/1.0; "
        "+https://github.com/your-repo/ai-success-tracker)"
    ),
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
}

REQUEST_TIMEOUT = 20   # seconds
RETRY_WAIT     = 3     # seconds between retries
MAX_RETRIES    = 2

# ─── データモデル ──────────────────────────────────────────────────────────

@dataclass
class Article:
    id: str
    title: str
    url: str
    published_date: str          # ISO-8601 文字列
    source: str
    category: str
    summary: str
    tags: list[str] = field(default_factory=list)
    scraped_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @staticmethod
    def make_id(url: str) -> str:
        """URL の SHA-256 先頭 12 文字を ID として使用"""
        return hashlib.sha256(url.encode()).hexdigest()[:12]


# ─── ユーティリティ ────────────────────────────────────────────────────────

def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        level=level,
    )
    return logging.getLogger("scraper")


def parse_date(entry) -> str:
    """feedparser エントリから ISO-8601 日付文字列を返す。失敗時は現在時刻。"""
    for attr in ("published", "updated", "created"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                dt = parsedate_to_datetime(raw)
                return dt.astimezone(timezone.utc).isoformat()
            except Exception:
                pass
    # feedparser が parsed_struct を持つ場合
    for attr in ("published_parsed", "updated_parsed"):
        st = getattr(entry, attr, None)
        if st:
            try:
                dt = datetime(*st[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except Exception:
                pass
    return datetime.now(timezone.utc).isoformat()


def extract_summary(entry, max_len: int = 300) -> str:
    """記事の概要テキストを取得・クリーニング"""
    import html as html_mod
    import re

    raw = (
        getattr(entry, "summary", "")
        or getattr(entry, "description", "")
        or getattr(entry, "content", [{}])[0].get("value", "") if hasattr(entry, "content") else ""
    )
    # HTMLタグ除去
    clean = re.sub(r"<[^>]+>", "", str(raw))
    clean = html_mod.unescape(clean)
    clean = " ".join(clean.split())
    return clean[:max_len].rstrip() + ("…" if len(clean) > max_len else "")


def is_relevant(entry) -> bool:
    """タイトル・サマリーにキーワードが含まれるか判定（大文字小文字無視）"""
    haystack = " ".join([
        getattr(entry, "title", ""),
        getattr(entry, "summary", ""),
        getattr(entry, "description", ""),
    ]).lower()
    return any(kw in haystack for kw in KEYWORDS)


def extract_tags(entry, source_tags: list[str]) -> list[str]:
    """feedparser タグ＋ソース固有タグをマージして返す"""
    tags = set(source_tags)
    for tag in getattr(entry, "tags", []):
        term = getattr(tag, "term", "") or getattr(tag, "label", "")
        if term:
            tags.add(term.strip()[:30])
    return sorted(tags)[:8]   # 最大 8 件


# ─── RSS フェッチ ──────────────────────────────────────────────────────────

def fetch_feed(source: dict, limit: int, log: logging.Logger) -> list[Article]:
    """1つのソースから Article リストを取得して返す"""
    name     = source["name"]
    feed_url = source["feed_url"]
    category = source["category"]

    log.info(f"📡  {name} → {feed_url}")

    raw_content: Optional[bytes] = None
    for attempt in range(1, MAX_RETRIES + 2):
        try:
            resp = requests.get(
                feed_url,
                headers=REQUEST_HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            raw_content = resp.content
            break
        except requests.exceptions.HTTPError as e:
            log.warning(f"  HTTP エラー ({e.response.status_code}): {e}")
            if e.response.status_code in (403, 404, 410):
                log.error(f"  ⛔  {name}: アクセス不可 (永続的エラー) — スキップ")
                return []
        except requests.exceptions.ConnectionError as e:
            log.warning(f"  接続エラー (試行 {attempt}): {e}")
        except requests.exceptions.Timeout:
            log.warning(f"  タイムアウト (試行 {attempt})")
        except requests.exceptions.RequestException as e:
            log.warning(f"  リクエストエラー (試行 {attempt}): {e}")

        if attempt <= MAX_RETRIES:
            log.info(f"  {RETRY_WAIT}秒後にリトライ…")
            time.sleep(RETRY_WAIT)
        else:
            log.error(f"  ⛔  {name}: {MAX_RETRIES + 1}回試行後も失敗 — スキップ")
            return []

    feed = feedparser.parse(raw_content)

    if feed.bozo and not feed.entries:
        log.warning(f"  ⚠️  フィードの解析に問題: {feed.bozo_exception}")

    log.info(f"  取得: {len(feed.entries)} 件のエントリ")

    articles: list[Article] = []
    skipped = 0

    for entry in feed.entries[:limit]:
        if not is_relevant(entry):
            skipped += 1
            continue

        url = getattr(entry, "link", "") or getattr(entry, "id", "")
        if not url:
            continue

        article = Article(
            id             = Article.make_id(url),
            title          = getattr(entry, "title", "（タイトルなし）").strip(),
            url            = url,
            published_date = parse_date(entry),
            source         = name,
            category       = category,
            summary        = extract_summary(entry),
            tags           = extract_tags(entry, [category, "AI", "Automation"]),
        )
        articles.append(article)

    log.info(
        f"  ✅  マッチ: {len(articles)} 件  /  キーワード外スキップ: {skipped} 件"
    )
    return articles


# ─── stories.json 読み書き ─────────────────────────────────────────────────

def load_existing(path: Path, log: logging.Logger) -> tuple[list[dict], set[str]]:
    """既存 JSON を読み込み (データリスト, 既存URL集合) を返す"""
    if not path.exists():
        log.info(f"  {path} が存在しないため新規作成します")
        return [], set()

    with path.open(encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            log.error(f"  JSON パースエラー: {e}  → バックアップして空リストで開始")
            backup = path.with_suffix(f".bak.{int(time.time())}.json")
            path.rename(backup)
            return [], set()

    if not isinstance(data, list):
        log.warning("  stories.json のルートが配列ではありません — スクレイパー記事専用ファイルを別途作成します")
        return [], set()

    # URL または id で既存を認識
    existing_urls = {
        item.get("url", "") for item in data if isinstance(item, dict)
    }
    existing_ids  = {
        item.get("id", "")  for item in data if isinstance(item, dict)
    }
    return data, existing_urls | existing_ids


def save_stories(path: Path, data: list[dict], log: logging.Logger) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log.info(f"  💾  保存完了: {path}  ({len(data)} 件)")


# ─── メイン ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="AI Workflow / Content Automation 記事スクレイパー"
    )
    parser.add_argument("--dry-run",  action="store_true",
                        help="stories.json を更新せずに結果だけ表示")
    parser.add_argument("--limit",    type=int, default=20,
                        help="ソースごとに取得するエントリ上限 (デフォルト: 20)")
    parser.add_argument("--verbose",  action="store_true",
                        help="デバッグログを表示")
    parser.add_argument("--output",   type=str, default=str(DATA_FILE),
                        help=f"保存先 JSON パス (デフォルト: {DATA_FILE})")
    args = parser.parse_args()

    log = setup_logging(args.verbose)
    output_path = Path(args.output)

    log.info("=" * 55)
    log.info("  AI Success Tracker — RSS Scraper 起動")
    log.info(f"  出力先  : {output_path}")
    log.info(f"  上限    : {args.limit} 件/ソース")
    log.info(f"  Dry-run : {args.dry_run}")
    log.info("=" * 55)

    # 既存データ読み込み
    existing_data, existing_keys = load_existing(output_path, log)
    log.info(f"既存エントリ数: {len(existing_data)}")

    # 全ソースから記事を収集
    all_new: list[Article] = []
    fetch_errors: list[str] = []

    for source in SOURCES:
        try:
            articles = fetch_feed(source, args.limit, log)
            all_new.extend(articles)
        except Exception as e:
            log.error(f"予期しないエラー [{source['name']}]: {e}", exc_info=args.verbose)
            fetch_errors.append(source["name"])

    # 重複チェック & 追加
    added: list[Article] = []
    dupes = 0

    for art in all_new:
        if art.url in existing_keys or art.id in existing_keys:
            dupes += 1
            log.debug(f"  SKIP (重複): {art.title[:60]}")
            continue
        added.append(art)
        existing_keys.add(art.url)
        existing_keys.add(art.id)

    # 結果サマリー
    log.info("")
    log.info("─" * 55)
    log.info(f"  新規追加: {len(added)} 件  /  重複スキップ: {dupes} 件")
    if fetch_errors:
        log.warning(f"  取得失敗ソース: {', '.join(fetch_errors)}")
    log.info("─" * 55)

    if added:
        log.info("\n新規記事一覧:")
        for i, art in enumerate(added, 1):
            log.info(f"  {i:>2}. [{art.source}] {art.title[:65]}")
            log.info(f"      {art.url}")
            log.info(f"      公開日: {art.published_date[:10]}")

    # 保存
    if args.dry_run:
        log.info("\n⚡  Dry-run モード — ファイルは更新しません")
    elif added:
        new_records = [asdict(a) for a in added]
        updated_data = existing_data + new_records
        save_stories(output_path, updated_data, log)
        log.info(f"\n✅  完了。合計 {len(updated_data)} 件のエントリが保存されました。")
    else:
        log.info("\n✅  新規記事はありません。stories.json は変更されていません。")


if __name__ == "__main__":
    main()
