import { buildApiUrl } from './api';

export type RentalOrderDetailPayload = {
  quantity: number;
  deviceModelId: number;
};

export type CreateRentalOrderPayload = {
  startDate: string;
  endDate: string;
  shippingAddress: string;
  customerId: number;
  orderDetails: RentalOrderDetailPayload[];
};

export type RentalOrderDetailResponse = {
  orderDetailId: number;
  quantity: number;
  pricePerDay: number;
  depositAmountPerUnit: number;
  deviceModelId: number;
};

export type RentalOrderResponse = {
  orderId: number;
  startDate: string;
  endDate: string;
  shippingAddress: string;
  orderStatus: string;
  depositAmount: number;
  depositAmountHeld: number;
  depositAmountUsed: number;
  depositAmountRefunded: number;
  totalPrice: number;
  pricePerDay: number;
  createdAt: string;
  customerId: number;
  orderDetails: RentalOrderDetailResponse[];
};

export type CreateRentalOrderResult = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: RentalOrderResponse | null;
};

export type FetchRentalOrdersResult = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: RentalOrderResponse[] | null;
};

type SessionCredentials = {
  accessToken: string;
  tokenType?: string | null;
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
    console.warn('Failed to parse rental order error response', error);
    return null;
  }
};

type ApiErrorWithStatus = Error & { status?: number };

export async function createRentalOrder(
  payload: CreateRentalOrderPayload,
  session: SessionCredentials
): Promise<RentalOrderResponse> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to create a rental order.');
  }

  const response = await fetch(buildApiUrl('rental-orders'), {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${
        session.accessToken
      }`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    const error = new Error(
      apiMessage ?? `Unable to create rental order (status ${response.status}).`
    ) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as CreateRentalOrderResult | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    const error = new Error(json?.message ?? 'Failed to create rental order. Please try again.') as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return json.data;
}

export async function fetchRentalOrders(session: SessionCredentials): Promise<RentalOrderResponse[]> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load rental orders.');
  }

  const response = await fetch(buildApiUrl('rental-orders'), {
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
      apiMessage ?? `Unable to load rental orders (status ${response.status}).`
    ) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const json = (await response.json()) as FetchRentalOrdersResult | null;

  if (!json || json.status !== 'SUCCESS' || !Array.isArray(json.data)) {
    const error = new Error(
      json?.message ?? 'Failed to load rental orders. Please try again.'
    ) as ApiErrorWithStatus;
    if (typeof json?.code === 'number') {
      error.status = json.code;
    }
    throw error;
  }

  return json.data;
}
