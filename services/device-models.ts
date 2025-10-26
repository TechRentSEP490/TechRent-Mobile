import type { ProductDetail, ProductSpecsPayload } from '@/constants/products';
import { products as fallbackProducts } from '@/constants/products';
import { buildApiUrl } from './api';

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

const parseSpecifications = (value: string | null): ProductSpecsPayload => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as ProductSpecsPayload;
  } catch (error) {
    console.warn('Failed to parse specifications payload', error);
    return trimmed;
  }
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

  const response = await fetch(buildApiUrl('device-models'));

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
