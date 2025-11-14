import { buildApiUrl } from './api';

export type SessionCredentials = {
  accessToken: string;
  tokenType?: string | null;
};

export type ShippingAddress = {
  shippingAddressId: number;
  address: string;
  customerId: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type ShippingAddressResponse = {
  status: string;
  message?: string;
  details?: string;
  code: number;
  data: ShippingAddress | null;
};

type ShippingAddressListResponse = {
  status: string;
  message?: string;
  details?: string;
  code: number;
  data: ShippingAddress[] | null;
};

export type CreateShippingAddressPayload = {
  address: string;
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const buildAuthHeader = (session: SessionCredentials) =>
  `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken}`;

const parseErrorMessage = async (response: Response) => {
  try {
    const json = (await response.json()) as Partial<{
      message: string;
      details: string;
      error: string;
    }>;

    return json?.message ?? json?.details ?? json?.error ?? null;
  } catch (error) {
    console.warn('Failed to parse shipping address error response', error);
    return null;
  }
};

const normalizeShippingAddress = (address: Partial<ShippingAddress> | null | undefined): ShippingAddress | null => {
  if (!address) {
    return null;
  }

  const id = Number(address.shippingAddressId);
  const customerId = Number(address.customerId);
  const normalizedAddress = typeof address.address === 'string' ? address.address.trim() : '';

  if (!Number.isFinite(id) || id <= 0 || normalizedAddress.length === 0) {
    return null;
  }

  return {
    shippingAddressId: id,
    address: normalizedAddress,
    customerId: Number.isFinite(customerId) && customerId > 0 ? customerId : 0,
    createdAt: typeof address.createdAt === 'string' ? address.createdAt : null,
    updatedAt: typeof address.updatedAt === 'string' ? address.updatedAt : null,
  };
};

export async function fetchShippingAddresses(session: SessionCredentials): Promise<ShippingAddress[]> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load shipping addresses.');
  }

  const response = await fetch(buildApiUrl('shipping-addresses'), {
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to load shipping addresses (status ${response.status}).`);
  }

  const json = (await response.json()) as ShippingAddressListResponse | null;

  if (!json || json.status !== 'SUCCESS' || !Array.isArray(json.data)) {
    throw new Error(json?.message ?? 'Failed to load shipping addresses. Please try again.');
  }

  return json.data
    .map((address) => normalizeShippingAddress(address) ?? null)
    .filter((value): value is ShippingAddress => value !== null);
}

export async function createShippingAddress(
  payload: CreateShippingAddressPayload,
  session: SessionCredentials,
): Promise<ShippingAddress> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to create a shipping address.');
  }

  const response = await fetch(buildApiUrl('shipping-addresses'), {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: buildAuthHeader(session),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to create shipping address (status ${response.status}).`);
  }

  const json = (await response.json()) as ShippingAddressResponse | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json?.message ?? 'Failed to create shipping address. Please try again.');
  }

  const normalized = normalizeShippingAddress(json.data);

  if (!normalized) {
    throw new Error('The shipping address returned by the server was invalid.');
  }

  return normalized;
}

export async function deleteShippingAddress(id: number, session: SessionCredentials): Promise<void> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to delete a shipping address.');
  }

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('A valid shipping address identifier is required.');
  }

  const response = await fetch(buildApiUrl(`shipping-addresses/${id}`), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to delete shipping address (status ${response.status}).`);
  }
}

export async function fetchShippingAddressById(
  id: number,
  session: SessionCredentials,
): Promise<ShippingAddress> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load the shipping address.');
  }

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('A valid shipping address identifier is required.');
  }

  const response = await fetch(buildApiUrl(`shipping-addresses/${id}`), {
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to load shipping address (status ${response.status}).`);
  }

  const json = (await response.json()) as ShippingAddressResponse | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json?.message ?? 'Failed to load the shipping address. Please try again.');
  }

  const normalized = normalizeShippingAddress(json.data);

  if (!normalized) {
    throw new Error('The shipping address returned by the server was invalid.');
  }

  return normalized;
}

export { normalizeShippingAddress };
