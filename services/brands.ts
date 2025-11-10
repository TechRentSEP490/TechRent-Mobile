import { buildApiUrl } from './api';

export type BrandPayload = {
  brandId: number;
  brandName: string;
  description: string;
  active: boolean;
};

type BrandResponse = {
  status: string;
  message: string;
  details: string;
  code: number;
  data: BrandPayload[];
};

const CACHE_TTL = 5 * 60 * 1000;

let cachedBrands: BrandPayload[] | null = null;
let cacheTimestamp = 0;

export const fetchBrands = async (forceRefresh = false): Promise<BrandPayload[]> => {
  const now = Date.now();

  if (!forceRefresh && cachedBrands && now - cacheTimestamp < CACHE_TTL) {
    return cachedBrands;
  }

  const response = await fetch(buildApiUrl('brands'));

  if (!response.ok) {
    throw new Error(`Failed to load brands (status ${response.status}).`);
  }

  const json = (await response.json()) as BrandResponse;

  if (!json || !Array.isArray(json.data)) {
    throw new Error('Unexpected response format when loading brands.');
  }

  cachedBrands = json.data;
  cacheTimestamp = now;

  return cachedBrands;
};

export const fetchBrandMap = async (forceRefresh = false): Promise<Map<number, BrandPayload>> => {
  const brands = await fetchBrands(forceRefresh);
  return new Map(brands.map((brand) => [brand.brandId, brand]));
};

export const getCachedBrandName = (brandId: number): string | null => {
  if (!cachedBrands) {
    return null;
  }

  const match = cachedBrands.find((brand) => brand.brandId === brandId);
  return match?.brandName ?? null;
};
