import React, { useState } from 'react';
import SearchBar from '../../components/SearchBar/SearchBar';
import { useAppContext } from '../../App';
import { getHistory, removeFromHistory } from '../../storage/history';
import {
  Book,
  Briefcase,
  Car,
  Dumbbell,
  Headphones,
  Heart,
  Moon,
  Sparkles,
  Umbrella,
  Zap,
} from 'lucide-react';
import './Home.css';

const FEATURE_CARDS = [
  { Icon: Sparkles,  title: 'AI-powered',        desc: 'Describe your mood in plain language and let our AI analyze it' },
  { Icon: Headphones, title: 'Real Spotify music', desc: 'Get actual tracks playable directly on Spotify' },
  { Icon: Heart,     title: 'Save favorites',    desc: 'Keep your favorite discoveries across sessions' },
  { Icon: Zap,       title: 'Instant results',   desc: 'Smart search in under 3 seconds' },
];

const EXAMPLES = [
  { Icon: Book,      text: 'música tranquila para estudiar' },
  { Icon: Dumbbell,  text: 'rock intenso para entrenar' },
  { Icon: Moon,      text: 'jazz suave para la noche' },
  { Icon: Car,       text: 'música para conducir en autopista' },
  { Icon: Umbrella,  text: 'reggaeton para la playa' },
  { Icon: Briefcase, text: 'ambient para trabajar concentrado' },
];

export default function Home() {
  const { handleSearch, isLoading } = useAppContext();
  const [history, setHistory] = useState(() => getHistory());

  const handleRemoveHistory = (id) => {
    removeFromHistory(id);
    setHistory(getHistory());
  };

  return (
    <div className="home">
      {/* Hero */}
      <section className="home__hero">
        <div className="home__hero-bg" aria-hidden="true">
          <div className="home__grid" />
          <div className="home__hero-orb home__hero-orb--1" />
          <div className="home__hero-orb home__hero-orb--2" />
        </div>

        <div className="container home__hero-content">
          <p className="home__eyebrow">
            <span className="home__eyebrow-dot" /> AI-powered music discovery
          </p>
          <h1 className="home__headline">
            Music that matches<br />
            <span className="home__headline-gradient">your mood</span>
          </h1>
          <p className="home__subline">
            Describe how you feel or what you're doing.<br />
            We'll find the perfect soundtrack for this moment.
          </p>

          <div className="home__search-wrap">
            <SearchBar
              onSearch={handleSearch}
              isLoading={isLoading}
              history={history}
              onSelectHistory={handleSearch}
              onRemoveHistory={handleRemoveHistory}
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="home__features container">
        <h2 className="home__section-title">Why MoodMatch?</h2>
        <div className="home__features-grid">
          {FEATURE_CARDS.map(({ Icon, title, desc }) => (
            <div key={title} className="feature-card">
              <span className="feature-card__icon"><Icon size={22} /></span>
              <h3 className="feature-card__title">{title}</h3>
              <p className="feature-card__desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example queries */}
      <section className="home__examples container">
        <h2 className="home__section-title">Try these examples</h2>
        <div className="home__examples-grid">
          {EXAMPLES.map(({ Icon, text }) => (
            <button
              key={text}
              className="example-chip"
              onClick={() => handleSearch(text)}
              disabled={isLoading}
            >
              <span className="example-chip__icon"><Icon size={18} /></span>
              <span>{text}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
