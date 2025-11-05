import type { ProductDetail, ProductSpecsPayload } from '@/constants/products';
import { products as fallbackProducts } from '@/constants/products';
import { buildApiUrl, enhanceNetworkError } from './api';

type DeviceModelResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: DeviceModelPayload[];
};

type DeviceModelPayload = {
  deviceModelId: number;
  deviceName: string;
  brand: string;
  imageURL: string | null;
  specifications: string | null;
  deviceCategoryId: number;
  deviceValue: number;
  pricePerDay: number;
  depositPercent: number;
  active: boolean;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const CACHE_TTL = 60 * 1000;

let cachedDeviceModels: ProductDetail[] | null = null;
let cacheTimestamp = 0;

const stripWrappingQuotes = (input: string) => input.replace(/^['"]+|['"]+$/g, '');

const parseLooseSpecificationString = (raw: string): ProductSpecsPayload => {
  const segments = raw
    .split(/\r?\n|,|;|\u2022|\|/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return raw;
  }

  const entries = segments.map((segment, index) => {
    const delimiterIndex = segment.indexOf(':');

    if (delimiterIndex === -1) {
      return {
        label: `Spec ${index + 1}`,
        value: stripWrappingQuotes(segment),
      };
    }

    const label = stripWrappingQuotes(segment.slice(0, delimiterIndex).trim());
    const value = stripWrappingQuotes(segment.slice(delimiterIndex + 1).trim());

    return {
      label: label || `Spec ${index + 1}`,
      value: value || '—',
    };
  });

  return entries;
};

const parseSpecifications = (value: string | null): ProductSpecsPayload => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const looksLikeJson = /^[{\[]/.test(trimmed);

  if (looksLikeJson) {
    try {
      return JSON.parse(trimmed) as ProductSpecsPayload;
    } catch {
      // Fall through to loose parsing below when the payload is not valid JSON.
    }
  }

  return parseLooseSpecificationString(trimmed);
};

const mapDeviceModelToProductDetail = (payload: DeviceModelPayload): ProductDetail => ({
  id: String(payload.deviceModelId),
  name: payload.deviceName,
  model: payload.deviceName,
  price: `${CURRENCY_FORMATTER.format(payload.pricePerDay)}/day`,
  brand: payload.brand,
  status: payload.active ? 'Available' : 'Unavailable',
  stock: payload.active ? 10 : 0,
  specs: parseSpecifications(payload.specifications),
  accessories: [],
  relatedProducts: [],
  reviews: [],
  imageURL: payload.imageURL,
  pricePerDay: payload.pricePerDay,
  depositPercent: payload.depositPercent,
  deviceValue: payload.deviceValue,
  deviceCategoryId: payload.deviceCategoryId,
  currency: 'VND',
  source: 'api',
});

export async function fetchDeviceModels(forceRefresh = false): Promise<ProductDetail[]> {
  const now = Date.now();

  if (!forceRefresh && cachedDeviceModels && now - cacheTimestamp < CACHE_TTL) {
    return cachedDeviceModels;
  }

  const endpointUrl = buildApiUrl('device-models');
  let response: Response;

  try {
    response = await fetch(endpointUrl);
  } catch (networkError) {
    throw enhanceNetworkError(networkError, endpointUrl);
  }

  if (!response.ok) {
    throw new Error(`Failed to load device models (status ${response.status}).`);
  }

  const json = (await response.json()) as DeviceModelResponse;

  if (!json || !Array.isArray(json.data)) {
    throw new Error('Unexpected response format when loading device models.');
  }

  const normalized = json.data.map(mapDeviceModelToProductDetail);

  cachedDeviceModels = normalized;
  cacheTimestamp = now;

  return normalized;
}

export async function fetchDeviceModelById(
  id: string,
  options: { forceRefresh?: boolean } = {}
): Promise<ProductDetail | null> {
  if (!id) {
    return null;
  }

  try {
    const devices = await fetchDeviceModels(options.forceRefresh ?? false);
    const match = devices.find((item) => item.id === id);

    if (match) {
      return match;
    }
  } catch (error) {
    console.warn('Unable to fetch device models. Falling back to local data.', error);
  }

  const fallbackMatch = fallbackProducts.find((item) => item.id === id);
  return fallbackMatch ?? null;
}
