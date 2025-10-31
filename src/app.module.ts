import { Module } from '@nestjs/common';
import { DbModule } from './db.module';
import { TicketsController } from './tickets/tickets.controller';
import { ReportsController } from './reports/reports.controller';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { ReportsService } from './reports/reports.service';
import { TicketsService } from './tickets/tickets.service';
import { Ticket } from 'db/models/Ticket';
import { User } from 'db/models/User';

@Module({
  imports: [DbModule],
  controllers: [TicketsController, ReportsController, HealthcheckController],
  providers: [ ReportsService, TicketsService,
    {
      provide: "TICKET_REPOSITORY",
      useValue: Ticket,
    },
     {
      provide: "TICKET_REPOSITORY",
      useValue: Ticket,
    },
    {
      provide: "USER_REPOSITORY",
      useValue: User,
    },
  ],
})
export class AppModule {}
