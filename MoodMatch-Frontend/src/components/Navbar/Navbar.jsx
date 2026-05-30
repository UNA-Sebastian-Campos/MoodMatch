import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Music2 } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Add glass effect on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const isActive = (path) => location.pathname === path;

  return (
    <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        {/* Logo */}
        <Link to="/" className="navbar__logo" aria-label="MoodMatch Home">
          <span className="navbar__logo-icon" aria-hidden="true"><Music2 size={20} /></span>
          <span className="navbar__logo-text">MoodMatch</span>
        </Link>

        {/* Desktop nav */}
        <nav className="navbar__nav" aria-label="Main navigation">
          <Link
            to="/"
            className={`navbar__link ${isActive('/') ? 'navbar__link--active' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/results"
            className={`navbar__link ${isActive('/results') ? 'navbar__link--active' : ''}`}
          >
            Discover
          </Link>
          <Link
            to="/favorites"
            className={`navbar__link ${isActive('/favorites') ? 'navbar__link--active' : ''}`}
          >
            <Heart size={16} /> Favorites
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className={`navbar__burger ${menuOpen ? 'navbar__burger--open' : ''}`}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile menu */}
      <nav
        className={`navbar__mobile-menu ${menuOpen ? 'navbar__mobile-menu--open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <Link to="/"          className="navbar__mobile-link">Home</Link>
        <Link to="/results"   className="navbar__mobile-link">Discover</Link>
        <Link to="/favorites" className="navbar__mobile-link"><Heart size={16} /> Favorites</Link>
      </nav>
    </header>
  );
}
