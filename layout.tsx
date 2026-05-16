'use client';

import { useState } from 'react';

interface FilterBarProps {
  industries: string[];
  activeFilter: string;
  onFilterChange: (industry: string) => void;
}

export default function FilterBar({
  industries,
  activeFilter,
  onFilterChange,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 mb-10 flex-wrap">
      <span
        className="text-xs tracking-widest uppercase mr-2"
        style={{ color: 'var(--text-muted)' }}
      >
        Filter
      </span>
      {['All', ...industries].map((industry) => {
        const isActive = activeFilter === industry;
        return (
          <button
            key={industry}
            onClick={() => onFilterChange(industry)}
            className="text-xs tracking-wider uppercase px-4 py-1.5 rounded-sm transition-all duration-200"
            style={{
              background: isActive ? 'rgba(212,175,55,0.12)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(212,175,55,0.35)' : 'rgba(255,255,255,0.07)'}`,
              color: isActive ? 'var(--gold)' : 'var(--text-muted)',
              cursor: 'pointer',
              letterSpacing: '0.08em',
            }}
          >
            {industry}
          </button>
        );
      })}
    </div>
  );
}
