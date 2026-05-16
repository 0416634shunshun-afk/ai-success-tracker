# ─────────────────────────────────────────────
#  AI Success Tracker — 環境変数テンプレート
#  このファイルを .env にコピーしてキーを入力してください
#  cp .env.example .env
# ─────────────────────────────────────────────

# 【優先】Claude API キー (Anthropic)
# https://console.anthropic.com/ で取得
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# 【代替】Gemini API キー (Google)
# https://aistudio.google.com/app/apikey で取得
GEMINI_API_KEY=your_gemini_api_key_here

# 使用するプロバイダー: "claude" または "gemini"（デフォルト: claude）
AI_PROVIDER=claude
