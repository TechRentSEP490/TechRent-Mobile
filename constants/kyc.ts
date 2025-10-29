export type KycProgressState = 'not_started' | 'pending' | 'verified' | 'rejected';

const formatSegments = (value: string) =>
  value
    .split(/[_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');

const PENDING_STATUSES = new Set([
  'DOCUMENTS_SUBMITTED',
  'PENDING',
  'PENDING_VERIFICATION',
  'IN_REVIEW',
  'UNDER_REVIEW',
  'IN_PROGRESS',
  'SUBMITTED',
]);

const VERIFIED_STATUSES = new Set([
  'VERIFIED',
  'APPROVED',
  'ACCEPTED',
  'COMPLETED',
  'SUCCESS',
]);

const REJECTED_STATUSES = new Set(['REJECTED', 'DECLINED', 'FAILED']);

export const getKycProgressState = (status?: string | null): KycProgressState => {
  const normalized = status?.trim().toUpperCase();

  if (!normalized || normalized.length === 0 || normalized === 'NOT_STARTED') {
    return 'not_started';
  }

  if (VERIFIED_STATUSES.has(normalized)) {
    return 'verified';
  }

  if (REJECTED_STATUSES.has(normalized)) {
    return 'rejected';
  }

  if (PENDING_STATUSES.has(normalized)) {
    return 'pending';
  }

  return 'pending';
};

export const formatKycStatusLabel = (status?: string | null): string => {
  if (!status || status.trim().length === 0) {
    return 'Not Started';
  }

  return formatSegments(status);
};
