import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { AiService } from '../ai/ai.service';
import { FinanceService } from '../finance/finance.service';

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
};

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Telegraf | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly financeService: FinanceService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured. Bot is not started.');
      return;
    }
    this.bot = new Telegraf(token);
    this.registerHandlers(this.bot);
    await this.bot.launch();
    this.logger.log('Opora Telegram bot started');
  }

  async onModuleDestroy() {
    this.bot?.stop('Nest application shutdown');
  }

  private registerHandlers(bot: Telegraf) {
    bot.start((ctx) => ctx.reply(this.startText()));
    bot.help((ctx) => ctx.reply(this.helpText()));

    bot.command('morning', async (ctx) => {
      await this.financeService.ensureUser(ctx.from as TelegramUser);
      await ctx.reply(this.morningText());
    });
    bot.command('reset', (ctx) => ctx.reply(this.resetText()));
    bot.command('voice', (ctx) => ctx.reply(this.voiceText()));
    bot.command('look', (ctx) => ctx.reply(this.lookText()));
    bot.command('status', (ctx) => ctx.reply(this.statusText(ctx.message.text)));
    bot.command('silent', (ctx) => ctx.reply(this.silentText()));
    bot.command('evening', (ctx) => ctx.reply(this.eveningText()));
    bot.command('podcast', (ctx) => ctx.reply(this.podcastText()));
    bot.command('categories', (ctx) => ctx.reply(this.categoriesText()));
    bot.command('debt', (ctx) => ctx.reply(this.debtText()));
    bot.command('reserve', (ctx) => ctx.reply(this.reserveText()));
    bot.command('car', (ctx) => ctx.reply(this.carText()));
    bot.command('today', (ctx) => ctx.reply(this.todayText()));
    bot.command('aiusage', (ctx) => ctx.reply(this.aiService.getUsageText()));

    bot.command('expense', async (ctx) => {
      const response = await this.financeService.addExpense(ctx.from as TelegramUser, ctx.message.text);
      await ctx.reply(response);
    });
    bot.command('income', async (ctx) => {
      const response = await this.financeService.addIncome(ctx.from as TelegramUser, ctx.message.text);
      await ctx.reply(response);
    });
    bot.command('money', async (ctx) => {
      const response = await this.financeService.moneySummary(ctx.from as TelegramUser);
      await ctx.reply(response);
    });
    bot.command('setlimit', async (ctx) => {
      const response = await this.financeService.setLimit(ctx.from as TelegramUser, ctx.message.text);
      await ctx.reply(response);
    });
    bot.command('limits', async (ctx) => {
      const response = await this.financeService.limits(ctx.from as TelegramUser);
      await ctx.reply(response);
    });
    bot.command('paydebt', async (ctx) => {
      const response = await this.financeService.updateDebt(ctx.from as TelegramUser, ctx.message.text);
      await ctx.reply(response);
    });
    bot.command('save', async (ctx) => {
      const response = await this.financeService.addSaving(ctx.from as TelegramUser, ctx.message.text);
      await ctx.reply(response);
    });
    bot.command('weekmoney', async (ctx) => {
      const response = await this.financeService.weekSummary(ctx.from as TelegramUser);
      await ctx.reply(response);
    });
    bot.command('month', async (ctx) => {
      const response = await this.financeService.moneySummary(ctx.from as TelegramUser);
      await ctx.reply(response);
    });

    bot.command('phrase', async (ctx) => {
      const situation = ctx.message.text.replace('/phrase', '').trim();
      if (!situation) {
        await ctx.reply('Опиши ситуацию после команды. Например:\n/phrase хочу сказать жене, что мне нужно 40 минут поработать');
        return;
      }
      const response = await this.aiService.ask(`Помоги сформулировать фразу для ситуации. Дай мягкую версию, короткую версию и фразу-якорь. Ситуация: ${situation}`);
      await ctx.reply(response);
    });

    bot.command('canbuy', async (ctx) => {
      const request = ctx.message.text.replace('/canbuy', '').trim();
      if (!request) {
        await ctx.reply('Формат: /canbuy 1800 щетка для бороды');
        return;
      }
      const response = await this.aiService.ask(`Оцени покупку в стиле финансовой опоры. Учитывай приоритеты: кредитки в ноль, резерв 300-500 тыс, потом авто-фонд. Не стыди. Покупка: ${request}`);
      await ctx.reply(response);
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return;
      const response = await this.aiService.ask(text, this.baseUserContext());
      await ctx.reply(response);
    });

    bot.catch((error) => this.logger.error('Telegram bot error', error as Error));
  }

  private startText() {
    return `Опора включена.\n\nЯ тут не для того, чтобы давить или стыдить.\nЯ помогаю держать курс: внешний вид, голос, семья, работа, деньги, восстановление.\n\nГлавный принцип:\nНе камень. Опора.\n\nКоманды:\n/morning — утренний ритуал\n/evening — вечерний разбор\n/status — статус вечера для семьи\n/phrase — сформулировать фразу\n/silent — разобрать молчание\n/voice — голос и дикция\n/look — образ\n/reset — вернуться в спокойствие\n/today — что делать сейчас\n/money — финансы\n/expense — записать расход\n/income — записать доход`;
  }

  private helpText() {
    return `Команды Опоры:\n\nРутины:\n/morning\n/evening\n/reset\n/today\n/podcast\n\nКоммуникация:\n/status желтый 40 минут\n/phrase <ситуация>\n/silent\n/voice\n\nСтиль:\n/look\n\nФинансы:\n/expense 245 happy meal сыну\n/income 4000 eur вторая работа\n/money\n/setlimit доставки 15000\n/limits\n/paydebt 10000 кредитка 1\n/save 10000 резерв\n/weekmoney\n/month\n/debt\n/reserve\n/car\n/canbuy 1800 щетка для бороды\n/categories\n/aiusage`;
  }

  private morningText() {
    return `Доброе утро.\n\nСегодня фокус: спокойный голос и присутствие.\n\nЧеклист:\n☐ вода\n☐ умывание\n☐ крем / SPF\n☐ борода\n☐ руки / ногти\n☐ одежда без хаоса\n☐ ключи\n☐ кошелёк\n☐ кофе\n☐ один главный фокус дня\n\nГолос:\nСкажи 3 раза медленно:\n“Я говорю спокойно. Я не исчезаю. Мне не нужно спешить.”\n\nФинансы:\n☐ записывать расходы\n☐ safe food сына — планово, не ругаем\n☐ кредитки важнее авто-фонда\n\nОдин шаг:\nсегодня один раз скажи “мне важно” вместо молчания.`;
  }

  private todayText() {
    return `Опора на сейчас:\n\n1. Не решаем всю жизнь.\n2. Выбираем один ближайший шаг.\n3. Деньги — записываем, не ругаем.\n4. Голос — медленнее на 10%.\n5. Дома — не исчезать, а назвать состояние.\n\nФраза дня:\n“Я могу быть опорой, не превращаясь в камень.”`;
  }

  private resetText() {
    return `Стоп.\n\nСейчас не решаем всю жизнь.\n\n1. Вдох.\n2. Медленный выдох.\n3. Назови одну ближайшую задачу.\n4. Что можно сделать за 10 минут?\n\nНапиши:\n“Сейчас мне нужно...”`;
  }

  private voiceText() {
    return `Голосовая тренировка на 5 минут.\n\n1. Дыхание: вдох 4 секунды, выдох 6 секунд — 5 раз.\n2. Резонанс: “ммм-ма”, “ммм-мо”, “ммм-му”.\n3. Дикция: бра-бро-бру-бры-бре, дра-дро-дру-дры-дре.\n4. Фраза: “Я готов говорить спокойно, но не готов ругаться.”`;
  }

  private lookText() {
    return `Куда собираем образ?\n\n1 — офис\n2 — конференция\n3 — прогулка\n4 — семейный выход\n5 — встреча\n6 — рыбалка\n7 — день рождения\n\nБазовое правило:\nтёмная плотная база + структура сверху + чистая обувь + часы + ключи/кошелёк без хаоса.`;
  }

  private statusText(text: string) {
    const normalized = text.toLowerCase();
    const minutes = normalized.match(/(\d+)/)?.[1];
    if (normalized.includes('зел')) return 'Еду. Сегодня без рабочих хвостов, дома нормально включаюсь.';
    if (normalized.includes('жел') || normalized.includes('жёл')) return `Еду. Сегодня жёлтый: нужно примерно ${minutes ?? '40'} минут закрыть задачу по работе. Я понимаю, что ты тоже устала. Дома спокойно договоримся, я закрываю хвост и потом беру дочку/дом на себя.`;
    if (normalized.includes('крас')) return `Еду. Сегодня красный: нужно примерно ${minutes ?? '90'} минут закрыть критичную задачу. Я понимаю, что ты тоже устала. Давай дома спокойно договоримся: после этого беру на себя дочку/купание/укладывание.`;
    return `Выбери статус вечера:\n\n/status зелёный\n/status жёлтый 40 минут\n/status красный 90 минут`;
  }

  private silentText() {
    return `Окей. Не ругаем себя. Разбираем.\n\nОтветь коротко:\n1. Где замолчал?\n2. Что хотел сказать?\n3. Чего боялся?\n4. Что можно сказать одной спокойной фразой?\n\nФраза-заготовка:\n“Я завис. Мне нужна минута, я хочу сказать нормально.”`;
  }

  private eveningText() {
    return `Вечерний разбор. Без самобичевания.\n\nОтветь по пунктам:\n1. Где сегодня промолчал?\n2. Что хотел сказать?\n3. Чего боялся?\n4. Что сделал для семьи?\n5. Что сделал для себя?\n6. Какие расходы были плановыми?\n7. Какие были хаотичными?\n8. Один шаг на завтра?`;
  }

  private podcastText() {
    return `Аудио на сегодня:\n\nЕсли есть ресурс: 10–15 минут Toastmasters / TED communication / Manager Tools.\nЕсли голова перегружена: музыка или тишина. Это тоже часть системы.\n\nПравило: один выпуск → одна мысль → одно действие.`;
  }

  private categoriesText() {
    return `Категории расходов:\n\nАренда\nКоммуналка\nШкола сына\nДочка\nПродукты домой\nSafe food сына\nКафе/доставки семьи\nКофе/перекусы\nСиделки/дедушка\nМедицина/аптека\nТранспорт/такси\nСвязь/интернет\nПодписки\nОдежда/обувь\nУход/барбер/маникюр\nEDC/стиль\nКредитки\nРезерв\nАвто-фонд\nПрочее`;
  }

  private debtText() {
    return `Кредитки:\n\n1. Кредитка 1: остаток 70 000 грн, мин. платёж 4 000 грн.\n2. Кредитка 2: остаток 70 000 грн, мин. платёж 4 000 грн.\n\nДля погашения: /paydebt 10000 кредитка 1\n\nФокус: закрыть кредитки до авто-фонда.`;
  }

  private reserveText() {
    return `Резерв:\n\nМинимальный: 300 000 грн.\nРабочий: 500 000 грн.\nСпокойный: 900 000–1 000 000 грн.\n\nПополнить: /save 10000 резерв\nПока резерв меньше 300 000 грн — крупные покупки охлаждаем.`;
  }

  private carText() {
    return `План машины к зиме:\n\nЭтап 1: кредитки в ноль — 140 000 грн.\nЭтап 2: резерв — минимум 300 000 грн.\nЭтап 3: авто-фонд.\n\nПополнить авто-фонд: /save 5000 авто\n\nShortlist:\n- Jeep Grand Cherokee\n- Toyota Highlander\n- Lexus RX\n- Ford Edge\n- Subaru Outback\n- Honda CR-V\n- Jeep Compass Trailhawk / Limited\n\nИсключено:\n- Mitsubishi L200 — задний ряд не подходит семье.`;
  }

  private baseUserContext() {
    return `Пользователь строит систему “Опора / дорогой виски”: внешний вид, голос, семья, работа, деньги, восстановление. У него семья, основная работа ЧОЕ, вторая работа, вечерние рабочие хвосты, сын и дочка. Он привык всё вывозить сам, молчать, не грузить, бояться конфликта и обесценивать свои желания. Цель — говорить спокойнее, не исчезать, держать слово без саморазрушения, закрыть кредитки, собрать резерв и позже купить машину без тревоги.`;
  }
}
