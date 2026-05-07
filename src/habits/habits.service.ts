import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  private today() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private daysAgo(days: number) {
    const date = this.today();
    date.setDate(date.getDate() - days);
    return date;
  }

  async ensureUser(telegramUser: { id: number; username?: string; first_name?: string }) {
    return this.prisma.user.upsert({
      where: { telegramId: BigInt(telegramUser.id) },
      update: { username: telegramUser.username, firstName: telegramUser.first_name },
      create: {
        telegramId: BigInt(telegramUser.id),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        profile: { create: { primaryGoals: ['держать утреннюю рутину', 'говорить спокойнее', 'собирать финансовую опору'] } },
        debts: {
          create: [
            { name: 'Кредитка 1', totalAmount: 70000, remainingAmount: 70000, monthlyPayment: 4000, type: 'credit_card' },
            { name: 'Кредитка 2', totalAmount: 70000, remainingAmount: 70000, monthlyPayment: 4000, type: 'credit_card' },
          ],
        },
        savingsGoals: {
          create: [
            { name: 'Минимальный резерв', targetAmount: 300000, currentAmount: 0, priority: 1 },
            { name: 'Рабочий резерв', targetAmount: 500000, currentAmount: 0, priority: 2 },
            { name: 'Авто-фонд', targetAmount: 0, currentAmount: 0, priority: 3, status: 'paused' },
          ],
        },
      },
    });
  }

  async markMorning(telegramUser: { id: number; username?: string; first_name?: string }, rawText?: string) {
    const user = await this.ensureUser(telegramUser);
    const focus = rawText?.replace(/^\/morning_done/i, '').replace(/^\/morning/i, '').trim() || undefined;
    await this.prisma.dailyCheckin.upsert({
      where: { userId_date: { userId: user.id, date: this.today() } },
      update: { morningDone: true, focus },
      create: { userId: user.id, date: this.today(), morningDone: true, focus },
    });
    return `Утренний ритуал отмечен.\n\nСегодня ты уже не “потом”. Ты появился в своём дне.`;
  }

  async markEvening(telegramUser: { id: number; username?: string; first_name?: string }, rawText?: string) {
    const user = await this.ensureUser(telegramUser);
    const note = rawText?.replace(/^\/evening_done/i, '').trim() || undefined;
    await this.prisma.dailyCheckin.upsert({
      where: { userId_date: { userId: user.id, date: this.today() } },
      update: { eveningDone: true },
      create: { userId: user.id, date: this.today(), eveningDone: true },
    });
    if (note) {
      await this.prisma.eveningReview.create({
        data: { userId: user.id, date: this.today(), tomorrowStep: note },
      });
    }
    return `Вечерний разбор отмечен.\n\nНе идеально — и не нужно. Главное: день закрыт осознанно.`;
  }

  async markVoice(telegramUser: { id: number; username?: string; first_name?: string }, rawText?: string) {
    const user = await this.ensureUser(telegramUser);
    const phrase = rawText?.replace(/^\/voice_done/i, '').trim() || undefined;
    await this.prisma.voicePractice.create({
      data: { userId: user.id, practiceType: 'daily', phrase, completed: true },
    });
    return `Голосовая практика отмечена.\n\nГолос дороже становится не от громкости, а от спокойствия и опоры.`;
  }

  async markOutfit(telegramUser: { id: number; username?: string; first_name?: string }, rawText?: string) {
    const user = await this.ensureUser(telegramUser);
    const scenario = rawText?.replace(/^\/look_done/i, '').trim() || 'daily';
    await this.prisma.outfitLog.create({
      data: { userId: user.id, scenario, recommendation: 'marked_done' },
    });
    return `Образ отмечен.\n\nСобранность — это не понты. Это уважение к себе и к людям рядом.`;
  }

  private streak(dates: Date[]) {
    const set = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
    let count = 0;
    const cursor = this.today();
    while (set.has(cursor.toISOString().slice(0, 10))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  async stats(telegramUser: { id: number; username?: string; first_name?: string }) {
    const user = await this.ensureUser(telegramUser);
    const from30 = this.daysAgo(29);
    const [checkins, voiceCount, outfitCount, expenseDays] = await Promise.all([
      this.prisma.dailyCheckin.findMany({ where: { userId: user.id, date: { gte: from30 } }, orderBy: { date: 'asc' } }),
      this.prisma.voicePractice.count({ where: { userId: user.id, completed: true, createdAt: { gte: from30 } } }),
      this.prisma.outfitLog.count({ where: { userId: user.id, createdAt: { gte: from30 } } }),
      this.prisma.transaction.findMany({ where: { userId: user.id, createdAt: { gte: from30 } }, select: { createdAt: true } }),
    ]);

    const morningDates = checkins.filter((c) => c.morningDone).map((c) => c.date);
    const eveningDates = checkins.filter((c) => c.eveningDone).map((c) => c.date);
    const expenseDateSet = new Set(expenseDays.map((t) => t.createdAt.toISOString().slice(0, 10)));

    const morningCount = morningDates.length;
    const eveningCount = eveningDates.length;
    const morningStreak = this.streak(morningDates);
    const eveningStreak = this.streak(eveningDates);
    const financeDays = expenseDateSet.size;

    return `Статистика Опоры за 30 дней:\n\nУтро:\n- выполнено: ${morningCount}/30\n- серия: ${morningStreak} дн. подряд\n\nВечер:\n- выполнено: ${eveningCount}/30\n- серия: ${eveningStreak} дн. подряд\n\nГолос:\n- практик: ${voiceCount}\n\nОбраз/собранность:\n- отметок: ${outfitCount}\n\nФинансы:\n- дней с записями: ${financeDays}/30\n\nФраза: мы не ищем идеальность. Мы строим повторяемость.`;
  }

  async habitCalendar(telegramUser: { id: number; username?: string; first_name?: string }) {
    const user = await this.ensureUser(telegramUser);
    const from14 = this.daysAgo(13);
    const checkins = await this.prisma.dailyCheckin.findMany({ where: { userId: user.id, date: { gte: from14 } }, orderBy: { date: 'asc' } });
    const map = new Map(checkins.map((c) => [c.date.toISOString().slice(0, 10), c]));
    const lines: string[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = this.daysAgo(i);
      const key = date.toISOString().slice(0, 10);
      const c = map.get(key);
      const morning = c?.morningDone ? '☀️' : '·';
      const evening = c?.eveningDone ? '🌙' : '·';
      lines.push(`${key}: ${morning} ${evening}`);
    }
    return `Календарь привычек за 14 дней:\n\n${lines.join('\n')}\n\n☀️ утро, 🌙 вечер, · нет отметки`;
  }
}
