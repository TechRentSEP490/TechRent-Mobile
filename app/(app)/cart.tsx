import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ProductDetail } from '@/constants/products';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useDeviceModel } from '@/hooks/use-device-model';
import { createRentalOrder } from '@/services/rental-orders';

const clampToStartOfDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const addDays = (date: Date, days: number) => {
  const base = clampToStartOfDay(date);
  const nextDate = new Date(base);
  nextDate.setDate(base.getDate() + days);
  return clampToStartOfDay(nextDate);
};

const formatDisplayDate = (date: Date) =>
  clampToStartOfDay(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

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

const DATE_SCROLL_ITEM_HEIGHT = 48;
const DATE_SCROLL_VISIBLE_ROWS = 5;
const DATE_SCROLL_RANGE_DAYS = 365;

const createDateSequence = (start: Date, totalDays: number) => {
  const normalizedStart = clampToStartOfDay(start);
  const length = Math.max(totalDays, 1);
  return Array.from({ length }, (_, index) => addDays(normalizedStart, index));
};

const findDateIndex = (dates: Date[], target: Date) =>
  dates.findIndex((item) => item.getTime() === target.getTime());

const parseDateParam = (value: unknown, fallback: Date) => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return clampToStartOfDay(parsed);
    }
  }

  return clampToStartOfDay(fallback);
};

type DateScrollPickerProps = {
  value: Date;
  minimumDate: Date;
  onChange: (date: Date) => void;
  rangeInDays?: number;
};

