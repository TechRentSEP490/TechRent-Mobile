import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

const getDepositRatio = (product: ProductDetail) => {
  if (typeof product.depositPercent === 'number') {
    return product.depositPercent;
  }

  if (typeof product.depositPercentage === 'number') {
    return product.depositPercentage / 100;
  }

  return null;
};

const getDeviceValue = (product: ProductDetail) => {
  if (typeof product.deviceValue === 'number' && Number.isFinite(product.deviceValue)) {
    return product.deviceValue;
  }

  return null;
};

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

const parseDateParam = (value: unknown, fallback: Date) => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return clampToStartOfDay(parsed);
    }
  }

  return clampToStartOfDay(fallback);
};

const startOfMonth = (date: Date) => {
  const firstDay = clampToStartOfDay(date);
  firstDay.setDate(1);
  return clampToStartOfDay(firstDay);
};

const addMonths = (date: Date, months: number) => {
  const base = startOfMonth(date);
  const next = new Date(base);
  next.setMonth(base.getMonth() + months);
  return startOfMonth(next);
};

const endOfMonth = (date: Date) => addDays(addMonths(startOfMonth(date), 1), -1);

const isSameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

const generateCalendarDays = (monthStart: Date) => {
  const firstDayOfMonth = startOfMonth(monthStart);
  const firstWeekday = firstDayOfMonth.getDay();
  const calendarStart = addDays(firstDayOfMonth, -firstWeekday);
  return Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DatePickerFieldProps = {
  value: Date;
  minimumDate: Date;
  onChange: (date: Date) => void;
};

function DatePickerField({ value, minimumDate, onChange }: DatePickerFieldProps) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(value));
  const normalizedMinimum = useMemo(() => clampToStartOfDay(minimumDate), [minimumDate]);

  useEffect(() => {
    if (!isPickerVisible) {
      setActiveMonth(startOfMonth(value));
    }
  }, [isPickerVisible, value]);

  const calendarDays = useMemo(() => generateCalendarDays(activeMonth), [activeMonth]);

  const handleOpen = () => {
    setIsPickerVisible(true);
  };

  const handleClose = () => {
    setIsPickerVisible(false);
  };

  const handleSelect = (nextDate: Date) => {
    const normalized = clampToStartOfDay(nextDate);
    if (normalized.getTime() < normalizedMinimum.getTime()) {
      return;
    }

    setIsPickerVisible(false);
    onChange(normalized);
  };

  const goToPreviousMonth = () => {
    setActiveMonth((current) => addMonths(current, -1));
  };

  const goToNextMonth = () => {
    setActiveMonth((current) => addMonths(current, 1));
  };

  const canNavigatePrev = useMemo(() => {
    const previousMonthEnd = endOfMonth(addMonths(activeMonth, -1));
    return previousMonthEnd.getTime() >= normalizedMinimum.getTime();
  }, [activeMonth, normalizedMinimum]);

  return (
    <>
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel="Select date"
        activeOpacity={0.85}
      >
        <Ionicons name="calendar-outline" size={18} color="#6f6f6f" style={styles.datePickerIcon} />
        <Text style={styles.datePickerValue}>{formatDisplayDate(value)}</Text>
      </TouchableOpacity>

      {isPickerVisible && (
        <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
          <View style={styles.datePickerModalBackdrop}>
            <View style={styles.datePickerModalContent}>
              <View style={styles.datePickerModalHeader}>
                <TouchableOpacity
                  style={[styles.datePickerModalButton, !canNavigatePrev && styles.datePickerModalButtonDisabled]}
                  onPress={canNavigatePrev ? goToPreviousMonth : undefined}
                  disabled={!canNavigatePrev}
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={!canNavigatePrev ? '#c5c5c5' : '#111111'}
                  />
                </TouchableOpacity>
                <Text style={styles.datePickerModalTitle}>
                  {activeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity
                  style={styles.datePickerModalButton}
                  onPress={goToNextMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                >
                  <Ionicons name="chevron-forward" size={20} color="#111111" />
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerWeekdaysRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.datePickerWeekday}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.datePickerDaysGrid}>
                {calendarDays.map((day) => {
                  const isFromCurrentMonth = day.getMonth() === activeMonth.getMonth();
                  const isDisabled = day.getTime() < normalizedMinimum.getTime();
                  const isSelected = isSameDay(day, value);

                  return (
                    <TouchableOpacity
                      key={day.getTime()}
                      style={[
                        styles.datePickerDayButton,
                        !isFromCurrentMonth && styles.datePickerDayOutside,
                        isSelected && styles.datePickerDaySelected,
                        isDisabled && styles.datePickerDayDisabled,
                      ]}
                      onPress={() => handleSelect(day)}
                      disabled={isDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={formatDisplayDate(day)}
                    >
                      <Text
                        style={[
                          styles.datePickerDayText,
                          !isFromCurrentMonth && styles.datePickerDayTextOutside,
                          isSelected && styles.datePickerDayTextSelected,
                          isDisabled && styles.datePickerDayTextDisabled,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.datePickerCloseButton}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
              >
                <Text style={styles.datePickerCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
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
  const { items: cartItems, updateQuantity, removeItem, clear } = useCart();

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

  const items = useMemo(() => {
    if (cartItems.length > 0) {
      return cartItems;
    }

    return fallbackItem ? [fallbackItem] : [];
  }, [cartItems, fallbackItem]);
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

  const summaryCurrency = useMemo(() => {
    if (!hasItems) {
      return null;
    }

    const uniqueCurrencies = new Set<ReturnType<typeof determineCurrency>>(
      items.map((item) => determineCurrency(item.product))
    );

    if (uniqueCurrencies.size !== 1) {
      return null;
    }

    return uniqueCurrencies.values().next().value ?? null;
  }, [hasItems, items]);

  const totalAmount =
    summaryCurrency !== null
      ? items.reduce((sum, item) => sum + getDailyRate(item.product) * item.quantity, 0)
      : null;
  const formattedTotal =
    hasItems && totalAmount !== null && summaryCurrency
      ? formatCurrencyValue(totalAmount, summaryCurrency)
      : '—';

  const { depositTotalLabel, deviceValueTotalLabel } = useMemo(() => {
    if (!hasItems || summaryCurrency === null) {
      return {
        depositTotalLabel: '—',
        deviceValueTotalLabel: '—',
      };
    }

    let depositSum = 0;
    let hasDepositAmount = false;
    let deviceValueSum = 0;
    let hasDeviceValue = false;

    items.forEach((item) => {
      const depositRatio = getDepositRatio(item.product);
      const deviceValue = getDeviceValue(item.product);

      if (depositRatio !== null && deviceValue !== null) {
        depositSum += depositRatio * deviceValue * item.quantity;
        hasDepositAmount = true;
      }

      if (deviceValue !== null) {
        deviceValueSum += deviceValue * item.quantity;
        hasDeviceValue = true;
      }
    });

    return {
      depositTotalLabel:
        hasDepositAmount && summaryCurrency
          ? formatCurrencyValue(depositSum, summaryCurrency)
          : '—',
      deviceValueTotalLabel:
        hasDeviceValue && summaryCurrency
          ? formatCurrencyValue(deviceValueSum, summaryCurrency)
          : '—',
    };
  }, [hasItems, items, summaryCurrency]);

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
      const createdOrder = await createRentalOrder(
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

      const normalizedStatus = (createdOrder.orderStatus ?? '').toUpperCase();

      if (normalizedStatus === 'PENDING_KYC' || normalizedStatus === 'PENDING_KYX') {
        const goToOrders = () =>
          router.replace({
            pathname: '/(app)/(tabs)/orders',
            params: { flow: 'continue', orderId: String(createdOrder.orderId) },
          });

        Alert.alert(
          'Complete your KYC',
          'Your rental order is pending identity verification. Would you like to finish your KYC now?',
          [
            {
              text: 'Later',
              style: 'cancel',
              onPress: goToOrders,
            },
            {
              text: 'Start KYC',
              onPress: () => router.replace('/(app)/kyc-documents'),
            },
          ],
          {
            cancelable: true,
            onDismiss: goToOrders,
          }
        );

        return;
      }

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
          {[
            { label: 'Total Items', value: deviceLabel },
            { label: 'Daily Total', value: formattedTotal },
            { label: 'Deposit Total', value: depositTotalLabel },
            { label: 'Device Value Total', value: deviceValueTotalLabel },
          ].map((metric) => (
            <View key={metric.label} style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>{metric.label}</Text>
              <Text style={styles.summaryValue}>{metric.value}</Text>
            </View>
          ))}
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
                const itemCurrency = determineCurrency(item.product);
                const itemDailyRate = getDailyRate(item.product);
                const itemLineTotal = formatCurrencyValue(itemDailyRate * item.quantity, itemCurrency);
                const itemLabel = item.product.model || item.product.name;
                const itemDailyRateLabel = `${formatCurrencyValue(itemDailyRate, itemCurrency)} / day`;
                const depositRatio = getDepositRatio(item.product);
                const deviceValue = getDeviceValue(item.product);
                const depositPercentageLabel =
                  depositRatio !== null ? `${Math.round(depositRatio * 100)}%` : null;
                const depositAmountPerUnit =
                  depositRatio !== null && deviceValue !== null ? depositRatio * deviceValue : null;
                const depositSummary = depositPercentageLabel
                  ? depositAmountPerUnit !== null
                    ? `${depositPercentageLabel} (~${formatCurrencyValue(depositAmountPerUnit, itemCurrency)})`
                    : depositPercentageLabel
                  : null;
                const itemDepositTotalLabel =
                  depositAmountPerUnit !== null && item.quantity > 1
                    ? formatCurrencyValue(depositAmountPerUnit * item.quantity, itemCurrency)
                    : null;
                const deviceValueLabel =
                  deviceValue !== null ? formatCurrencyValue(deviceValue, itemCurrency) : null;
                const itemDeviceValueTotalLabel =
                  deviceValue !== null && item.quantity > 1
                    ? formatCurrencyValue(deviceValue * item.quantity, itemCurrency)
                    : null;
                const availableStock = Number.isFinite(item.product.stock)
                  ? Math.max(0, Math.floor(item.product.stock))
                  : Number.POSITIVE_INFINITY;
                const isAdjustable = isContextBacked;
                const canDecrease = isAdjustable && item.quantity > 1;
                const canIncrease =
                  isAdjustable &&
                  (availableStock === Number.POSITIVE_INFINITY ? true : item.quantity < availableStock);

                return (
                  <View key={item.product.id} style={styles.orderItem}>
                    <View style={styles.orderItemHeader}>
                      <View style={styles.orderItemTitle}>
                        <View style={styles.productBadge}>
                          <Ionicons name="phone-portrait-outline" size={24} color="#6f6f6f" />
                        </View>
                        <View style={styles.productDetails}>
                          <Text style={styles.productName}>{itemLabel}</Text>
                          <View style={styles.quantityRow}>
                            <TouchableOpacity
                              style={[styles.quantityButton, !canDecrease && styles.quantityButtonDisabled]}
                              onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                              disabled={!canDecrease}
                              accessibilityRole="button"
                              accessibilityLabel={`Decrease quantity for ${itemLabel}`}
                            >
                              <Ionicons name="remove" size={16} color="#111111" />
                            </TouchableOpacity>
                            <Text style={styles.quantityValue}>{item.quantity}</Text>
                            <TouchableOpacity
                              style={[styles.quantityButton, !canIncrease && styles.quantityButtonDisabled]}
                              onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                              disabled={!canIncrease}
                              accessibilityRole="button"
                              accessibilityLabel={`Increase quantity for ${itemLabel}`}
                            >
                              <Ionicons name="add" size={16} color="#111111" />
                            </TouchableOpacity>
                          </View>
                          {Number.isFinite(availableStock) ? (
                            <Text style={styles.productMeta}>{`Stock available: ${availableStock}`}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.orderItemHeaderRight}>
                        <View style={styles.lineTotalGroup}>
                          <Text style={styles.lineTotalLabel}>Line total</Text>
                          <Text style={styles.productPrice}>{itemLineTotal}</Text>
                        </View>
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
                    </View>

                    <View style={styles.orderItemDetails}>
                      <View style={styles.orderItemMetric}>
                        <Text style={styles.orderItemMetricLabel}>Daily rate</Text>
                        <Text style={styles.orderItemMetricValue}>{itemDailyRateLabel}</Text>
                      </View>
                      {depositSummary ? (
                        <View style={styles.orderItemMetric}>
                          <Text style={styles.orderItemMetricLabel}>Deposit</Text>
                          <Text style={styles.orderItemMetricValue}>{depositSummary}</Text>
                          {itemDepositTotalLabel ? (
                            <Text style={styles.orderItemMetricSubValue}>{`Total: ${itemDepositTotalLabel}`}</Text>
                          ) : null}
                        </View>
                      ) : null}
                      {deviceValueLabel ? (
                        <View style={styles.orderItemMetric}>
                          <Text style={styles.orderItemMetricLabel}>Device value</Text>
                          <Text style={styles.orderItemMetricValue}>{deviceValueLabel}</Text>
                          {itemDeviceValueTotalLabel ? (
                            <Text style={styles.orderItemMetricSubValue}>{`Total: ${itemDeviceValueTotalLabel}`}</Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
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
              <DatePickerField
                value={startDate}
                minimumDate={minimumStartDate}
                onChange={handleStartDateChange}
              />
            </View>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>End Date</Text>
              <DatePickerField value={endDate} minimumDate={minimumEndDate} onChange={handleEndDateChange} />
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
    flexWrap: 'wrap',
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededed',
    gap: 16,
  },
  summaryMetric: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 140,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    padding: 16,
    gap: 12,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  orderItemTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orderItemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  lineTotalGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  lineTotalLabel: {
    color: '#6f6f6f',
    fontSize: 12,
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
  quantityRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
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
  orderItemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  orderItemMetric: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 140,
    gap: 4,
  },
  orderItemMetricLabel: {
    fontSize: 13,
    color: '#6f6f6f',
  },
  orderItemMetricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  orderItemMetricSubValue: {
    fontSize: 13,
    color: '#6f6f6f',
  },
  removeItemButton: {
    padding: 4,
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
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  datePickerIcon: {
    color: '#6f6f6f',
  },
  datePickerValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  datePickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  datePickerModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#ededed',
  },
  datePickerModalButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 12,
  },
  datePickerModalButtonDisabled: {
    opacity: 0.35,
  },
  datePickerModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  datePickerWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  datePickerWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6f6f6f',
  },
  datePickerDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  datePickerDayButton: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 999,
  },
  datePickerDayOutside: {
    opacity: 0.5,
  },
  datePickerDaySelected: {
    backgroundColor: '#111111',
  },
  datePickerDayDisabled: {
    opacity: 0.35,
  },
  datePickerDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111111',
  },
  datePickerDayTextOutside: {
    color: '#6f6f6f',
  },
  datePickerDayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  datePickerDayTextDisabled: {
    color: '#9c9c9c',
  },
  datePickerCloseButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  datePickerCloseButtonText: {
    fontSize: 15,
    color: '#0057ff',
    fontWeight: '600',
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
