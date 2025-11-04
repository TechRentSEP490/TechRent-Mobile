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
  customerId: number | string | null;
  staffId: number | string | null;
  orderId: number | string | null;
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

export type FetchContractResult = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: ContractResponse | null;
};

export type SendContractPinResult = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: unknown;
};

export type SignedContractData = {
  signatureId: number;
  contractId: number;
  signatureHash: string;
  signatureMethod: string;
  deviceInfo: string;
  ipAddress: string;
  signedAt: string;
  signatureStatus: string;
  certificateInfo: string;
  auditTrail: string;
};

export type SignContractResult = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: SignedContractData | null;
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

export async function fetchContractById(
  session: SessionCredentials,
  contractId: number,
): Promise<ContractResponse | null> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load the contract.');
  }

  if (!Number.isInteger(contractId) || contractId <= 0) {
    throw new Error('A valid contract identifier is required to load the contract.');
  }

  const response = await fetch(buildApiUrl('contracts', contractId), {
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
      apiMessage ?? `Unable to load the contract (status ${response.status}).`,
    ) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as FetchContractResult | null;

  if (!json || json.status !== 'SUCCESS') {
    const error = new Error(
      json?.message ?? 'Failed to load the contract. Please try again.',
    ) as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return json.data ?? null;
}

type SendContractPinOptions = {
  contractId: number;
  email: string;
};

export async function sendContractPin(
  session: SessionCredentials,
  { contractId, email }: SendContractPinOptions,
): Promise<SendContractPinResult> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to request a verification code.');
  }

  if (!Number.isInteger(contractId) || contractId <= 0) {
    throw new Error('A valid contract identifier is required to request a verification code.');
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    throw new Error('An email address is required to send the verification code.');
  }

  const response = await fetch(buildApiUrl('contracts', contractId, 'send-pin', 'email'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${
        session.accessToken
      }`,
    },
    body: JSON.stringify({ email: trimmedEmail }),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    const error = new Error(
      apiMessage ?? `Unable to request verification code (status ${response.status}).`,
    ) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as SendContractPinResult | null;

  if (!json || json.status !== 'SUCCESS') {
    const error = new Error(
      json?.message ?? 'Failed to send the verification code. Please try again.',
    ) as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
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
  payload: SignContractPayload,
): Promise<SignContractResult> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to sign the contract.');
  }

  if (!Number.isInteger(payload?.contractId) || payload.contractId <= 0) {
    throw new Error('A valid contract identifier is required to sign the contract.');
  }

  if (!payload?.pinCode || payload.pinCode.trim().length === 0) {
    throw new Error('A verification code is required to sign the contract.');
  }

  const response = await fetch(buildApiUrl('contracts', payload.contractId, 'sign'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${
        session.accessToken
      }`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    const error = new Error(
      apiMessage ?? `Unable to sign the contract (status ${response.status}).`,
    ) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as SignContractResult | null;

  if (!json || json.status !== 'SUCCESS') {
    const error = new Error(
      json?.message ?? 'Failed to sign the contract. Please try again.',
    ) as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return json;
}
