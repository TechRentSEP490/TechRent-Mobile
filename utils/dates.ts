export const clampToStartOfDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const addDays = (date: Date, days: number) => {
  const base = clampToStartOfDay(date);
  const nextDate = new Date(base);
  nextDate.setDate(base.getDate() + days);
  return clampToStartOfDay(nextDate);
};

export const startOfMonth = (date: Date) => {
  const firstDay = clampToStartOfDay(date);
  firstDay.setDate(1);
  return clampToStartOfDay(firstDay);
};

export const addMonths = (date: Date, months: number) => {
  const base = startOfMonth(date);
  const next = new Date(base);
  next.setMonth(base.getMonth() + months);
  return startOfMonth(next);
};

export const endOfMonth = (date: Date) => addDays(addMonths(startOfMonth(date), 1), -1);

export const isSameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const formatDisplayDate = (date: Date) =>
  clampToStartOfDay(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const generateCalendarDays = (monthStart: Date) => {
  const firstDayOfMonth = startOfMonth(monthStart);
  const firstWeekday = firstDayOfMonth.getDay();
  const calendarStart = addDays(firstDayOfMonth, -firstWeekday);
  return Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
};

export const parseDateParam = (value: unknown, fallback: Date) => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return clampToStartOfDay(parsed);
    }
  }

  return clampToStartOfDay(fallback);
};

// ============================================================
// RENTAL ORDER HELPERS - Days Remaining Calculations
// ============================================================

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Calculate days remaining until return date
 * Returns null if endDate is invalid
 */
export function getDaysRemaining(endDate: string | Date | null | undefined): number | null {
  if (!endDate) return null;

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  // Calculate based on local date (not UTC) to match user's calendar
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diff = endDateOnly.getTime() - nowDateOnly.getTime();
  const days = Math.ceil(diff / DAY_MS);

  return days;
}

/**
 * Format remaining days as text (Vietnamese)
 */
export function formatRemainingDaysText(daysRemaining: number | null): string {
  if (daysRemaining === null) return '—';
  if (daysRemaining < 0) return 'Đã quá hạn';
  if (daysRemaining === 0) return 'Hết hạn hôm nay';
  if (daysRemaining <= 1) return 'Còn 1 ngày';
  return `Còn ${daysRemaining} ngày`;
}

/**
 * Check if order is close to return date (less than or equal to 1 day remaining)
 * @param endDate - The end date to check (planEndDate or endDate)
 */
export function isCloseToReturnDate(endDate: string | Date | null | undefined): boolean {
  if (!endDate) return false;
  const daysRemaining = getDaysRemaining(endDate);
  return daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 1;
}

/**
 * Check if order is currently in use
 */
export function isOrderInUse(orderStatus: string | null | undefined): boolean {
  if (!orderStatus) return false;
  const status = String(orderStatus).toLowerCase();
  return status === 'in_use';
}

/**
 * Synchronous check if return is confirmed
 * Checks multiple sources: local storage set, order status, returnConfirmed flag
 */
export function isReturnConfirmedSync(
  order: {
    orderId?: number;
    id?: number;
    rentalOrderId?: number;
    orderStatus?: string;
    status?: string;
    returnConfirmed?: boolean | string;
  } | null | undefined,
  confirmedReturnOrders?: Set<number>
): boolean {
  if (!order) return false;

  // Check if in local confirmed set
  const orderId = order?.orderId || order?.id || order?.rentalOrderId;
  if (orderId && confirmedReturnOrders?.has(orderId)) {
    return true;
  }

  // Check order status
  const status = String(order?.orderStatus || order?.status || '').toLowerCase();
  if (status === 'returned' || status === 'return_confirmed') {
    return true;
  }

  // Check returnConfirmed flag
  if (order?.returnConfirmed === true || order?.returnConfirmed === 'true') {
    return true;
  }

  // Check if status contains "return"
  if (status.includes('return')) {
    return true;
  }

  return false;
}

/**
 * Calculate difference in days between two dates
 */
export function diffDays(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): number {
  if (!start || !end) return 0;

  const s = new Date(start);
  const e = new Date(end);

  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;

  const diff = Math.abs(e.getTime() - s.getTime());
  return Math.ceil(diff / DAY_MS);
}
