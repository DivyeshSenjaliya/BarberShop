import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors';
import type { Logger } from '../../core/logger';
import {
  ServicesRepository,
  type BranchEffectiveServiceRecord,
  type BranchServiceRecord,
  type ConfigureBranchServiceInput,
  type CreateCategoryInput,
  type CreateServiceInput,
  type ServiceCategoryRecord,
  type ServiceRecord,
  type UpdateCategoryInput,
  type UpdateServiceInput,
} from '../../db/repositories/services';
import {
  ShopsRepository,
  type BranchRecord,
  type BusinessHoursRecord,
  type CreateBranchInput,
  type CreateHolidayInput,
  type CreateShopInput,
  type HolidayRecord,
  type SetBusinessHoursInput,
  type ShopRecord,
  type ShopStatus,
  type UpdateBranchInput,
  type UpdateShopInput,
} from '../../db/repositories/shops';
import {
  StaffRepository,
  type AttendanceStatus,
  type CreateStaffInput,
  type LeaveStatus,
  type RecordAttendanceInput,
  type RequestLeaveInput,
  type SetOverrideInput,
  type SetStaffBreakInput,
  type SetStaffScheduleInput,
  type StaffAttendanceRecord,
  type StaffBranchRecord,
  type StaffBreakRecord,
  type StaffLeaveRecord,
  type StaffOverrideRecord,
  type StaffRecord,
  type StaffScheduleRecord,
  type UpdateStaffInput,
} from '../../db/repositories/staff';
import type { Db } from '../../db/sqlite';
import { assertCan, can, type Role } from '../auth/rbac';

export interface CatalogServiceDeps {
  db: Db;
  logger: Logger;
}

