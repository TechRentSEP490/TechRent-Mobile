import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ProductDetail } from '@/constants/products';
import { useDeviceModel } from '@/hooks/use-device-model';
import { useAuth } from '@/contexts/AuthContext';
import { createRentalOrder } from '@/services/rental-orders';

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

export default function CheckoutScreen() {
  const router = useRouter();
  const { productId, quantity: quantityParam, startDate: startParam, endDate: endParam } =
    useLocalSearchParams<{
      productId?: string;
      quantity?: string;
      startDate?: string;
      endDate?: string;
    }>();
  const { data: product, loading, error } = useDeviceModel(productId);
  const { session, user, signOut } = useAuth();

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(typeof quantityParam === 'string' ? quantityParam : '1', 10);
    return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  }, [quantityParam]);

  const rentalStart = typeof startParam === 'string' ? startParam : undefined;
  const rentalEnd = typeof endParam === 'string' ? endParam : undefined;

  const rentalStartDate = useMemo(() => {
    if (!rentalStart) {
      return null;
    }

    const parsed = new Date(rentalStart);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [rentalStart]);

  const rentalEndDate = useMemo(() => {
    if (!rentalEnd) {
      return null;
    }

    const parsed = new Date(rentalEnd);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [rentalEnd]);

  const rentalRangeLabel = useMemo(() => {
    if (!rentalStartDate) {
      return 'Not selected';
    }

    if (!rentalEndDate || rentalEndDate.getTime() === rentalStartDate.getTime()) {
      return formatDisplayDate(rentalStartDate.toISOString());
    }

    return `${formatDisplayDate(rentalStartDate.toISOString())} - ${formatDisplayDate(rentalEndDate.toISOString())}`;
  }, [rentalEndDate, rentalStartDate]);

  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const depositPercent = typeof product.depositPercent === 'number' ? product.depositPercent : 0.12;
  const depositHeldValue = totalAmount * depositPercent;
  const depositHeld = formatCurrencyValue(depositHeldValue, currency);

  const handleOrder = async () => {
    if (isSubmitting) {
      return;
    }

    if (!product) {
      setOrderError('Device information is unavailable. Please try again.');
      return;
    }

    if (!session?.accessToken || !user?.customerId) {
      Alert.alert('Authentication required', 'Please sign in again to place your rental order.');
      router.replace('/(auth)/sign-in');
      return;
    }

    const deviceModelId = Number.parseInt(product.id, 10);

    if (Number.isNaN(deviceModelId)) {
      setOrderError('Unable to determine the selected device. Please try another model.');
      return;
    }

    if (!rentalStartDate || !rentalEndDate) {
      setOrderError('Rental dates are missing. Please return to the product screen and try again.');
      return;
    }

    setOrderError(null);
    setIsSubmitting(true);

    try {
      await createRentalOrder(
        {
          startDate: rentalStartDate.toISOString(),
          endDate: rentalEndDate.toISOString(),
          shippingAddress: 'Pending confirmation',
          customerId: user.customerId,
          orderDetails: [
            {
              quantity,
              deviceModelId,
            },
          ],
        },
        session
      );

      Alert.alert('Rental order created', 'Your rental order has been submitted successfully.', [
        {
          text: 'OK',
          onPress: () =>
            router.replace({
              pathname: '/(app)/product-details',
              params: { productId: product.id },
            }),
        },
      ]);
    } catch (err) {
      const apiError = err as { status?: number };

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

  const isOrderDisabled =
    isSubmitting || !product || !session?.accessToken || !user?.customerId || !rentalStartDate || !rentalEndDate;

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
        {(error || orderError) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{orderError ?? error}</Text>
          </View>
        )}

        {loading && (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color="#111111" />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rental Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Device</Text>
            <Text style={styles.summaryValue}>{product.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Quantity</Text>
            <Text style={styles.summaryValue}>{quantity}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Start Date</Text>
            <Text style={styles.summaryValue}>{
              rentalStartDate ? formatDisplayDate(rentalStartDate.toISOString()) : 'Not selected'
            }</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>End Date</Text>
            <Text style={styles.summaryValue}>{
              rentalEndDate ? formatDisplayDate(rentalEndDate.toISOString()) : 'Not selected'
            }</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rental Range</Text>
            <Text style={styles.summaryValue}>{rentalRangeLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Daily Rental Amount</Text>
            <Text style={styles.summaryValue}>{formattedTotal}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Deposit Held (Daily)</Text>
            <Text style={styles.summaryValue}>{depositHeld}</Text>
          </View>
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
        </View>
      </ScrollView>

      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.orderButton, isOrderDisabled && styles.disabledButton]}
          onPress={handleOrder}
          disabled={isOrderDisabled}
        >
          {isSubmitting ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.orderText}>Order</Text>}
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
    paddingTop: 8,
    paddingBottom: 32,
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
    color: '#6f6f6f',
    fontSize: 15,
  },
  summaryValue: {
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
  backButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111111',
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
