export default () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    tokenUrl: 'https://accounts.spotify.com/api/token',
    apiBaseUrl: 'https://api.spotify.com/v1',
  },

  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    model: process.env.HUGGINGFACE_MODEL || 'HuggingFaceH4/zephyr-7b-beta',
    apiBaseUrl: 'https://router.huggingface.co/hf-inference',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60000,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 30,
  },
});
