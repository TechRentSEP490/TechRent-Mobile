import { buildApiUrl } from './api';

type SessionCredentials = {
  accessToken: string;
  tokenType?: string | null;
};

type ContractActionResponse<TData = unknown> = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: TData;
};

type ApiErrorWithStatus = Error & { status?: number };

type SendContractPinPayload = {
  email: string;
};

type SendContractPinResult = ContractActionResponse<null>;

type SignContractPayload = {
  contractId: number;
  pinCode: string;
  digitalSignature?: string;
  signatureMethod?: string;
  deviceInfo?: string;
  ipAddress?: string;
};

type SignContractData = {
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

type SignContractResult = ContractActionResponse<SignContractData | null>;

const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
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
    console.warn('Failed to parse contract API error response', error);
    return null;
  }
};

const resolveTokenType = (tokenType?: string | null) =>
  tokenType && tokenType.length > 0 ? tokenType : 'Bearer';

export async function sendContractPinEmail(
  contractId: number | string,
  payload: SendContractPinPayload,
  session: SessionCredentials,
): Promise<SendContractPinResult> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to request the contract PIN.');
  }

  if (!payload.email || payload.email.trim().length === 0) {
    throw new Error('An email address is required to request the contract PIN.');
  }

  const response = await fetch(buildApiUrl('contracts', contractId, 'send-pin', 'email'), {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `${resolveTokenType(session.tokenType)} ${session.accessToken}`,
    },
    body: JSON.stringify({ email: payload.email.trim() }),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    const error = new Error(
      apiMessage ?? `Unable to request contract PIN (status ${response.status}).`,
    ) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as SendContractPinResult | null;

  if (!json || json.status !== 'SUCCESS') {
    const error = new Error(json?.message ?? 'Failed to request contract PIN.') as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return json;
}

export async function signContract(
  contractId: number | string,
  payload: SignContractPayload,
  session: SessionCredentials,
): Promise<SignContractResult> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to sign the contract.');
  }

  if (!payload.pinCode || payload.pinCode.trim().length === 0) {
    throw new Error('A valid PIN code is required to sign the contract.');
  }

  const response = await fetch(buildApiUrl('contracts', contractId, 'sign'), {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `${resolveTokenType(session.tokenType)} ${session.accessToken}`,
    },
    body: JSON.stringify({
      contractId: payload.contractId,
      digitalSignature: payload.digitalSignature ?? 'string',
      pinCode: payload.pinCode.trim(),
      signatureMethod: payload.signatureMethod ?? 'EMAIL_OTP',
      deviceInfo: payload.deviceInfo ?? 'string',
      ipAddress: payload.ipAddress ?? 'string',
    }),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    const error = new Error(apiMessage ?? `Unable to sign contract (status ${response.status}).`) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as SignContractResult | null;

  if (!json || json.status !== 'SUCCESS') {
    const error = new Error(json?.message ?? 'Failed to sign contract.') as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return json;
}
