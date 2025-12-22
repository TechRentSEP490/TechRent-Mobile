import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeviceModel } from '@/hooks/use-device-model';
import { determineCurrency, formatCurrencyValue, getDailyRate } from '@/utils/product-pricing';
import styles from '@/style/checkout.styles';

export default function CheckoutScreen() {
  const router = useRouter();
  const { productId, quantity: quantityParam } = useLocalSearchParams<{
    productId?: string;
    quantity?: string;
  }>();
  const { data: product, loading, error } = useDeviceModel(productId);

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(typeof quantityParam === 'string' ? quantityParam : '1', 10);
    return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  }, [quantityParam]);

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
