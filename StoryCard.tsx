name: Daily AI Stories Update

on:
  # 毎日 JST 09:00（UTC 00:00）に自動実行
  schedule:
    - cron: "0 0 * * *"

  # GitHub の Actions タブから手動実行も可能
  workflow_dispatch:
    inputs:
      force_analyze:
        description: "既存の分析も上書きする (--force)"
        required: false
        default: "false"
        type: choice
        options:
          - "false"
          - "true"
      scraper_limit:
        description: "ソースごとの取得上限件数"
        required: false
        default: "20"

# data/stories.json の書き込み権限
permissions:
  contents: write

jobs:
  update-stories:
    name: Scrape → Analyze → Commit
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      # ── 1. リポジトリをチェックアウト ──────────────────────────
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          # ボットコミット後もトリガーされないよう token を指定
          token: ${{ secrets.GITHUB_TOKEN }}

      # ── 2. Python セットアップ ──────────────────────────────────
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"
          cache-dependency-path: requirements.txt

      # ── 3. Python 依存ライブラリをインストール ──────────────────
      - name: Install Python dependencies
        run: pip install -r requirements.txt

      # ── 4. RSS スクレイピング ────────────────────────────────────
      - name: Scrape RSS feeds
        run: |
          echo "📡 RSS フィードを取得中..."
          python scraper.py \
            --limit ${{ github.event.inputs.scraper_limit || '20' }} \
            --verbose
        # スクレイパーが失敗（403等）してもワークフローを続行
        continue-on-error: true

      # ── 5. AI 分析・翻訳 ────────────────────────────────────────
      - name: Analyze and translate stories
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GEMINI_API_KEY:    ${{ secrets.GEMINI_API_KEY }}
          AI_PROVIDER:       ${{ vars.AI_PROVIDER || 'claude' }}
        run: |
          echo "🤖 AI 分析・翻訳中..."
          FORCE_FLAG=""
          if [ "${{ github.event.inputs.force_analyze }}" = "true" ]; then
            FORCE_FLAG="--force"
          fi
          python analyze.py $FORCE_FLAG --delay 1.5 --verbose

      # ── 6. 変更があればコミット & プッシュ ──────────────────────
      - name: Commit and push if changed
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name  "github-actions[bot]"

          git add data/stories.json

          # 変更がなければスキップ
          if git diff --staged --quiet; then
            echo "✅ 変更なし — コミットをスキップします"
            exit 0
          fi

          # コミットメッセージに件数を含める
          ADDED=$(git diff --staged --unified=0 data/stories.json \
            | grep -c '^+.*"id"' || true)
          DATE=$(date -u '+%Y-%m-%d %H:%M UTC')

          git commit -m "chore(data): auto-update stories [${DATE}]

          - 新規 / 更新: ${ADDED} 件
          - スクレイパー + AI 分析 (${AI_PROVIDER:-claude}) 自動実行
          [skip ci]"

          git push

      # ── 7. 実行サマリーをジョブに出力 ───────────────────────────
      - name: Job summary
        if: always()
        run: |
          echo "## 🤖 Daily AI Stories Update" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| 項目 | 値 |" >> $GITHUB_STEP_SUMMARY
          echo "|----|-----|" >> $GITHUB_STEP_SUMMARY
          echo "| 実行日時 | $(date -u '+%Y-%m-%d %H:%M UTC') |" >> $GITHUB_STEP_SUMMARY
          echo "| プロバイダー | ${AI_PROVIDER:-claude} |" >> $GITHUB_STEP_SUMMARY
          TOTAL=$(python -c "import json; d=json.load(open('data/stories.json')); print(len(d))" 2>/dev/null || echo "?")
          echo "| 総件数 | ${TOTAL} 件 |" >> $GITHUB_STEP_SUMMARY
          ANALYZED=$(python -c "import json; d=json.load(open('data/stories.json')); print(sum(1 for x in d if x.get('ja_analysis')))" 2>/dev/null || echo "?")
          echo "| 日本語分析済み | ${ANALYZED} 件 |" >> $GITHUB_STEP_SUMMARY
        env:
          AI_PROVIDER: ${{ vars.AI_PROVIDER || 'claude' }}
