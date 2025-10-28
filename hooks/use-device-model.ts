import { useCallback, useEffect, useState } from 'react';

import type { ProductDetail } from '@/constants/products';
import { products as fallbackProducts } from '@/constants/products';
import { fetchDeviceModelById } from '@/services/device-models';

type UseDeviceModelResult = {
  data: ProductDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useDeviceModel(productId: string | undefined): UseDeviceModelResult {
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(productId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId) {
      setData(fallbackProducts[0] ?? null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    try {
      const product = await fetchDeviceModelById(productId);

      if (!product) {
        throw new Error('Device not found.');
      }

      setData(product);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load device.';
      setError(message);
      const fallback = fallbackProducts.find((item) => item.id === productId) ?? null;
      setData(fallback);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    loading,
    error,
    refetch: load,
  };
}
