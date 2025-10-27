import { useCallback, useEffect, useState } from 'react';

import type { ProductDetail } from '@/constants/products';
import { products as fallbackProducts } from '@/constants/products';
import { fetchDeviceModels } from '@/services/device-models';

type UseDeviceModelsResult = {
  data: ProductDetail[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useDeviceModels(): UseDeviceModelsResult {
  const [data, setData] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const devices = await fetchDeviceModels();
      setData(devices);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load device catalog.';
      setError(message);
      setData(fallbackProducts);
    } finally {
      setLoading(false);
    }
  }, []);

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
