export default function Header() {
  return (
    <header className="relative mb-16 pt-16 pb-12">
      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="h-px w-8"
            style={{ background: 'var(--gold)', opacity: 0.5 }}
          />
          <span
            className="text-xs tracking-[0.3em] uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            Global Intelligence
          </span>
        </div>

        {/* Main title */}
        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-medium mb-4 leading-none">
          <span style={{ color: 'var(--text-primary)' }}>AI Success</span>
          <br />
          <span className="text-gold-gradient">Tracker</span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-base md:text-lg max-w-xl mt-6 leading-relaxed"
          style={{ color: 'var(--text-secondary)', fontWeight: 300 }}
        >
          Curated case studies of enterprise AI adoption—
          <span style={{ color: 'var(--text-primary)' }}> real metrics, real impact.</span>
        </p>

        {/* Stats row */}
        <div
          className="flex items-center gap-8 mt-10 pt-8"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {[
            { value: '6', label: 'Case Studies' },
            { value: '5', label: 'Industries' },
            { value: '2024', label: 'Latest Year' },
          ].map((stat) => (
            <div key={stat.label}>
              <div
                className="font-display text-2xl font-medium"
                style={{ color: 'var(--gold)' }}
              >
                {stat.value}
              </div>
              <div
                className="text-xs tracking-wider uppercase mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
