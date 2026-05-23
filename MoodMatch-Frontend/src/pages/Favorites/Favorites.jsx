import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicCard from '../../components/MusicCard/MusicCard';
import EmptyState from '../../components/EmptyState/EmptyState';
import { useAppContext } from '../../App';
import { getFavorites, clearFavorites } from '../../storage/favorites';
import './Favorites.css';

export default function Favorites() {
  const { showToast } = useAppContext();
  const navigate       = useNavigate();

  // Load from LocalStorage on mount; refresh on fav changes
  const [favorites, setFavorites] = useState(() => getFavorites());

  const refreshFavorites = useCallback(() => {
    setFavorites(getFavorites());
  }, []);

  const handleClearAll = () => {
    if (!window.confirm('Remove all favorites? This cannot be undone.')) return;
    clearFavorites();
    setFavorites([]);
    showToast('All favorites cleared', 'info');
  };

  return (
    <div className="favorites">
      <div className="container">
        {/* Header */}
        <div className="favorites__header">
          <div>
            <h1 className="favorites__title">Your Favorites</h1>
            <p className="favorites__subtitle">
              {favorites.length > 0
                ? `${favorites.length} saved track${favorites.length !== 1 ? 's' : ''}`
                : 'No saved tracks yet'}
            </p>
          </div>
          {favorites.length > 0 && (
            <button className="favorites__clear-btn" onClick={handleClearAll}>
              Clear all
            </button>
          )}
        </div>

        {/* Grid */}
        {favorites.length === 0 ? (
          <EmptyState
            type="no-favorites"
            onAction={() => navigate('/')}
            actionLabel="Discover Music"
          />
        ) : (
          <div className="favorites__grid">
            {favorites.map((track) => (
              <MusicCard
                key={track.id}
                track={track}
                onFavoriteChange={refreshFavorites}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
