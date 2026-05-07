import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { AiModule } from '../ai/ai.module';
import { FinanceModule } from '../finance/finance.module';
import { HabitsModule } from '../habits/habits.module';

@Module({
  imports: [AiModule, FinanceModule, HabitsModule],
  providers: [BotService],
})
export class BotModule {}
