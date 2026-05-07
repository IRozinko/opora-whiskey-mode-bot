import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private readonly bot: Telegraf | null;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.enabled = this.configService.get<string>('REMINDERS_ENABLED') !== 'false';
    this.bot = token ? new Telegraf(token) : null;
  }

  private async sendToAllUsers(message: string) {
    if (!this.enabled || !this.bot) return;

    const users = await this.prisma.user.findMany({ select: { telegramId: true } });
    for (const user of users) {
      try {
        await this.bot.telegram.sendMessage(String(user.telegramId), message);
      } catch (error) {
        this.logger.warn(`Failed to send reminder to ${user.telegramId}: ${(error as Error).message}`);
      }
    }
  }

  @Cron('0 7 * * 1-5', { timeZone: 'Europe/Kyiv' })
  async weekdayMorningReminder() {
    await this.sendToAllUsers(
      '☀️ Утренний пинг Опоры.\n\nНе геройствуем. Отмечаем базу:\n/morning\n\nВода, лицо, одежда, голос, один фокус дня.',
    );
  }

  @Cron('30 12 * * 1-5', { timeZone: 'Europe/Kyiv' })
  async middayNerveCheck() {
    await this.sendToAllUsers(
      '🟡 Проверка палкой в середине дня.\n\nКак нервная система?\n/nerve_status\n/nerve_status yellow\n/nerve_status red\n\nЕсли голова квадратная — чай, вода, одна механическая задача.',
    );
  }

  @Cron('30 17 * * 1-5', { timeZone: 'Europe/Kyiv' })
  async eveningTransitionReminder() {
    await this.sendToAllUsers(
      '🌙 Переход из работы домой.\n\nЕсли есть рабочий хвост — назови его спокойно:\n/status зелёный\n/status жёлтый 40 минут\n/status красный 90 минут\n\nНе исчезаем. Говорим коротко.',
    );
  }

  @Cron('30 21 * * *', { timeZone: 'Europe/Kyiv' })
  async eveningReviewReminder() {
    await this.sendToAllUsers(
      '🌙 Вечерняя отметка.\n\nНе самобичевание, а закрытие дня:\n/evening\n\nКогда сделал — отметь:\n/evening_done один шаг на завтра',
    );
  }

  @Cron('0 10 * * 0', { timeZone: 'Europe/Kyiv' })
  async weeklyStatsReminder() {
    await this.sendToAllUsers(
      '📊 Недельная проверка Опоры.\n\nПосмотреть статистику:\n/stats\n/habitcalendar\n/weekmoney\n\nНе ищем идеальность. Смотрим повторяемость.',
    );
  }
}
