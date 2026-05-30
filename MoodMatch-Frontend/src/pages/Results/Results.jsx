import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Brain, Globe, Zap } from 'lucide-react';
import SearchBar from '../../components/SearchBar/SearchBar';
import MusicCard from '../../components/MusicCard/MusicCard';
import FilterPanel from '../../components/FilterPanel/FilterPanel';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import EmptyState from '../../components/EmptyState/EmptyState';
import { useAppContext } from '../../App';
import { capitalize } from '../../utils/format';
import './Results.css';

const DEFAULT_FILTERS = {
  mood:   'all',
  artist: 'all',
  sort:   'default',
};

function applyFilters(tracks, filters) {
  if (!tracks) return [];
  let result = [...tracks];

  if (filters.artist !== 'all') {
    result = result.filter(
      (t) => t.artist.toLowerCase() === filters.artist.toLowerCase(),
    );
  }

  switch (filters.sort) {
    case 'duration_asc':  result.sort((a, b) => a.durationMs - b.durationMs); break;
    case 'duration_desc': result.sort((a, b) => b.durationMs - a.durationMs); break;
    case 'name_asc':      result.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: break;
  }

  return result;
}

export default function Results() {
  const {
    searchQuery, searchResults, musicContext,
    isLoading, isLoadingMore, searchError,
    hasMore, handleSearch, handleLoadMore, showToast,
  } = useAppContext();

  const navigate  = useNavigate();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const filteredTracks = useMemo(
    () => applyFilters(searchResults, filters),
    [searchResults, filters],
  );

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="results">
        <div className="results__header container">
          <SearchBar onSearch={handleSearch} isLoading={true} initialValue={searchQuery} />
        </div>
        <div className="results__body container">
          <SkeletonLoader count={12} />
        </div>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────────
  if (searchError && !searchResults) {
    const errorType = searchError.errorCode === 'SPOTIFY_ERROR' ? 'spotify-error'
      : !navigator.onLine ? 'offline' : 'error';
    return (
      <div className="results">
        <div className="results__header container">
          <SearchBar onSearch={handleSearch} isLoading={false} initialValue={searchQuery} />
        </div>
        <EmptyState type={errorType} onAction={() => handleSearch(searchQuery)} actionLabel="Try again" />
      </div>
    );
  }

  // ─── No search yet ───────────────────────────────────────────────────────────
  if (!searchResults) {
    return (
      <div className="results">
        <div className="results__header container">
          <SearchBar onSearch={handleSearch} isLoading={false} />
        </div>
        <EmptyState type="default" onAction={() => navigate('/')} actionLabel="Go to Home" />
      </div>
    );
  }

  // ─── Results ─────────────────────────────────────────────────────────────────
  return (
    <div className="results">
      <div className="results__header container">
        <SearchBar onSearch={handleSearch} isLoading={false} initialValue={searchQuery} />
      </div>

      <div className="results__body container">
        {/* AI context badges */}
        {musicContext && (
          <div className="results__context">
            {/* Analysis source indicator */}
            {musicContext.analysisSource === 'huggingface' ? (
              <span className="results__source-badge results__source-badge--ai" title="Query analyzed by HuggingFace AI">
                <Bot size={14} /> AI Analysis
              </span>
            ) : (
              <span className="results__source-badge results__source-badge--fallback" title="HuggingFace unavailable — using smart keyword detection">
                <Zap size={14} /> Smart Fallback
              </span>
            )}

            <span className="results__context-badge">
              <Brain size={14} /> {capitalize(musicContext.mood)} · {capitalize(musicContext.activity)}
            </span>
            {musicContext.genres.slice(0, 3).map((g) => (
              <span key={g} className="results__genre-tag">{g}</span>
            ))}
            {musicContext.language !== 'any' && (
              <span className="results__genre-tag"><Globe size={14} /> {musicContext.language}</span>
            )}
          </div>
        )}

        {/* Count */}
        <div className="results__meta">
          <h2 className="results__count">
            {filteredTracks.length > 0
              ? `${filteredTracks.length} track${filteredTracks.length !== 1 ? 's' : ''} found`
              : 'No tracks match these filters'}
          </h2>
          {searchQuery && <p className="results__query">for "{searchQuery}"</p>}
        </div>

        {/* Layout */}
        <div className="results__layout">
          <FilterPanel
            tracks={searchResults}
            filters={filters}
            onFilterChange={setFilters}
            onMoodSearch={handleSearch}
            activeQuery={searchQuery}
          />

          <div className="results__grid-area">
            {filteredTracks.length === 0 ? (
              <EmptyState
                type="no-results"
                onAction={() => setFilters(DEFAULT_FILTERS)}
                actionLabel="Clear filters"
              />
            ) : (
              <>
                <div className="results__grid">
                  {filteredTracks.map((track) => (
                    <MusicCard
                      key={track.id}
                      track={track}
                      onFavoriteChange={() => {}}
                      showToast={showToast}
                    />
                  ))}
                </div>

                {/* Load more */}
                {hasMore && (
                  <div className="results__load-more">
                    <button
                      className="results__load-more-btn"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <><span className="results__load-spinner" /> Loading…</>
                      ) : (
                        '+ Load more tracks'
                      )}
                    </button>
                  </div>
                )}

                {/* End message when all loaded */}
                {!hasMore && searchResults.length > 0 && (
                  <p className="results__end-msg">
                    All {searchResults.length} tracks loaded
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