function DateScrollPicker({ value, minimumDate, onChange, rangeInDays = DATE_SCROLL_RANGE_DAYS }: DateScrollPickerProps) {
  const dates = useMemo(() => createDateSequence(minimumDate, rangeInDays), [minimumDate, rangeInDays]);
  const scrollRef = useRef<ScrollView | null>(null);
  const isInteractingRef = useRef(false);

  const selectedIndex = useMemo(() => {
    const index = findDateIndex(dates, clampToStartOfDay(value));
    if (index >= 0) {
      return index;
    }

    if (dates.length === 0) {
      return 0;
    }

    if (value.getTime() < dates[0].getTime()) {
      return 0;
    }

    return dates.length - 1;
  }, [dates, value]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const targetOffset = selectedIndex * DATE_SCROLL_ITEM_HEIGHT;
    scrollRef.current.scrollTo({ y: targetOffset, animated: !isInteractingRef.current });
  }, [selectedIndex]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const rawIndex = Math.round(offsetY / DATE_SCROLL_ITEM_HEIGHT);
      const clampedIndex = Math.min(Math.max(rawIndex, 0), Math.max(dates.length - 1, 0));
      const nextDate = dates[clampedIndex];

      if (nextDate && nextDate.getTime() !== value.getTime()) {
        onChange(nextDate);
      }

      isInteractingRef.current = false;
    },
    [dates, onChange, value]
  );

  const handleScrollBegin = useCallback(() => {
    isInteractingRef.current = true;
  }, []);

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleMomentumEnd(event);
    },
    [handleMomentumEnd]
  );

  return (
    <View style={styles.dateScrollPickerContainer}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={DATE_SCROLL_ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEndDrag}
        contentContainerStyle={styles.dateScrollContent}
      >
        {dates.map((date) => {
          const key = date.getTime();
          const isSelected = date.getTime() === value.getTime();

          return (
            <View key={key} style={[styles.dateScrollItem, isSelected && styles.dateScrollItemSelected]}>
              <Text style={[styles.dateScrollText, isSelected && styles.dateScrollTextSelected]}>
                {formatDisplayDate(date)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View pointerEvents="none" style={styles.dateScrollHighlight} />
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { productId, quantity: quantityParam, startDate: startParam, endDate: endParam } =
    useLocalSearchParams<{
      productId?: string;
      quantity?: string;
      startDate?: string;
      endDate?: string;
    }>();
  const { data: product, loading, error } = useDeviceModel(productId);
  const { items: cartItems, removeItem, clear } = useCart();

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(typeof quantityParam === 'string' ? quantityParam : '1', 10);
    return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  }, [quantityParam]);

  const fallbackItem = useMemo(() => {
    if (!product) {
      return null;
    }

    return {
      product,
      quantity,
    };
  }, [product, quantity]);

  const items = cartItems.length > 0 ? cartItems : fallbackItem ? [fallbackItem] : [];
  const hasItems = items.length > 0;
  const isContextBacked = cartItems.length > 0;

  const today = clampToStartOfDay(new Date());
  const initialStartDate = parseDateParam(startParam, today);
  const initialEndFallback = addDays(initialStartDate, 1);
  const initialEndDate = parseDateParam(endParam, initialEndFallback);

  const [startDate, setStartDate] = useState<Date>(initialStartDate);
  const [endDate, setEndDate] = useState<Date>(
    initialEndDate.getTime() <= initialStartDate.getTime() ? initialEndFallback : initialEndDate
  );
  const [shippingAddress, setShippingAddress] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minimumStartDate = today;
  const minimumEndDate = useMemo(() => addDays(startDate, 1), [startDate]);
  const isRangeInvalid = endDate.getTime() <= startDate.getTime();

  if (!hasItems && !product) {
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

  const primaryItem = items[0] ?? null;
  const currency = primaryItem ? determineCurrency(primaryItem.product) : 'VND';
  const totalAmount = items.reduce(
    (sum, item) => sum + getDailyRate(item.product) * item.quantity,
    0
  );
  const formattedTotal = hasItems ? formatCurrencyValue(totalAmount, currency) : '—';

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const deviceLabel = hasItems
    ? `${totalQuantity} ${totalQuantity === 1 ? 'device' : 'devices'}`
    : '0 devices';
  const rentalRangeLabel =
    endDate.getTime() === startDate.getTime()
      ? formatDisplayDate(startDate)
      : `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;

  const handleStartDateChange = (nextDate: Date) => {
    const normalized = clampToStartOfDay(nextDate);
    setStartDate(normalized);
    setEndDate((current) => (current.getTime() <= normalized.getTime() ? addDays(normalized, 1) : current));
  };

  const handleEndDateChange = (nextDate: Date) => {
    const normalized = clampToStartOfDay(nextDate);
    if (normalized.getTime() <= startDate.getTime()) {
      setEndDate(addDays(startDate, 1));
      return;
    }

    setEndDate(normalized);
  };

  const hasInvalidItemId = items.some(
    (item) => !Number.isFinite(Number.parseInt(item.product.id, 10))
  );

  const isCheckoutDisabled =
    !hasItems || !shippingAddress.trim() || isRangeInvalid || isSubmitting || hasInvalidItemId;

  const handleCheckout = async () => {
    if (isCheckoutDisabled) {
      return;
    }

    if (!session?.accessToken) {
      Alert.alert('Authentication required', 'Please sign in again to complete your rental.');
      return;
    }

    const orderDetails = items.map((item) => {
      const deviceModelId = Number.parseInt(item.product.id, 10);
      return {
        quantity: item.quantity,
        deviceModelId,
      };
    });

    if (orderDetails.some((detail) => !Number.isFinite(detail.deviceModelId))) {
      setSubmitError('Unable to determine one or more selected devices. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createRentalOrder(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          shippingAddress: shippingAddress.trim(),
          orderDetails,
        },
        {
          accessToken: session.accessToken,
          tokenType: session.tokenType,
        }
      );

      clear();

      Alert.alert(
        'Rental order created',
        "Your rental order was submitted successfully. We'll keep you posted with updates.",
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace({
                pathname: '/(app)/(tabs)/home',
              }),
          },
        ]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create the rental order. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
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
              <Text style={styles.orderTitle}>Rental Summary</Text>
              <Text style={styles.orderSubtitle}>{rentalRangeLabel}</Text>
            </View>
            <TouchableOpacity
              style={[styles.clearButton, (!hasItems || !isContextBacked) && styles.clearButtonDisabled]}
              onPress={clear}
              disabled={!hasItems || !isContextBacked}
              accessibilityRole="button"
              accessibilityLabel="Clear cart"
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={!hasItems || !isContextBacked ? '#d0d0d0' : '#9c9c9c'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.orderBody}>
            {hasItems ? (
              items.map((item) => {
                const itemDailyRate = getDailyRate(item.product);
                const itemTotal = formatCurrencyValue(itemDailyRate * item.quantity, determineCurrency(item.product));
                const itemLabel = item.product.model || item.product.name;

                return (
                  <View key={item.product.id} style={styles.orderItem}>
                    <View style={styles.productBadge}>
                      <Ionicons name="phone-portrait-outline" size={24} color="#6f6f6f" />
                    </View>
                    <View style={styles.productDetails}>
                      <Text style={styles.productName}>{itemLabel}</Text>
                      <Text style={styles.productMeta}>{`Quantity: ${item.quantity}`}</Text>
                    </View>
                    <Text style={styles.productPrice}>{itemTotal}</Text>
                    {isContextBacked ? (
                      <TouchableOpacity
                        style={styles.removeItemButton}
                        onPress={() => removeItem(item.product.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${itemLabel}`}
                      >
                        <Ionicons name="close" size={16} color="#6f6f6f" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyOrderBody}>
                <Text style={styles.emptyOrderText}>Add devices to your cart to create a rental.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Shipping Address</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Enter the address where we should deliver the device"
            placeholderTextColor="#9c9c9c"
            value={shippingAddress}
            onChangeText={setShippingAddress}
            multiline
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Rental Dates</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <DateScrollPicker value={startDate} minimumDate={minimumStartDate} onChange={handleStartDateChange} />
            </View>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>End Date</Text>
              <DateScrollPicker value={endDate} minimumDate={minimumEndDate} onChange={handleEndDateChange} />
            </View>
          </View>
          {isRangeInvalid && (
            <Text style={styles.dateErrorText}>End date must be at least one day after the start date.</Text>
          )}
        </View>

        {submitError && (
          <View style={styles.submitErrorBanner}>
            <Text style={styles.submitErrorText}>{submitError}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkoutButton, (isCheckoutDisabled || isSubmitting) && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={isCheckoutDisabled || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.checkoutText}>Place Rental Order</Text>
          )}
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
    fontSize: 13,
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
    fontWeight: '600',
    color: '#111111',
    marginTop: 4,
  },
  orderCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ededed',
    padding: 18,
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
    marginTop: 4,
    color: '#6f6f6f',
    fontSize: 13,
  },
  orderBody: {
    gap: 12,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
    marginTop: 2,
  },
  productPrice: {
    fontWeight: '600',
    color: '#111111',
  },
  removeItemButton: {
    padding: 4,
    marginLeft: 4,
  },
  emptyOrderBody: {
    paddingVertical: 12,
  },
  emptyOrderText: {
    color: '#6f6f6f',
  },
  clearButton: {
    padding: 8,
    borderRadius: 18,
  },
  clearButtonDisabled: {
    opacity: 0.4,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ededed',
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
    backgroundColor: '#ffffff',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateColumn: {
    flex: 1,
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  dateErrorText: {
    color: '#c53030',
    fontSize: 13,
  },
  dateScrollPickerContainer: {
    width: '100%',
    height: DATE_SCROLL_ITEM_HEIGHT * DATE_SCROLL_VISIBLE_ROWS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fafafa',
  },
  dateScrollContent: {
    paddingVertical: (DATE_SCROLL_ITEM_HEIGHT * DATE_SCROLL_VISIBLE_ROWS - DATE_SCROLL_ITEM_HEIGHT) / 2,
  },
  dateScrollItem: {
    height: DATE_SCROLL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateScrollItemSelected: {
    backgroundColor: '#ffffff',
  },
  dateScrollText: {
    fontSize: 15,
    color: '#6f6f6f',
  },
  dateScrollTextSelected: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  dateScrollHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (DATE_SCROLL_ITEM_HEIGHT * DATE_SCROLL_VISIBLE_ROWS - DATE_SCROLL_ITEM_HEIGHT) / 2,
    height: DATE_SCROLL_ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d4d4d4',
  },
  submitErrorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f5c2c2',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submitErrorText: {
    color: '#c53030',
    fontSize: 14,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
  },
  checkoutButton: {
    flex: 2,
    borderRadius: 14,
    backgroundColor: '#111111',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButtonDisabled: {
    opacity: 0.5,
  },
  checkoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
