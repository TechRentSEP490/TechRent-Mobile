import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import type { ProductDetail } from '@/constants/products';
import { useCart } from '@/contexts/CartContext';

const clampToStartOfDay = (value: Date) => {
  const clone = new Date(value);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const addDays = (value: Date, amount: number) => {
  const clone = new Date(value);
  clone.setDate(clone.getDate() + amount);
  return clone;
};

const formatDisplayDate = (isoDate: string | null) => {
  if (!isoDate) {
    return 'Select date';
  }

  const parsed = new Date(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return 'Select date';
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  if (typeof product.pricePerDay === 'number' && Number.isFinite(product.pricePerDay)) {
    return Math.max(product.pricePerDay, 0);
  }

  const sanitized = product.price.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const parsed = Number.parseFloat(sanitized);
  return Number.isNaN(parsed) ? 0 : parsed;
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

export default function CartScreen() {
  const router = useRouter();
  const {
    items,
    isEmpty,
    removeItem,
    updateItemQuantity,
    rentalStartDate,
    rentalEndDate,
    setRentalStartDate,
    setRentalEndDate,
  } = useCart();
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const startDate = useMemo(
    () => (rentalStartDate ? clampToStartOfDay(new Date(rentalStartDate)) : null),
    [rentalStartDate],
  );
  const endDate = useMemo(
    () => (rentalEndDate ? clampToStartOfDay(new Date(rentalEndDate)) : null),
    [rentalEndDate],
  );

  useEffect(() => {
    if (isEmpty) {
      return;
    }

    if (!rentalStartDate) {
      const today = clampToStartOfDay(new Date());
      const startIso = today.toISOString();
      setRentalStartDate(startIso);

      if (!rentalEndDate || new Date(rentalEndDate).getTime() < today.getTime()) {
        setRentalEndDate(addDays(today, 1).toISOString());
      }
    }
  }, [isEmpty, rentalEndDate, rentalStartDate, setRentalEndDate, setRentalStartDate]);

  const totalsByCurrency = useMemo(() => buildCurrencySummary(items), [items]);
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const rentalRangeLabel = useMemo(() => {
    if (!startDate || !rentalStartDate) {
      return 'Select start date';
    }

    if (!endDate || !rentalEndDate || endDate.getTime() === startDate.getTime()) {
      return formatDisplayDate(rentalStartDate);
    }

    return `${formatDisplayDate(rentalStartDate)} - ${formatDisplayDate(rentalEndDate)}`;
  }, [endDate, rentalEndDate, rentalStartDate, startDate]);

  const handleStartChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) {
      setShowStartPicker(false);
      return;
    }

    const normalized = clampToStartOfDay(selected);
    const isoValue = normalized.toISOString();
    setRentalStartDate(isoValue);

    if (!endDate || normalized.getTime() > endDate.getTime()) {
      setRentalEndDate(addDays(normalized, 1).toISOString());
    }

    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
  };

  const handleEndChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) {
      setShowEndPicker(false);
      return;
    }

    const normalized = clampToStartOfDay(selected);
    const isoValue = normalized.toISOString();

    if (startDate && normalized.getTime() < startDate.getTime()) {
      setRentalEndDate(startDate.toISOString());
    } else {
      setRentalEndDate(isoValue);
    }

    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
  };

  const handleCheckout = () => {
    if (isEmpty) {
      Alert.alert('Cart is empty', 'Add at least one device before proceeding to checkout.');
      return;
    }

    if (!rentalStartDate || !rentalEndDate) {
      Alert.alert('Select rental dates', 'Choose your start and end dates to continue.');
      return;
    }

    router.push('/(app)/checkout');
  };

  const renderTotals = () => {
    const entries = Object.entries(totalsByCurrency);

    if (entries.length === 0) {
      return null;
    }

    return entries.map(([currency, amount]) => (
      <View key={currency} style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Daily Total ({currency})</Text>
        <Text style={styles.summaryValue}>{formatCurrencyValue(amount ?? 0, currency as 'USD' | 'VND')}</Text>
      </View>
    ));
  };

  const minimumEndDate = startDate ? addDays(startDate, 0) : new Date();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {isEmpty ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={56} color="#9c9c9c" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse devices and tap “Add to Cart” to start building your rental order.
          </Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => router.replace('/(app)/(tabs)/home')}>
            <Text style={styles.browseButtonText}>Browse devices</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rental window</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.dateLabel}>Start date</Text>
                <Text style={styles.dateValue}>{formatDisplayDate(rentalStartDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.dateLabel}>End date</Text>
                <Text style={styles.dateValue}>{formatDisplayDate(rentalEndDate)}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dateHelper}>{rentalRangeLabel}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items ({totalQuantity})</Text>
            {items.map((item) => {
              const currency = determineCurrency(item.product);
              const dailyRate = getDailyRate(item.product);
              const lineAmount = dailyRate * item.quantity;

              return (
                <View key={item.productId} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.productId)}>
                      <Ionicons name="trash-outline" size={20} color="#b91c1c" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemModel}>{item.product.model}</Text>
                  <View style={styles.itemFooter}>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => {
                          if (item.quantity <= 1) {
                            removeItem(item.productId);
                          } else {
                            updateItemQuantity(item.productId, item.quantity - 1);
                          }
                        }}
                      >
                        <Ionicons name="remove" size={16} color="#111111" />
                      </TouchableOpacity>
                      <Text style={styles.quantityValue}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateItemQuantity(item.productId, item.quantity + 1)}
                      >
                        <Ionicons name="add" size={16} color="#111111" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.itemPricing}>
                      <Text style={styles.itemPrice}>{formatCurrencyValue(dailyRate, currency)} / day</Text>
                      <Text style={styles.itemTotal}>{formatCurrencyValue(lineAmount, currency)} daily</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Rental window</Text>
              <Text style={styles.summaryValue}>{rentalRangeLabel}</Text>
            </View>
            {renderTotals()}
          </View>
        </ScrollView>
      )}

      {!isEmpty && (
        <View style={styles.footerActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(app)/(tabs)/home')}>
            <Text style={styles.secondaryText}>Continue browsing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleCheckout}>
            <Text style={styles.primaryText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}

      {showStartPicker && (
        <DateTimePicker
          value={startDate ?? clampToStartOfDay(new Date())}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          minimumDate={clampToStartOfDay(new Date())}
          onChange={handleStartChange}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate ?? (startDate ?? clampToStartOfDay(new Date()))}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          minimumDate={minimumEndDate}
          onChange={handleEndChange}
        />
      )}
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
    gap: 24,
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
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  dateLabel: {
    fontSize: 13,
    color: '#6f6f6f',
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginTop: 4,
  },
  dateHelper: {
    fontSize: 14,
    color: '#6f6f6f',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  itemModel: {
    color: '#6f6f6f',
    fontSize: 14,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 14,
    color: '#6f6f6f',
  },
  itemTotal: {
    fontSize: 16,
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
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    paddingVertical: 16,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#6f6f6f',
  },
  browseButton: {
    marginTop: 8,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#111111',
  },
  browseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
