export class MusicContextDto {
  mood: string;
  activity: string;
  genres: string[];
  artists: string[];
  keywords: string[];
  language: string;
  context: string;
  /** Indicates which engine analyzed the query */
  analysisSource: 'huggingface' | 'fallback';
}
