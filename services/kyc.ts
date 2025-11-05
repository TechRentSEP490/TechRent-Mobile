import { buildApiUrl, enhanceNetworkError } from './api';

export type KycDocumentSlot = 'front' | 'back' | 'selfie';

export type KycDocumentAsset = {
  uri: string;
  name?: string | null;
  type?: string | null;
};

export type KycDocumentsPayload = Record<KycDocumentSlot, KycDocumentAsset>;

export const KYC_DOCUMENT_SLOTS: readonly KycDocumentSlot[] = ['front', 'back', 'selfie'];

type KycDocumentsApiResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: KycDocumentsDto | null;
};

type KycDocumentsDto = {
  kycStatus?: string | null;
  customerId?: number | null;
  verifiedAt?: string | null;
  fullName?: string | null;
  frontCCCDUrl?: string | null;
  backCCCDUrl?: string | null;
  selfieUrl?: string | null;
  verifiedBy?: string | null;
  rejectionReason?: string | null;
};

export type NormalizedKycDocuments = {
  kycStatus: string | null;
  customerId: number | null;
  verifiedAt: string | null;
  fullName: string | null;
  frontUrl: string | null;
  backUrl: string | null;
  selfieUrl: string | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
};

const normalizeKycDocuments = (data: KycDocumentsDto | null | undefined): NormalizedKycDocuments | null => {
  if (!data) {
    return null;
  }

  return {
    kycStatus: data.kycStatus ?? null,
    customerId: typeof data.customerId === 'number' ? data.customerId : null,
    verifiedAt: data.verifiedAt ?? null,
    fullName: data.fullName ?? null,
    frontUrl: data.frontCCCDUrl ?? null,
    backUrl: data.backCCCDUrl ?? null,
    selfieUrl: data.selfieUrl ?? null,
    verifiedBy: data.verifiedBy ?? null,
    rejectionReason: data.rejectionReason ?? null,
  };
};

const coerceDocumentsParamValue = (raw: string | string[] | undefined) =>
  Array.isArray(raw) ? raw[0] : raw;

export const encodeKycDocumentsParam = (documents: KycDocumentsPayload) =>
  encodeURIComponent(JSON.stringify(documents));

export const decodeKycDocumentsParam = (
  raw: string | string[] | undefined
): KycDocumentsPayload | null => {
  const value = coerceDocumentsParamValue(raw);

  if (!value || value.length === 0) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded) as Partial<Record<KycDocumentSlot, KycDocumentAsset>> | null;

    if (!parsed) {
      return null;
    }

    const result: Partial<KycDocumentsPayload> = {};

    for (const slot of KYC_DOCUMENT_SLOTS) {
      const asset = parsed[slot];

      if (!asset || typeof asset.uri !== 'string' || asset.uri.length === 0) {
        return null;
      }

      result[slot] = {
        uri: asset.uri,
        name: asset.name ?? null,
        type: asset.type ?? null,
      };
    }

    return result as KycDocumentsPayload;
  } catch (error) {
    console.warn('Failed to decode KYC document payload', error);
    return null;
  }
};

const resolveTokenType = (tokenType?: string | null) =>
  tokenType && tokenType.length > 0 ? tokenType : 'Bearer';

const getAuthorizationHeader = ({
  accessToken,
  tokenType,
}: {
  accessToken: string;
  tokenType?: string | null;
}) => `${resolveTokenType(tokenType)} ${accessToken}`;

const handleKycResponse = async (response: Response) => {
  const json = (await response.json()) as KycDocumentsApiResponse | null;

  if (!json || json.status !== 'SUCCESS') {
    const message = json?.message ?? 'Failed to process KYC request. Please try again.';
    throw new Error(message);
  }

  return normalizeKycDocuments(json.data);
};

export async function fetchKycDocuments({
  accessToken,
  tokenType,
}: {
  accessToken: string;
  tokenType?: string | null;
}) {
  if (!accessToken) {
    throw new Error('Access token is required to load KYC documents.');
  }

  const endpointUrl = buildApiUrl('operator', 'kyc', 'api', 'customers', 'me', 'kyc');
  let response: Response;

  try {
    response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: getAuthorizationHeader({ accessToken, tokenType }),
      },
    });
  } catch (networkError) {
    throw enhanceNetworkError(networkError, endpointUrl);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load KYC documents (status ${response.status}).`);
  }

  return handleKycResponse(response);
}

export async function uploadKycDocuments({
  accessToken,
  tokenType,
  documents,
}: {
  accessToken: string;
  tokenType?: string | null;
  documents: KycDocumentsPayload;
}) {
  if (!accessToken) {
    throw new Error('Access token is required to upload KYC documents.');
  }

  const formData = new FormData();

  (Object.entries(documents) as Array<[KycDocumentSlot, KycDocumentAsset]>).forEach(
    ([slot, asset]) => {
      if (!asset?.uri) {
        throw new Error(`Missing file for ${slot} document.`);
      }

      const fileName = asset.name && asset.name.length > 0 ? asset.name : `${slot}-${Date.now()}.jpg`;
      const contentType = asset.type && asset.type.length > 0 ? asset.type : 'image/jpeg';

      formData.append(slot, {
        uri: asset.uri,
        name: fileName,
        type: contentType,
      } as unknown as Blob);
    }
  );

  const endpointUrl = buildApiUrl('operator', 'kyc', 'api', 'customers', 'me', 'kyc', 'documents', 'batch');
  let response: Response;

  try {
    response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: getAuthorizationHeader({ accessToken, tokenType }),
      },
      body: formData,
    });
  } catch (networkError) {
    throw enhanceNetworkError(networkError, endpointUrl);
  }

  if (!response.ok) {
    throw new Error(`Failed to upload KYC documents (status ${response.status}).`);
  }

  return handleKycResponse(response);
}
