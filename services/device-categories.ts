import { buildApiUrl } from './api';

export type DeviceCategory = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};

type DeviceCategoriesResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: DeviceCategoryPayload[];
};

type DeviceCategoryResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: DeviceCategoryPayload;
};

type DeviceCategoryPayload = {
  deviceCategoryId: number;
  deviceCategoryName: string;
  description: string | null;
  active: boolean;
};

const CACHE_TTL = 60 * 1000;

let cachedCategories: DeviceCategory[] | null = null;
let categoriesTimestamp = 0;
const detailCache = new Map<string, DeviceCategory>();

const mapCategory = (payload: DeviceCategoryPayload): DeviceCategory => ({
  id: String(payload.deviceCategoryId),
  name: payload.deviceCategoryName,
  description: payload.description?.trim() ?? '',
  active: payload.active,
});

export async function fetchDeviceCategories(forceRefresh = false): Promise<DeviceCategory[]> {
  const now = Date.now();

  if (!forceRefresh && cachedCategories && now - categoriesTimestamp < CACHE_TTL) {
    return cachedCategories;
  }

  const response = await fetch(buildApiUrl('device-categories'));

  if (!response.ok) {
    throw new Error(`Failed to load device categories (status ${response.status}).`);
  }

  const json = (await response.json()) as DeviceCategoriesResponse;

  if (!json || !Array.isArray(json.data)) {
    throw new Error('Unexpected response format when loading device categories.');
  }

  const normalized = json.data.map(mapCategory);

  cachedCategories = normalized;
  categoriesTimestamp = now;
  normalized.forEach((category) => {
    detailCache.set(category.id, category);
  });

  return normalized;
}

export async function fetchDeviceCategoryById(
  id: string,
  options: { forceRefresh?: boolean } = {},
): Promise<DeviceCategory> {
  if (!id) {
    throw new Error('Category id is required.');
  }

  const categoryId = String(id);

  if (!options.forceRefresh && detailCache.has(categoryId)) {
    return detailCache.get(categoryId)!;
  }

  const response = await fetch(buildApiUrl('device-categories', categoryId));

  if (!response.ok) {
    throw new Error(`Failed to load device category (status ${response.status}).`);
  }

  const json = (await response.json()) as DeviceCategoryResponse;

  if (!json || !json.data) {
    throw new Error('Unexpected response format when loading device category.');
  }

  const normalized = mapCategory(json.data);
  detailCache.set(categoryId, normalized);

  return normalized;
}
