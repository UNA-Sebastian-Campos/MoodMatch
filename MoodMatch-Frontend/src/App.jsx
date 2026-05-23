import React, { createContext, useContext, useState, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import Toast from './components/Toast/Toast';
import Home from './pages/Home/Home';
import Results from './pages/Results/Results';
import Favorites from './pages/Favorites/Favorites';
import { searchMusic } from './services/api';
import { addToHistory } from './storage/history';
import { sanitizeQuery } from './utils/sanitize';
import './App.css';

export const AppContext = createContext(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContext.Provider');
  return ctx;
}

export default function App() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [musicContext, setMusicContext]   = useState(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError]     = useState(null);
  const [hasMore, setHasMore]             = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [toast, setToast]                 = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // Fresh search — resets everything
  const handleSearch = useCallback(async (rawQuery) => {
    const { valid, value, error } = sanitizeQuery(rawQuery);
    if (!valid) { showToast(error, 'error'); return; }

    setSearchQuery(value);
    setIsLoading(true);
    setSearchError(null);
    setSearchResults(null);
    setMusicContext(null);
    setHasMore(false);
    setCurrentOffset(0);
    navigate('/results');

    try {
      const data = await searchMusic(value, 0);
      setSearchResults(data.tracks || []);
      setMusicContext(data.context || null);
      setHasMore(data.hasMore || false);
      setCurrentOffset(data.tracks?.length || 0);
      addToHistory(value, data.totalFound || 0);
    } catch (err) {
      setSearchError(err);
      showToast(resolveErrorMessage(err), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, showToast]);

  // Load more — appends to existing results
  const handleLoadMore = useCallback(async () => {
    if (!searchQuery || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const data = await searchMusic(searchQuery, currentOffset);
      setSearchResults((prev) => [...(prev || []), ...(data.tracks || [])]);
      setHasMore(data.hasMore || false);
      // Increment by 5 (Spotify's page size per query) for full catalog coverage
      setCurrentOffset((prev) => prev + 5);
    } catch (err) {
      showToast('Could not load more tracks. Try again.', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [searchQuery, currentOffset, hasMore, isLoadingMore, showToast]);

  const contextValue = {
    searchQuery, searchResults, musicContext,
    isLoading, isLoadingMore, searchError,
    hasMore, handleSearch, handleLoadMore, showToast,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/results"   element={<Results />} />
          <Route path="/favorites" element={<Favorites />} />
        </Routes>
      </main>
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={dismissToast}
        />
      )}
    </AppContext.Provider>
  );
}

function resolveErrorMessage(err) {
  if (!navigator.onLine) return 'No internet connection.';
  const code = err.errorCode || '';
  if (code === 'SPOTIFY_ERROR')    return 'Spotify is temporarily unavailable.';
  if (code === 'AI_SERVICE_ERROR') return 'AI service unavailable — using smart fallback.';
  if (err.statusCode === 429)      return 'Too many requests. Please wait a moment.';
  if (err.statusCode === 400)      return 'Invalid search query. Try different terms.';
  return err.message || 'Something went wrong. Please try again.';
}
