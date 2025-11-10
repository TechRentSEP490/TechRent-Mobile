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
