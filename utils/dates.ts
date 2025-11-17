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
