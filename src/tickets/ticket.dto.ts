import { IsString, IsEmail, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';



export class NewTicketDto {
  @ApiProperty({ example: 'managementReport', required: true })
  @IsNotEmpty()
  type: TicketType;

  @ApiProperty({ example: 1, required: true })
  @IsNotEmpty()
  companyId: number;
}

export class TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}