import React from 'react';
import './FilterPanel.css';

const MOOD_OPTIONS = ['all', 'calm', 'energetic', 'happy', 'sad', 'romantic', 'focused', 'chill'];

export default function FilterPanel({ tracks = [], filters, onFilterChange, onMoodSearch, activeQuery = '' }) {
  const artists = [...new Set(tracks.map((t) => t.artist).filter(Boolean))].slice(0, 12);

  const update = (key, value) => onFilterChange({ ...filters, [key]: value });

  const activeCount = Object.values(filters).filter((v) => v && v !== 'all' && v !== 'default').length;

  const resetAll = () =>
    onFilterChange({ mood: 'all', artist: 'all', sort: 'default' });

  const handleMoodClick = (mood) => {
    if (mood === 'all') {
      // Re-run the original query without mood modifier
      onMoodSearch(activeQuery);
    } else {
      onMoodSearch(`${activeQuery} ${mood}`);
    }
    update('mood', mood);
  };

  return (
    <aside className="filter-panel" aria-label="Filter results">
      <div className="filter-panel__header">
        <h2 className="filter-panel__title">
          Filters
          {activeCount > 0 && <span className="filter-panel__badge">{activeCount}</span>}
        </h2>
        {activeCount > 0 && (
          <button className="filter-panel__reset" onClick={resetAll}>Reset all</button>
        )}
      </div>

      {/* Sort */}
      <FilterSection label="Sort by">
        <select
          className="filter-panel__select"
          value={filters.sort}
          onChange={(e) => update('sort', e.target.value)}
        >
          <option value="default">Relevance</option>
          <option value="duration_asc">Shortest first</option>
          <option value="duration_desc">Longest first</option>
          <option value="name_asc">A → Z</option>
        </select>
      </FilterSection>

      {/* Mood — triggers a new search with mood as modifier */}
      <FilterSection label="Refine by mood">
        <p className="filter-section__hint">Triggers a new search</p>
        <div className="filter-panel__chips">
          {MOOD_OPTIONS.map((mood) => (
            <button
              key={mood}
              className={`filter-chip ${filters.mood === mood ? 'filter-chip--active' : ''}`}
              onClick={() => handleMoodClick(mood)}
              aria-pressed={filters.mood === mood}
            >
              {mood === 'all' ? 'Any mood' : mood}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Artist */}
      {artists.length > 0 && (
        <FilterSection label="Artist">
          <select
            className="filter-panel__select"
            value={filters.artist}
            onChange={(e) => update('artist', e.target.value)}
          >
            <option value="all">All artists</option>
            {artists.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </FilterSection>
      )}
    </aside>
  );
}

function FilterSection({ label, children }) {
  return (
    <div className="filter-section">
      <h3 className="filter-section__label">{label}</h3>
      {children}
    </div>
  );
}
