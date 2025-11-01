import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NewTicketDto } from './ticket.dto';
import { TicketsService } from './tickets.service';



@ApiTags('Tickets')
@Controller('api/v1/tickets')
export class TicketsController {

  constructor(private ticketsService: TicketsService) { }

  @Get()
  @ApiOperation({ summary: 'Get all tickets' })
  @ApiResponse({ status: 200, description: 'Returns an array of tickets.' })
  async findAll() {
    return await this.ticketsService.getAllTickets();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiResponse({ status: 201, description: 'The ticket has been successfully created.' })
  async create(@Body() newTicketDto: NewTicketDto) {
    const ticketDto = await this.ticketsService.createTicket(newTicketDto);
    return ticketDto;
  }
}