import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPORA_SYSTEM_PROMPT } from './prompts/system.prompt';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4.1-mini';
    this.client = apiKey ? new OpenAI({ apiKey }) : null;

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not configured. AI responses will use fallback text.');
    }
  }

  async ask(userMessage: string, context?: string): Promise<string> {
    if (!this.client) {
      return 'Окей. Возвращаемся спокойно. Один шаг. Сейчас AI не подключён, но базовые команды работают.';
    }

    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: [
          {
            role: 'system',
            content: OPORA_SYSTEM_PROMPT,
          },
          ...(context
            ? [
                {
                  role: 'system' as const,
                  content: `Контекст пользователя:\n${context}`,
                },
              ]
            : []),
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      return response.output_text?.trim() || 'Окей. Держим курс. Один ближайший шаг.';
    } catch (error) {
      this.logger.error('OpenAI request failed', error as Error);
      return 'Что-то пошло не так с AI-ответом. Не геройствуем: попробуй ещё раз или используй /reset.';
    }
  }
}
