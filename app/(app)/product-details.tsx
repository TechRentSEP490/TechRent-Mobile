import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AccessoriesModal from '@/components/modals/AccessoriesModal';
import AuthPromptModal from '@/components/modals/AuthPromptModal';
import DeviceSpecsModal from '@/components/modals/DeviceSpecsModal';
import RentDeviceModal from '@/components/modals/RentDeviceModal';
import { products, type ProductDetail } from '../../constants/products';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useDeviceModel } from '@/hooks/use-device-model';
import styles from '@/style/product-details.styles';

type NormalizedSpecEntry = {
  label: string;
  value: string;
};

type AuthRoute = '/(auth)/sign-in' | '/(auth)/sign-up';

const formatSpecKey = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s{2,}/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatPrimitiveSpecValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  return String(value).trim();
};

const joinSpecPath = (path: string[], fallback = 'Details') => {
  if (!path.length) {
    return fallback;
  }

  const formatted = path
    .map((segment) => formatSpecKey(segment))
    .filter((segment) => segment.length > 0);

  return formatted.length > 0 ? formatted.join(' › ') : fallback;
};

const flattenSpecStructure = (value: unknown, path: string[] = []): NormalizedSpecEntry[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    const entries: NormalizedSpecEntry[] = [];

    const primitiveValues = value
      .filter((item) => item === null || item === undefined || typeof item !== 'object')
      .map((item) => formatPrimitiveSpecValue(item))
      .filter((text) => text.length > 0);

    if (primitiveValues.length > 0) {
      entries.push({
        label: joinSpecPath(path),
        value: primitiveValues.join(', '),
      });
    }

    value.forEach((item, index) => {
      if (item && typeof item === 'object') {
        entries.push(...flattenSpecStructure(item, [...path, `Item ${index + 1}`]));
      }
    });

    return entries;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if ('label' in record && 'value' in record) {
      const label = formatPrimitiveSpecValue(record.label);
      const formattedValue = formatPrimitiveSpecValue(record.value);

      if (!label && !formattedValue) {
        return [];
      }

      return [
        {
          label: label || joinSpecPath(path),
          value: formattedValue || '—',
        },
      ];
    }

    return Object.entries(record).flatMap(([key, nestedValue]) =>
      flattenSpecStructure(nestedValue, [...path, key])
    );
  }

  const primitiveValue = formatPrimitiveSpecValue(value);

  if (!primitiveValue) {
    return [];
  }

  return [
    {
      label: joinSpecPath(path),
      value: primitiveValue,
    },
  ];
};

const normalizeSpecsData = (data: ProductDetail['specs']): NormalizedSpecEntry[] => {
  if (data === null || data === undefined) {
    return [];
  }

  if (Array.isArray(data)) {
    return data
      .flatMap((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const record = item as Record<string, unknown>;

          if ('label' in record && 'value' in record) {
            const label = formatPrimitiveSpecValue(record.label);
            const value = formatPrimitiveSpecValue(record.value);

            if (!label && !value) {
              return [];
            }

            return [
              {
                label: label || `Spec ${index + 1}`,
                value: value || '—',
              },
            ];
          }
        }

        return flattenSpecStructure(item, [`Spec ${index + 1}`]);
      })
      .filter((entry) => entry.value.length > 0);
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeSpecsData(parsed as ProductDetail['specs']);
    } catch {
      return [
        {
          label: 'Details',
          value: trimmed,
        },
      ];
    }
  }

  if (typeof data === 'object') {
    return flattenSpecStructure(data);
  }

  const fallbackValue = formatPrimitiveSpecValue(data);

  return fallbackValue
    ? [
        {
          label: 'Details',
          value: fallbackValue,
        },
      ]
    : [];
};

const resolveDailyRate = (product: ProductDetail) => {
  if (typeof product.pricePerDay === 'number' && product.pricePerDay > 0) {
    return product.pricePerDay;
  }

  const sanitized = product.price.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const parsed = Number.parseFloat(sanitized);

  return Number.isNaN(parsed) ? null : parsed;
};

const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const formatCurrencyValue = (value: number) => VND_FORMATTER.format(value);

