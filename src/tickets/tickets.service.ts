import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { Company } from 'db/models/Company';
import { Ticket, TicketCategory, TicketStatus, TicketType } from 'db/models/Ticket';
import { User, UserRole } from 'db/models/User';
import { NewTicketDto, TicketDto } from './ticket.dto';
import { Op } from 'sequelize';

@Injectable()
export class TicketsService {
    constructor(
        @Inject('TICKET_REPOSITORY') private ticketRepository: typeof Ticket,
        @Inject('USER_REPOSITORY') private userRepository: typeof User, // injected user repo
    ) { }

    // Get all tickets with associated Company and User details
    async getAllTickets(): Promise<Ticket[]> {
        return this.ticketRepository.findAll({ include: [Company, User] });
    }

    async createTicket(createTicketDto: NewTicketDto): Promise<TicketDto> {
        const { type, companyId } = createTicketDto;
        const { category, userRole } = this.getRoleCategoryMapping(type);

        var assignees = await this.getAssigneeByRole(companyId, userRole);

        // Check for existing open registrationAddressChange ticket for the company
        if (type === TicketType.registrationAddressChange) {
            const isTicketExist = await this.checkExistingOpenRegistrationAddressChangeTicket(companyId);
            if (isTicketExist) {
                throw new ConflictException(`An open ticket of type registrationAddressChange already exists for this company.`);
            }
            // Fallback to director if no corporate secretary found for registration address change
            if (!assignees.length) {
                assignees = await this.getAssigneeByRole(companyId, UserRole.director);

                if (assignees.length > 1) {
                    throw new ConflictException(
                        `Multiple users with role ${userRole}. Cannot create a ticket`,
                    );
                }
            }
        }

        // If type is not managementReport and multiple directors found, throw conflict error
        // to cover previous logic if userRole === UserRole.corporateSecretary and multiple found and new logic ticket assigned to director and multiple found
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

        const ticket = await this.ticketRepository.create({
            companyId,
            assigneeId: assignee.id,
            category,
            type,
            status: TicketStatus.open,
        });

        // If the ticket type is strikeOff, resolve all other open tickets for the company
        if (type === TicketType.strikeOff) {
            await this.resolveOthers(ticket.id, { companyId });
        }

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
    private async checkExistingOpenRegistrationAddressChangeTicket(companyId: number): Promise<boolean> {
        const existingTicket = await this.ticketRepository.findOne({
            where: {
                companyId,
                type: TicketType.registrationAddressChange,
                status: TicketStatus.open, // this ensures we only check for open tickets
            },
        });
        return !!existingTicket;
    }
    private async resolveOthers(id: number, data: any): Promise<void> {
        await this.ticketRepository.update(
            { status: TicketStatus.resolved },
            {
                where: {
                    companyId: data.companyId,
                    status: TicketStatus.open,
                    id: { [Op.ne]: id },
                },
            },
        );
    }
    private async getAssigneeByRole(companyId: number, role: UserRole): Promise<User[]> {
        const assignees = await this.userRepository.findAll({
            where: { companyId, role },
            order: [['createdAt', 'DESC']],
        });
        return assignees;
    }
    private getRoleCategoryMapping(ticketType: TicketType): { category: TicketCategory; userRole: UserRole } {
        switch (ticketType) {
            case TicketType.managementReport:
                return {
                    category: TicketCategory.accounting,
                    userRole: UserRole.accountant
                };
            case TicketType.registrationAddressChange:
                return {
                    category: TicketCategory.corporate,
                    userRole: UserRole.corporateSecretary
                };
            case TicketType.strikeOff:
                return {
                    category: TicketCategory.management,
                    userRole: UserRole.director
                };
            default:
                throw new ConflictException(`Invalid ticket type: ${ticketType}`);
        }
    }
}