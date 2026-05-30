import React from 'react';
import {
  AlertTriangle,
  Ban,
  Bot,
  Heart,
  Lightbulb,
  Music,
  Music2,
  Search,
  WifiOff,
} from 'lucide-react';
import './EmptyState.css';

const STATES = {
  'no-results': {
    Icon: Search,
    title: 'No tracks found',
    description: 'Try different keywords or be more specific about your mood.',
    suggestion: 'Example: "jazz suave para la noche" or "lo-fi para estudiar"',
  },
  'error': {
    Icon: AlertTriangle,
    title: 'Something went wrong',
    description: 'We couldn\'t process your request. Please try again.',
    suggestion: null,
  },
  'spotify-error': {
    Icon: Music2,
    title: 'Spotify is unavailable',
    description: 'Spotify is temporarily down. Please try again in a moment.',
    suggestion: null,
  },
  'ai-error': {
    Icon: Bot,
    title: 'AI analysis failed',
    description: 'The AI service is busy. We\'ll use simplified search instead.',
    suggestion: null,
  },
  'offline': {
    Icon: WifiOff,
    title: 'No internet connection',
    description: 'Please check your network and try again.',
    suggestion: null,
  },
  'no-favorites': {
    Icon: Heart,
    title: 'No favorites yet',
    description: 'Discover music and tap the heart icon to save your favorites.',
    suggestion: null,
  },
  'no-preview': {
    Icon: Ban,
    title: 'Preview not available',
    description: 'Spotify doesn\'t provide a preview for this track.',
    suggestion: null,
  },
  'default': {
    Icon: Music,
    title: 'Ready to find your music',
    description: 'Describe how you feel or what you\'re doing to get started.',
    suggestion: 'Try "música relajante para estudiar" or "rock para entrenar"',
  },
};

export default function EmptyState({ type = 'default', onAction, actionLabel }) {
  const state = STATES[type] || STATES.default;
  const Icon = state.Icon || Music;

  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="empty-state__icon" aria-hidden="true"><Icon size={56} /></div>
      <h2 className="empty-state__title">{state.title}</h2>
      <p className="empty-state__description">{state.description}</p>
      {state.suggestion && (
        <p className="empty-state__suggestion"><Lightbulb size={16} /> {state.suggestion}</p>
      )}
      {onAction && actionLabel && (
        <button className="empty-state__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
