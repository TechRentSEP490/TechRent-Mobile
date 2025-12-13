import type { ProductDetail, ProductSpecsPayload } from '@/constants/products';
import { products as fallbackProducts } from '@/constants/products';
import { buildApiUrl } from './api';
import { fetchBrandMap, getCachedBrandName } from './brands';

type DeviceModelResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: DeviceModelPayload[];
};

type DeviceModelDetailResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: DeviceModelPayload;
};

type DeviceModelPayload = {
  deviceModelId: number;
  deviceName: string;
  description: string | null;
  brandId: number;
  imageURL: string | null;
  specifications: string | null;
  deviceCategoryId: number;
  amountAvailable: number;
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

const formatBrandName = (brandId: number, brandMap: Map<number, { brandName: string }>) => {
  const entry = brandMap.get(brandId);

  if (entry?.brandName) {
    return entry.brandName;
  }

  const cached = getCachedBrandName(brandId);
  if (cached) {
    return cached;
  }

  return brandId ? `Brand #${brandId}` : 'Unknown Brand';
};

const mapDeviceModelToProductDetail = (
  payload: DeviceModelPayload,
  brandMap: Map<number, { brandName: string }>,
): ProductDetail => {
  const brandName = formatBrandName(payload.brandId, brandMap);
  const isAvailable = payload.active && payload.amountAvailable > 0;
  const normalizedStock = Number.isFinite(payload.amountAvailable) ? payload.amountAvailable : 0;
  const depositPercentage = Number.isFinite(payload.depositPercent)
    ? payload.depositPercent * 100
    : undefined;

  return {
    id: String(payload.deviceModelId),
    name: payload.deviceName,
    model: payload.deviceName,
    description: payload.description ?? undefined,
    price: `${CURRENCY_FORMATTER.format(payload.pricePerDay)}/day`,
    brand: brandName,
    status: isAvailable ? 'Available' : 'Unavailable',
    stock: Math.max(0, normalizedStock),
    specs: parseSpecifications(payload.specifications),
    accessories: [],
    relatedProducts: [],
    reviews: [],
    imageURL: payload.imageURL,
    pricePerDay: payload.pricePerDay,
    depositPercent: payload.depositPercent,
    depositPercentage,
    deviceValue: payload.deviceValue,
    deviceCategoryId: payload.deviceCategoryId,
    currency: 'VND',
    source: 'api',
  };
};

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

  const brandMap = await fetchBrandMap();
  const normalized = json.data.map((payload) => mapDeviceModelToProductDetail(payload, brandMap));

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

  const url = buildApiUrl('device-models', id);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load device model (status ${response.status}).`);
    }

    const json = (await response.json()) as DeviceModelDetailResponse;

    if (!json || !json.data) {
      throw new Error('Unexpected response format when loading device model.');
    }

    const brandMap = await fetchBrandMap(options.forceRefresh ?? false);
    const normalized = mapDeviceModelToProductDetail(json.data, brandMap);

    if (cachedDeviceModels) {
      const next = [...cachedDeviceModels];
      const index = next.findIndex((item) => item.id === normalized.id);
      if (index >= 0) {
        next[index] = normalized;
      } else {
        next.push(normalized);
      }
      cachedDeviceModels = next;
      cacheTimestamp = Date.now();
    }

    return normalized;
  } catch (error) {
    console.warn('Unable to fetch device model detail. Falling back to local data.', error);
  }

  const fallbackMatch = fallbackProducts.find((item) => item.id === id);
  return fallbackMatch ?? null;
}

// === Search API ===

export type SearchDeviceModelsParams = {
  deviceName?: string;
  brandId?: number;
  deviceCategoryId?: number;
  isActive?: boolean;
  page?: number;
  size?: number;
};

export type PaginatedSearchResult = {
  content: ProductDetail[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

type SearchApiResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: {
    content: DeviceModelPayload[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    numberOfElements: number;
    last: boolean;
  };
};

export async function searchDeviceModels(
  params: SearchDeviceModelsParams
): Promise<PaginatedSearchResult> {
  const queryParams = new URLSearchParams();

  if (params.deviceName?.trim()) {
    queryParams.append('deviceName', params.deviceName.trim());
  }
  if (typeof params.brandId === 'number') {
    queryParams.append('brandId', String(params.brandId));
  }
  if (typeof params.deviceCategoryId === 'number') {
    queryParams.append('deviceCategoryId', String(params.deviceCategoryId));
  }
  if (typeof params.isActive === 'boolean') {
    queryParams.append('isActive', String(params.isActive));
  }
  queryParams.append('page', String(params.page ?? 0));
  queryParams.append('size', String(params.size ?? 20));

  const url = `${buildApiUrl('device-models/search')}?${queryParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Search failed (status ${response.status}).`);
  }

  const json = (await response.json()) as SearchApiResponse;

  if (!json || !json.data || !Array.isArray(json.data.content)) {
    throw new Error('Unexpected response format when searching device models.');
  }

  const brandMap = await fetchBrandMap();
  const content = json.data.content.map((payload) =>
    mapDeviceModelToProductDetail(payload, brandMap)
  );

  return {
    content,
    page: json.data.page,
    size: json.data.size,
    totalElements: json.data.totalElements,
    totalPages: json.data.totalPages,
    last: json.data.last,
  };
}
