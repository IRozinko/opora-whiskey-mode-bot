import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPORA_SYSTEM_PROMPT } from './prompts/system.prompt';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;
  private readonly dailyLimit: number;
  private readonly usage = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4.1-mini';
    this.dailyLimit = Number(this.configService.get<string>('AI_DAILY_LIMIT') ?? 50);
    this.client = apiKey ? new OpenAI({ apiKey }) : null;

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not configured. AI responses will use fallback text.');
    }
  }

  private todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private canUseAi() {
    const key = this.todayKey();
    const used = this.usage.get(key) ?? 0;
    if (used >= this.dailyLimit) return false;
    this.usage.set(key, used + 1);
    return true;
  }

  getUsageText() {
    const key = this.todayKey();
    const used = this.usage.get(key) ?? 0;
    return `AI-запросы сегодня: ${used} / ${this.dailyLimit}.`;
  }

  async ask(userMessage: string, context?: string): Promise<string> {
    if (!this.client) {
      return 'Окей. Возвращаемся спокойно. Один шаг. Сейчас AI не подключён, но базовые команды работают.';
    }

    if (!this.canUseAi()) {
      return 'Сегодня лимит AI-запросов исчерпан. Базовые команды работают: /morning, /status, /expense, /money, /reset. Не геройствуем — экономим ресурс и токены.';
    }

    try {
      const response = await this.client.responses.create({
        model: this.model,
        max_output_tokens: 700,
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
