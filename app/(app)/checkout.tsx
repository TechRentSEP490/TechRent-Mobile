import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import type { ProductDetail } from '@/constants/products';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { createRentalOrder, type RentalOrderDetailPayload } from '@/services/rental-orders';

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
  if (typeof product.pricePerDay === 'number' && Number.isFinite(product.pricePerDay)) {
    return Math.max(product.pricePerDay, 0);
  }

  const sanitized = product.price.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const parsed = Number.parseFloat(sanitized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDisplayDate = (isoDate: string | null | undefined) => {
  if (!isoDate) {
    return 'Not selected';
  }

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not selected';
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const buildCurrencySummary = (items: ReturnType<typeof useCart>['items']) =>
  items.reduce(
    (accumulator, item) => {
      const currency = determineCurrency(item.product);
      const amount = getDailyRate(item.product) * item.quantity;
      accumulator[currency] = (accumulator[currency] ?? 0) + amount;
      return accumulator;
    },
    {} as Partial<Record<'USD' | 'VND', number>>,
  );

const buildDepositSummary = (items: ReturnType<typeof useCart>['items']) =>
  items.reduce(
    (accumulator, item) => {
      const currency = determineCurrency(item.product);
      const depositPercent =
        typeof item.product.depositPercent === 'number' && item.product.depositPercent > 0
          ? item.product.depositPercent
          : 0.12;
      const amount = getDailyRate(item.product) * item.quantity * depositPercent;
      accumulator[currency] = (accumulator[currency] ?? 0) + amount;
      return accumulator;
    },
    {} as Partial<Record<'USD' | 'VND', number>>,
  );

const extractShippingAddress = (user: ReturnType<typeof useAuth>['user']) => {
  if (!user || !Array.isArray(user.shippingAddresses) || user.shippingAddresses.length === 0) {
    return null;
  }

  const primary = user.shippingAddresses[0];

  if (!primary || typeof primary !== 'object') {
    return null;
  }

  const record = primary as Record<string, unknown>;
  const preferredKeys = [
    'addressLine1',
    'addressLine2',
    'street',
    'ward',
    'district',
    'city',
    'province',
    'state',
    'country',
    'postalCode',
  ];

  const parts: string[] = [];

  preferredKeys.forEach((key) => {
    const value = record[key];

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (trimmed.length > 0 && !parts.includes(trimmed)) {
        parts.push(trimmed);
      }
    }
  });

  if (parts.length > 0) {
    return parts.join(', ');
  }

  const fallbackValue = Object.values(record).find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof fallbackValue === 'string' ? fallbackValue.trim() : null;
};

const normalizeIsoDate = (input: string) => {
  const parsed = new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { session, user, signOut, ensureSession } = useAuth();
  const { items, rentalStartDate, rentalEndDate, clearCart } = useCart();
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customerId = typeof user?.customerId === 'number' ? user.customerId : null;
  const derivedShippingAddress = useMemo(() => extractShippingAddress(user), [user]);
  const rentalRangeLabel = useMemo(() => {
    if (!rentalStartDate) {
      return 'Not selected';
    }

    const start = new Date(rentalStartDate);

    if (Number.isNaN(start.getTime())) {
      return 'Not selected';
    }

    if (!rentalEndDate) {
      return formatDisplayDate(rentalStartDate);
    }

    const end = new Date(rentalEndDate);

    if (Number.isNaN(end.getTime()) || end.getTime() === start.getTime()) {
      return formatDisplayDate(rentalStartDate);
    }

    return `${formatDisplayDate(rentalStartDate)} - ${formatDisplayDate(rentalEndDate)}`;
  }, [rentalEndDate, rentalStartDate]);

  const orderDetails = useMemo(() => {
    const details: RentalOrderDetailPayload[] = [];

    items.forEach((item) => {
      const deviceModelId = Number.parseInt(item.product.id, 10);

      if (!Number.isFinite(deviceModelId) || deviceModelId <= 0) {
        return;
      }

      details.push({
        quantity: item.quantity,
        deviceModelId,
      });
    });

    return details;
  }, [items]);

  const invalidItemCount = items.length - orderDetails.length;
  const totalsByCurrency = useMemo(() => buildCurrencySummary(items), [items]);
  const depositByCurrency = useMemo(() => buildDepositSummary(items), [items]);
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const orderBlockers = useMemo(() => {
    const reasons: string[] = [];

    if (isSubmitting) {
      reasons.push('Submission already in progress');
    }

    if (items.length === 0) {
      reasons.push('Your cart is empty');
    }

    if (!session?.accessToken) {
      reasons.push('Missing access token — user is not authenticated');
    }

    if (!rentalStartDate) {
      reasons.push('Rental start date has not been selected');
    }

    if (!rentalEndDate) {
      reasons.push('Rental end date has not been selected');
    }

    if (invalidItemCount > 0) {
      reasons.push('Some items are missing a valid device identifier');
    }

    return reasons;
  }, [invalidItemCount, isSubmitting, items.length, rentalEndDate, rentalStartDate, session?.accessToken]);

  const handleOrder = async () => {
    if (isSubmitting) {
      return;
    }

    if (items.length === 0) {
      setOrderError('Your cart is empty. Add devices before placing an order.');
      return;
    }

    if (!rentalStartDate || !rentalEndDate) {
      setOrderError('Rental dates are missing. Return to the cart to select a rental window.');
      return;
    }

    const normalizedStart = normalizeIsoDate(rentalStartDate);
    const normalizedEnd = normalizeIsoDate(rentalEndDate);

    if (!normalizedStart || !normalizedEnd) {
      setOrderError('Selected rental dates are invalid. Please reselect your rental window in the cart.');
      return;
    }

    if (new Date(normalizedEnd).getTime() <= new Date(normalizedStart).getTime()) {
      setOrderError('Rental end date must be after the start date. Please adjust your rental window.');
      return;
    }

    if (orderDetails.length === 0) {
      setOrderError('No valid devices found in your cart. Please try adding them again.');
      return;
    }

    setOrderError(null);
    setIsSubmitting(true);

    try {
      const activeSession = await ensureSession();

      if (!activeSession?.accessToken) {
        Alert.alert('Authentication required', 'Please sign in again to complete your rental order.');
        router.replace('/(auth)/sign-in');
        return;
      }

      await createRentalOrder(
        {
          startDate: normalizedStart,
          endDate: normalizedEnd,
          shippingAddress: derivedShippingAddress ?? 'Pending confirmation',
          orderDetails,
          customerId,
        },
        activeSession,
      );

      clearCart();

      Alert.alert('Rental order created', 'Your rental order has been submitted successfully.', [
        {
          text: 'OK',
          onPress: () => router.replace('/(app)/(tabs)/orders'),
        },
      ]);
    } catch (err) {
      const apiError = err as { status?: number; message?: string };

      if (apiError?.status === 401) {
        await signOut();
        Alert.alert('Session expired', 'Please sign in again to place your rental order.', [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/sign-in'),
          },
        ]);
        return;
      }

      const message = err instanceof Error ? err.message : 'Failed to create rental order. Please try again.';
      setOrderError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCurrencySummary = (summary: Partial<Record<'USD' | 'VND', number>>, label: string) => {
    const entries = Object.entries(summary);

    if (entries.length === 0) {
      return null;
    }

    return entries.map(([currency, amount]) => (
      <View key={`${label}-${currency}`} style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{`${label} (${currency})`}</Text>
        <Text style={styles.summaryValue}>{formatCurrencyValue(amount ?? 0, currency as 'USD' | 'VND')}</Text>
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {orderError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{orderError}</Text>
          </View>
        )}

        {orderBlockers.length > 0 && (
          <View style={styles.diagnosticsContainer}>
            <Text style={styles.diagnosticsTitle}>Order requirements</Text>
            {orderBlockers.map((reason) => (
              <View key={reason} style={styles.diagnosticsRow}>
                <View style={styles.diagnosticsBullet} />
                <Text style={styles.diagnosticsText}>{reason}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rental Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rental window</Text>
            <Text style={styles.summaryValue}>{rentalRangeLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total items</Text>
            <Text style={styles.summaryValue}>{totalQuantity}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Start date</Text>
            <Text style={styles.summaryValue}>{formatDisplayDate(rentalStartDate)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>End date</Text>
            <Text style={styles.summaryValue}>{formatDisplayDate(rentalEndDate)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.length === 0 ? (
            <Text style={styles.emptyItemsText}>Your cart is empty.</Text>
          ) : (
            items.map((item) => {
              const currency = determineCurrency(item.product);
              const dailyRate = getDailyRate(item.product);
              return (
                <View key={item.productId} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemMeta}>{`Model: ${item.product.model}`}</Text>
                  </View>
                  <View style={styles.itemPricing}>
                    <Text style={styles.itemQuantity}>{`Qty ${item.quantity}`}</Text>
                    <Text style={styles.itemAmount}>{formatCurrencyValue(dailyRate * item.quantity, currency)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing Summary</Text>
          {renderCurrencySummary(totalsByCurrency, 'Daily rental total')}
          {renderCurrencySummary(depositByCurrency, 'Deposit held (daily)')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Username</Text>
            <Text style={styles.summaryValue}>{user?.username ?? 'Unknown'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Email</Text>
            <Text style={styles.summaryValue}>{user?.email ?? 'Not provided'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phone</Text>
            <Text style={styles.summaryValue}>{user?.phoneNumber ?? 'Not provided'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping address</Text>
            <Text style={[styles.summaryValue, styles.summaryValueMultiline]}>
              {derivedShippingAddress ?? 'Pending confirmation'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.orderButton, (orderBlockers.length > 0 || isSubmitting) && styles.disabledButton]}
          onPress={handleOrder}
          disabled={orderBlockers.length > 0 || isSubmitting}
        >
          {isSubmitting ? <Text style={styles.orderText}>Submitting…</Text> : <Text style={styles.orderText}>Order</Text>}
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
  diagnosticsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 16,
    gap: 12,
  },
  diagnosticsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  diagnosticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  diagnosticsBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#111111',
  },
  diagnosticsText: {
    flex: 1,
    color: '#6f6f6f',
    fontSize: 14,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ededed',
    padding: 20,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6f6f6f',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  summaryValueMultiline: {
    flex: 1,
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#f1f1f1',
    gap: 12,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  itemMeta: {
    color: '#6f6f6f',
    fontSize: 13,
  },
  itemPricing: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#6f6f6f',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  emptyItemsText: {
    color: '#6f6f6f',
    fontSize: 14,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  orderButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    paddingVertical: 16,
  },
  orderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
