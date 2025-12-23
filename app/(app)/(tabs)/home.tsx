import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProductDetail } from '@/constants/products';
import { useAuth } from '@/contexts/AuthContext';
import { useDeviceCategories } from '@/hooks/use-device-categories';
import { useDeviceModels } from '@/hooks/use-device-models';
import { fetchDeviceCategoryById, type DeviceCategory } from '@/services/device-categories';
import styles from '@/style/home.styles';

const reviews = [
  {
    id: 'r1',
    title: 'Happy Customer',
    content: 'Sleek smartphone',
  },
  {
    id: 'r2',
    title: 'Great Product',
    content: 'Gaming Laptop',
  },
  {
    id: 'r3',
    title: 'Excellent Support',
    content: 'Tablet arrived fast',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { isSignedIn, isHydrating } = useAuth();
  const { data: deviceModels, loading, error, refetch } = useDeviceModels();
  const {
    data: categories,
    loading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useDeviceCategories();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<'all' | string>('all');
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory | null>(null);
  const [categoryDetailLoading, setCategoryDetailLoading] = useState(false);
  const [categoryDetailError, setCategoryDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCategoryId === 'all') {
      return;
    }

    const stillExists = categories.some((category) => category.id === selectedCategoryId);

    if (!stillExists) {
      setSelectedCategoryId('all');
      setSelectedCategory(null);
      setCategoryDetailError(null);
    }
  }, [categories, selectedCategoryId]);

  const quickActions = useMemo(
    () => [
      {
        key: 'notifications',
        icon: 'notifications-outline',
        onPress: () => router.push('/(app)/notifications'),
      },
      {
        key: 'chat',
        icon: 'chatbubble-ellipses-outline',
        onPress: () => {
          if (isHydrating) {
            return;
          }

          if (!isSignedIn) {
            router.push('/(auth)/sign-in');
            return;
          }

          router.push('/(app)/chat');
        },
      },
      {
        key: 'cart',
        icon: 'cart-outline',
        onPress: () => {
          if (isHydrating) {
            return;
          }

          if (!isSignedIn) {
            router.push('/(auth)/sign-in');
            return;
          }

          router.push('/(app)/cart');
        },
      },
    ],
    [isHydrating, isSignedIn, router]
  );

  const categoryOptions = useMemo(
    () => [
      { id: 'all' as const, name: 'All' },
      ...categories.map((category) => ({ id: category.id, name: category.name })),
    ],
    [categories]
  );

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === 'all') {
      return null;
    }

    if (selectedCategory?.name) {
      return selectedCategory.name;
    }

    return categories.find((category) => category.id === selectedCategoryId)?.name ?? null;
  }, [categories, selectedCategory, selectedCategoryId]);

  const filteredProducts = useMemo(() => {
    if (selectedCategoryId === 'all') {
      return deviceModels;
    }

    return deviceModels.filter((item) =>
      item.deviceCategoryId ? String(item.deviceCategoryId) === selectedCategoryId : false
    );
  }, [deviceModels, selectedCategoryId]);

  const handleProductPress = useCallback(
    (item: ProductDetail) => {
      router.push({
        pathname: '/(app)/product-details',
        params: { productId: item.id },
      });
    },
    [router]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), refetchCategories()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, refetchCategories]);

  const handleCategoryPress = useCallback(
    async (categoryId: string) => {
      if (categoryId === selectedCategoryId) {
        return;
      }

      setSelectedCategoryId(categoryId);

      if (categoryId === 'all') {
        setSelectedCategory(null);
        setCategoryDetailError(null);
        setCategoryDetailLoading(false);
        return;
      }

      const optimisticCategory = categories.find((category) => category.id === categoryId) ?? null;
      setSelectedCategory(optimisticCategory);
      setCategoryDetailError(null);
      setCategoryDetailLoading(true);

      try {
        const detail = await fetchDeviceCategoryById(categoryId);
        setSelectedCategory(detail);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load category details.';
        setCategoryDetailError(message);
      } finally {
        setCategoryDetailLoading(false);
      }
    },
    [categories, selectedCategoryId]
  );

  const helperText = error
    ? 'Unable to fetch the latest catalog. Showing saved devices.'
    : 'Find what you need easily!';

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.brand}>TechRent</Text>
            <View style={styles.headerIcons}>
              {quickActions.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.headerIconButton}
                  onPress={item.onPress}
                  activeOpacity={item.onPress ? 0.7 : 1}
                >
                  <Ionicons name={item.icon as any} size={22} color="#111" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!isHydrating && !isSignedIn && (
            <View style={styles.authNoticeCard}>
              <View style={styles.authNoticeTextGroup}>
                <Text style={styles.authNoticeTitle}>Sign in to rent devices</Text>
                <Text style={styles.authNoticeSubtitle}>
                  Create an account or sign in to add items to your cart and complete rentals.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.authNoticeButton}
                activeOpacity={0.85}
                onPress={() => router.push('/(auth)/sign-in')}
              >
                <Text style={styles.authNoticeButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Categories</Text>
            {(categoriesLoading || categoryDetailLoading) && (
              <ActivityIndicator size="small" color="#111111" />
            )}
          </View>

          {categoriesError ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                void refetchCategories();
              }}
            >
              <Text style={styles.retryButtonText}>Reload categories</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {categoryOptions.map((category) => {
                const isActive = category.id === selectedCategoryId;

                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    activeOpacity={0.85}
                    onPress={() => void handleCategoryPress(category.id)}
                  >
                    <Text
                      style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedCategoryId !== 'all' && !categoriesError && (
            <View style={styles.categoryDetails}>
              <Text style={styles.categoryDetailsTitle}>{selectedCategoryName}</Text>
              {selectedCategory?.description ? (
                <Text style={styles.categoryDetailsDescription}>{selectedCategory.description}</Text>
              ) : categoryDetailLoading ? (
                <Text style={styles.categoryDetailsDescriptionMuted}>Loading details...</Text>
              ) : (
                <Text style={styles.categoryDetailsDescriptionMuted}>
                  No description available for this category.
                </Text>
              )}
              {categoryDetailError && (
                <Text style={styles.categoryDetailsError}>{categoryDetailError}</Text>
              )}
            </View>
          )}

          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for products..."
              placeholderTextColor="#7f7f7f"
            />
            <TouchableOpacity style={styles.searchButton}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.helperText, error && styles.helperTextError]}>{helperText}</Text>
          {error && (
            <TouchableOpacity style={styles.retryButton} onPress={() => void handleRefresh()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Our Products</Text>
            {loading && <ActivityIndicator size="small" color="#111111" />}
          </View>

          {filteredProducts.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {filteredProducts.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.productCard}
                  activeOpacity={0.85}
                  onPress={() => handleProductPress(item)}
                >
                  <View style={styles.productThumbnail}>
                    {item.imageURL ? (
                      <Image source={{ uri: item.imageURL }} style={styles.productImage} resizeMode="cover" />
                    ) : (
                      <MaterialCommunityIcons name="image-off-outline" size={32} color="#111" />
                    )}
                  </View>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productBrand}>{item.brand}</Text>
                  <Text style={styles.productPrice}>{item.price}</Text>
                  <Text style={styles.productAvailability}>
                    {item.stock > 0 ? `${item.stock} available` : 'Out of stock'}
                  </Text>
                  {typeof item.depositPercent === 'number' && (
                    <Text style={styles.productDeposit}>
                      Deposit: {Math.round(item.depositPercent * 100)}%
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {selectedCategoryId === 'all'
                  ? 'No devices available right now.'
                  : 'No devices found in this category.'}
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Customer Ratings</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {reviews.map((item) => (
              <View key={item.id} style={styles.reviewCard}>
                <Ionicons name="chatbubbles-outline" size={28} color="#111" style={styles.reviewIcon} />
                <Text style={styles.reviewTitle}>{item.title}</Text>
                <Text style={styles.reviewContent}>{item.content}</Text>
              </View>
            ))}
          </ScrollView>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
