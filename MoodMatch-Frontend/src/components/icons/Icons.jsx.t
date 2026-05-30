// Lightweight inline SVG icons (no external dependency).
// All inherit `currentColor` and size via the `size` prop.

const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

export const IconSearch = ({ size = 20 }) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);

export const IconMusic = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
);

export const IconClock = ({ size = 16 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

export const IconClose = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

export const IconReturn = ({ size = 16 }) => (
  <svg {...base(size)}><polyline points="9 10 4 15 9 20" /><path d="M20 4v7a4 4 0 0 1-4 4H4" /></svg>
);

export const IconSparkles = ({ size = 22 }) => (
  <svg {...base(size)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" /></svg>
);

export const IconHeadphones = ({ size = 22 }) => (
  <svg {...base(size)}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>
);

export const IconHeart = ({ size = 22 }) => (
  <svg {...base(size)}><path d="M19 8.5c0 4-7 9-7 9s-7-5-7-9a3.8 3.8 0 0 1 7-2 3.8 3.8 0 0 1 7 2Z" /></svg>
);

export const IconBolt = ({ size = 22 }) => (
  <svg {...base(size)}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
);

export const IconBook = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z" /><path d="M8 7h7M8 11h7" /></svg>
);

export const IconDumbbell = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M6.5 6.5 17.5 17.5" /><path d="m3 7 4-4 3 3-4 4-3-3ZM14 18l4-4 3 3-4 4-3-3Z" /></svg>
);

export const IconMoon = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>
);

export const IconCar = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13v4h-2v-2H7v2H5v-4Z" /><circle cx="8" cy="15" r="0.5" /><circle cx="16" cy="15" r="0.5" /></svg>
);

export const IconUmbrella = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M12 3a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8Z" /><path d="M12 11v7a2 2 0 0 0 4 0" /></svg>
);

export const IconBriefcase = ({ size = 18 }) => (
  <svg {...base(size)}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></svg>
);
