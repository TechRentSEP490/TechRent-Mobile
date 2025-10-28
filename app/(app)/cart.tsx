import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ProductDetail } from '@/constants/products';
import { useDeviceModel } from '@/hooks/use-device-model';

const formatDisplayDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const normalizeDateParam = (value: string | string[] | undefined): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const attemptParse = (input: string) => {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  return (
    attemptParse(trimmed) ??
    attemptParse(`${trimmed}T00:00:00.000Z`) ??
    attemptParse(`${trimmed}T00:00:00`)
  );
};

const formatCurrencyValue = (value: number, currency: 'USD' | 'VND') =>
  new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value);

const determineCurrency = (product: ProductDetail): 'USD' | 'VND' => {
  if (product.currency) {
    return product.currency;
  }

  return product.price.includes('$') ? 'USD' : 'VND';
};

const getDailyRate = (product: ProductDetail) => {
  if (typeof product.pricePerDay === 'number' && product.pricePerDay > 0) {
    return product.pricePerDay;
  }

  const sanitized = product.price.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const parsed = Number.parseFloat(sanitized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function CartScreen() {
  const router = useRouter();
  const { productId: productIdParam, quantity: quantityParam, startDate: startParam, endDate: endParam } =
    useLocalSearchParams();

  const productId = Array.isArray(productIdParam) ? productIdParam[0] : productIdParam;
  const { data: product, loading, error } = useDeviceModel(productId);

  const quantity = useMemo(() => {
    const raw = Array.isArray(quantityParam) ? quantityParam[0] : quantityParam;
    const parsed = Number.parseInt(typeof raw === 'string' ? raw : '1', 10);
    return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  }, [quantityParam]);

  const fallbackStartIso = useMemo(() => {
    const initial = new Date();
    initial.setHours(0, 0, 0, 0);
    return initial.toISOString();
  }, []);

  const startDateIso = useMemo(
    () => normalizeDateParam(startParam) ?? fallbackStartIso,
    [fallbackStartIso, startParam]
  );

  const endDateIso = useMemo(() => {
    const normalized = normalizeDateParam(endParam);

    if (!normalized) {
      return startDateIso;
    }

    const startTime = new Date(startDateIso).getTime();
    const endTime = new Date(normalized).getTime();

    if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
      return startDateIso;
    }

    return normalized;
  }, [endParam, startDateIso]);

  const isSingleDay = new Date(startDateIso).getTime() === new Date(endDateIso).getTime();

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.loadingState}>
          {loading ? (
            <ActivityIndicator size="large" color="#111111" />
          ) : (
            <Text style={styles.loadingStateText}>Device not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const currency = determineCurrency(product);
  const dailyRate = getDailyRate(product);
  const totalAmount = dailyRate * quantity;
  const formattedTotal = formatCurrencyValue(totalAmount, currency);

  const productLabel = product.model || product.name;
  const deviceLabel = `${quantity} ${quantity === 1 ? 'device' : 'devices'}`;
  const rentalRangeLabel = isSingleDay
    ? formatDisplayDate(startDateIso)
    : `${formatDisplayDate(startDateIso)} - ${formatDisplayDate(endDateIso)}`;

  const handleCheckout = () => {
    router.push({
      pathname: '/(app)/checkout',
      params: {
        productId: product.id,
        quantity: String(quantity),
        startDate: startDateIso,
        endDate: endDateIso,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {loading && (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color="#111111" />
          </View>
        )}

        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total Items</Text>
            <Text style={styles.summaryValue}>{deviceLabel}</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryLabel}>Daily Total</Text>
            <Text style={styles.summaryAmount}>{formattedTotal}</Text>
          </View>
        </View>

        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderTitle}>Order #001</Text>
              <Text style={styles.orderSubtitle}>{rentalRangeLabel}</Text>
            </View>
            <Ionicons name="trash-outline" size={20} color="#9c9c9c" />
          </View>

          <View style={styles.orderBody}>
            <View style={styles.productBadge}>
              <Ionicons name="phone-portrait-outline" size={24} color="#6f6f6f" />
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{productLabel}</Text>
              <Text style={styles.productMeta}>{`Quantity: ${quantity}`}</Text>
            </View>
            <Text style={styles.productPrice}>{formattedTotal}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  loadingStateText: {
    color: '#6f6f6f',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
    gap: 20,
  },
  errorBanner: {
    borderRadius: 12,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#f5c2c2',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorBannerText: {
    color: '#c53030',
    fontSize: 14,
  },
  loaderRow: {
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededed',
  },
  summaryLabel: {
    color: '#6f6f6f',
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
    marginTop: 4,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginTop: 4,
  },
  orderCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ededed',
    padding: 20,
    backgroundColor: '#ffffff',
    gap: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  orderSubtitle: {
    color: '#6f6f6f',
    marginTop: 4,
  },
  orderBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  productBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  productMeta: {
    color: '#6f6f6f',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  checkoutButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    paddingVertical: 16,
  },
  checkoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
