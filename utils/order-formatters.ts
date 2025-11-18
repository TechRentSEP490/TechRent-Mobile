export const formatCurrency = (value: number): string => {
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  } catch {
    return `${Number.isFinite(value) ? Math.round(value).toLocaleString('vi-VN') : '0'} ₫`;
  }
};

export const formatRentalPeriod = (startDateIso: string, endDateIso: string): string => {
  const startDate = startDateIso ? new Date(startDateIso) : null;
  const endDate = endDateIso ? new Date(endDateIso) : null;

  if (!startDate || Number.isNaN(startDate.getTime())) {
    return '—';
  }

  const hasValidEnd = Boolean(endDate && !Number.isNaN(endDate.getTime()));

  try {
    const sameYear = hasValidEnd && endDate ? startDate.getFullYear() === endDate.getFullYear() : false;
    const startFormatter = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
    const startLabel = startFormatter.format(startDate);

    if (hasValidEnd && endDate) {
      const endFormatter = new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const endLabel = endFormatter.format(endDate);
      return `${startLabel} - ${endLabel}`;
    }

    return `Starting ${startLabel}`;
  } catch {
    if (hasValidEnd && endDate) {
      return `${startDate.toDateString()} - ${endDate.toDateString()}`;
    }

    return startDate.toDateString();
  }
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
};

export const formatContractStatus = (status: string | null | undefined): string => {
  if (!status) {
    return 'Unknown';
  }

  const normalized = status.replace(/[_\s]+/g, ' ').toLowerCase();
  return normalized.replace(/(?:^|\s)([a-z])/g, (_, char: string) => char.toUpperCase());
};

export const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
