/**
 * Normalized track object returned to the frontend.
 * All sensitive/unnecessary Spotify fields are stripped.
 */
export class SpotifyTrackDto {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  album: string;
  imageUrl: string;
  previewUrl: string | null;
  durationMs: number;
  duration: string;          // human-readable "3:42"
  popularity: number;        // 0-100
  spotifyUrl: string;
  explicit: boolean;
  releaseYear: string;
}
