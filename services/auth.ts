import { buildApiUrl } from './api';

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  phoneNumber: string;
};

type RegisterResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
};

type VerifyEmailResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: unknown;
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

export async function registerUser(payload: RegisterPayload) {
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
