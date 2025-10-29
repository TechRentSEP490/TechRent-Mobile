import { buildApiUrl } from './api';

type SessionCredentials = {
  accessToken: string;
  tokenType?: string | null;
};

export type ContractResponse = {
  contractId: number;
  contractNumber: string;
  title: string | null;
  description: string | null;
  contractType: string | null;
  status: string | null;
  customerId: number | null;
  staffId: number | null;
  orderId: number | null;
  contractContent: string | null;
  termsAndConditions: string | null;
  rentalPeriodDays: number | null;
  totalAmount: number | null;
  depositAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: number | null;
  updatedBy: number | null;
};

export type FetchContractsResult = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: ContractResponse[] | null;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const json = (await response.json()) as Partial<{
      message: string;
      details: string;
      error: string;
    }>;

    return json?.message ?? json?.details ?? json?.error ?? null;
  } catch (error) {
    console.warn('Failed to parse contracts error response', error);
    return null;
  }
};

type ApiErrorWithStatus = Error & { status?: number };

export async function fetchContracts(session: SessionCredentials): Promise<ContractResponse[]> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load rental contracts.');
  }

  const response = await fetch(buildApiUrl('contracts', 'my-contracts'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${
        session.accessToken
      }`,
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    const error = new Error(
      apiMessage ?? `Unable to load rental contracts (status ${response.status}).`,
    ) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as FetchContractsResult | null;

  if (!json || json.status !== 'SUCCESS' || !Array.isArray(json.data)) {
    const error = new Error(
      json?.message ?? 'Failed to load rental contracts. Please try again.',
    ) as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return json.data;
}
