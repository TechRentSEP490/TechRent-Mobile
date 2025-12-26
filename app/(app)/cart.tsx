import DatePickerField from '@/components/date-picker-field';
import SavedAddressesModal from '@/components/modals/SavedAddressesModal';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useDeviceModel } from '@/hooks/use-device-model';
import { createRentalOrder } from '@/services/rental-orders';
import { fetchShippingAddresses, type ShippingAddress } from '@/services/shipping-addresses';
import styles from '@/style/cart.styles';
import { addDays, clampToStartOfDay, formatDisplayDate, parseDateParam } from '@/utils/dates';
import {
  determineCurrency,
  formatCurrencyValue,
  getDailyRate,
  getDepositRatio,
  getDeviceValue,
} from '@/utils/product-pricing';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
const formatAddressTimestamp = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
};

const DATE_SCROLL_ITEM_HEIGHT = 48;
const DATE_SCROLL_VISIBLE_ROWS = 5;
const DATE_SCROLL_RANGE_DAYS = 365;

const createDateSequence = (start: Date, totalDays: number) => {
  const normalizedStart = clampToStartOfDay(start);
  const length = Math.max(totalDays, 1);
  return Array.from({ length }, (_, index) => addDays(normalizedStart, index));
};

// Helper to add hours to a date
const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
};

