import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../../components/SearchBar/SearchBar';
import { useAppContext } from '../../App';
import { getHistory, removeFromHistory } from '../../storage/history';
import { timeAgo } from '../../utils/format';
import './Home.css';

const FEATURE_CARDS = [
  { icon: '🧠', title: 'AI-Powered',       desc: 'Describes your mood in plain language and let our AI analyze it' },
  { icon: '🎵', title: 'Real Spotify Music', desc: 'Get actual tracks playable directly on Spotify' },
  { icon: '❤',  title: 'Save Favorites',   desc: 'Keep your favorite discoveries across sessions' },
  { icon: '⚡', title: 'Instant results',   desc: 'Smart search in under 3 seconds' },
];

export default function Home() {
  const { handleSearch, isLoading } = useAppContext();
  const [history, setHistory]       = useState(() => getHistory());
  const navigate                    = useNavigate();

  const handleRemoveHistory = (id, e) => {
    e.stopPropagation();
    removeFromHistory(id);
    setHistory(getHistory());
  };

  const handleHistoryClick = (query) => handleSearch(query);

  return (
    <div className="home">
      {/* Hero */}
      <section className="home__hero">
        <div className="home__hero-bg" aria-hidden="true">
          <div className="home__hero-orb home__hero-orb--1" />
          <div className="home__hero-orb home__hero-orb--2" />
        </div>

        <div className="container home__hero-content">
          <p className="home__eyebrow">AI-powered music discovery</p>
          <h1 className="home__headline">
            Music that matches<br />
            <span className="home__headline-gradient">your mood</span>
          </h1>
          <p className="home__subline">
            Describe how you feel or what you're doing.<br />
            We'll find the perfect soundtrack for this moment.
          </p>

          <div className="home__search-wrap">
            <SearchBar onSearch={handleSearch} isLoading={isLoading} />
          </div>

          {/* Recent history */}
          {history.length > 0 && (
            <div className="home__history">
              <p className="home__history-label">Recent searches</p>
              <div className="home__history-list">
                {history.slice(0, 5).map((item) => (
                  <div key={item.id} className="home__history-item">
                    <button
                      className="home__history-btn"
                      onClick={() => handleHistoryClick(item.query)}
                      disabled={isLoading}
                    >
                      <span className="home__history-icon">🕐</span>
                      <span className="home__history-text">{item.query}</span>
                      <span className="home__history-time">{timeAgo(item.timestamp)}</span>
                    </button>
                    <button
                      className="home__history-remove"
                      onClick={(e) => handleRemoveHistory(item.id, e)}
                      aria-label={`Remove "${item.query}" from history`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="home__features container">
        <h2 className="home__section-title">Why MoodMatch?</h2>
        <div className="home__features-grid">
          {FEATURE_CARDS.map((card) => (
            <div key={card.title} className="feature-card">
              <span className="feature-card__icon">{card.icon}</span>
              <h3 className="feature-card__title">{card.title}</h3>
              <p className="feature-card__desc">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example queries */}
      <section className="home__examples container">
        <h2 className="home__section-title">Try these examples</h2>
        <div className="home__examples-grid">
          {[
            { emoji: '📚', text: 'música tranquila para estudiar' },
            { emoji: '🏋️', text: 'rock intenso para entrenar' },
            { emoji: '🌙', text: 'jazz suave para la noche' },
            { emoji: '🚗', text: 'música para conducir en autopista' },
            { emoji: '🏖️', text: 'reggaeton para la playa' },
            { emoji: '💼', text: 'ambient para trabajar concentrado' },
          ].map(({ emoji, text }) => (
            <button
              key={text}
              className="example-chip"
              onClick={() => handleSearch(text)}
              disabled={isLoading}
            >
              <span>{emoji}</span>
              <span>{text}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
