import { buildApiUrl } from './api';
import type { SessionCredentials } from './rental-orders';

export type RentalContract = {
  contractId: number;
  contractNumber: string;
  title: string;
  description: string;
  contractType: string;
  status: string;
  customerId: number;
  staffId: number | null;
  orderId: number;
  contractContent: string | null;
  termsAndConditions: string | null;
  rentalPeriodDays: number | null;
  totalAmount: number | null;
  depositAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  adminSignedAt: string | null;
  adminSignedBy: string | null;
  customerSignedAt: string | null;
  customerSignedBy: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: number | null;
  updatedBy: number | null;
};

type ContractsResponse = {
  status: string;
  message: string;
  details?: string;
  code: number;
  data: RentalContract[] | null;
};

const buildAuthHeader = (session: SessionCredentials) =>
  `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken}`;

export async function fetchContracts(session: SessionCredentials): Promise<RentalContract[]> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load rental contracts.');
  }

  const response = await fetch(buildApiUrl('contracts', 'my-contracts'), {
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load rental contracts (status ${response.status}).`);
  }

  const json = (await response.json()) as ContractsResponse | null;

  if (!json || json.status !== 'SUCCESS' || !Array.isArray(json.data)) {
    throw new Error(json?.message ?? 'Failed to load rental contracts. Please try again.');
  }

  return json.data;
}

export async function fetchContractForOrder(
  orderId: number,
  session: SessionCredentials
): Promise<RentalContract | null> {
  const contracts = await fetchContracts(session);
  return contracts.find((contract) => contract.orderId === orderId) ?? null;
}
