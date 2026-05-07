import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const FINANCE_CATEGORIES = [
  'Аренда',
  'Коммуналка',
  'Школа сына',
  'Дочка',
  'Продукты домой',
  'Safe food сына',
  'Кафе/доставки семьи',
  'Кофе/перекусы',
  'Сиделки/дедушка',
  'Медицина/аптека',
  'Транспорт/такси',
  'Связь/интернет',
  'Подписки',
  'Одежда/обувь',
  'Уход/барбер/маникюр',
  'EDC/стиль',
  'Кредитки',
  'Резерв',
  'Авто-фонд',
  'Прочее',
] as const;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  parseAmount(input: string): number | null {
    const match = input.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  detectCurrency(input: string): string {
    const normalized = input.toLowerCase();
    if (normalized.includes('eur') || normalized.includes('euro') || normalized.includes('евро')) return 'EUR';
    if (normalized.includes('usd') || normalized.includes('$') || normalized.includes('дол')) return 'USD';
    return 'UAH';
  }

  private normalizeCategory(input: string) {
    const text = input.trim().toLowerCase().replace(/_/g, ' ');
    const direct = FINANCE_CATEGORIES.find((category) => category.toLowerCase() === text);
    if (direct) return direct;

    const aliases: Record<string, string> = {
      продукты: 'Продукты домой',
      еда: 'Продукты домой',
      safe: 'Safe food сына',
      'safe food': 'Safe food сына',
      сын: 'Safe food сына',
      доставки: 'Кафе/доставки семьи',
      кафе: 'Кафе/доставки семьи',
      кофе: 'Кофе/перекусы',
      перекусы: 'Кофе/перекусы',
      такси: 'Транспорт/такси',
      транспорт: 'Транспорт/такси',
      медицина: 'Медицина/аптека',
      аптека: 'Медицина/аптека',
      уход: 'Уход/барбер/маникюр',
      барбер: 'Уход/барбер/маникюр',
      стиль: 'EDC/стиль',
      edc: 'EDC/стиль',
      кредитки: 'Кредитки',
      кредитка: 'Кредитки',
      резерв: 'Резерв',
      авто: 'Авто-фонд',
      машина: 'Авто-фонд',
    };

    return aliases[text] ?? input.trim();
  }

  categorizeExpense(description: string): string {
    const text = description.toLowerCase();

    if (/(happy meal|хэппи|наггет|бульон.*сын|сын.*бульон|макдональдс.*сын|mcdonald.*сын)/i.test(text)) {
      return 'Safe food сына';
    }

    if (/(кофе|перекус|булоч|круассан|снэк|snack)/i.test(text)) return 'Кофе/перекусы';
    if (/(суши|пицц|доставка|glovo|bolt food|ракета|еда)/i.test(text)) return 'Кафе/доставки семьи';
    if (/(аптек|лекар|медицин|врач|анализ|таблет)/i.test(text)) return 'Медицина/аптека';
    if (/(такси|uber|uklon|bolt|маршрут|проезд|транспорт)/i.test(text)) return 'Транспорт/такси';
    if (/(коммун|свет|газ|вода|отопл)/i.test(text)) return 'Коммуналка';
    if (/(аренд|квартир)/i.test(text)) return 'Аренда';
    if (/(школ|занят|подготов)/i.test(text)) return 'Школа сына';
    if (/(дочка|подгуз|памперс|смесь|детск)/i.test(text)) return 'Дочка';
    if (/(продукт|сильпо|атб|novus|fora|магазин|мясо|овощ|молоко)/i.test(text)) return 'Продукты домой';
    if (/(сидел|дедуш|бабуш)/i.test(text)) return 'Сиделки/дедушка';
    if (/(интернет|связь|телефон|киевстар|vodafone|lifecell)/i.test(text)) return 'Связь/интернет';
    if (/(netflix|spotify|youtube|подпис|chatgpt|openai)/i.test(text)) return 'Подписки';
    if (/(одеж|обув|футбол|кроссов|носки|трусы)/i.test(text)) return 'Одежда/обувь';
    if (/(барбер|маникюр|крем|spf|духи|парфюм|бритв|бород)/i.test(text)) return 'Уход/барбер/маникюр';
    if (/(кошелек|ключ|рюкзак|сумка|edc|чехол|очки|часы)/i.test(text)) return 'EDC/стиль';
    if (/(кредит|кредитк|долг)/i.test(text)) return 'Кредитки';

    return 'Прочее';
  }

  async ensureUser(telegramUser: { id: number; username?: string; first_name?: string }) {
    return this.prisma.user.upsert({
      where: { telegramId: BigInt(telegramUser.id) },
      update: { username: telegramUser.username, firstName: telegramUser.first_name },
      create: {
        telegramId: BigInt(telegramUser.id),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        profile: { create: { primaryGoals: ['выглядеть собранно', 'говорить увереннее', 'научиться не исчезать', 'закрыть кредитки', 'собрать резерв', 'купить машину без тревоги'] } },
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

  private monthStart() {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  async addExpense(telegramUser: { id: number; username?: string; first_name?: string }, rawText: string) {
    const user = await this.ensureUser(telegramUser);
    const amount = this.parseAmount(rawText);
    if (!amount) return 'Не увидел сумму. Формат: /expense 245 happy meal сыну';

    const description = rawText.replace(/^\/expense/i, '').replace(String(amount), '').trim();
    const currency = this.detectCurrency(rawText);
    const category = this.categorizeExpense(description);

    await this.prisma.transaction.create({ data: { userId: user.id, type: TransactionType.expense, amount, currency, category, description } });
    const spent = await this.categorySpent(user.id, category, currency);
    const budget = await this.prisma.budget.findUnique({ where: { userId_category: { userId: user.id, category } } });

    const limitText = budget
      ? `\nЛимит: ${Number(budget.monthlyLimit).toLocaleString('ru-RU')} ${budget.currency}.\nОстаток: ${(Number(budget.monthlyLimit) - spent).toLocaleString('ru-RU')} ${budget.currency}.`
      : '\nЛимит пока не задан. Можно задать через /setlimit.';
    const safeFoodNote = category === 'Safe food сына' ? '\n\nЭто плановая семейная статья, не хаотичная доставка.' : '';

    return `Записал: ${amount.toLocaleString('ru-RU')} ${currency} — ${category}.${safeFoodNote}\n\nЗа месяц по категории: ${spent.toLocaleString('ru-RU')} ${currency}.${limitText}\n\nФраза: не запрещаем жизнь, убираем хаос.`;
  }

  async addIncome(telegramUser: { id: number; username?: string; first_name?: string }, rawText: string) {
    const user = await this.ensureUser(telegramUser);
    const amount = this.parseAmount(rawText);
    if (!amount) return 'Не увидел сумму. Формат: /income 4000 eur вторая работа';

    const currency = this.detectCurrency(rawText);
    const description = rawText.replace(/^\/income/i, '').replace(String(amount), '').trim();
    await this.prisma.transaction.create({ data: { userId: user.id, type: TransactionType.income, amount, currency, category: description.toLowerCase().includes('чое') ? 'ЧОЕ' : 'Вторая работа', description } });

    if (currency === 'EUR') {
      const eurToUah = Number(this.configService.get<string>('EUR_TO_UAH') ?? 51.6);
      const grossUah = amount * eurToUah;
      const singleTax = grossUah * (Number(this.configService.get<string>('FOP_SINGLE_TAX_RATE') ?? 5) / 100);
      const militaryTax = grossUah * (Number(this.configService.get<string>('FOP_MILITARY_TAX_RATE') ?? 1) / 100);
      const esv = Number(this.configService.get<string>('FOP_ESV_MONTHLY') ?? 1902.34);
      const net = grossUah - singleTax - militaryTax - esv;
      return `Записал доход: ${amount.toLocaleString('ru-RU')} EUR.\n\nОриентир ФОП 3 группа:\n- gross: ${grossUah.toLocaleString('ru-RU')} грн\n- единый налог 5%: ${singleTax.toLocaleString('ru-RU')} грн\n- военный сбор 1%: ${militaryTax.toLocaleString('ru-RU')} грн\n- ЕСВ: ${esv.toLocaleString('ru-RU')} грн\n\nОриентир чистыми: ${net.toLocaleString('ru-RU')} грн.`;
    }
    return `Записал доход: ${amount.toLocaleString('ru-RU')} ${currency}.`;
  }

  private async categorySpent(userId: number, category: string, currency = 'UAH') {
    const result = await this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId, type: TransactionType.expense, category, currency, transactionDate: { gte: this.monthStart() } } });
    return Number(result._sum.amount ?? 0);
  }

  async setLimit(telegramUser: { id: number; username?: string; first_name?: string }, rawText: string) {
    const user = await this.ensureUser(telegramUser);
    const amount = this.parseAmount(rawText);
    if (!amount) return 'Формат: /setlimit категория сумма. Например: /setlimit доставки 15000';
    const categoryRaw = rawText.replace(/^\/setlimit/i, '').replace(String(amount), '').trim();
    if (!categoryRaw) return 'Не вижу категорию. Например: /setlimit safe 12000';
    const category = this.normalizeCategory(categoryRaw);
    const currency = this.detectCurrency(rawText);
    await this.prisma.budget.upsert({ where: { userId_category: { userId: user.id, category } }, update: { monthlyLimit: amount, currency }, create: { userId: user.id, category, monthlyLimit: amount, currency } });
    return `Лимит установлен: ${category} — ${amount.toLocaleString('ru-RU')} ${currency}/мес.`;
  }

  async limits(telegramUser: { id: number; username?: string; first_name?: string }) {
    const user = await this.ensureUser(telegramUser);
    const budgets = await this.prisma.budget.findMany({ where: { userId: user.id }, orderBy: { category: 'asc' } });
    if (!budgets.length) return 'Лимиты пока не заданы. Пример: /setlimit доставки 15000';
    const lines = await Promise.all(budgets.map(async (budget) => {
      const spent = await this.categorySpent(user.id, budget.category, budget.currency);
      const limit = Number(budget.monthlyLimit);
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      return `- ${budget.category}: ${spent.toLocaleString('ru-RU')} / ${limit.toLocaleString('ru-RU')} ${budget.currency} (${pct}%)`;
    }));
    return `Лимиты на месяц:\n\n${lines.join('\n')}`;
  }

  async updateDebt(telegramUser: { id: number; username?: string; first_name?: string }, rawText: string) {
    const user = await this.ensureUser(telegramUser);
    const amount = this.parseAmount(rawText);
    if (!amount) return 'Формат: /paydebt 10000 кредитка 1';
    const debts = await this.prisma.debt.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
    const target = rawText.includes('2') ? debts[1] : debts[0];
    if (!target) return 'Кредитка не найдена.';
    const newRemaining = Math.max(0, Number(target.remainingAmount) - amount);
    await this.prisma.debt.update({ where: { id: target.id }, data: { remainingAmount: newRemaining } });
    await this.prisma.transaction.create({ data: { userId: user.id, type: TransactionType.expense, amount, currency: 'UAH', category: 'Кредитки', description: `Погашение: ${target.name}` } });
    return `Записал погашение: ${amount.toLocaleString('ru-RU')} грн — ${target.name}.\nОстаток: ${newRemaining.toLocaleString('ru-RU')} грн.`;
  }

  async addSaving(telegramUser: { id: number; username?: string; first_name?: string }, rawText: string) {
    const user = await this.ensureUser(telegramUser);
    const amount = this.parseAmount(rawText);
    if (!amount) return 'Формат: /save 10000 резерв или /save 5000 авто';
    const isCar = /авто|машин|car/i.test(rawText);
    const goalName = isCar ? 'Авто-фонд' : 'Минимальный резерв';
    const goal = await this.prisma.savingsGoal.findFirst({ where: { userId: user.id, name: goalName } });
    if (!goal) return `Цель ${goalName} не найдена.`;
    const currentAmount = Number(goal.currentAmount) + amount;
    await this.prisma.savingsGoal.update({ where: { id: goal.id }, data: { currentAmount } });
    await this.prisma.transaction.create({ data: { userId: user.id, type: TransactionType.expense, amount, currency: 'UAH', category: isCar ? 'Авто-фонд' : 'Резерв', description: `Пополнение: ${goalName}` } });
    return `Пополнение цели: ${goalName} +${amount.toLocaleString('ru-RU')} грн.\nТеперь: ${currentAmount.toLocaleString('ru-RU')} / ${Number(goal.targetAmount).toLocaleString('ru-RU')} грн.`;
  }

  async weekSummary(telegramUser: { id: number; username?: string; first_name?: string }) {
    const user = await this.ensureUser(telegramUser);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const rows = await this.prisma.transaction.groupBy({ by: ['category'], _sum: { amount: true }, where: { userId: user.id, type: TransactionType.expense, currency: 'UAH', transactionDate: { gte: weekStart } }, orderBy: { _sum: { amount: 'desc' } } });
    if (!rows.length) return 'За последние 7 дней расходов UAH пока нет.';
    return `Расходы за 7 дней:\n\n${rows.map((r) => `- ${r.category ?? 'Без категории'}: ${Number(r._sum.amount ?? 0).toLocaleString('ru-RU')} грн`).join('\n')}\n\nФраза: видим поток — управляем потоком.`;
  }

  async moneySummary(telegramUser: { id: number; username?: string; first_name?: string }) {
    const user = await this.ensureUser(telegramUser);
    const [income, expenses, debts, goals] = await Promise.all([
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: user.id, type: TransactionType.income, currency: 'UAH', transactionDate: { gte: this.monthStart() } } }),
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: user.id, type: TransactionType.expense, currency: 'UAH', transactionDate: { gte: this.monthStart() } } }),
      this.prisma.debt.findMany({ where: { userId: user.id } }),
      this.prisma.savingsGoal.findMany({ where: { userId: user.id }, orderBy: { priority: 'asc' } }),
    ]);
    const incomeSum = Number(income._sum.amount ?? 0);
    const expenseSum = Number(expenses._sum.amount ?? 0);
    const debtTotal = debts.reduce((sum, debt) => sum + Number(debt.remainingAmount), 0);
    const debtMonthly = debts.reduce((sum, debt) => sum + Number(debt.monthlyPayment ?? 0), 0);
    const goalsText = goals.map((goal) => `- ${goal.name}: ${Number(goal.currentAmount).toLocaleString('ru-RU')} / ${Number(goal.targetAmount).toLocaleString('ru-RU')} грн (${goal.status})`).join('\n');
    return `Финансовая опора на сегодня:\n\nДоходы UAH за месяц: ${incomeSum.toLocaleString('ru-RU')} грн\nРасходы UAH за месяц: ${expenseSum.toLocaleString('ru-RU')} грн\nРазница: ${(incomeSum - expenseSum).toLocaleString('ru-RU')} грн\n\nКредитки/долги:\n- остаток: ${debtTotal.toLocaleString('ru-RU')} грн\n- минимальные платежи: ${debtMonthly.toLocaleString('ru-RU')} грн/мес\n\nЦели:\n${goalsText || 'Цели пока не созданы.'}\n\nФокус: кредитки в ноль → резерв 300–500 тыс → авто-фонд.`;
  }
}
