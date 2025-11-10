import { buildApiUrl } from './api';
import type { SessionCredentials } from './rental-orders';

export type ContractResponse = {
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

type ApiEnvelope<T> = {
  status: string;
  message: string;
  details?: string | null;
  code: number;
  data: T;
};

const buildAuthHeader = (session: SessionCredentials) =>
  `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken}`;

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    console.warn('Failed to parse JSON response', error);
    return null;
  }
}

export async function fetchContracts(session: SessionCredentials): Promise<ContractResponse[]> {
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

  const json = (await parseJsonSafely<ApiEnvelope<ContractResponse[] | null>>(response)) ?? null;

  if (!json || json.status !== 'SUCCESS' || !Array.isArray(json.data)) {
    throw new Error(json?.message ?? 'Failed to load rental contracts. Please try again.');
  }

  return json.data;
}

export async function fetchContractForOrder(
  orderId: number,
  session: SessionCredentials
): Promise<ContractResponse | null> {
  const contracts = await fetchContracts(session);
  return contracts.find((contract) => contract.orderId === orderId) ?? null;
}

export async function fetchContractById(
  session: SessionCredentials,
  contractId: number
): Promise<ContractResponse | null> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load rental contracts.');
  }

  const response = await fetch(buildApiUrl('contracts', contractId), {
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }

    throw new Error(`Unable to load rental contract (status ${response.status}).`);
  }

  const json = (await parseJsonSafely<ApiEnvelope<ContractResponse | null>>(response)) ?? null;

  if (!json || json.status !== 'SUCCESS') {
    throw new Error(json?.message ?? 'Failed to load rental contract. Please try again.');
  }

  return json.data;
}

type SendContractPinParams = {
  contractId: number;
  email: string;
};

export async function sendContractPin(
  session: SessionCredentials,
  params: SendContractPinParams
): Promise<ApiEnvelope<unknown>> {
  if (!session?.accessToken) {
    throw new Error('You must be signed in to request a contract verification code.');
  }

  const { contractId, email } = params;

  if (!contractId || Number.isNaN(contractId)) {
    throw new Error('A valid contract is required before requesting a verification code.');
  }

  const response = await fetch(buildApiUrl('contracts', contractId, 'send-pin', 'email'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: buildAuthHeader(session),
    },
    body: JSON.stringify({ email }),
  });

  const json = (await parseJsonSafely<ApiEnvelope<unknown>>(response)) ?? null;

  if (!response.ok || !json || json.status !== 'SUCCESS') {
    const message = json?.message ?? `Unable to send verification code (status ${response.status}).`;
    throw new Error(message);
  }

  return json;
}

type SignContractPayload = {
  contractId: number;
  digitalSignature: string;
  pinCode: string;
  signatureMethod: string;
  deviceInfo: string;
  ipAddress: string;
};

export async function signContract(
  session: SessionCredentials,
  payload: SignContractPayload
): Promise<ApiEnvelope<unknown>> {
  if (!session?.accessToken) {
    throw new Error('You must be signed in to sign a rental contract.');
  }

  const { contractId, ...body } = payload;

  if (!contractId || Number.isNaN(contractId)) {
    throw new Error('A valid contract is required to complete the signature.');
  }

  const response = await fetch(buildApiUrl('contracts', contractId, 'sign'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: buildAuthHeader(session),
    },
    body: JSON.stringify({ contractId, ...body }),
  });

  const json = (await parseJsonSafely<ApiEnvelope<unknown>>(response)) ?? null;

  if (!response.ok || !json || json.status !== 'SUCCESS') {
    const message = json?.message ?? `Unable to sign the contract (status ${response.status}).`;
    throw new Error(message);
  }

  return json;
}
