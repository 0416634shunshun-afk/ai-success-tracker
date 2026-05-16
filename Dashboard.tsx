name: Deploy to Vercel

on:
  push:
    branches:
      - main
    paths:
      # これらのパスに変更があった場合のみデプロイ
      - "app/**"
      - "data/stories.json"
      - "public/**"
      - "package.json"
      - "package-lock.json"
      - "next.config.ts"
      - "tsconfig.json"
      - "postcss.config.mjs"

  # 手動デプロイ
  workflow_dispatch:
    inputs:
      environment:
        description: "デプロイ先"
        required: true
        default: "production"
        type: choice
        options:
          - production
          - preview

jobs:
  deploy:
    name: Deploy to Vercel
    runs-on: ubuntu-latest
    timeout-minutes: 20

    environment:
      name: ${{ github.event.inputs.environment || 'production' }}
      url: ${{ steps.deploy.outputs.url }}

    steps:
      # ── 1. チェックアウト ────────────────────────────────────────
      - name: Checkout repository
        uses: actions/checkout@v4

      # ── 2. Node.js セットアップ ──────────────────────────────────
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      # ── 3. 依存インストール ──────────────────────────────────────
      - name: Install dependencies
        run: npm ci

      # ── 4. ビルド検証 ────────────────────────────────────────────
      - name: Build (lint + type-check)
        run: npm run build

      # ── 5. Vercel CLI でデプロイ ─────────────────────────────────
      - name: Deploy to Vercel
        id: deploy
        env:
          VERCEL_TOKEN:   ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID:  ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          npm install -g vercel@latest

          if [ "${{ github.event.inputs.environment }}" = "preview" ]; then
            URL=$(vercel deploy --token=$VERCEL_TOKEN 2>&1 | tail -1)
          else
            URL=$(vercel deploy --prod --token=$VERCEL_TOKEN 2>&1 | tail -1)
          fi

          echo "url=${URL}" >> $GITHUB_OUTPUT
          echo "🚀 デプロイ完了: ${URL}"

      # ── 6. サマリー ──────────────────────────────────────────────
      - name: Job summary
        if: always()
        run: |
          echo "## 🚀 Vercel Deploy" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| 項目 | 値 |" >> $GITHUB_STEP_SUMMARY
          echo "|----|-----|" >> $GITHUB_STEP_SUMMARY
          echo "| ブランチ | ${{ github.ref_name }} |" >> $GITHUB_STEP_SUMMARY
          echo "| コミット | ${{ github.sha }} |" >> $GITHUB_STEP_SUMMARY
          echo "| URL | ${{ steps.deploy.outputs.url }} |" >> $GITHUB_STEP_SUMMARY
          echo "| 環境 | ${{ github.event.inputs.environment || 'production' }} |" >> $GITHUB_STEP_SUMMARY