export default function ProductDetailsScreen() {
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isAccessoriesOpen, setIsAccessoriesOpen] = useState(false);
  const [isRentOpen, setIsRentOpen] = useState(false);
  const [rentMode, setRentMode] = useState<'rent' | 'cart' | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [authPromptMode, setAuthPromptMode] = useState<'rent' | 'cart' | null>(null);
  const router = useRouter();
  const { isSignedIn, isHydrating, session } = useAuth();
  const { addItem } = useCart();
  const { productId: productIdParam, deviceModelId } = useLocalSearchParams<{
    productId?: string;
    deviceModelId?: string;
  }>();
  const resolvedProductId = typeof deviceModelId === 'string' ? deviceModelId : productIdParam;
  const {
    data: fetchedProduct,
    loading: isProductLoading,
    error: productError,
  } = useDeviceModel(resolvedProductId);

  const product = useMemo(() => {
    if (fetchedProduct) {
      return fetchedProduct;
    }

    if (typeof resolvedProductId === 'string') {
      const match = products.find((item) => item.id === resolvedProductId);
      if (match) {
        return match;
      }
    }

    return products[0] ?? null;
  }, [fetchedProduct, resolvedProductId]);

  const specsSource = product?.specs;

  const normalizedSpecs = useMemo(() => {
    if (!specsSource) {
      return [];
    }

    const entries = normalizeSpecsData(specsSource);
    const seen = new Set<string>();

    return entries.filter((entry) => {
      const key = `${entry.label}|${entry.value}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [specsSource]);

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.loadingState}>
          {isProductLoading ? (
            <ActivityIndicator size="large" color="#111111" />
          ) : (
            <Text style={styles.errorBannerText}>Device not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const {
    name,
    model,
    brand,
    status,
    accessories,
    relatedProducts,
    reviews,
    price,
    stock,
    description,
    deviceValue,
    depositPercent,
  } = product;
  const productImage = product.imageURL;

  const isOutOfStock = stock <= 0;
  const maxQuantity = Math.max(stock, 1);
  const stockLabel = stock > 0 ? `${stock} in stock` : 'Out of stock';
  const isRestoringSession = isHydrating && Boolean(session?.accessToken);

  const openRentModal = (mode: 'rent' | 'cart') => {
    if (isRestoringSession) {
      return;
    }

    if (!isSignedIn) {
      setAuthPromptMode(mode);
      setIsAuthPromptOpen(true);
      return;
    }

    setQuantity(1);
    setRentMode(mode);
    setIsRentOpen(true);
  };

  const closeRentModal = () => {
    setIsRentOpen(false);
    setRentMode(null);
  };

  const closeAuthPrompt = () => {
    setIsAuthPromptOpen(false);
    setAuthPromptMode(null);
  };

  const handleAuthNavigation = (path: AuthRoute) => {
    closeAuthPrompt();
    router.push(path);
  };

  const isPrimaryDisabled = isOutOfStock || rentMode === null;

  const normalizedDepositPercent = typeof depositPercent === 'number' ? depositPercent : null;
  const depositPercentageLabel = normalizedDepositPercent !== null
    ? `${Math.round(normalizedDepositPercent * 100)}%`
    : null;
  const depositAmount =
    normalizedDepositPercent !== null && typeof deviceValue === 'number'
      ? deviceValue * normalizedDepositPercent
      : null;
  const depositSummary = depositPercentageLabel
    ? depositAmount !== null
      ? `${depositPercentageLabel} (~${formatCurrencyValue(depositAmount)})`
      : depositPercentageLabel
    : null;
  const deviceValueLabel =
    typeof deviceValue === 'number' && Number.isFinite(deviceValue)
      ? formatCurrencyValue(deviceValue)
      : null;
  const dailyRate = resolveDailyRate(product);
  const totalRentalPrice = dailyRate !== null ? dailyRate * quantity : null;
  const totalDepositAmount = depositAmount !== null ? depositAmount * quantity : null;
  const totalCost =
    totalRentalPrice !== null && totalDepositAmount !== null
      ? totalRentalPrice + totalDepositAmount
      : null;
  const shouldShowTotalCost = quantity > 1 && totalCost !== null;
  const totalCostLabel = totalCost !== null ? formatCurrencyValue(totalCost) : '—';

  const handlePrimaryAction = () => {
    if (isPrimaryDisabled || rentMode === null) {
      return;
    }

    if (rentMode === 'cart') {
      addItem(product, quantity);
      closeRentModal();
      const isMultiple = quantity > 1;
      Toast.show({
        type: 'success',
        text1: 'Added to cart',
        text2: isMultiple
          ? `${quantity} units of ${product.name} are now in your cart.`
          : `${product.name} is now in your cart.`,
      });
      return;
    }

    addItem(product, quantity, { replace: true });
    closeRentModal();
    router.push({
      pathname: '/(app)/cart',
    });
  };

  const decreaseQuantity = () => setQuantity((prev) => Math.max(prev - 1, 1));
  const increaseQuantity = () => setQuantity((prev) => Math.min(prev + 1, maxQuantity));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#111" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="share-outline" size={22} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="ellipsis-vertical" size={22} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        {productError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{productError}</Text>
          </View>
        )}

        <View style={styles.imagePreview}>
          {productImage ? (
            <Image source={{ uri: productImage }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <MaterialCommunityIcons name="image-off-outline" size={48} color="#6f6f6f" />
              <Text style={styles.heroPlaceholderText}>Images coming soon</Text>
            </View>
          )}
        </View>

        <View style={styles.paginationDots}>
          {[0, 1, 2].map((item) => (
            <View key={item} style={[styles.dot, item === 0 && styles.activeDot]} />
          ))}
        </View>

        <View style={styles.productInfo}>
          <View>
            <Text style={styles.productName}>{name}</Text>
            <Text style={styles.productMeta}>{`Model: ${model} | Brand: ${brand} | ${status}`}</Text>
          </View>
          <MaterialCommunityIcons name="bookmark-outline" size={28} color="#111" />
        </View>

        {description ? <Text style={styles.productDescription}>{description}</Text> : null}

        <View style={styles.pricingCard}>
          <Text style={styles.pricingTitle}>Pricing</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Daily rate</Text>
            <Text style={styles.pricingValue}>{price}</Text>
          </View>
          {depositSummary ? (
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Deposit</Text>
              <Text style={styles.pricingValue}>{depositSummary}</Text>
            </View>
          ) : null}
          {deviceValueLabel ? (
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Device value</Text>
              <Text style={styles.pricingValue}>{deviceValueLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickAction, styles.quickActionActive]}>
            <Ionicons name="information-circle-outline" size={24} color="#111" />
            <Text style={[styles.quickActionLabel, styles.quickActionLabelActive]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Ionicons name="star-outline" size={24} color="#6f6f6f" />
            <Text style={styles.quickActionLabel}>Reviews</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => setIsSpecsOpen(true)}>
            <Ionicons name="hammer-outline" size={24} color="#6f6f6f" />
            <Text style={styles.quickActionLabel}>Specs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => setIsAccessoriesOpen(true)}>
            <Ionicons name="construct-outline" size={24} color="#6f6f6f" />
            <Text style={styles.quickActionLabel}>Accessories</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => openRentModal('rent')}>
          <Text style={styles.primaryButtonText}>Rent Now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => openRentModal('cart')}>
          <Text style={styles.secondaryButtonText}>Add to Cart</Text>
        </TouchableOpacity>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Related Products</Text>
          <View style={styles.relatedRow}>
            {relatedProducts.map((item) => (
              <View key={item.id} style={styles.relatedCard}>
                <Text style={styles.relatedBadge}>{item.title}</Text>
                <Text style={styles.relatedSubtitle}>{item.subtitle}</Text>
                <Text style={styles.relatedPrice}>{item.price}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Customer Reviews</Text>
          <FlatList
            data={reviews}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewName}>{item.name}</Text>
                  <View style={styles.ratingRow}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Ionicons
                        key={index}
                        name={index < item.rating ? 'star' : 'star-outline'}
                        size={16}
                        color="#f8b400"
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewComment}>{item.comment}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.reviewSeparator} />}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      <RentDeviceModal
        visible={isRentOpen}
        name={name}
        model={model}
        brand={brand}
        price={price}
        quantity={quantity}
        maxQuantity={maxQuantity}
        stockLabel={stockLabel}
        shouldShowTotalCost={shouldShowTotalCost}
        totalCostLabel={totalCostLabel}
        rentMode={rentMode}
        isPrimaryDisabled={isPrimaryDisabled}
        onClose={closeRentModal}
        onDecreaseQuantity={decreaseQuantity}
        onIncreaseQuantity={increaseQuantity}
        onPrimaryAction={handlePrimaryAction}
      />

      <AuthPromptModal
        visible={isAuthPromptOpen}
        mode={authPromptMode}
        onClose={closeAuthPrompt}
        onNavigate={handleAuthNavigation}
      />

      <DeviceSpecsModal
        visible={isSpecsOpen}
        items={normalizedSpecs}
        onClose={() => setIsSpecsOpen(false)}
      />

      <AccessoriesModal
        visible={isAccessoriesOpen}
        items={accessories}
        onClose={() => setIsAccessoriesOpen(false)}
      />
    </SafeAreaView>
  );
}