// Format date as local ISO string (keeps local timezone, not UTC)
const formatLocalDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const findDateIndex = (dates: Date[], target: Date) =>
  dates.findIndex((item) => item.getTime() === target.getTime());

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
  const { session, user, ensureSession } = useAuth();
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

  // Chỉ dùng items từ CartContext, không có fallback mock data
  const items = cartItems;
  const hasItems = items.length > 0;
  const isContextBacked = cartItems.length > 0;

  // Default: Start date = hiện tại + 1 giờ
  const now = new Date();
  const defaultStartDate = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour from now
  const initialStartDate = parseDateParam(startParam, defaultStartDate);

  const [startDate, setStartDate] = useState<Date>(initialStartDate);
  const [rentalDays, setRentalDays] = useState<number>(1); // Số ngày thuê, tối thiểu 1

  // Tự động tính endDate = startDate + rentalDays * 24 giờ
  const endDate = useMemo(() => {
    return addHours(startDate, rentalDays * 24);
  }, [startDate, rentalDays]);

  const [shippingAddress, setShippingAddress] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isRefreshingAddresses, setIsRefreshingAddresses] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isAddressPickerVisible, setIsAddressPickerVisible] = useState(false);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [tempHour, setTempHour] = useState(startDate.getHours());
  const [tempMinute, setTempMinute] = useState(startDate.getMinutes());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ngày bắt đầu tối thiểu = hiện tại (không cho phép trong quá khứ)
  const minimumStartDate = new Date();
  // Số ngày thuê hợp lệ (tối thiểu 1 ngày)
  const isRangeInvalid = rentalDays < 1;
  const rentalDurationInDays = rentalDays;
  const rentalDurationInHours = rentalDays * 24;

  const fetchSavedAddresses = useCallback(async () => {
    const activeSession = session?.accessToken ? session : await ensureSession();

    if (!activeSession?.accessToken) {
      return [];
    }

    const addresses = await fetchShippingAddresses({
      accessToken: activeSession.accessToken,
      tokenType: activeSession.tokenType,
    });

    return addresses;
  }, [ensureSession, session]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoadingAddresses(true);
      setAddressError(null);

      fetchSavedAddresses()
        .then((results) => {
          if (!isActive) {
            return;
          }

          setSavedAddresses(results);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load your shipping addresses. Please try again later.';
          setAddressError(message);
          setSavedAddresses([]);
        })
        .finally(() => {
          if (isActive) {
            setIsLoadingAddresses(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [fetchSavedAddresses]),
  );

  const handleRefreshSavedAddresses = useCallback(async () => {
    setIsRefreshingAddresses(true);

    try {
      const results = await fetchSavedAddresses();
      setSavedAddresses(results);
      setAddressError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to refresh your shipping addresses. Please try again later.';
      setAddressError(message);
      Toast.show({ type: 'error', text1: 'Unable to refresh addresses', text2: message });
    } finally {
      setIsRefreshingAddresses(false);
    }
  }, [fetchSavedAddresses]);

  const handleOpenAddressPicker = useCallback(() => {
    setIsAddressPickerVisible(true);
  }, []);

  const handleCloseAddressPicker = useCallback(() => {
    setIsAddressPickerVisible(false);
  }, []);

  const handleSelectSavedAddress = useCallback((address: ShippingAddress) => {
    setShippingAddress(address.address.trim());
    setIsAddressPickerVisible(false);
    Toast.show({
      type: 'success',
      text1: 'Shipping address selected',
      text2: 'We will deliver your rental order to this location.',
    });
  }, []);

  const handleManageAddressesFromPicker = useCallback(() => {
    handleCloseAddressPicker();
    router.push('/(app)/shipping-addresses');
  }, [handleCloseAddressPicker, router]);

  const getAddressTimestampLabel = useCallback((address: ShippingAddress) => {
    const timestamp = formatAddressTimestamp(address.updatedAt ?? address.createdAt);
    return timestamp ? `Updated ${timestamp}` : null;
  }, []);

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

  const totalAmount = useMemo(() => {
    if (summaryCurrency === null) {
      return null;
    }

    return items.reduce((sum, item) => sum + getDailyRate(item.product) * item.quantity, 0);
  }, [items, summaryCurrency]);
  const totalOrderAmount = useMemo(() => {
    if (summaryCurrency === null) {
      return null;
    }

    return items.reduce(
      (sum, item) => sum + getDailyRate(item.product) * item.quantity * rentalDurationInDays,
      0
    );
  }, [items, rentalDurationInDays, summaryCurrency]);
  const formattedTotal = useMemo(() => {
    if (!hasItems || totalAmount === null || !summaryCurrency) {
      return '—';
    }

    return formatCurrencyValue(totalAmount, summaryCurrency);
  }, [hasItems, summaryCurrency, totalAmount]);

  const { depositTotalLabel, deviceValueTotalLabel, depositTotalValue } = useMemo(() => {
    if (!hasItems || summaryCurrency === null) {
      return {
        depositTotalLabel: '—',
        deviceValueTotalLabel: '—',
        depositTotalValue: null,
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
      depositTotalValue: hasDepositAmount ? depositSum : null,
    };
  }, [hasItems, items, summaryCurrency]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  const deviceLabel = useMemo(() => {
    if (!hasItems) {
      return '0 devices';
    }

    return `${totalQuantity} ${totalQuantity === 1 ? 'thiết bị' : 'thiết bị'}`;
  }, [hasItems, totalQuantity]);
  const totalCostLabel = useMemo(() => {
    if (!hasItems) {
      return '—';
    }

    if (summaryCurrency === null || totalOrderAmount === null) {
      return '—';
    }

    const depositValue = depositTotalValue ?? 0;

    return formatCurrencyValue(totalOrderAmount + depositValue, summaryCurrency);
  }, [depositTotalValue, hasItems, summaryCurrency, totalOrderAmount]);
  // Label hiển thị số ngày thuê
  const rentalDurationLabel = useMemo(() => {
    if (!hasItems) {
      return '—';
    }
    return `${rentalDurationInDays} ${rentalDurationInDays === 1 ? 'ngày' : 'ngày'}`;
  }, [hasItems, rentalDurationInDays]);

  // Tổng tiền thuê = Daily Rate × Số ngày × Số lượng (không bao gồm đặt cọc)
  const rentalCostLabel = useMemo(() => {
    if (!hasItems || summaryCurrency === null || totalOrderAmount === null) {
      return '—';
    }
    return formatCurrencyValue(totalOrderAmount, summaryCurrency);
  }, [hasItems, summaryCurrency, totalOrderAmount]);

  // Type cho các metrics hiển thị trong summary
  type SummaryMetric = {
    label: string;
    value: string;
    description?: string;
    highlight?: boolean;
  };

  const summaryMetrics = useMemo(
    (): SummaryMetric[] => {
      const metrics: SummaryMetric[] = [
        { label: 'Tổng sản phẩm', value: deviceLabel },
        { label: 'Thời gian thuê', value: rentalDurationLabel },
        { label: 'Tổng giá thuê/ngày', value: formattedTotal },
        { label: 'Chi phí thuê', value: rentalCostLabel, description: `(${rentalDurationLabel} × Giá/ngày)` },
        { label: 'Tiền cọc (Hoàn lại)', value: depositTotalLabel, description: 'Hoàn lại khi trả thiết bị' },
        { label: 'Giá trị thiết bị', value: deviceValueTotalLabel },
      ];

      metrics.push({ label: 'Tổng thanh toán', value: totalCostLabel, highlight: true, description: 'Chi phí thuê + Tiền cọc' });

      return metrics;
    },
    [
      depositTotalLabel,
      deviceLabel,
      deviceValueTotalLabel,
      formattedTotal,
      rentalCostLabel,
      rentalDurationLabel,
      totalCostLabel,
    ]
  );

  // Hiển thị empty state khi cart trống
  if (!hasItems) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingState}>
          <Ionicons name="cart-outline" size={64} color="#d0d0d0" />
          <Text style={styles.loadingStateText}>Giỏ hàng trống</Text>
          <Text style={[styles.loadingStateText, { marginTop: 8, fontSize: 14 }]}>
            Thêm thiết bị từ danh mục để bắt đầu thuê
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: '#111', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => router.push('/(app)/(tabs)/home')}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Xem thiết bị</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const rentalRangeLabel =
    endDate.getTime() === startDate.getTime()
      ? formatDisplayDate(startDate)
      : `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;

  const handleStartDateChange = (nextDate: Date) => {
    setStartDate(nextDate);
    // endDate sẽ tự động cập nhật vì là derived value từ startDate + rentalDays
  };

  const handleRentalDaysChange = (days: number) => {
    // Tối thiểu 1 ngày, tối đa 365 ngày
    const validDays = Math.max(1, Math.min(365, days));
    setRentalDays(validDays);
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
          planStartDate: formatLocalDateTime(startDate),
          planEndDate: formatLocalDateTime(endDate),
          shippingAddress: shippingAddress.trim(),
          orderDetails,
        },
        {
          accessToken: session.accessToken,
          tokenType: session.tokenType,
        }
      );

      clear();

      const normalizedKycStatus = (user?.kycStatus ?? '').toUpperCase();

      if (normalizedKycStatus === 'NOT_STARTED') {
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
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
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
          {summaryMetrics.map((metric) => (
            <View key={metric.label} style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>{metric.label}</Text>
              <Text style={[styles.summaryValue, metric.highlight && styles.summaryValueHighlight]}>
                {metric.value}
              </Text>
              {metric.description ? (
                <Text style={styles.summaryDescription}>{metric.description}</Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderTitle}>Tóm tắt đơn hàng</Text>
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
              items.map((item, index) => {
                const itemCurrency = determineCurrency(item.product);
                const itemDailyRate = getDailyRate(item.product);
                const itemLineTotal = formatCurrencyValue(itemDailyRate * item.quantity, itemCurrency);
                const itemLabel = item.product.model || item.product.name;
                const itemDailyRateLabel = `${formatCurrencyValue(itemDailyRate, itemCurrency)} / ngày`;
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
                const singleItemTotalPaymentLabel =
                  index === 0
                    ? formatCurrencyValue(
                      itemDailyRate * item.quantity + (depositAmountPerUnit ?? 0) * item.quantity,
                      itemCurrency
                    )
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
                          {item.product.imageURL ? (
                            <Image
                              source={{ uri: item.product.imageURL }}
                              style={styles.productImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="phone-portrait-outline" size={24} color="#6f6f6f" />
                          )}
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
                            <Text style={styles.productMeta}>{`Còn hàng: ${availableStock}`}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.orderItemHeaderRight}>
                        <View style={styles.lineTotalGroup}>
                          <Text style={styles.lineTotalLabel}>Tổng dòng</Text>
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
                        <Text style={styles.orderItemMetricLabel}>Giá thuê/ngày</Text>
                        <Text style={styles.orderItemMetricValue}>{itemDailyRateLabel}</Text>
                      </View>
                      {singleItemTotalPaymentLabel ? (
                        <View style={styles.orderItemMetric}>
                          <Text style={styles.orderItemMetricLabel}>Tổng thanh toán (1 sp)</Text>
                          <Text style={styles.orderItemMetricValue}>{singleItemTotalPaymentLabel}</Text>
                        </View>
                      ) : null}
                      {depositSummary ? (
                        <View style={styles.orderItemMetric}>
                          <Text style={styles.orderItemMetricLabel}>Tiền cọc</Text>
                          <Text style={styles.orderItemMetricValue}>{depositSummary}</Text>
                          {itemDepositTotalLabel ? (
                            <Text style={styles.orderItemMetricSubValue}>{`Tổng: ${itemDepositTotalLabel}`}</Text>
                          ) : null}
                        </View>
                      ) : null}
                      {deviceValueLabel ? (
                        <View style={styles.orderItemMetric}>
                          <Text style={styles.orderItemMetricLabel}>Giá trị thiết bị</Text>
                          <Text style={styles.orderItemMetricValue}>{deviceValueLabel}</Text>
                          {itemDeviceValueTotalLabel ? (
                            <Text style={styles.orderItemMetricSubValue}>{`Tổng: ${itemDeviceValueTotalLabel}`}</Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyOrderBody}>
                <Text style={styles.emptyOrderText}>Thêm thiết bị vào giỏ hàng để tạo đơn thuê.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Địa chỉ giao hàng</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Nhập địa chỉ nơi bạn muốn nhận thiết bị"
            placeholderTextColor="#9c9c9c"
            value={shippingAddress}
            onChangeText={setShippingAddress}
            multiline
          />
          <View style={styles.addressActions}>
            <TouchableOpacity
              style={styles.addressActionButton}
              onPress={handleOpenAddressPicker}
              accessibilityRole="button"
              accessibilityLabel="Choose a saved shipping address"
            >
              <Ionicons
                name="location-outline"
                size={16}
                color="#111111"
                style={styles.addressActionIcon}
              />
              <Text style={styles.addressActionText}>
                {isLoadingAddresses ? 'Đang tải địa chỉ...' : 'Chọn địa chỉ đã lưu'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addressActionButton}
              onPress={() => router.push('/(app)/shipping-addresses')}
              accessibilityRole="button"
              accessibilityLabel="Manage shipping addresses"
            >
              <Ionicons
                name="settings-outline"
                size={16}
                color="#111111"
                style={styles.addressActionIcon}
              />
              <Text style={styles.addressActionText}>Quản lý địa chỉ</Text>
            </TouchableOpacity>
          </View>
          {addressError ? (
            <Text style={styles.addressHelperError}>{addressError}</Text>
          ) : (
            <Text style={styles.addressHelperText}>
              {isLoadingAddresses
                ? 'Đang tải địa chỉ đã lưu...'
                : savedAddresses.length > 0
                  ? `Bạn có ${savedAddresses.length} địa chỉ đã lưu.`
                  : 'Thêm địa chỉ giao hàng để sử dụng lại cho các lần thuê sau.'}
            </Text>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Thời gian thuê</Text>

          {/* Row 1: Ngày bắt đầu + Số ngày thuê */}
          <View style={styles.dateRow}>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>Ngày bắt đầu</Text>
              <DatePickerField
                value={startDate}
                minimumDate={minimumStartDate}
                onChange={handleStartDateChange}
                showTime={false}
              />
            </View>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>Số ngày thuê</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <TouchableOpacity
                  style={{ width: 32, height: 32, backgroundColor: rentalDays <= 1 ? '#e5e7eb' : '#111', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => handleRentalDaysChange(rentalDays - 1)}
                  disabled={rentalDays <= 1}
                >
                  <Ionicons name="remove" size={18} color={rentalDays <= 1 ? '#9ca3af' : '#fff'} />
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111' }}>{rentalDays}</Text>
                <TouchableOpacity
                  style={{ width: 32, height: 32, backgroundColor: '#111', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => handleRentalDaysChange(rentalDays + 1)}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Row 2: Giờ bắt đầu */}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.dateLabel}>Giờ bắt đầu (8:00 - 19:00)</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e5e7eb', gap: 8 }}
              onPress={() => {
                setTempHour(startDate.getHours());
                setTempMinute(startDate.getMinutes());
                setIsTimePickerVisible(true);
              }}
            >
              <Ionicons name="time-outline" size={18} color="#6f6f6f" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>
                {startDate.getHours().toString().padStart(2, '0')}:{startDate.getMinutes().toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Picker Modal */}
          <Modal
            visible={isTimePickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsTimePickerVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 16, textAlign: 'center' }}>Chọn giờ bắt đầu</Text>

                {/* Giờ */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 8 }}>Giờ</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(h => (
                    <TouchableOpacity
                      key={h}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: tempHour === h ? '#111' : '#f3f4f6',
                        borderWidth: 1,
                        borderColor: tempHour === h ? '#111' : '#e5e7eb',
                      }}
                      onPress={() => setTempHour(h)}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: tempHour === h ? '#fff' : '#374151' }}>
                        {h.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Phút */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 8 }}>Phút</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {[0, 15, 30, 45].map(m => (
                    <TouchableOpacity
                      key={m}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: tempMinute === m ? '#111' : '#f3f4f6',
                        borderWidth: 1,
                        borderColor: tempMinute === m ? '#111' : '#e5e7eb',
                      }}
                      onPress={() => setTempMinute(m)}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: tempMinute === m ? '#fff' : '#374151' }}>
                        :{m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Preview */}
                <View style={{ padding: 12, backgroundColor: '#f0f9ff', borderRadius: 10, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: '#0369a1', fontWeight: '500' }}>Giờ đã chọn</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#111', marginTop: 4 }}>
                    {tempHour.toString().padStart(2, '0')}:{tempMinute.toString().padStart(2, '0')}
                  </Text>
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, backgroundColor: '#f3f4f6', borderRadius: 12, alignItems: 'center' }}
                    onPress={() => setIsTimePickerVisible(false)}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, backgroundColor: '#111', borderRadius: 12, alignItems: 'center' }}
                    onPress={() => {
                      const newDate = new Date(startDate);
                      newDate.setHours(tempHour, tempMinute, 0, 0);
                      if (newDate.getTime() >= new Date().getTime()) {
                        handleStartDateChange(newDate);
                        setIsTimePickerVisible(false);
                      } else {
                        Alert.alert('Lỗi', 'Không thể chọn giờ trong quá khứ.');
                      }
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Xác nhận</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Hiển thị ngày kết thúc tự động tính */}
          <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' }}>
            <Text style={{ fontSize: 12, color: '#166534', fontWeight: '500' }}>Ngày kết thúc (tự động tính)</Text>
            <Text style={{ fontSize: 15, color: '#111', fontWeight: '600', marginTop: 4 }}>
              {endDate.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          </View>

          {isRangeInvalid && (
            <Text style={styles.dateErrorText}>Số ngày thuê phải ít nhất 1 ngày.</Text>
          )}
        </View>

        {submitError && (
          <View style={styles.submitErrorBanner}>
            <Text style={styles.submitErrorText}>{submitError}</Text>
          </View>
        )}
      </ScrollView>

      <SavedAddressesModal
        visible={isAddressPickerVisible}
        addresses={savedAddresses}
        isLoading={isLoadingAddresses}
        isRefreshing={isRefreshingAddresses}
        onRefresh={() => void handleRefreshSavedAddresses()}
        onManage={handleManageAddressesFromPicker}
        onSelect={handleSelectSavedAddress}
        onClose={handleCloseAddressPicker}
        getTimestampLabel={getAddressTimestampLabel}
      />

      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkoutButton, (isCheckoutDisabled || isSubmitting) && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={isCheckoutDisabled || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.checkoutText}>Đặt đơn thuê</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
