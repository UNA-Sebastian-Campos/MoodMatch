import React from 'react';
import './SkeletonLoader.css';

/**
 * Reusable skeleton card loader.
 * @param {number} count - Number of skeleton cards to render
 */
export default function SkeletonLoader({ count = 8 }) {
  return (
    <div className="skeleton-grid" aria-busy="true" aria-label="Loading music…">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-cover" />
          <div className="skeleton-info">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line skeleton-line--artist" />
            <div className="skeleton-line skeleton-line--album" />
            <div className="skeleton-meta">
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
            <div className="skeleton-actions">
              <div className="skeleton-circle" />
              <div className="skeleton-line skeleton-line--btn" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
