export class MusicContextDto {
  mood: string;
  activity: string;
  genres: string[];
  artists: string[];
  keywords: string[];
  language: string;
  context: string;
  /** True when the user named a genre explicitly (it gets search priority) */
  explicitGenre?: boolean;
  /** Indicates which engine analyzed the query */
  analysisSource: 'huggingface' | 'fallback';
}
