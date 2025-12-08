import { buildApiUrl } from './api';

export type SessionCredentials = {
  accessToken: string;
  tokenType?: string | null;
};

export type PaymentMethod = 'VNPAY' | 'PAYOS';

export type CreatePaymentPayload = {
  orderId: number;
  invoiceType: 'RENT_PAYMENT';
  paymentMethod: PaymentMethod;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  frontendSuccessUrl: string;
  frontendFailureUrl: string;
};

type PaymentSessionResponse = {
  paymentLinkId: string | number | null;
  checkoutUrl: string | null;
  qrCodeUrl: string | null;
  orderCode: string | number | null;
  status: string | null;
};

type PaymentApiResponse = {
  status: string;
  message?: string;
  details?: string;
  code: number;
  data: PaymentSessionResponse | null;
};

export type PaymentSession = {
  paymentLinkId: string | null;
  checkoutUrl: string | null;
  qrCodeUrl: string | null;
  orderCode: string | null;
  status: string | null;
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
    console.warn('Failed to parse payment error response', error);
    return null;
  }
};

const normalizePaymentField = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const normalizePaymentSession = (data: PaymentSessionResponse | null | undefined): PaymentSession => ({
  paymentLinkId: normalizePaymentField(data?.paymentLinkId),
  checkoutUrl:
    typeof data?.checkoutUrl === 'string' && data.checkoutUrl.trim().length > 0
      ? data.checkoutUrl.trim()
      : null,
  qrCodeUrl:
    typeof data?.qrCodeUrl === 'string' && data.qrCodeUrl.trim().length > 0
      ? data.qrCodeUrl.trim()
      : null,
  orderCode: normalizePaymentField(data?.orderCode),
  status: normalizePaymentField(data?.status),
});

export async function createPayment(
  payload: CreatePaymentPayload,
  session: SessionCredentials,
): Promise<PaymentSession> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to create a payment.');
  }

  if (!Number.isFinite(payload?.orderId) || payload.orderId <= 0) {
    throw new Error('A valid order identifier is required to create a payment.');
  }

  if (!Number.isFinite(payload?.amount) || payload.amount <= 0) {
    throw new Error('A positive payment amount is required.');
  }

  const requestBody = {
    ...payload,
    description: payload.description?.trim()?.length ? payload.description.trim() : `Rent payment for order #${payload.orderId}`,
  };

  const response = await fetch(buildApiUrl('v1', 'payments'), {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: buildAuthHeader(session),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorBody: string | null = null;

    try {
      errorBody = await response.clone().text();
    } catch (cloneError) {
      console.warn('Unable to clone payment error response body', cloneError);
    }

    console.error('Create payment request failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
    });

    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to create payment (status ${response.status}).`);
  }

  const json = (await response.json()) as PaymentApiResponse | null;

  if (!json || json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json?.message ?? json?.details ?? 'Failed to create the payment. Please try again.');
  }

  return normalizePaymentSession(json.data);
}

// Invoice types
export type Invoice = {
  invoiceId: number;
  rentalOrderId: number;
  invoiceType: string;
  paymentMethod: string;
  invoiceStatus: string;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  depositApplied: number;
  paymentDate: string | null;
  dueDate: string | null;
  issueDate: string | null;
  pdfUrl: string | null;
};

type InvoiceApiResponse = {
  status: string;
  message?: string;
  details?: string;
  code: number;
  data: Invoice | Invoice[] | null;
};

/**
 * Get invoice(s) by rental order ID
 * Returns invoice details including invoiceStatus
 */
export async function getInvoiceByRentalOrderId(
  session: SessionCredentials,
  rentalOrderId: number,
): Promise<Invoice[]> {
  if (!session?.accessToken) {
    throw new Error('An access token is required to get invoice.');
  }

  if (!Number.isFinite(rentalOrderId) || rentalOrderId <= 0) {
    throw new Error('A valid rental order ID is required.');
  }

  const response = await fetch(buildApiUrl('v1', `payments/invoice/${rentalOrderId}`), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthHeader(session),
    },
  });

  if (!response.ok) {
    const apiMessage = await parseErrorMessage(response);
    throw new Error(apiMessage ?? `Unable to get invoice for order ${rentalOrderId} (status ${response.status}).`);
  }

  const json = (await response.json()) as InvoiceApiResponse | null;

  if (!json || json.status !== 'SUCCESS') {
    throw new Error(json?.message ?? json?.details ?? 'Failed to get invoice.');
  }

  // API may return a single invoice or an array
  if (Array.isArray(json.data)) {
    return json.data;
  } else if (json.data) {
    return [json.data];
  }

  return [];
}

export default createPayment;
