import { buildApiUrl } from './api';

export type RentalOrderDetailPayload = {
  quantity: number;
  deviceModelId: number;
};

export type CreateRentalOrderPayload = {
  planStartDate: string;
  planEndDate: string;
  shippingAddress: string;
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

export type SessionCredentials = {
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
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken
        }`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorBody: string | null = null;

    try {
      errorBody = await response.clone().text();
    } catch (cloneError) {
      console.warn('Unable to clone rental order error response body', cloneError);
    }

    console.error('Create rental order request failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
    });

    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to create rental order (status ${response.status}).`);
  }

  const json = (await response.json()) as CreateRentalOrderResult | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json?.message ?? 'Failed to create rental order. Please try again.');
  }

  return json.data;
}

type RentalOrdersListResponse = {
  status: string;
  message: string;
  details?: string;
  code: number;
  data: RentalOrderResponse[] | null;
};

type RentalOrderDetailsResult = {
  status: string;
  message?: string;
  details?: string;
  code: number;
  data: RentalOrderResponse | null;
};

export async function fetchRentalOrders(
  session: SessionCredentials
): Promise<RentalOrderResponse[]> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load rental orders.');
  }

  const response = await fetch(buildApiUrl('rental-orders'), {
    headers: {
      Accept: 'application/json',
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken
        }`,
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to load rental orders (status ${response.status}).`);
  }

  const json = (await response.json()) as RentalOrdersListResponse | null;

  if (!json || json.status !== 'SUCCESS' || !Array.isArray(json.data)) {
    throw new Error(json?.message ?? 'Failed to load rental orders. Please try again.');
  }

  return json.data;
}

export const fetchRentalOrderById = async (
  session: SessionCredentials,
  orderId: number
): Promise<RentalOrderResponse> => {
  if (!session?.accessToken) {
    throw new Error('An access token is required to load the rental order.');
  }

  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new Error('A valid rental order identifier is required to load the rental order.');
  }

  const response = await fetch(buildApiUrl(`rental-orders/${orderId}`), {
    headers: {
      Accept: 'application/json',
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken
        }`,
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(
      apiMessage ?? `Unable to load rental order ${orderId} (status ${response.status}).`,
    );
  }

  const json = (await response.json()) as RentalOrderDetailsResult | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(
      json?.message ?? json?.details ?? 'Failed to load the rental order details. Please try again.',
    );
  }

  return json.data;
};

/**
 * Confirm return of rental order (End Contract)
 * Customer confirms they want to return the rental, triggering the return process
 */
export const confirmReturnRentalOrder = async (
  session: SessionCredentials,
  orderId: number
): Promise<RentalOrderResponse> => {
  if (!session?.accessToken) {
    throw new Error('An access token is required to confirm return.');
  }

  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new Error('A valid rental order identifier is required.');
  }

  const url = buildApiUrl(`rental-orders/${orderId}/confirm-return`);
  console.log('[API] confirmReturnRentalOrder - URL:', url, 'Method: PATCH');

  const response = await fetch(url, {
    method: 'PATCH', // Changed from POST to PATCH to match backend
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken
        }`,
    },
  });

  console.log('[API] confirmReturnRentalOrder - Response status:', response.status);

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    console.error('[API] confirmReturnRentalOrder - Error:', apiMessage);
    throw new Error(
      apiMessage ?? `Unable to confirm return for order ${orderId} (status ${response.status}).`,
    );
  }

  const json = (await response.json()) as RentalOrderDetailsResult | null;
  console.log('[API] confirmReturnRentalOrder - Response:', json?.status, json?.message);

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(
      json?.message ?? json?.details ?? 'Failed to confirm return. Please try again.',
    );
  }

  return json.data;
};

// ============================================================
// EXTEND RENTAL ORDER API
// ============================================================

export type ExtendRentalOrderPayload = {
  rentalOrderId: number;
  extendedEndTime: string; // Format: YYYY-MM-DDTHH:mm:ss (no timezone)
};

/**
 * Extend rental order
 * Creates extension request from existing rental order
 * POST /api/rental-orders/extend
 */
export const extendRentalOrder = async (
  session: SessionCredentials,
  rentalOrderId: number,
  extendedEndTime: string
): Promise<RentalOrderResponse> => {
  if (!session?.accessToken) {
    throw new Error('An access token is required to extend rental order.');
  }

  if (!Number.isFinite(rentalOrderId) || rentalOrderId <= 0) {
    throw new Error('A valid rental order identifier is required.');
  }

  if (!extendedEndTime) {
    throw new Error('Extended end time is required.');
  }

  // Backend expects LocalDateTime format: YYYY-MM-DDTHH:mm:ss (no timezone)
  // Remove timezone suffix (Z or +07:00 etc.)
  const formattedEndTime = extendedEndTime.replace(/[Z+].*$/, '');

  const payload: ExtendRentalOrderPayload = {
    rentalOrderId: Number(rentalOrderId),
    extendedEndTime: formattedEndTime,
  };

  const url = buildApiUrl('rental-orders/extend');
  console.log('[API] extendRentalOrder - URL:', url, 'Payload:', payload);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `${session.tokenType && session.tokenType.length > 0 ? session.tokenType : 'Bearer'} ${session.accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  console.log('[API] extendRentalOrder - Response status:', response.status);

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    console.error('[API] extendRentalOrder - Error:', apiMessage);
    throw new Error(
      apiMessage ?? `Unable to extend rental order ${rentalOrderId} (status ${response.status}).`,
    );
  }

  const json = (await response.json()) as RentalOrderDetailsResult | null;
  console.log('[API] extendRentalOrder - Response:', json?.status, json?.message);

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(
      json?.message ?? json?.details ?? 'Failed to extend rental order. Please try again.',
    );
  }

  return json.data;
};

// ============================================================
// SEARCH API - Pagination và Filtering
// ============================================================

export type SearchRentalOrdersParams = {
  page?: number;
  size?: number;
  orderStatus?: string;
  sort?: string[];
};

export type PaginatedOrdersData = {
  content: RentalOrderResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  numberOfElements: number;
  last: boolean;
};

type SearchRentalOrdersResult = {
  status: string;
  message: string;
  details?: string;
  code: number;
  data: PaginatedOrdersData | null;
};

/**
 * Search rental orders với pagination và filter
 * GET /api/rental-orders/search
 */
export async function searchRentalOrders(
  session: SessionCredentials,
  params: SearchRentalOrdersParams = {}
): Promise<PaginatedOrdersData> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to search rental orders.');
  }

  const { page = 0, size = 10, orderStatus, sort } = params;

  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('size', String(size));

  if (orderStatus && orderStatus !== 'ALL') {
    queryParams.set('orderStatus', orderStatus);
  }

  if (sort && sort.length > 0) {
    sort.forEach((s) => queryParams.append('sort', s));
  }

  const url = `${buildApiUrl('rental-orders/search')}?${queryParams.toString()}`;
  console.log('[Orders] searchRentalOrders URL:', url);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to search rental orders (status ${response.status}).`);
  }

  const json = (await response.json()) as SearchRentalOrdersResult | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json?.message ?? 'Failed to search rental orders. Please try again.');
  }

  return json.data;
}

export const rentalOrdersApi = {
  createRentalOrder,
  fetchRentalOrders,
  fetchRentalOrderById,
  confirmReturnRentalOrder,
  extendRentalOrder,
  searchRentalOrders,
};

export default rentalOrdersApi;
