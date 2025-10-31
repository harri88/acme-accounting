import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

class newTicketDto {
  @ApiProperty({ example: 'managementReport', required: true })
  @IsNotEmpty()
  type: TicketType;

  @ApiProperty({ example: 1, required: true })
  @IsNotEmpty()
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

@ApiTags('Tickets')
@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  @ApiOperation({ summary: 'Get all tickets' })
  @ApiResponse({ status: 200, description: 'Returns an array of tickets.' })
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;
    var category,userRole: string = "";

    switch (type) {
      case TicketType.managementReport:
        category = TicketCategory.accounting;
        userRole = UserRole.accountant;
        break;
      case TicketType.registrationAddressChange:
        category = TicketCategory.corporate;
        userRole = UserRole.corporateSecretary;

        const existingTicket = await Ticket.findOne({
            where: {
              companyId,
              type: TicketType.registrationAddressChange,
              status: TicketStatus.open, // this ensures we only check for open tickets
        },
      });
      
      if (existingTicket) {
        throw new ConflictException(`An open ticket of type registrationAddressChange already exists for this company.`);
      }
        break;
      case TicketType.strikeOff:
        category = TicketCategory.management;
        userRole = UserRole.director;
        break;
      default:
        throw new ConflictException(`Invalid ticket type: ${type}`);
    }

    var assignees = await User.findAll({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });
    
    // Fallback to director if no corporate secretary found for registration address change
     if (!assignees.length && type === TicketType.registrationAddressChange) {
      userRole = UserRole.director;
      assignees = await User.findAll({ where: { companyId, role: userRole }, order: [['createdAt', 'DESC']],});

      
      if (assignees.length > 1) {
        throw new ConflictException(
          `Multiple users with role ${userRole}. Cannot create a ticket`,
        );    
      }
    }

    // If type is not managementReport and multiple directors found, throw conflict error
    if (type !== TicketType.managementReport && assignees.length > 1) {
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );
    }

    if (!assignees.length)
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );

    if (userRole === UserRole.corporateSecretary && assignees.length > 1)
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );

    const assignee = assignees[0];

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}