export interface Actor {
  userId: string;
  role: Role;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class CatalogService {
  readonly shopsRepo: ShopsRepository;
  readonly servicesRepo: ServicesRepository;
  readonly staffRepo: StaffRepository;

  constructor(private readonly deps: CatalogServiceDeps) {
    this.shopsRepo = new ShopsRepository(deps.db);
    this.servicesRepo = new ServicesRepository(deps.db);
    this.staffRepo = new StaffRepository(deps.db);
  }

  private assertShopOwnershipOrAdmin(actor: Actor, shop: ShopRecord): void {
    if (actor.role === 'admin') return;
    if (shop.ownerId !== actor.userId) {
      throw new ForbiddenError('You do not have permission to manage this shop');
    }
  }

  // ---------------------------------------------------------------------------
  // Shops
  // ---------------------------------------------------------------------------

  createShop(actor: Actor, input: Omit<CreateShopInput, 'ownerId' | 'slug'> & { ownerId?: string; slug?: string }): ShopRecord {
    assertCan(actor.role, 'shop:write');

    const ownerId = actor.role === 'admin' && input.ownerId ? input.ownerId : actor.userId;
    const slug = slugify(input.slug || input.name);

    if (this.shopsRepo.slugExists(slug)) {
      throw new ConflictError(`A shop with the slug '${slug}' already exists`);
    }

    const shop = this.shopsRepo.createShop({
      ...input,
      ownerId,
      slug,
    });

    this.deps.logger.info('shop created', { shopId: shop.id, ownerId, slug });
    return shop;
  }

  getShop(idOrSlug: string): ShopRecord {
    const shop = idOrSlug.startsWith('shop_')
      ? this.shopsRepo.findShopById(idOrSlug)
      : this.shopsRepo.findShopBySlug(idOrSlug);

    if (!shop) {
      throw new NotFoundError('Shop', idOrSlug);
    }
    return shop;
  }

  listShops(query: {
    status?: ShopStatus;
    ownerId?: string;
    limit?: number;
    offset?: number;
  } = {}): { items: ShopRecord[]; total: number } {
    const items = this.shopsRepo.listShops(query);
    const total = this.shopsRepo.countShops(query);
    return { items, total };
  }

  updateShop(actor: Actor, shopId: string, patch: UpdateShopInput): ShopRecord {
    assertCan(actor.role, 'shop:write');
    const existing = this.getShop(shopId);
    this.assertShopOwnershipOrAdmin(actor, existing);

    if (patch.slug) {
      const slug = slugify(patch.slug);
      const other = this.shopsRepo.findShopBySlug(slug);
      if (other && other.id !== shopId) {
        throw new ConflictError(`Slug '${slug}' is already taken`);
      }
      patch = { ...patch, slug };
    }

    const updated = this.shopsRepo.updateShop(shopId, patch);
    this.deps.logger.info('shop updated', { shopId, actorId: actor.userId });
    return updated;
  }

  deleteShop(actor: Actor, shopId: string): void {
    assertCan(actor.role, 'shop:write');
    const existing = this.getShop(shopId);
    this.assertShopOwnershipOrAdmin(actor, existing);

    this.shopsRepo.softDeleteShop(shopId);
    this.deps.logger.info('shop deleted', { shopId, actorId: actor.userId });
  }

  // ---------------------------------------------------------------------------
  // Branches
  // ---------------------------------------------------------------------------

  createBranch(actor: Actor, shopId: string, input: Omit<CreateBranchInput, 'shopId'>): BranchRecord {
    assertCan(actor.role, 'branch:manage');
    const shop = this.getShop(shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    const branch = this.shopsRepo.createBranch({
      ...input,
      shopId,
    });

    this.deps.logger.info('branch created', { branchId: branch.id, shopId });
    return branch;
  }

  getBranch(branchId: string): BranchRecord {
    const branch = this.shopsRepo.findBranchById(branchId);
    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }
    return branch;
  }

  listBranches(shopId: string): BranchRecord[] {
    this.getShop(shopId);
    return this.shopsRepo.listBranchesForShop(shopId);
  }

  updateBranch(actor: Actor, branchId: string, patch: UpdateBranchInput): BranchRecord {
    assertCan(actor.role, 'branch:manage');
    const branch = this.getBranch(branchId);
    const shop = this.getShop(branch.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    const updated = this.shopsRepo.updateBranch(branchId, patch);
    this.deps.logger.info('branch updated', { branchId, actorId: actor.userId });
    return updated;
  }

  deleteBranch(actor: Actor, branchId: string): void {
    assertCan(actor.role, 'branch:manage');
    const branch = this.getBranch(branchId);
    const shop = this.getShop(branch.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    this.shopsRepo.softDeleteBranch(branchId);
    this.deps.logger.info('branch deleted', { branchId, actorId: actor.userId });
  }

  setBusinessHours(actor: Actor, branchId: string, hours: SetBusinessHoursInput[]): BusinessHoursRecord[] {
    assertCan(actor.role, 'branch:manage');
    const branch = this.getBranch(branchId);
    const shop = this.getShop(branch.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    for (const h of hours) {
      if (h.weekday < 0 || h.weekday > 6) {
        throw new ValidationError(`Invalid weekday ${h.weekday}`);
      }
      if (!h.closed && (!h.opensAt || !h.closesAt || h.opensAt >= h.closesAt)) {
        throw new ValidationError(`Invalid hours for weekday ${h.weekday}: opensAt must be before closesAt`);
      }
    }

    return this.shopsRepo.setBusinessHours(branchId, hours);
  }

  getBusinessHours(branchId: string): BusinessHoursRecord[] {
    this.getBranch(branchId);
    return this.shopsRepo.listBusinessHours(branchId);
  }

  addHoliday(actor: Actor, branchId: string, input: Omit<CreateHolidayInput, 'branchId'>): HolidayRecord {
    assertCan(actor.role, 'branch:manage');
    const branch = this.getBranch(branchId);
    const shop = this.getShop(branch.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    return this.shopsRepo.addHoliday({
      ...input,
      branchId,
    });
  }

  listHolidays(branchId: string): HolidayRecord[] {
    this.getBranch(branchId);
    return this.shopsRepo.listHolidays(branchId);
  }

  deleteHoliday(actor: Actor, branchId: string, holidayId: string): void {
    assertCan(actor.role, 'branch:manage');
    const branch = this.getBranch(branchId);
    const shop = this.getShop(branch.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    this.shopsRepo.deleteHoliday(holidayId);
  }

  // ---------------------------------------------------------------------------
  // Categories & Services
  // ---------------------------------------------------------------------------

  createCategory(actor: Actor, input: Omit<CreateCategoryInput, 'slug'> & { slug?: string }): ServiceCategoryRecord {
    assertCan(actor.role, 'service:manage');

    if (input.shopId) {
      const shop = this.getShop(input.shopId);
      this.assertShopOwnershipOrAdmin(actor, shop);
    } else if (actor.role !== 'admin') {
      throw new ForbiddenError('Only admins can create platform-wide categories');
    }

    const slug = slugify(input.slug || input.name);
    return this.servicesRepo.createCategory({
      ...input,
      slug,
    });
  }

  listCategories(shopId?: string): ServiceCategoryRecord[] {
    return this.servicesRepo.listCategories({ shopId, includePlatform: true });
  }

  createService(actor: Actor, shopId: string, input: Omit<CreateServiceInput, 'shopId' | 'slug'> & { slug?: string }): ServiceRecord {
    assertCan(actor.role, 'service:manage');
    const shop = this.getShop(shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    const slug = slugify(input.slug || input.name);
    const existing = this.servicesRepo.findServiceBySlug(shopId, slug);
    if (existing) {
      throw new ConflictError(`Service slug '${slug}' is already taken in this shop`);
    }

    if (input.durationMinutes < 5 || input.durationMinutes > 480) {
      throw new ValidationError('Service duration must be between 5 and 480 minutes');
    }

    return this.servicesRepo.createService({
      ...input,
      shopId,
      slug,
    });
  }

  getService(serviceId: string): ServiceRecord {
    const service = this.servicesRepo.findServiceById(serviceId);
    if (!service) {
      throw new NotFoundError('Service', serviceId);
    }
    return service;
  }

  listServices(shopId: string, categoryId?: string): ServiceRecord[] {
    this.getShop(shopId);
    return this.servicesRepo.listServices({ shopId, categoryId });
  }

  updateService(actor: Actor, serviceId: string, patch: UpdateServiceInput): ServiceRecord {
    assertCan(actor.role, 'service:manage');
    const service = this.getService(serviceId);
    const shop = this.getShop(service.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    if (patch.slug) {
      const slug = slugify(patch.slug);
      const other = this.servicesRepo.findServiceBySlug(service.shopId, slug);
      if (other && other.id !== serviceId) {
        throw new ConflictError(`Service slug '${slug}' is already in use`);
      }
      patch = { ...patch, slug };
    }

    return this.servicesRepo.updateService(serviceId, patch);
  }

  deleteService(actor: Actor, serviceId: string): void {
    assertCan(actor.role, 'service:manage');
    const service = this.getService(serviceId);
    const shop = this.getShop(service.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    this.servicesRepo.softDeleteService(serviceId);
  }

  configureBranchService(
    actor: Actor,
    branchId: string,
    serviceId: string,
    config: { enabled?: boolean; priceCents?: number | null },
  ): BranchServiceRecord {
    assertCan(actor.role, 'branch:manage');
    const branch = this.getBranch(branchId);
    const service = this.getService(serviceId);
    if (branch.shopId !== service.shopId) {
      throw new ValidationError('Branch and Service must belong to the same shop');
    }
    const shop = this.getShop(branch.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    return this.servicesRepo.configureBranchService({
      branchId,
      serviceId,
      ...config,
    });
  }

  listBranchServices(branchId: string, options: { enabledOnly?: boolean } = {}): BranchEffectiveServiceRecord[] {
    this.getBranch(branchId);
    return this.servicesRepo.listServicesForBranch(branchId, options);
  }

  // ---------------------------------------------------------------------------
  // Staff & Schedules
  // ---------------------------------------------------------------------------

  createStaff(actor: Actor, shopId: string, input: Omit<CreateStaffInput, 'shopId'>): StaffRecord {
    assertCan(actor.role, 'staff:manage');
    const shop = this.getShop(shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    const existing = this.staffRepo.findStaffByCode(shopId, input.employeeCode);
    if (existing) {
      throw new ConflictError(`Employee code '${input.employeeCode}' already exists for this shop`);
    }

    return this.staffRepo.createStaff({
      ...input,
      shopId,
    });
  }

  getStaff(staffId: string): StaffRecord {
    const staff = this.staffRepo.findStaffById(staffId);
    if (!staff) {
      throw new NotFoundError('Staff', staffId);
    }
    return staff;
  }

  listStaff(shopId: string, options: { branchId?: string; serviceId?: string; canAcceptBookings?: boolean } = {}): StaffRecord[] {
    this.getShop(shopId);
    return this.staffRepo.listStaff({ shopId, ...options });
  }

  updateStaff(actor: Actor, staffId: string, patch: UpdateStaffInput): StaffRecord {
    assertCan(actor.role, 'staff:manage');
    const staff = this.getStaff(staffId);
    const shop = this.getShop(staff.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    if (patch.employeeCode) {
      const existing = this.staffRepo.findStaffByCode(staff.shopId, patch.employeeCode);
      if (existing && existing.id !== staffId) {
        throw new ConflictError(`Employee code '${patch.employeeCode}' is already in use`);
      }
    }

    return this.staffRepo.updateStaff(staffId, patch);
  }

  deleteStaff(actor: Actor, staffId: string): void {
    assertCan(actor.role, 'staff:manage');
    const staff = this.getStaff(staffId);
    const shop = this.getShop(staff.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    this.staffRepo.softDeleteStaff(staffId);
  }

  setStaffServices(actor: Actor, staffId: string, serviceIds: string[]): void {
    assertCan(actor.role, 'staff:manage');
    const staff = this.getStaff(staffId);
    const shop = this.getShop(staff.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    this.staffRepo.setStaffServices(staffId, serviceIds);
  }

  getStaffServices(staffId: string): string[] {
    this.getStaff(staffId);
    return this.staffRepo.getStaffServiceIds(staffId);
  }

  setStaffBranches(actor: Actor, staffId: string, branches: Array<{ branchId: string; isPrimary?: boolean }>): void {
    assertCan(actor.role, 'staff:manage');
    const staff = this.getStaff(staffId);
    const shop = this.getShop(staff.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    this.staffRepo.setStaffBranches(staffId, branches);
  }

  getStaffBranches(staffId: string): StaffBranchRecord[] {
    this.getStaff(staffId);
    return this.staffRepo.getStaffBranches(staffId);
  }

  setStaffSchedules(actor: Actor, staffId: string, schedules: SetStaffScheduleInput[]): StaffScheduleRecord[] {
    assertCan(actor.role, 'schedule:write:shop');
    const staff = this.getStaff(staffId);
    const shop = this.getShop(staff.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    return this.staffRepo.setStaffSchedules(staffId, schedules);
  }

  getStaffSchedules(staffId: string): StaffScheduleRecord[] {
    this.getStaff(staffId);
    return this.staffRepo.getStaffSchedules(staffId);
  }

  setStaffBreaks(actor: Actor, staffId: string, breaks: SetStaffBreakInput[]): StaffBreakRecord[] {
    assertCan(actor.role, 'schedule:write:shop');
    const staff = this.getStaff(staffId);
    const shop = this.getShop(staff.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    return this.staffRepo.setStaffBreaks(staffId, breaks);
  }

  getStaffBreaks(staffId: string): StaffBreakRecord[] {
    this.getStaff(staffId);
    return this.staffRepo.getStaffBreaks(staffId);
  }

  requestLeave(staffId: string, input: Omit<RequestLeaveInput, 'staffId'>): StaffLeaveRecord {
    this.getStaff(staffId);
    return this.staffRepo.requestLeave({ ...input, staffId });
  }

  decideLeave(actor: Actor, leaveId: string, status: 'approved' | 'rejected'): StaffLeaveRecord {
    assertCan(actor.role, 'leave:approve');
    return this.staffRepo.decideLeave(leaveId, status, actor.userId);
  }

  setAvailabilityOverride(actor: Actor, staffId: string, input: Omit<SetOverrideInput, 'staffId' | 'createdBy'>): StaffOverrideRecord {
    assertCan(actor.role, 'availability:write:staff');
    const staff = this.getStaff(staffId);
    const shop = this.getShop(staff.shopId);
    this.assertShopOwnershipOrAdmin(actor, shop);

    return this.staffRepo.setAvailabilityOverride({
      ...input,
      staffId,
      createdBy: actor.userId,
    });
  }

  recordAttendance(staffId: string, input: Omit<RecordAttendanceInput, 'staffId'>): StaffAttendanceRecord {
    this.getStaff(staffId);
    return this.staffRepo.recordAttendance({ ...input, staffId });
  }
}
