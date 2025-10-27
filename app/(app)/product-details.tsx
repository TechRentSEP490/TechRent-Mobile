import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { products, type ProductDetail } from '../../constants/products';
import { useAuth } from '@/contexts/AuthContext';
import { useDeviceModel } from '@/hooks/use-device-model';

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

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export default function ProductDetailsScreen() {
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isAccessoriesOpen, setIsAccessoriesOpen] = useState(false);
  const [isRentOpen, setIsRentOpen] = useState(false);
  const [rentMode, setRentMode] = useState<'rent' | 'cart' | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState(() => formatDate(new Date()));
  const [endDate, setEndDate] = useState(() => formatDate(addDays(new Date(), 7)));
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [authPromptMode, setAuthPromptMode] = useState<'rent' | 'cart' | null>(null);
  const router = useRouter();
  const { isSignedIn, isHydrating } = useAuth();
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

  const rentalDuration = useMemo(() => {
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return 0;
    }
    const diff = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [startDate, endDate]);

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

  const { name, model, brand, status, accessories, relatedProducts, reviews, price, stock } = product;
  const productImage = product.imageURL;

  const isOutOfStock = stock <= 0;
  const maxQuantity = Math.max(stock, 1);
  const stockLabel = stock > 0 ? `${stock} in stock` : 'Out of stock';

  const rentalDurationLabel = rentalDuration === 1 ? '1 day' : `${rentalDuration} days`;

  const openRentModal = (mode: 'rent' | 'cart') => {
    if (isHydrating) {
      return;
    }

    if (!isSignedIn) {
      setAuthPromptMode(mode);
      setIsAuthPromptOpen(true);
      return;
    }

    const today = new Date();
    setQuantity(1);
    setStartDate(formatDate(today));
    setEndDate(formatDate(addDays(today, 7)));
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

  const isPrimaryDisabled = isOutOfStock || rentalDuration <= 0 || rentMode === null;

  const handlePrimaryAction = () => {
    if (isPrimaryDisabled || rentMode === null) {
      return;
    }

    const destinationProductId = product.id;

    if (rentMode === 'cart') {
      closeRentModal();
      return;
    }

    closeRentModal();
    router.push({
      pathname: '/(app)/cart',
      params: {
        productId: destinationProductId,
        quantity: String(quantity),
        startDate,
        endDate,
      },
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

      <Modal visible={isRentOpen} transparent animationType="fade" onRequestClose={closeRentModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.rentModalContent}>
            <View style={styles.rentModalHeader}>
              <Text style={styles.rentModalTitle}>Rent Device</Text>
              <TouchableOpacity style={styles.rentModalClose} onPress={closeRentModal}>
                <Ionicons name="close" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={styles.rentSummary}>
              <View style={styles.rentSummaryThumb}>
                <Ionicons name="phone-portrait-outline" size={24} color="#6f6f6f" />
              </View>
              <View style={styles.rentSummaryDetails}>
                <Text style={styles.rentSummaryName}>{name}</Text>
                <Text style={styles.rentSummaryMeta}>{`${model} • ${brand}`}</Text>
                <Text style={styles.rentSummaryPrice}>{price}</Text>
              </View>
            </View>

            <View style={styles.rentFieldGroup}>
              <Text style={styles.rentFieldLabel}>Quantity</Text>
              <View style={styles.rentQuantityControl}>
                <TouchableOpacity
                  style={[styles.rentQuantityButton, quantity === 1 && styles.rentQuantityButtonDisabled]}
                  onPress={decreaseQuantity}
                  disabled={quantity === 1}
                >
                  <Ionicons name="remove" size={18} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.rentQuantityValue}>{quantity}</Text>
                <TouchableOpacity
                  style={[
                    styles.rentQuantityButton,
                    quantity === maxQuantity && styles.rentQuantityButtonDisabled,
                  ]}
                  onPress={increaseQuantity}
                  disabled={quantity === maxQuantity}
                >
                  <Ionicons name="add" size={18} color="#111111" />
                </TouchableOpacity>
              </View>
              <Text style={styles.rentStockLabel}>{stockLabel}</Text>
            </View>

            <View style={styles.rentFieldRow}>
              <View style={styles.rentFieldHalf}>
                <Text style={styles.rentFieldLabel}>Start Date</Text>
                <View style={styles.rentDateControl}>
                  <TextInput
                    style={styles.rentDateInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9c9c9c"
                  />
                  <TouchableOpacity
                    style={styles.rentCalendarButton}
                    onPress={() => setStartDate(formatDate(new Date()))}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#111111" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.rentFieldHalf}>
                <Text style={styles.rentFieldLabel}>End Date</Text>
                <View style={styles.rentDateControl}>
                  <TextInput
                    style={styles.rentDateInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9c9c9c"
                  />
                  <TouchableOpacity
                    style={styles.rentCalendarButton}
                    onPress={() => {
                      const base = new Date();
                      setEndDate(formatDate(addDays(base, 7)));
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#111111" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.rentFieldGroup}>
              <Text style={styles.rentFieldLabel}>Rental Duration</Text>
              <View style={styles.rentDurationRow}>
                <Text style={styles.rentDurationValue}>{rentalDurationLabel}</Text>
              </View>
            </View>

            <View style={styles.rentFooter}>
              <TouchableOpacity
                style={[
                  styles.rentPrimaryAction,
                  rentMode === 'cart' && styles.cartModeButton,
                  isPrimaryDisabled && styles.disabledButton,
                ]}
                disabled={isPrimaryDisabled}
                onPress={handlePrimaryAction}
              >
                <Text
                  style={[
                    styles.rentPrimaryActionText,
                    rentMode === 'cart' && styles.cartModeButtonText,
                    isPrimaryDisabled && styles.disabledButtonText,
                  ]}
                >
                  {rentMode === 'cart' ? 'Add to Cart' : 'Rent Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isAuthPromptOpen} transparent animationType="fade" onRequestClose={closeAuthPrompt}>
        <View style={styles.modalBackdrop}>
          <View style={styles.authModalContent}>
            <Text style={styles.authModalTitle}>Sign in required</Text>
            <Text style={styles.authModalDescription}>
              {authPromptMode === 'cart'
                ? 'Sign in or create an account to add this device to your cart.'
                : 'Sign in or create an account to rent this device.'}
            </Text>
            <View style={styles.authModalActions}>
              <TouchableOpacity style={styles.authModalSecondary} onPress={closeAuthPrompt}>
                <Text style={styles.authModalSecondaryText}>Maybe later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.authModalPrimary}
                onPress={() => handleAuthNavigation('/(auth)/sign-in')}
              >
                <Text style={styles.authModalPrimaryText}>Sign In</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.authModalLink}
              onPress={() => handleAuthNavigation('/(auth)/sign-up')}
            >
              <Text style={styles.authModalLinkText}>New here? Create an account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isSpecsOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Device Specifications</Text>
            {normalizedSpecs.length > 0 ? (
              normalizedSpecs.map((item) => (
                <View key={`${item.label}-${item.value}`} style={styles.modalRow}>
                  <Text style={styles.modalLabel}>{item.label}</Text>
                  <Text style={styles.modalValue}>{item.value}</Text>
                </View>
              ))
            ) : (
              <View style={styles.modalEmptyState}>
                <Text style={styles.modalEmptyText}>
                  Specifications will appear once they are available.
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsSpecsOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isAccessoriesOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Accessories</Text>
            {accessories.map((item) => (
              <View key={item.label} style={styles.modalRow}>
                <Text style={styles.modalLabel}>{item.label}</Text>
                <Text style={styles.modalValue}>{item.category}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsAccessoriesOpen(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  container: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  errorBanner: {
    marginBottom: 16,
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
  imagePreview: {
    height: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fafafa',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heroPlaceholderText: {
    color: '#6c6c6c',
    fontSize: 14,
    marginTop: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dcdcdc',
  },
  activeDot: {
    backgroundColor: '#111111',
    width: 18,
  },
  productInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
  },
  productMeta: {
    color: '#6c6c6c',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickActionActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#111111',
    paddingBottom: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6f6f6f',
  },
  quickActionLabelActive: {
    color: '#111111',
  },
  primaryButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600',
  },
  cardSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 16,
  },
  relatedRow: {
    flexDirection: 'row',
    gap: 16,
  },
  relatedCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    padding: 16,
    backgroundColor: '#ffffff',
  },
  relatedBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#000000',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  relatedSubtitle: {
    fontSize: 14,
    color: '#444444',
    marginBottom: 12,
  },
  relatedPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    padding: 16,
    backgroundColor: '#ffffff',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  reviewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewComment: {
    color: '#444444',
    fontSize: 14,
    lineHeight: 20,
  },
  reviewSeparator: {
    height: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalLabel: {
    fontWeight: '500',
    color: '#333333',
  },
  modalValue: {
    color: '#666666',
  },
  modalEmptyState: {
    paddingVertical: 4,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#6f6f6f',
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  authModalContent: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  authModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  authModalDescription: {
    fontSize: 14,
    color: '#444444',
    marginBottom: 20,
    lineHeight: 20,
  },
  authModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  authModalSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    backgroundColor: '#ffffff',
  },
  authModalSecondaryText: {
    color: '#444444',
    fontWeight: '600',
  },
  authModalPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#111111',
  },
  authModalPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  authModalLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  authModalLinkText: {
    color: '#111111',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  rentModalContent: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  rentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rentModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  rentModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rentSummaryThumb: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rentSummaryDetails: {
    flex: 1,
  },
  rentSummaryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  rentSummaryMeta: {
    color: '#6f6f6f',
    marginTop: 4,
  },
  rentSummaryPrice: {
    color: '#111111',
    fontWeight: '600',
    marginTop: 4,
  },
  rentFieldGroup: {
    marginBottom: 18,
  },
  rentFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
  },
  rentQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  rentQuantityButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentQuantityButtonDisabled: {
    opacity: 0.5,
  },
  rentQuantityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
  },
  rentStockLabel: {
    marginTop: 8,
    color: '#6f6f6f',
  },
  rentFieldRow: {
    flexDirection: 'row',
    gap: 16,
  },
  rentFieldHalf: {
    flex: 1,
  },
  rentDateControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  rentDateInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    paddingVertical: 12,
    marginRight: 12,
  },
  rentCalendarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentDurationRow: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fafafa',
  },
  rentDurationValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  rentFooter: {
    marginTop: 8,
    alignItems: 'stretch',
  },
  rentPrimaryAction: {
    borderRadius: 12,
    backgroundColor: '#111111',
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  rentPrimaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cartModeButton: {
    backgroundColor: '#f4f4f4',
    borderWidth: 1,
    borderColor: '#111111',
  },
  cartModeButtonText: {
    color: '#111111',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: '#cccccc',
  },
});
