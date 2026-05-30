import React, { useState, useCallback } from 'react';
import { Heart, HeartOff } from 'lucide-react';
import AudioPreview from '../AudioPreview/AudioPreview';
import { addFavorite, removeFavorite, isFavorite } from '../../storage/favorites';
import { truncate } from '../../utils/format';
import './MusicCard.css';

export default function MusicCard({ track, onFavoriteChange, showToast }) {
  const [favorited, setFavorited] = useState(() => isFavorite(track.id));
  const [imgError, setImgError] = useState(false);

  const handleFavoriteToggle = useCallback(() => {
    if (favorited) {
      removeFavorite(track.id);
      setFavorited(false);
      showToast?.('Removed from favorites', 'info');
    } else {
      addFavorite(track);
      setFavorited(true);
      showToast?.('Added to favorites', 'success');
    }
    onFavoriteChange?.();
  }, [favorited, track, onFavoriteChange, showToast]);

  const handleImageError = () => setImgError(true);

  return (
    <article className="music-card" aria-label={`${track.name} by ${track.artist}`}>
      {/* Album cover */}
      <div className="music-card__cover-wrap">
        <img
          className="music-card__cover"
          src={imgError ? 'https://placehold.co/300x300/1e1e1e/535353?text=Music' : track.imageUrl}
          alt={`${track.album} cover`}
          onError={handleImageError}
          loading="lazy"
          width="300"
          height="300"
        />
        {/* Hover overlay */}
        <div className="music-card__overlay">
          {track.previewUrl ? (
            <AudioPreview previewUrl={track.previewUrl} trackName={track.name} />
          ) : (
            <a
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="music-card__overlay-spotify"
              aria-label={`Open ${track.name} on Spotify`}
              onClick={(e) => e.stopPropagation()}
            >
              <SpotifyIcon size={40} className="music-card__spotify-icon" />
              <span>Play on Spotify</span>
            </a>
          )}
        </div>
        {/* Explicit badge */}
        {track.explicit && <span className="music-card__explicit" aria-label="Explicit">E</span>}
      </div>

      {/* Info */}
      <div className="music-card__info">
        <h3 className="music-card__title" title={track.name}>
          {truncate(track.name, 28)}
        </h3>
        <p className="music-card__artist" title={track.artist}>
          {truncate(track.artist, 24)}
        </p>
        <p className="music-card__album truncate">{truncate(track.album, 26)}</p>

        {/* Meta row */}
        <div className="music-card__meta">
          <span className="music-card__duration">{track.duration}</span>
          {track.releaseYear && (
            <span className="music-card__year">{track.releaseYear}</span>
          )}
        </div>

        {/* Actions */}
        <div className="music-card__actions">
          <button
            className={`music-card__fav-btn ${favorited ? 'music-card__fav-btn--active' : ''}`}
            onClick={handleFavoriteToggle}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={favorited}
          >
            {favorited ? <Heart size={18} /> : <HeartOff size={18} />}
          </button>

          <a
            href={track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="music-card__spotify-btn"
            aria-label={`Open ${track.name} on Spotify`}
          >
            <SpotifyIcon size={14} />
            Open
          </a>
        </div>
      </div>
    </article>
  );
}

function SpotifyIcon({ size = 14, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#1DB954" />
      <path
        d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15 3.55-1.05 9.4-.85 13.1 1.35.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25zm-.1 2.8c-.25.35-.7.5-1.05.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.3.15.45.65.2 1zm-1.2 2.75c-.2.3-.55.4-.85.2-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.55.25.85z"
        fill="white"
      />
    </svg>
  );
}
