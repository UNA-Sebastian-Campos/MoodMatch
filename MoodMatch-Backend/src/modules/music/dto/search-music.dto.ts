import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchMusicDto {
  @IsString()
  @IsNotEmpty({ message: 'Search query cannot be empty' })
  @MinLength(2, { message: 'Query must be at least 2 characters' })
  @MaxLength(200, { message: 'Query cannot exceed 200 characters' })
  @Matches(/^[a-zA-ZÀ-ÿ0-9\s\-&,.'!?áéíóúÁÉÍÓÚñÑüÜ]+$/, {
    message: 'Query contains invalid characters',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  query: string;

  /** Pagination offset for "Load more" — 0-based, multiples of 50 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(950) // Spotify max offset is 1000
  offset?: number = 0;
}
