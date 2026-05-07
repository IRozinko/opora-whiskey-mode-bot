import { Module } from '@nestjs/common';
import { HabitsService } from './habits.service';

@Module({
  providers: [HabitsService],
  exports: [HabitsService],
})
export class HabitsModule {}
