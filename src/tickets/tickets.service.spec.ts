import { ConflictException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket, TicketType, TicketStatus, TicketCategory } from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

describe('TicketsService (unit)', () => {
  let service: TicketsService;

  // simple in-memory id generator for created tickets
  let nextTicketId = 1;

  const makeMockTicketRepo = () => ({
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (payload: any) => ({ id: nextTicketId++, ...payload })),
    update: jest.fn().mockResolvedValue([1]),
  });

  const makeMockUserRepo = () => ({
    findAll: jest.fn().mockResolvedValue([]),
  });

  beforeEach(() => {
    nextTicketId = 1;
  });

  it('throws when duplicate registrationAddressChange ticket exists', async () => {
    const mockTicketRepo = makeMockTicketRepo();
    // simulate an existing open registrationAddressChange ticket
    mockTicketRepo.findOne.mockResolvedValue({ id: 42, type: TicketType.registrationAddressChange, status: TicketStatus.open });

    const mockUserRepo = makeMockUserRepo();

    service = new TicketsService(mockTicketRepo as any, mockUserRepo as any);

    await expect(
      service.createTicket({ companyId: 1, type: TicketType.registrationAddressChange } as any),
    ).rejects.toThrow(ConflictException);

    expect(mockTicketRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 1 }) }));
  });

  it('assigns to director when no corporate secretary exists', async () => {
    const mockTicketRepo = makeMockTicketRepo();
    // no existing open ticket
    mockTicketRepo.findOne.mockResolvedValue(null);

    const director = { id: 11, name: 'Dir', role: UserRole.director, companyId: 2 } as any;
    const mockUserRepo = makeMockUserRepo();
    // first call for corporateSecretary returns empty, second call for director returns single director
    mockUserRepo.findAll = jest.fn()
      .mockResolvedValueOnce([]) // for corporateSecretary
      .mockResolvedValueOnce([director]); // for director

    service = new TicketsService(mockTicketRepo as any, mockUserRepo as any);

    const dto = { companyId: 2, type: TicketType.registrationAddressChange } as any;
    const ticket = await service.createTicket(dto);

    expect(ticket.assigneeId).toBe(director.id);
    expect(ticket.category).toBe(TicketCategory.corporate);
    expect(ticket.status).toBe(TicketStatus.open);
    expect(mockTicketRepo.create).toHaveBeenCalledWith(expect.objectContaining({ companyId: 2, assigneeId: director.id }));
  });

  it('throws when multiple directors exist and no corporate secretary', async () => {
    const mockTicketRepo = makeMockTicketRepo();
    mockTicketRepo.findOne.mockResolvedValue(null);

    const d1 = { id: 21, role: UserRole.director, companyId: 3 } as any;
    const d2 = { id: 22, role: UserRole.director, companyId: 3 } as any;

    const mockUserRepo = makeMockUserRepo();
    mockUserRepo.findAll = jest.fn()
      .mockResolvedValueOnce([]) // corporateSecretary
      .mockResolvedValueOnce([d1, d2]); // directors

    service = new TicketsService(mockTicketRepo as any, mockUserRepo as any);

    await expect(service.createTicket({ companyId: 3, type: TicketType.registrationAddressChange } as any)).rejects.toThrow(ConflictException);
  });

  it('creates strikeOff and resolves other tickets', async () => {
    const mockTicketRepo = makeMockTicketRepo();
    mockTicketRepo.findOne.mockResolvedValue(null);

    const director = { id: 31, role: UserRole.director, companyId: 4 } as any;
    const mockUserRepo = makeMockUserRepo();
    mockUserRepo.findAll = jest.fn().mockResolvedValue([director]);

    service = new TicketsService(mockTicketRepo as any, mockUserRepo as any);

    const ticket = await service.createTicket({ companyId: 4, type: TicketType.strikeOff } as any);

    // created strikeOff ticket returned
    expect(ticket.type).toBe(TicketType.strikeOff);
    expect(ticket.assigneeId).toBe(director.id);

    // resolveOthers should call update to resolve other tickets
    expect(mockTicketRepo.update).toHaveBeenCalledWith(
      { status: TicketStatus.resolved },
      expect.objectContaining({ where: expect.objectContaining({ companyId: 4 }) }),
    );
  });

  it('throws when multiple directors exist for strikeOff', async () => {
    const mockTicketRepo = makeMockTicketRepo();
    mockTicketRepo.findOne.mockResolvedValue(null);

    const d1 = { id: 41, role: UserRole.director, companyId: 5 } as any;
    const d2 = { id: 42, role: UserRole.director, companyId: 5 } as any;

    const mockUserRepo = makeMockUserRepo();
    mockUserRepo.findAll = jest.fn().mockResolvedValue([d1, d2]);

    service = new TicketsService(mockTicketRepo as any, mockUserRepo as any);

    await expect(service.createTicket({ companyId: 5, type: TicketType.strikeOff } as any)).rejects.toThrow(ConflictException);
  });
});
