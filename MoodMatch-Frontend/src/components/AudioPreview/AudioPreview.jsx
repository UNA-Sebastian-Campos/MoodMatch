import React, { useState, useRef, useCallback } from 'react';
import { Ban, Pause, Play } from 'lucide-react';
import './AudioPreview.css';

/**
 * Audio preview player component.
 * - If previewUrl is provided: shows a play/pause button that plays a 30-second clip.
 * - If not: shows a "not available" state.
 * Only one preview plays at a time globally (via AudioContext singleton pattern).
 */

// Global reference to pause any playing preview before starting a new one
let globalAudio = null;

export default function AudioPreview({ previewUrl, trackName }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const handleToggle = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (!previewUrl) return;

      // Pause any other playing audio
      if (globalAudio && globalAudio !== audioRef.current) {
        globalAudio.pause();
        globalAudio = null;
      }

      if (!audioRef.current) {
        audioRef.current = new Audio(previewUrl);
        audioRef.current.volume = 0.7;

        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          globalAudio = null;
        });
        audioRef.current.addEventListener('error', () => {
          setIsPlaying(false);
          setIsLoading(false);
          globalAudio = null;
        });
        audioRef.current.addEventListener('canplay', () => {
          setIsLoading(false);
        });
      }

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        globalAudio = null;
      } else {
        setIsLoading(true);
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
            globalAudio = audioRef.current;
          })
          .catch(() => {
            setIsPlaying(false);
            setIsLoading(false);
          });
      }
    },
    [previewUrl, isPlaying],
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!previewUrl) {
    return (
      <div className="audio-preview audio-preview--unavailable" title="Preview not available">
        <span className="audio-preview__unavail-icon" aria-hidden="true"><Ban size={20} /></span>
        <span className="audio-preview__unavail-text">Preview unavailable</span>
      </div>
    );
  }

  return (
    <button
      className={`audio-preview audio-preview--available ${isPlaying ? 'audio-preview--playing' : ''}`}
      onClick={handleToggle}
      aria-label={isPlaying ? `Pause preview of ${trackName}` : `Play preview of ${trackName}`}
      aria-pressed={isPlaying}
      title={isPlaying ? 'Pause preview' : 'Play 30-second preview'}
    >
      {isLoading ? (
        <span className="audio-preview__loader" />
      ) : (
        <span className="audio-preview__icon">
          {isPlaying ? (
            <Pause size={28} />
          ) : (
            <Play size={28} />
          )}
        </span>
      )}
      {isPlaying && <span className="audio-preview__ripple" aria-hidden="true" />}
    </button>
  );
}
