@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
@import "tailwindcss";

:root {
  --bg-primary: #0a0a0b;
  --bg-secondary: #111114;
  --bg-card: #131316;
  --bg-card-hover: #18181d;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-accent: rgba(212, 175, 55, 0.3);
  --gold: #d4af37;
  --gold-light: #e8c84a;
  --gold-dim: rgba(212, 175, 55, 0.12);
  --text-primary: #f0ede8;
  --text-secondary: #8a8794;
  --text-muted: #4a4755;
  --accent-cyan: #4fc3c3;
  --accent-cyan-dim: rgba(79, 195, 195, 0.1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'DM Sans', sans-serif;
  font-weight: 300;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 999;
  opacity: 0.5;
}

.font-display { font-family: 'Playfair Display', serif; }

.text-gold-gradient {
  background: linear-gradient(135deg, #c9a227 0%, #f5d06e 45%, #b8941c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.story-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  position: relative;
  overflow: hidden;
}

.story-card::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.story-card:hover {
  background: var(--bg-card-hover);
  border-color: rgba(212, 175, 55, 0.25);
  transform: translateY(-3px);
  box-shadow: 0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.08);
}

.story-card:hover::after { opacity: 1; }

::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 2px; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up { animation: fadeInUp 0.6s ease forwards; }

.tag-pill {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  color: var(--text-secondary);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 2px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.metric-highlight {
  color: var(--gold);
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1;
}

.divider-gold {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent);
}
