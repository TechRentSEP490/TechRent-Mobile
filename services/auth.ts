import { buildApiUrl } from './api';
import { normalizeShippingAddress, type ShippingAddress } from './shipping-addresses';

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  phoneNumber: string;
};

export type LoginPayload = {
  usernameOrEmail: string;
  password: string;
};

type ApiSuccessResponse<TData> = {
  status: string;
  message: string;
  details?: string | null;
  code: number;
  data: TData;
};

type RegisterResponse = ApiSuccessResponse<null>;

type VerifyEmailResponse = ApiSuccessResponse<unknown>;

type LoginResponse = {
  accessToken: string;
  tokenType: string;
};

export type AuthenticatedUser = {
  customerId: number;
  accountId: number;
  username: string;
  email: string;
  phoneNumber: string | null;
  fullName: string | null;
  kycStatus: string;
  shippingAddressDtos: ShippingAddress[];
  bankInformationDtos: unknown[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

type CurrentUserResponse = ApiSuccessResponse<AuthenticatedUser | null>;

type ApiErrorWithStatus = Error & { status?: number };

export type UpdateProfilePayload = {
  email: string;
  phoneNumber: string;
  fullName: string;
};

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
    console.warn('Failed to parse API error response', error);
    return null;
  }
};

const normalizeAuthenticatedUser = (user: AuthenticatedUser) => {
  const normalizedPhoneNumber = user.phoneNumber?.trim() ?? null;
  const normalizedAddresses = Array.isArray(user.shippingAddressDtos)
    ? user.shippingAddressDtos
        .map((address) => normalizeShippingAddress(address) ?? null)
        .filter((value): value is ShippingAddress => value !== null)
    : [];

  return {
    ...user,
    phoneNumber:
      normalizedPhoneNumber && normalizedPhoneNumber.length > 0 ? normalizedPhoneNumber : null,
    shippingAddressDtos: normalizedAddresses,
  };
};

export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  const response = await fetch(buildApiUrl('auth', 'register'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Registration failed (status ${response.status}).`);
  }

  const json = (await response.json()) as RegisterResponse | null;

  if (!json || json.status !== 'SUCCESS') {
    throw new Error(json?.message ?? 'Registration failed. Please try again.');
  }

  return json;
}

export async function verifyEmail({ email, code }: { email: string; code: string }) {
  if (!email || !code) {
    throw new Error('Email and verification code are required.');
  }

  const url = new URL(buildApiUrl('auth', 'verify-email'));
  url.searchParams.append('email', email);
  url.searchParams.append('code', code);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: jsonHeaders,
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Verification failed (status ${response.status}).`);
  }

  const json = (await response.json()) as VerifyEmailResponse | null;

  if (!json || json.status !== 'SUCCESS') {
    throw new Error(json?.message ?? 'Verification failed. Please try again.');
  }

  return json;
}

export async function loginUser(payload: LoginPayload) {
  const response = await fetch(buildApiUrl('auth', 'login'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Sign in failed (status ${response.status}).`);
  }

  const json = (await response.json()) as LoginResponse | null;

  if (!json?.accessToken) {
    throw new Error('Sign in failed. Please verify your credentials and try again.');
  }

  return json;
}

export async function getCurrentUser({
  accessToken,
  tokenType,
}: {
  accessToken: string;
  tokenType?: string | null;
}) {
  if (!accessToken) {
    throw new Error('Access token is required to load the current user.');
  }

  const response = await fetch(buildApiUrl('customers', 'profile'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${tokenType && tokenType.length > 0 ? tokenType : 'Bearer'} ${accessToken}`,
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    const error = new Error(apiMessage ?? `Failed to load profile (status ${response.status}).`) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as CurrentUserResponse | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    const error = new Error(json?.message ?? 'Failed to load profile. Please try again.') as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return normalizeAuthenticatedUser(json.data);
}

export async function updateCustomerProfile({
  accessToken,
  tokenType,
  payload,
}: {
  accessToken: string;
  tokenType?: string | null;
  payload: UpdateProfilePayload;
}) {
  if (!accessToken) {
    throw new Error('Access token is required to update the profile.');
  }

  const response = await fetch(buildApiUrl('customers', 'profile'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `${tokenType && tokenType.length > 0 ? tokenType : 'Bearer'} ${accessToken}`,
    },
    body: JSON.stringify({
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      fullName: payload.fullName,
      bankName: 'string',
      bankAccountHolder: 'string',
    }),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    const error = new Error(
      apiMessage ?? `Failed to update profile (status ${response.status}).`,
    ) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as CurrentUserResponse | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    const error = new Error(json?.message ?? 'Failed to update profile. Please try again.') as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return normalizeAuthenticatedUser(json.data);
}
