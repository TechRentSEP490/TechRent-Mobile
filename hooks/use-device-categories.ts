import { useCallback, useEffect, useState } from 'react';

import { fetchDeviceCategories, type DeviceCategory } from '@/services/device-categories';

type UseDeviceCategoriesResult = {
  data: DeviceCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useDeviceCategories(): UseDeviceCategoriesResult {
  const [data, setData] = useState<DeviceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const categories = await fetchDeviceCategories();
      setData(categories);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load categories.';
      setError(message);
      setData([]);
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
