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

    bot.command('morning', (ctx) => ctx.reply(this.morningText()));
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

    bot.command('expense', async (ctx) => {
      const user = ctx.from as TelegramUser;
      const response = await this.financeService.addExpense(user, ctx.message.text);
      await ctx.reply(response);
    });

    bot.command('income', async (ctx) => {
      const user = ctx.from as TelegramUser;
      const response = await this.financeService.addIncome(user, ctx.message.text);
      await ctx.reply(response);
    });

    bot.command('money', async (ctx) => {
      const user = ctx.from as TelegramUser;
      const response = await this.financeService.moneySummary(user);
      await ctx.reply(response);
    });

    bot.command('phrase', async (ctx) => {
      const situation = ctx.message.text.replace('/phrase', '').trim();
      if (!situation) {
        await ctx.reply('Опиши ситуацию после команды. Например:\n/phrase хочу сказать жене, что мне нужно 40 минут поработать');
        return;
      }

      const response = await this.aiService.ask(
        `Помоги сформулировать фразу для ситуации. Дай мягкую версию, короткую версию и фразу-якорь. Ситуация: ${situation}`,
      );
      await ctx.reply(response);
    });

    bot.command('canbuy', async (ctx) => {
      const request = ctx.message.text.replace('/canbuy', '').trim();
      if (!request) {
        await ctx.reply('Формат: /canbuy 1800 щетка для бороды');
        return;
      }

      const response = await this.aiService.ask(
        `Оцени покупку в стиле финансовой опоры. Учитывай приоритеты: кредитки в ноль, резерв 300-500 тыс, потом авто-фонд. Не стыди. Покупка: ${request}`,
      );
      await ctx.reply(response);
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return;

      const response = await this.aiService.ask(text, this.baseUserContext());
      await ctx.reply(response);
    });

    bot.catch((error) => {
      this.logger.error('Telegram bot error', error as Error);
    });
  }

  private startText() {
    return `Опора включена.

Я тут не для того, чтобы давить или стыдить.
Я помогаю держать курс: внешний вид, голос, семья, работа, деньги, восстановление.

Главный принцип:
Не камень. Опора.

Команды:
/morning — утренний ритуал
/evening — вечерний разбор
/status — статус вечера для семьи
/phrase — сформулировать фразу
/silent — разобрать молчание
/voice — голос и дикция
/look — образ
/reset — вернуться в спокойствие
/money — финансы
/expense — записать расход
/income — записать доход`;
  }

  private helpText() {
    return `Команды Опоры:

Рутины:
/morning
/evening
/reset
/podcast

Коммуникация:
/status желтый 40 минут
/phrase <ситуация>
/silent
/voice

Стиль:
/look

Финансы:
/expense 245 happy meal сыну
/income 4000 eur вторая работа
/money
/debt
/reserve
/car
/canbuy 1800 щетка для бороды
/categories`;
  }

  private morningText() {
    return `Доброе утро.

Сегодня фокус: спокойный голос и присутствие.

Чеклист:
☐ вода
☐ умывание
☐ крем / SPF
☐ борода
☐ руки / ногти
☐ одежда без хаоса
☐ ключи
☐ кошелёк
☐ кофе
☐ один главный фокус дня

Голос:
Скажи 3 раза медленно:
“Я говорю спокойно. Я не исчезаю. Мне не нужно спешить.”

Финансы:
☐ записывать расходы
☐ safe food сына — планово, не ругаем
☐ кредитки важнее авто-фонда

Один шаг:
сегодня один раз скажи “мне важно” вместо молчания.`;
  }

  private resetText() {
    return `Стоп.

Сейчас не решаем всю жизнь.

1. Вдох.
2. Медленный выдох.
3. Назови одну ближайшую задачу.
4. Что можно сделать за 10 минут?

Напиши:
“Сейчас мне нужно...”`;
  }

  private voiceText() {
    return `Голосовая тренировка на 5 минут.

1. Дыхание:
вдох 4 секунды, выдох 6 секунд — 5 раз.

2. Резонанс:
“ммм-ма”
“ммм-мо”
“ммм-му”

3. Дикция:
бра-бро-бру-бры-бре
дра-дро-дру-дры-дре
кра-кро-кру-кры-кре

4. Фраза:
“Я готов говорить спокойно, но не готов ругаться.”

Скажи её 3 раза:
— обычно
— медленнее
— с паузой после “спокойно”`;
  }

  private lookText() {
    return `Куда собираем образ?

1 — офис
2 — конференция
3 — прогулка
4 — семейный выход
5 — встреча
6 — рыбалка
7 — день рождения

Базовое правило:
тёмная плотная база + структура сверху + чистая обувь + часы + ключи/кошелёк без хаоса.`;
  }

  private statusText(text: string) {
    const normalized = text.toLowerCase();
    const minutes = normalized.match(/(\d+)/)?.[1];

    if (normalized.includes('зел')) {
      return 'Еду. Сегодня без рабочих хвостов, дома нормально включаюсь.';
    }

    if (normalized.includes('жел') || normalized.includes('жёл')) {
      return `Еду. Сегодня жёлтый: нужно примерно ${minutes ?? '40'} минут закрыть задачу по работе. Я понимаю, что ты тоже устала. Дома спокойно договоримся, я закрываю хвост и потом беру дочку/дом на себя.`;
    }

    if (normalized.includes('крас')) {
      return `Еду. Сегодня красный: нужно примерно ${minutes ?? '90'} минут закрыть критичную задачу. Я понимаю, что ты тоже устала. Давай дома спокойно договоримся: после этого беру на себя дочку/купание/укладывание.`;
    }

    return `Выбери статус вечера:

/status зелёный
/status жёлтый 40 минут
/status красный 90 минут`;
  }

  private silentText() {
    return `Окей. Не ругаем себя. Разбираем.

Ответь коротко:
1. Где замолчал?
2. Что хотел сказать?
3. Чего боялся?
4. Что можно сказать одной спокойной фразой?

Фраза-заготовка:
“Я завис. Мне нужна минута, я хочу сказать нормально.”`;
  }

  private eveningText() {
    return `Вечерний разбор. Без самобичевания.

Ответь по пунктам:
1. Где сегодня промолчал?
2. Что хотел сказать?
3. Чего боялся?
4. Что сделал для семьи?
5. Что сделал для себя?
6. Какие расходы были плановыми?
7. Какие были хаотичными?
8. Один шаг на завтра?`;
  }

  private podcastText() {
    return `Аудио на сегодня:

Если есть ресурс:
10–15 минут Toastmasters / TED communication / Manager Tools.

Если голова перегружена:
музыка или тишина. Это тоже часть системы.

Правило:
один выпуск → одна мысль → одно действие.`;
  }

  private categoriesText() {
    return `Категории расходов:

Аренда
Коммуналка
Школа сына
Дочка
Продукты домой
Safe food сына
Кафе/доставки семьи
Кофе/перекусы
Сиделки/дедушка
Медицина/аптека
Транспорт/такси
Связь/интернет
Подписки
Одежда/обувь
Уход/барбер/маникюр
EDC/стиль
Кредитки
Резерв
Авто-фонд
Прочее`;
  }

  private debtText() {
    return `Кредитки:

1. Кредитка 1: остаток 70 000 грн, мин. платёж 4 000 грн.
2. Кредитка 2: остаток 70 000 грн, мин. платёж 4 000 грн.

Итого: 140 000 грн.

Фокус:
закрыть кредитки до авто-фонда.`;
  }

  private reserveText() {
    return `Резерв:

Минимальный: 300 000 грн.
Рабочий: 500 000 грн.
Спокойный: 900 000–1 000 000 грн.

Пока резерв меньше 300 000 грн — крупные покупки охлаждаем.`;
  }

  private carText() {
    return `План машины к зиме:

Этап 1: кредитки в ноль — 140 000 грн.
Этап 2: резерв — минимум 300 000 грн.
Этап 3: авто-фонд.

Shortlist:
- Jeep Grand Cherokee
- Toyota Highlander
- Lexus RX
- Ford Edge
- Subaru Outback
- Honda CR-V
- Jeep Compass Trailhawk / Limited

Исключено:
- Mitsubishi L200 — задний ряд не подходит семье.`;
  }

  private baseUserContext() {
    return `Пользователь строит систему “Опора / дорогой виски”: внешний вид, голос, семья, работа, деньги, восстановление. У него семья, основная работа ЧОЕ, вторая работа, вечерние рабочие хвосты, сын и дочка. Он привык всё вывозить сам, молчать, не грузить, бояться конфликта и обесценивать свои желания. Цель — говорить спокойнее, не исчезать, держать слово без саморазрушения, закрыть кредитки, собрать резерв и позже купить машину без тревоги.`;
  }
}
