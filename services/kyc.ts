import { buildApiUrl, fetchWithRetry } from './api';

type DocumentAsset = {
  uri: string;
  type: string;
  name: string;
};

export type UploadKycDocumentsPayload = {
  accessToken: string;
  tokenType?: string;
  front: DocumentAsset;
  back: DocumentAsset;
  selfie: DocumentAsset;
  fullName: string;
  identificationCode: string;
  typeOfIdentification: string;
  birthday: string;
  expirationDate: string;
  permanentAddress: string;
};

export type UploadKycDocumentsResponse = {
  status: string;
  message?: string;
  details?: string;
  code?: number;
  data?: unknown;
};

export type CustomerKycDetails = {
  birthday: string | null;
  identificationCode: string | null;
  kycStatus: string;
  verifiedAt: string | null;
  fullName: string | null;
  frontCCCDUrl: string | null;
  verifiedBy: number | null;
  typeOfIdentification: string | null;
  customerId: number;
  permanentAddress: string | null;
  backCCCDUrl: string | null;
  selfieUrl: string | null;
  rejectionReason: string | null;
  expirationDate: string | null;
};

type KycDetailsResponse = {
  status?: string;
  message?: string;
  details?: string;
  code?: number;
  data?: CustomerKycDetails | null;
};

const toFormDataFile = (asset: DocumentAsset) => ({
  uri: asset.uri,
  type: asset.type,
  name: asset.name,
});

const resolveTokenType = (tokenType?: string) => {
  if (tokenType && tokenType.length > 0) {
    return tokenType;
  }

  return 'Bearer';
};

export const uploadKycDocuments = async (payload: UploadKycDocumentsPayload) => {
  const {
    accessToken,
    tokenType,
    front,
    back,
    selfie,
    fullName,
    identificationCode,
    typeOfIdentification,
    birthday,
    expirationDate,
    permanentAddress,
  } = payload;

  const url = buildApiUrl('customers', 'me', 'kyc', 'documents', 'batch');
  const formData = new FormData();

  formData.append('front', toFormDataFile(front) as unknown as any);
  formData.append('back', toFormDataFile(back) as unknown as any);
  formData.append('selfie', toFormDataFile(selfie) as unknown as any);
  formData.append('fullName', fullName);
  formData.append('identificationCode', identificationCode);
  formData.append('typeOfIdentification', typeOfIdentification);
  formData.append('birthday', birthday);
  formData.append('expirationDate', expirationDate);
  formData.append('permanentAddress', permanentAddress);

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Authorization: `${resolveTokenType(tokenType)} ${accessToken}`,
      Accept: 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to upload KYC documents.');
  }

  const data = (await response.json()) as UploadKycDocumentsResponse;

  return data;
};

type GetMyKycDetailsArgs = {
  accessToken: string;
  tokenType?: string;
};

const parseKycErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as Partial<{ message?: string; details?: string; error?: string }>;
    return data.message ?? data.details ?? data.error ?? null;
  } catch (error) {
    console.warn('Failed to parse KYC error response', error);
    return null;
  }
};

const normalizeNullable = <T>(value: T | null | undefined): T | null =>
  value === undefined ? null : value;

export const getMyKycDetails = async ({ accessToken, tokenType }: GetMyKycDetailsArgs) => {
  if (!accessToken) {
    throw new Error('Access token is required to load KYC details.');
  }

  const response = await fetchWithRetry(buildApiUrl('customers', 'me', 'kyc'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${resolveTokenType(tokenType)} ${accessToken}`,
    },
  });

  if (!response.ok) {
    const apiMessage = await parseKycErrorMessage(response);
    throw new Error(apiMessage ?? 'Failed to load KYC information.');
  }

  const json = (await response.json()) as KycDetailsResponse | null;

  if (!json || json.status !== 'SUCCESS') {
    throw new Error(json?.message ?? 'Failed to load KYC information.');
  }

  if (!json.data) {
    return null;
  }

  const normalizedStatus = (json.data.kycStatus ?? 'NOT_STARTED').toUpperCase();

  return {
    ...json.data,
    kycStatus: normalizedStatus,
    birthday: normalizeNullable(json.data.birthday),
    identificationCode: normalizeNullable(json.data.identificationCode),
    verifiedAt: normalizeNullable(json.data.verifiedAt),
    fullName: normalizeNullable(json.data.fullName),
    frontCCCDUrl: normalizeNullable(json.data.frontCCCDUrl),
    verifiedBy: normalizeNullable(json.data.verifiedBy),
    typeOfIdentification: normalizeNullable(json.data.typeOfIdentification),
    permanentAddress: normalizeNullable(json.data.permanentAddress),
    backCCCDUrl: normalizeNullable(json.data.backCCCDUrl),
    selfieUrl: normalizeNullable(json.data.selfieUrl),
    rejectionReason: normalizeNullable(json.data.rejectionReason),
    expirationDate: normalizeNullable(json.data.expirationDate),
  } satisfies CustomerKycDetails;
};
