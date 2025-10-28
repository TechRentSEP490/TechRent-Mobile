import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ProductDetail } from '@/constants/products';
import { useDeviceModel } from '@/hooks/use-device-model';

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

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(typeof quantityParam === 'string' ? quantityParam : '1', 10);
    return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  }, [quantityParam]);

  const rentalStart = typeof startParam === 'string' ? startParam : undefined;
  const rentalEnd = typeof endParam === 'string' ? endParam : undefined;
  const rentalRangeLabel = useMemo(() => {
    if (!rentalStart) {
      return 'Not selected';
    }

    if (!rentalEnd || rentalEnd === rentalStart) {
      return formatDisplayDate(rentalStart);
    }

    return `${formatDisplayDate(rentalStart)} - ${formatDisplayDate(rentalEnd)}`;
  }, [rentalEnd, rentalStart]);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingEmail, setShippingEmail] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);

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

  const handleOrder = () => {
    router.replace({
      pathname: '/(app)/product-details',
      params: { productId: product.id },
    });
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Enter your name"
              placeholderTextColor="#9c9c9c"
              value={customerName}
              onChangeText={setCustomerName}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Enter your email"
              placeholderTextColor="#9c9c9c"
              value={customerEmail}
              onChangeText={setCustomerEmail}
              keyboardType="email-address"
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            placeholderTextColor="#9c9c9c"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shipping Information</Text>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setSameAsBilling((prev) => !prev)}
            >
              <View style={[styles.checkbox, sameAsBilling && styles.checkboxChecked]}>
                {sameAsBilling && <Ionicons name="checkmark" size={14} color="#ffffff" />}
              </View>
              <Text style={styles.checkboxLabel}>Same as billing</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Enter your address"
            placeholderTextColor="#9c9c9c"
            value={shippingAddress}
            onChangeText={setShippingAddress}
          />
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#9c9c9c"
            value={shippingEmail}
            onChangeText={setShippingEmail}
            keyboardType="email-address"
          />
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
      </ScrollView>

      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.orderButton} onPress={handleOrder}>
          <Text style={styles.orderText}>Order</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
    backgroundColor: '#fafafa',
  },
  inputHalf: {
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d1d1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});
