import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { MusicContextDto } from './dto/music-context.dto';

const MOOD_LABELS     = ['calm', 'energetic', 'happy', 'sad', 'romantic', 'focused', 'chill'];
const ACTIVITY_LABELS = ['study', 'workout', 'sleep', 'drive', 'party', 'relax', 'work', 'meditate'];

@Injectable()
export class HuggingFaceService {
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const apiKey     = this.config.get<string>('huggingface.apiKey');
    const apiBaseUrl = this.config.get<string>('huggingface.apiBaseUrl');

    this.http = axios.create({
      baseURL: apiBaseUrl,
      timeout: 20000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Analyzes a natural-language music request.
   * Primary:  HuggingFace zero-shot classification (facebook/bart-large-mnli)
   *           — always available on the free hf-inference tier.
   * Fallback: rule-based keyword extraction.
   */
  async analyzeText(query: string): Promise<MusicContextDto> {
    try {
      const context = await this.analyzeWithZeroShot(query);
      this.logger.log(`HF zero-shot analysis OK for: "${query}"`);
      return { ...context, analysisSource: 'huggingface' };
    } catch (error) {
      this.logger.warn(
        `HuggingFace API failed (${error.message}) – status:${error.response?.status} – body:${JSON.stringify(error.response?.data)}, using rule-based fallback`,
      );
      return { ...this.ruleBasedFallback(query), analysisSource: 'fallback' };
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Uses facebook/bart-large-mnli zero-shot classification to detect
   * mood and activity, then combines with rule-based genre/language detection.
   * Two parallel requests = fast.
   */
  private async analyzeWithZeroShot(
    query: string,
  ): Promise<Omit<MusicContextDto, 'analysisSource'>> {
    const [moodResult, activityResult] = await Promise.all([
      this.classify(query, MOOD_LABELS),
      this.classify(query, ACTIVITY_LABELS),
    ]);

    const mood     = moodResult.labels[0];
    const activity = activityResult.labels[0];
    const q        = query.toLowerCase();

    return {
      mood,
      activity,
      genres:   this.detectGenres(q),
      artists:  [],
      keywords: this.extractKeywords(q),
      language: this.detectLanguage(q),
      context:  `${activity} music with ${mood} mood`,
    };
  }

  /**
   * Calls the zero-shot classification endpoint.
   * Returns labels sorted by score (highest first).
   */
  private async classify(
    text: string,
    candidateLabels: string[],
  ): Promise<{ labels: string[]; scores: number[] }> {
    const response = await this.http.post(
      '/models/facebook/bart-large-mnli',
      {
        inputs: text,
        parameters: { candidate_labels: candidateLabels },
      },
    );

    const data = response.data;
    this.logger.debug(`HF raw response: ${JSON.stringify(data).substring(0, 200)}`);

    // Format 1: { labels: [...], scores: [...] }  ← standard zero-shot
    if (data?.labels && Array.isArray(data.labels)) {
      return data;
    }

    // Format 2: [{ label: "...", score: 0.9 }, ...]  ← some router versions
    if (Array.isArray(data) && data[0]?.label !== undefined) {
      const sorted = [...data].sort((a, b) => b.score - a.score);
      return {
        labels: sorted.map((d) => d.label),
        scores: sorted.map((d) => d.score),
      };
    }

    // Format 3: model loading  { error: "...", estimated_time: N }
    if (data?.estimated_time || data?.error) {
      throw new Error(`HF model loading or error: ${JSON.stringify(data)}`);
    }

    throw new Error(`Unexpected HF response format: ${JSON.stringify(data).substring(0, 150)}`);
  }

  // ─── Rule-based fallback ───────────────────────────────────────────────────

  private ruleBasedFallback(query: string): Omit<MusicContextDto, 'analysisSource'> {
    const q        = query.toLowerCase();
    const mood     = this.detectMood(q);
    const activity = this.detectActivity(q);
    const genres   = this.detectGenres(q);
    const language = this.detectLanguage(q);
    const keywords = this.extractKeywords(q);

    this.logger.log(`Rule-based fallback for "${query}" → mood:${mood}, genres:${genres.join(',')}`);

    return {
      mood,
      activity,
      genres,
      artists:  [],
      keywords,
      language,
      context: `${activity} music with ${mood} mood`,
    };
  }

  private detectMood(q: string): string {
    if (/gym|ejercicio|entrenar|workout|correr|run|train/.test(q))     return 'energetic';
    if (/relax|tranquil|calm|suave|peaceful|soft|sereno|calmado|descanso/.test(q)) return 'calm';
    if (/energi|activ|fuerte|pump|power|intense|motivat/.test(q))      return 'energetic';
    if (/happy|alegr|feliz|joy|upbeat|animad/.test(q))                 return 'happy';
    if (/sad|triste|melanc|nostálg|melanchol/.test(q))                 return 'sad';
    if (/romantic|amor|love|romántic/.test(q))                         return 'romantic';
    if (/focus|concentra|study|estudiar/.test(q))                      return 'focused';
    if (/party|fiesta|baile|dance|club/.test(q))                       return 'happy';
    if (/sleep|dormir|noche|night/.test(q))                            return 'calm';
    if (/work|trabajar|oficina/.test(q))                               return 'focused';
    if (/playa|beach|vacacion/.test(q))                                return 'happy';
    if (/conduc|manejar|drive|autopista|carretera/.test(q))            return 'energetic';
    return 'chill';
  }

  private detectActivity(q: string): string {
    if (/studi|estudiar|concentra|tarea/.test(q))                return 'study';
    if (/gym|entrenar|workout|ejercicio|correr|run|pesas|cardio/.test(q)) return 'workout';
    if (/sleep|dormir|descanso|siesta/.test(q))                  return 'sleep';
    if (/conduc|manejar|drive|carro|coche|autopista/.test(q))    return 'drive';
    if (/party|fiesta|baile|dance|club/.test(q))                 return 'party';
    if (/playa|beach|piscina|verano/.test(q))                    return 'relax';
    if (/work|trabajar|oficina|teletrabaj/.test(q))              return 'work';
    if (/medita|yoga|mindful|zen/.test(q))                       return 'meditate';
    return 'relax';
  }

  private detectGenres(q: string): string[] {
    const genres: string[] = [];
    if (/lo.?fi|lofi/.test(q))               genres.push('lofi');
    if (/jazz/.test(q))                       genres.push('jazz');
    if (/rock/.test(q))                       genres.push('rock');
    if (/pop/.test(q))                        genres.push('pop');
    if (/ambient/.test(q))                    genres.push('ambient');
    if (/classical|clásic/.test(q))           genres.push('classical');
    if (/reggaeton|regueton/.test(q))         genres.push('reggaeton');
    if (/trap/.test(q))                       genres.push('trap');
    if (/electro|edm|electronic/.test(q))    genres.push('electronic');
    if (/hip.?hop|rap/.test(q))              genres.push('hip-hop');
    if (/r&b|rnb|soul/.test(q))              genres.push('r&b');
    if (/salsa|cumbia|merengue/.test(q))     genres.push('salsa');
    if (/acoustic|acústic/.test(q))          genres.push('acoustic');
    if (/indie/.test(q))                      genres.push('indie');
    if (/metal/.test(q))                      genres.push('metal');
    if (/bachata/.test(q))                    genres.push('bachata');
    if (/blues/.test(q))                      genres.push('blues');
    if (/funk/.test(q))                       genres.push('funk');
    if (/bossa|nova/.test(q))                genres.push('bossa nova');

    if (genres.length === 0) {
      if (/gym|ejercicio|entrenar|workout|correr|pesas|cardio/.test(q))   genres.push('rock', 'hip-hop', 'electronic');
      else if (/studi|estudiar|concentra|focus|tarea/.test(q))             genres.push('lofi', 'ambient');
      else if (/conduc|manejar|drive|autopista|carretera/.test(q))         genres.push('rock', 'pop');
      else if (/sleep|dormir|descanso|siesta/.test(q))                     genres.push('ambient', 'classical');
      else if (/playa|beach|verano/.test(q))                               genres.push('reggaeton', 'pop');
      else if (/party|fiesta|baile|club/.test(q))                          genres.push('electronic', 'reggaeton', 'pop');
      else if (/work|trabajar|oficina/.test(q))                            genres.push('ambient', 'lofi');
      else if (/medita|yoga|zen/.test(q))                                  genres.push('ambient', 'classical');
      else                                                                  genres.push('pop');
    }
    return genres;
  }

  private detectLanguage(q: string): string {
    if (/español|castellano|en español/.test(q)) return 'es';
    if (/english|inglés|in english/.test(q))     return 'en';
    if (/português|portuguese|brasil/.test(q))   return 'pt';
    return 'any';
  }

  private extractKeywords(q: string): string[] {
    const stopwords = new Set([
      'para','de','la','el','en','con','una','un','y','a','al',
      'for','the','a','an','and','to','of','in','with',
      'music','musica','música','quiero','escuchar','oir',
    ]);
    return q.split(/\s+/)
      .filter((w) => w.length > 3 && !stopwords.has(w))
      .slice(0, 6);
  }
}
