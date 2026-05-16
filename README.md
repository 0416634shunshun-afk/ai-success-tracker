# AI Success Tracker

海外のAI活用事例をRSSで自動収集し、Claude APIで日本語解析・翻訳してダッシュボードに表示するNext.jsアプリ。GitHub Actionsで毎日自動実行、Vercelで公開できます。

---

## 目次

1. [機能概要](#機能概要)
2. [技術スタック](#技術スタック)
3. [ローカル開発](#ローカル開発)
4. [Pythonスクリプトの使い方](#pythonスクリプトの使い方)
5. [GitHub Actionsの設定](#github-actionsの設定)
6. [Vercelへのデプロイ](#vercelへのデプロイ)
7. [データ構造](#データ構造)
8. [トラブルシューティング](#トラブルシューティング)

---

## 機能概要

| 機能 | 説明 |
|------|------|
| **RSSスクレイピング** | Zapier Blog / Make.com / TechCrunch AIから毎日記事を収集 |
| **AIキーワードフィルタ** | 「AI Workflow」「Content Automation」関連記事のみ抽出 |
| **重複チェック** | URLとID（SHA-256）による二重チェックで再取得なし |
| **日本語AI分析** | Claude / Gemini APIで要約・ツール抽出・マネタイズ・日本向けアドバイスを生成 |
| **自動コミット** | 毎日JST 09:00にGitHub Actionsが実行し差分をpush |
| **自動デプロイ** | mainブランチへのpushでVercelへ自動デプロイ |

---

## 技術スタック

- **フロントエンド**: Next.js 16 (App Router) + Tailwind CSS v4
- **言語**: TypeScript / Python 3.11
- **AI API**: Anthropic Claude (claude-opus-4-5) / Google Gemini (1.5-flash)
- **CI/CD**: GitHub Actions
- **ホスティング**: Vercel
- **データストア**: `data/stories.json`（Gitで管理）

---

## ローカル開発

### 前提条件

- Node.js 20+
- Python 3.11+
- Git

### セットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/<your-username>/ai-success-tracker.git
cd ai-success-tracker

# 2. Node.js 依存インストール
npm install

# 3. Python 依存インストール
pip install -r requirements.txt

# 4. 環境変数を設定
cp .env.example .env
# .env を編集してAPIキーを入力

# 5. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開くとダッシュボードが表示されます。

---

## Pythonスクリプトの使い方

### .env の設定

```env
# Claude API（推奨）
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxx

# Gemini API（代替）
GEMINI_API_KEY=AIzaSyxxxxxxxxxx

# 使用するプロバイダー: claude または gemini
AI_PROVIDER=claude
```

### scraper.py — RSSスクレイピング

```bash
python scraper.py               # 通常実行
python scraper.py --dry-run     # プレビューのみ（保存なし）
python scraper.py --limit 50    # 取得上限を変更
python scraper.py --verbose     # 詳細ログ
```

### analyze.py — AI分析・翻訳

```bash
python analyze.py               # 未分析の記事だけ処理
python analyze.py --force       # 全件を再分析（上書き）
python analyze.py --id 1 3 5    # 特定IDだけ処理
python analyze.py --provider gemini  # Gemini APIを使用
python analyze.py --dry-run     # プロンプト確認のみ
```

### まとめて実行

```bash
python scraper.py && python analyze.py
```

---

## GitHub Actionsの設定

### ワークフロー全体像

```
毎日 JST 09:00（UTC 00:00）
    │
    ▼
[daily-update.yml]
    ├─ 1. RSS スクレイピング  (scraper.py)
    ├─ 2. AI 分析・翻訳      (analyze.py)
    └─ 3. 差分コミット & プッシュ → main
                │
                ▼（data/stories.json 等が変更されたとき）
          [deploy.yml]
              ├─ 4. npm ci + npm run build（ビルド検証）
              └─ 5. Vercel へ本番デプロイ
```

### Step 1: リポジトリをGitHubにプッシュ

```bash
git init
git add .
git commit -m "feat: initial commit"
git branch -M main
git remote add origin https://github.com/<username>/ai-success-tracker.git
git push -u origin main
```

### Step 2: GitHub Secrets を設定

GitHubリポジトリの **Settings → Secrets and variables → Actions** で以下を追加します。

#### Secrets（暗号化 — 必須）

| Secret名 | 取得方法 |
|----------|---------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ → API Keys |
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → Create Token |
| `VERCEL_ORG_ID` | 後述の `vercel link` で確認 |
| `VERCEL_PROJECT_ID` | 後述の `vercel link` で確認 |

> Geminiを使う場合は `GEMINI_API_KEY` も追加してください。

#### Variables（平文 — 任意）

| Variable名 | デフォルト | 説明 |
|------------|-----------|------|
| `AI_PROVIDER` | `claude` | `claude` または `gemini` |

### Step 3: Vercel IDを取得

```bash
# Vercel CLI インストール
npm install -g vercel

# ログイン & プロジェクトリンク
vercel login
vercel link    # 対話形式でプロジェクトを作成 or 選択

# ID を確認
cat .vercel/project.json
# → { "projectId": "prj_xxxx", "orgId": "team_xxxx" }
```

`projectId` を `VERCEL_PROJECT_ID` に、`orgId` を `VERCEL_ORG_ID` に設定します。

### Step 4: 動作確認（手動実行）

1. GitHubの **Actions** タブを開く
2. **Daily AI Stories Update** ワークフローを選択
3. **Run workflow** ボタンをクリック → **Run workflow**
4. ジョブが完了したら `data/stories.json` の更新を確認

---

## Vercelへのデプロイ

### 方法A: GitHub連携（推奨・最も簡単）

1. [vercel.com/new](https://vercel.com/new) にアクセス
2. **Import Git Repository** → `ai-success-tracker` を選択
3. 設定はすべてデフォルトのまま **Deploy** をクリック

```
Framework Preset : Next.js        ← 自動検出
Root Directory   : ./
Build Command    : npm run build
Output Directory : .next
```

4. デプロイ完了後 `https://ai-success-tracker-xxx.vercel.app` が発行される
5. 以降は main への push ごとに自動デプロイされる

### 方法B: GitHub Actions経由の自動デプロイ（推奨）

Step 2〜3 でSecretsを設定済みであれば、`main` への push 時に `.github/workflows/deploy.yml` が自動的にVercelへデプロイします。

```bash
git push origin main  # → 自動でビルド & デプロイ
```

### 方法C: CLIで手動デプロイ

```bash
vercel --prod
```

### 注意: Vercel側に環境変数は不要

Next.jsアプリは `data/stories.json` をサーバーサイドで直接読み込むため、VercelダッシュボードにAPIキー等を設定する必要はありません。  
APIキーは **GitHub Secretsのみ** に設定してください。

### カスタムドメイン（任意）

1. Vercelダッシュボード → プロジェクト → **Settings → Domains**
2. **Add** に独自ドメインを入力
3. ドメイン管理画面でCNAMEを `cname.vercel-dns.com` に設定

---

## データ構造

`data/stories.json` の各エントリ:

```jsonc
{
  // 基本情報（手動またはscraper.pyが追加）
  "id": "1",
  "company": "Morgan Stanley",
  "country": "USA",
  "industry": "Finance",
  "title": "AI-Powered Wealth Management Assistant",
  "summary": "英語の概要...",
  "impact": "40% reduction in time spent searching",
  "metrics": { "timeReduced": "40%", "advisorsEnabled": "16,000+" },
  "tags": ["LLM", "Enterprise"],
  "year": 2023,

  // analyze.py が追加する日本語分析フィールド
  "ja_analysis": {
    "summary": "1行目：何をしたか\n2行目：使った技術\n3行目：成果",
    "ai_tools": "OpenAI GPT-4, RAG, Azure OpenAI Service",
    "monetization": "情報検索時間40%削減により...",
    "japan_advice": "①独立FPや税理士はNotionAIで...",
    "model_used": "claude-opus-4-5",
    "analyzed_at": "2024-05-13T10:00:00+00:00"
  }
}
```

---

## トラブルシューティング

### GitHub Actions

| 症状 | 対処 |
|------|------|
| `ANTHROPIC_API_KEY が設定されていません` | Settings → Secrets に `ANTHROPIC_API_KEY` を追加 |
| スクレイパーが 403 エラー | `continue-on-error: true` 設定済みなので分析は継続。各サイトのRSS URLを要確認 |
| コミットがスキップされる | 新規記事なしの正常動作。`--force` で強制再分析も可能 |
| ワークフローが全く動かない | `.github/workflows/` ディレクトリとymlが正しくpushされているか確認 |

### Vercel

| 症状 | 対処 |
|------|------|
| `Build failed` | ローカルで `npm run build` を実行して事前確認 |
| `vercel: command not found` | `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` の3つのSecretを確認 |
| デプロイ後に古いデータが表示される | Vercel の **Redeploy** ボタンでキャッシュをクリア |

### analyze.py

| 症状 | 対処 |
|------|------|
| `JSON not found in response` | `--verbose` で生レスポンスを確認。`--delay 3.0` でレート制限を回避 |
| 分析が途中で止まる | 1件ごとに保存されるため再実行で再開可能 |

---

## ライセンス

MIT

---

## 関連リンク

- [Anthropic Console](https://console.anthropic.com/)
- [Google AI Studio (Gemini)](https://aistudio.google.com/)
- [Vercel ドキュメント](https://vercel.com/docs)
- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)
