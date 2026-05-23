import React, { useState, useRef, useCallback } from 'react';
import { debounce } from '../../utils/debounce';
import { sanitizeQuery } from '../../utils/sanitize';
import './SearchBar.css';

const SUGGESTIONS = [
  'música relajante para estudiar',
  'rock en inglés para entrenar',
  'lo-fi para concentrarme',
  'jazz suave para la noche',
  'música alegre en español',
  'música para conducir',
  'ambient para trabajar',
  'música para la playa',
];

export default function SearchBar({ onSearch, isLoading = false, initialValue = '' }) {
  const [value, setValue] = useState(initialValue);
  const [validationError, setValidationError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  // Debounced validation (feedback only — doesn't trigger search)
  const validateDebounced = useCallback(
    debounce((v) => {
      if (v.length === 0) { setValidationError(null); return; }
      const { error } = sanitizeQuery(v);
      setValidationError(error);
    }, 500),
    [],
  );

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    validateDebounced(v);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isLoading || !value.trim()) return;
    setShowSuggestions(false);
    onSearch(value);
  };

  const handleSuggestion = (suggestion) => {
    setValue(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') { setShowSuggestions(false); inputRef.current?.blur(); }
  };

  const handleClear = () => {
    setValue('');
    setValidationError(null);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className="searchbar">
      <form className="searchbar__form" onSubmit={handleSubmit} role="search">
        {/* Search icon */}
        <span className="searchbar__icon" aria-hidden="true">
          {isLoading ? (
            <span className="searchbar__spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          className={`searchbar__input ${validationError ? 'searchbar__input--error' : ''}`}
          placeholder="Describe tu estado de ánimo o actividad…"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          disabled={isLoading}
          maxLength={200}
          aria-label="Search music by mood or activity"
          aria-describedby={validationError ? 'searchbar-error' : undefined}
          autoComplete="off"
          spellCheck="false"
        />

        {/* Clear button */}
        {value && !isLoading && (
          <button
            type="button"
            className="searchbar__clear"
            onClick={handleClear}
            aria-label="Clear search"
            tabIndex={-1}
          >
            ✕
          </button>
        )}

        {/* Search button */}
        <button
          type="submit"
          className="searchbar__btn"
          disabled={isLoading || !value.trim()}
          aria-label="Search"
        >
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Validation error */}
      {validationError && (
        <p id="searchbar-error" className="searchbar__error" role="alert">
          {validationError}
        </p>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && !value && (
        <div className="searchbar__suggestions" role="listbox" aria-label="Search suggestions">
          <p className="searchbar__suggestions-label">Try these…</p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="searchbar__suggestion"
              onMouseDown={() => handleSuggestion(s)}
              role="option"
              aria-selected="false"
            >
              <span className="searchbar__suggestion-icon">🎵</span>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
