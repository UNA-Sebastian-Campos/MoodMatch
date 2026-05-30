import React, { useState, useRef, useCallback } from 'react';
import { debounce } from '../../utils/debounce';
import { sanitizeQuery } from '../../utils/sanitize';
import { timeAgo } from '../../utils/format';
import { IconSearch, IconMusic, IconClock, IconClose, IconReturn } from '../icons/Icons';
import './SearchBar.css';

const SUGGESTIONS = [
  'música relajante para estudiar',
  'rock en inglés para entrenar',
  'lo-fi para concentrarme',
  'jazz suave para la noche',
  'música alegre en español',
  'música para conducir',
];

export default function SearchBar({
  onSearch,
  isLoading = false,
  initialValue = '',
  history = [],
  onSelectHistory,
  onRemoveHistory,
}) {
  const [value, setValue] = useState(initialValue);
  const [validationError, setValidationError] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
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
    setIsFocused(false);
    onSearch(value);
  };

  const handleSuggestion = (suggestion) => {
    setValue(suggestion);
    inputRef.current?.focus();
  };

  const handleHistory = (query) => {
    setIsFocused(false);
    (onSelectHistory || onSearch)(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') { setIsFocused(false); inputRef.current?.blur(); }
  };

  const handleClear = () => {
    setValue('');
    setValidationError(null);
    inputRef.current?.focus();
  };

  const recent = (history || []).slice(0, 5);
  // The panel only exists while the input is focused — no overlap with the page,
  // and recent searches live inside it instead of always-on under the bar.
  const showPanel = isFocused && !value && (recent.length > 0 || SUGGESTIONS.length > 0);

  return (
    <div className="searchbar">
      <form className="searchbar__form" onSubmit={handleSubmit} role="search">
        <span className="searchbar__icon" aria-hidden="true">
          {isLoading ? <span className="searchbar__spinner" /> : <IconSearch size={20} />}
        </span>

        <input
          ref={inputRef}
          type="text"
          className={`searchbar__input ${validationError ? 'searchbar__input--error' : ''}`}
          placeholder="Describe tu estado de ánimo o actividad…"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          disabled={isLoading}
          maxLength={200}
          aria-label="Search music by mood or activity"
          aria-describedby={validationError ? 'searchbar-error' : undefined}
          autoComplete="off"
          spellCheck="false"
        />

        {value && !isLoading && (
          <button
            type="button"
            className="searchbar__clear"
            onClick={handleClear}
            aria-label="Clear search"
            tabIndex={-1}
          >
            <IconClose size={16} />
          </button>
        )}

        <button
          type="submit"
          className="searchbar__btn"
          disabled={isLoading || !value.trim()}
          aria-label="Search"
        >
          <span>{isLoading ? 'Searching…' : 'Search'}</span>
          {!isLoading && <IconReturn size={15} />}
        </button>
      </form>

      {validationError && (
        <p id="searchbar-error" className="searchbar__error" role="alert">
          {validationError}
        </p>
      )}

      {showPanel && (
        <div className="searchbar__panel" role="listbox" aria-label="Suggestions">
          {recent.length > 0 && (
            <div className="searchbar__panel-section">
              <p className="searchbar__panel-label">
                <IconClock size={13} /> Recent
              </p>
              {recent.map((item) => (
                <div key={item.id} className="searchbar__row searchbar__row--recent">
                  <button
                    type="button"
                    className="searchbar__row-main"
                    onMouseDown={() => handleHistory(item.query)}
                    role="option"
