import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { MusicContextDto } from './dto/music-context.dto';

@Injectable()
export class HuggingFaceService {
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly http: AxiosInstance;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('huggingface.apiKey');
    const apiBaseUrl = this.config.get<string>('huggingface.apiBaseUrl');
    this.model = this.config.get<string>('huggingface.model');

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
   * Analyzes a natural-language music request and returns structured context.
   * Primary: HuggingFace text-generation model (Mistral-7B-Instruct)
   * Fallback: rule-based keyword extraction
   */
  async analyzeText(query: string): Promise<MusicContextDto> {
    try {
      const context = await this.callHuggingFaceApi(query);
      this.logger.log(`HF analysis successful for: "${query}"`);
      return context;
    } catch (error) {
      this.logger.warn(
        `HuggingFace API failed (${error.message}), using rule-based fallback`,
      );
      return this.ruleBasedFallback(query);
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async callHuggingFaceApi(query: string): Promise<MusicContextDto> {
    // New HuggingFace Router API — OpenAI-compatible chat completions format
    const response = await this.http.post(
      `/models/${this.model}/v1/chat/completions`,
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a music context analyzer. Always respond with valid JSON only — no markdown, no explanation.',
          },
          {
            role: 'user',
            content: this.buildPrompt(query),
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      },
    );

    const raw: string =
      response.data?.choices?.[0]?.message?.content || '';

    return this.parseJsonFromText(raw, query);
  }

  /**
   * Builds the user prompt for the chat completions API.
   */
  private buildPrompt(query: string): string {
    return `Extract music preferences from this request and return ONLY a valid JSON object with these exact fields:
{
  "mood": "one word (calm/energetic/happy/sad/romantic/focused/chill)",
  "activity": "one word (study/workout/sleep/drive/party/relax/work/meditate)",
  "genres": ["array of music genres"],
  "artists": ["array of artist names if mentioned, else empty"],
  "keywords": ["array of descriptive keywords"],
  "language": "language code: en/es/pt/fr/de/it or any",
  "context": "brief description of the musical context"
}

Request: "${query}"`;
  }

  /**
   * Extracts the first valid JSON object from the model's raw text output.
   * Handles cases where the model adds extra text before/after the JSON.
   */
  private parseJsonFromText(text: string, originalQuery: string): MusicContextDto {
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from HuggingFace');
    }

    // Try to extract JSON block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in HuggingFace response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        mood: this.sanitizeString(parsed.mood, 'chill'),
        activity: this.sanitizeString(parsed.activity, 'relax'),
        genres: this.sanitizeArray(parsed.genres),
        artists: this.sanitizeArray(parsed.artists),
        keywords: this.sanitizeArray(parsed.keywords),
        language: this.sanitizeString(parsed.language, 'any'),
        context: this.sanitizeString(parsed.context, originalQuery),
        analysisSource: 'huggingface',
      };
    } catch {
      throw new Error('Failed to parse JSON from HuggingFace response');
    }
  }

  /**
   * Rule-based fallback when HuggingFace is unavailable or returns invalid data.
   * Analyzes common Spanish and English music-related keywords.
   */
  private ruleBasedFallback(query: string): MusicContextDto {
    const q = query.toLowerCase();

    const mood = this.detectMood(q);
    const activity = this.detectActivity(q);
    const genres = this.detectGenres(q);
    const language = this.detectLanguage(q);
    const keywords = this.extractKeywords(q);

    this.logger.log(`Rule-based fallback for "${query}" → mood:${mood}, genres:${genres.join(',')}`);

    return {
      mood,
      activity,
      genres,
      artists: [],
      keywords,
      language,
      context: `${activity} music with ${mood} mood`,
      analysisSource: 'fallback',
    };
  }

  private detectMood(q: string): string {
    // Workout / gym → energetic (must go before generic energy check)
    if (/gym|ejercicio|entrenar|workout|correr|run|train/.test(q)) return 'energetic';
    if (/relax|tranquil|calm|suave|peaceful|soft|gentle|sereno|calmado|descanso/.test(q)) return 'calm';
    if (/energi|activ|fuerte|pump|power|intense|motivat/.test(q)) return 'energetic';
    if (/happy|alegr|feliz|joy|upbeat|animad|eufor/.test(q)) return 'happy';
    if (/sad|triste|melanc|nostálg|melanchol/.test(q)) return 'sad';
    if (/romantic|amor|love|romántic/.test(q)) return 'romantic';
    if (/focus|concentra|study|estudiar/.test(q)) return 'focused';
    if (/party|fiesta|baile|dance|club/.test(q)) return 'happy';
    if (/sleep|dormir|noche|night/.test(q)) return 'calm';
    if (/work|trabajar|oficina/.test(q)) return 'focused';
    if (/playa|beach|vacacion/.test(q)) return 'happy';
    if (/conduc|manejar|drive|autopista|carretera/.test(q)) return 'energetic';
    return 'chill';
  }

  private detectActivity(q: string): string {
    if (/studi|estudiar|estudio|concentra|tarea|deberes/.test(q)) return 'study';
    if (/gym|entrenar|workout|ejercicio|correr|run|train|pesas|cardio/.test(q)) return 'workout';
    if (/sleep|dormir|descanso|rest|siesta/.test(q)) return 'sleep';
    if (/conduc|manejar|drive|carro|coche|autopista|carretera/.test(q)) return 'drive';
    if (/party|fiesta|baile|dance|club|celebr/.test(q)) return 'party';
    if (/playa|beach|piscina|pool|verano/.test(q)) return 'relax';
    if (/work|trabajar|oficina|office|teletrabaj/.test(q)) return 'work';
    if (/medita|yoga|mindful|zen/.test(q)) return 'meditate';
    if (/leer|lectura|read/.test(q)) return 'study';
    return 'relax';
  }

  private detectGenres(q: string): string[] {
    const genres: string[] = [];
    if (/lo.?fi|lofi/.test(q)) genres.push('lofi');
    if (/jazz/.test(q)) genres.push('jazz');
    if (/rock/.test(q)) genres.push('rock');
    if (/pop/.test(q)) genres.push('pop');
    if (/ambient/.test(q)) genres.push('ambient');
    if (/classical|clásic/.test(q)) genres.push('classical');
    if (/reggaeton|regueton/.test(q)) genres.push('reggaeton');
    if (/trap/.test(q)) genres.push('trap');
    if (/urban|urbano/.test(q)) genres.push('urban');
    if (/electro|edm|electronic/.test(q)) genres.push('electronic');
    if (/hip.?hop|rap/.test(q)) genres.push('hip-hop');
    if (/r&b|rnb|soul/.test(q)) genres.push('r&b');
    if (/salsa|cumbia|merengue/.test(q)) genres.push('salsa');
    if (/folk|acoustic|acústic/.test(q)) genres.push('acoustic');
    if (/indie/.test(q)) genres.push('indie');
    if (/metal/.test(q)) genres.push('metal');
    if (/punk/.test(q)) genres.push('punk');
    if (/country/.test(q)) genres.push('country');
    if (/bachata/.test(q)) genres.push('bachata');
    if (/flamenco/.test(q)) genres.push('flamenco');
    if (/blues/.test(q)) genres.push('blues');
    if (/funk/.test(q)) genres.push('funk');
    if (/bossa|nova/.test(q)) genres.push('bossa nova');

    // Activity-based genre inference when no genre is explicitly mentioned
    if (genres.length === 0) {
      if (/gym|ejercicio|entrenar|workout|correr|run|pesas|cardio/.test(q)) {
        genres.push('rock', 'hip-hop', 'electronic');
      } else if (/studi|estudiar|concentra|focus|tarea/.test(q)) {
        genres.push('lofi', 'ambient');
      } else if (/conduc|manejar|drive|autopista|carretera/.test(q)) {
        genres.push('rock', 'pop');
      } else if (/sleep|dormir|descanso|siesta/.test(q)) {
        genres.push('ambient', 'classical');
      } else if (/playa|beach|verano/.test(q)) {
        genres.push('reggaeton', 'pop');
      } else if (/party|fiesta|baile|club/.test(q)) {
        genres.push('electronic', 'reggaeton', 'pop');
      } else if (/work|trabajar|oficina/.test(q)) {
        genres.push('ambient', 'lofi');
      } else if (/medita|yoga|zen/.test(q)) {
        genres.push('ambient', 'classical');
      } else {
        genres.push('pop');
      }
    }
    return genres;
  }

  private detectLanguage(q: string): string {
    if (/español|castellano|spanish|en español|habla hispana/.test(q)) return 'es';
    if (/english|inglés|in english/.test(q)) return 'en';
    if (/português|portuguese|brasil/.test(q)) return 'pt';
    return 'any';
  }

  private extractKeywords(q: string): string[] {
    const stopwords = new Set([
      'para','de','la','el','en','con','una','un','y','a',
      'for','the','a','an','and','to','of','in','with','music','musica','música',
    ]);
    return q
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopwords.has(w))
      .slice(0, 6);
  }

  private sanitizeString(value: any, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim().toLowerCase()
      : fallback;
  }

  private sanitizeArray(value: any): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().toLowerCase())
      .slice(0, 10);
  }
}
