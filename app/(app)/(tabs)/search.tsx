import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProductDetail } from '@/constants/products';
import { fetchBrands, type BrandPayload } from '@/services/brands';
import { fetchDeviceCategories, type DeviceCategory } from '@/services/device-categories';
import {
  searchDeviceModels,
  type PaginatedSearchResult,
  type SearchDeviceModelsParams,
} from '@/services/device-models';
import styles from '@/style/search.styles';

const PAGE_SIZE = 20;

export default function SearchScreen() {
  const router = useRouter();

  // Filter data
  const [brands, setBrands] = useState<BrandPayload[]>([]);
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Results state
  const [results, setResults] = useState<ProductDetail[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLastPage, setIsLastPage] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Load filter data on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [brandsData, categoriesData] = await Promise.all([
          fetchBrands(),
          fetchDeviceCategories(),
        ]);
        setBrands(brandsData.filter((b) => b.active));
        setCategories(categoriesData.filter((c) => c.active));
      } catch (err) {
        console.error('Failed to load filters:', err);
      } finally {
        setLoadingFilters(false);
      }
    };

    void loadFilters();
  }, []);

  // Get selected filter names - hiển thị brandName và deviceCategoryName
  const selectedBrandName = useMemo(() => {
    if (selectedBrandId === null) return null;
    return brands.find((b) => b.brandId === selectedBrandId)?.brandName ?? null;
  }, [brands, selectedBrandId]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === null) return null;
    return categories.find((c) => c.id === String(selectedCategoryId))?.name ?? null;
  }, [categories, selectedCategoryId]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchQuery.trim() !== '' || selectedBrandId !== null || selectedCategoryId !== null;
  }, [searchQuery, selectedBrandId, selectedCategoryId]);

  // Build search params
  const buildSearchParams = useCallback(
    (page: number): SearchDeviceModelsParams => ({
      deviceName: searchQuery.trim() || undefined,
      brandId: selectedBrandId ?? undefined,
      deviceCategoryId: selectedCategoryId ?? undefined,
      isActive: true,
      page,
      size: PAGE_SIZE,
    }),
    [searchQuery, selectedBrandId, selectedCategoryId]
  );

  // Perform search
  const performSearch = useCallback(
    async (page: number = 0, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const params = buildSearchParams(page);
        const result: PaginatedSearchResult = await searchDeviceModels(params);

        if (append) {
          setResults((prev) => [...prev, ...result.content]);
        } else {
          setResults(result.content);
        }

        setCurrentPage(result.page);
        setTotalElements(result.totalElements);
        setIsLastPage(result.last);
        setHasSearched(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Không thể tìm kiếm. Vui lòng thử lại.';
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [buildSearchParams]
  );

  // Handle search button press
  const handleSearch = useCallback(() => {
    void performSearch(0);
  }, [performSearch]);

  // Handle load more (pagination)
  const handleLoadMore = useCallback(() => {
    if (!isLastPage && !loadingMore) {
      void performSearch(currentPage + 1, true);
    }
  }, [currentPage, isLastPage, loadingMore, performSearch]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await performSearch(0);
  }, [performSearch]);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedBrandId(null);
    setSelectedCategoryId(null);
    setResults([]);
    setHasSearched(false);
  }, []);

  // Handle product press - navigate to product details
  const handleProductPress = useCallback(
    (item: ProductDetail) => {
      router.push({
        pathname: '/(app)/product-details',
        params: { productId: item.id },
      });
    },
    [router]
  );

  // Handle brand selection
  const handleBrandSelect = useCallback((brandId: number | null) => {
    setSelectedBrandId(brandId);
    setShowBrandModal(false);
  }, []);

  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
    setShowCategoryModal(false);
  }, []);

  // Render device card
  const renderDeviceCard = useCallback(
    (item: ProductDetail) => {
      const isAvailable = item.stock > 0;

      return (
        <TouchableOpacity
          style={styles.deviceCard}
          activeOpacity={0.85}
          onPress={() => handleProductPress(item)}
        >
          <View style={styles.deviceImageContainer}>
            {item.imageURL ? (
              <Image
                source={{ uri: item.imageURL }}
                style={styles.deviceImage}
                resizeMode="cover"
              />
            ) : (
              <MaterialCommunityIcons name="image-off-outline" size={40} color="#cccccc" />
            )}
          </View>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.deviceBrand}>{item.brand}</Text>
            <Text style={styles.devicePrice}>{item.price}</Text>
            <Text
              style={[styles.deviceAvailability, !isAvailable && styles.deviceUnavailable]}
            >
              {isAvailable ? `${item.stock} có sẵn` : 'Hết hàng'}
            </Text>
            {typeof item.depositPercent === 'number' && (
              <Text style={styles.deviceDeposit}>
                Đặt cọc: {Math.round(item.depositPercent * 100)}%
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleProductPress]
  );

  // Render filter modal
  const renderFilterModal = useCallback(
    <T extends { id: string | number; name: string }>(
      visible: boolean,
      onClose: () => void,
      title: string,
      items: T[],
      selectedId: string | number | null,
      onSelect: (id: number | null) => void,
      idKey: keyof T
    ) => (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[styles.modalItem, selectedId === null && styles.modalItemSelected]}
                onPress={() => onSelect(null)}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    selectedId === null && styles.modalItemTextSelected,
                  ]}
                >
                  Tất cả
                </Text>
                {selectedId === null && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color="#111111"
                    style={styles.modalCheckIcon}
                  />
                )}
              </TouchableOpacity>
              {items.map((item) => {
                const itemId = item[idKey] as string | number;
                const isSelected = String(selectedId) === String(itemId);

                return (
                  <TouchableOpacity
                    key={String(itemId)}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => onSelect(Number(itemId))}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        isSelected && styles.modalItemTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color="#111111"
                        style={styles.modalCheckIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Tìm kiếm</Text>
            {loading && <ActivityIndicator size="small" color="#111111" />}
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên thiết bị..."
              placeholderTextColor="#7f7f7f"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Ionicons name="search" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Filter Chips - Brand và Category */}
          <View style={styles.filtersRow}>
            <TouchableOpacity
              style={[styles.filterChip, selectedBrandId !== null && styles.filterChipActive]}
              onPress={() => setShowBrandModal(true)}
              disabled={loadingFilters}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedBrandId !== null && styles.filterChipTextActive,
                ]}
                numberOfLines={1}
              >
                {selectedBrandName ?? 'Thương hiệu'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={selectedBrandId !== null ? '#ffffff' : '#555555'}
                style={styles.filterChipIcon}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, selectedCategoryId !== null && styles.filterChipActive]}
              onPress={() => setShowCategoryModal(true)}
              disabled={loadingFilters}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategoryId !== null && styles.filterChipTextActive,
                ]}
                numberOfLines={1}
              >
                {selectedCategoryName ?? 'Danh mục'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={selectedCategoryId !== null ? '#ffffff' : '#555555'}
                style={styles.filterChipIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <View style={styles.activeFiltersContainer}>
              {searchQuery.trim() !== '' && (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterTagText}>"{searchQuery}"</Text>
                  <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => setSearchQuery('')}
                  >
                    <Ionicons name="close-circle" size={16} color="#0066cc" />
                  </TouchableOpacity>
                </View>
              )}
              {selectedBrandName && (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterTagText}>{selectedBrandName}</Text>
                  <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => setSelectedBrandId(null)}
                  >
                    <Ionicons name="close-circle" size={16} color="#0066cc" />
                  </TouchableOpacity>
                </View>
              )}
              {selectedCategoryName && (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterTagText}>{selectedCategoryName}</Text>
                  <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => setSelectedCategoryId(null)}
                  >
                    <Ionicons name="close-circle" size={16} color="#0066cc" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.clearAllFiltersButton} onPress={handleClearFilters}>
                <Text style={styles.clearAllFiltersText}>Xóa tất cả</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Results Header */}
          {hasSearched && !loading && (
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {totalElements} kết quả
              </Text>
            </View>
          )}

          {/* Error State */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleSearch}>
                <Text style={styles.retryButtonText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading State */}
          {loading && !refreshing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#111111" />
              <Text style={styles.loadingText}>Đang tìm kiếm...</Text>
            </View>
          )}

          {/* Initial State - Before any search */}
          {!hasSearched && !loading && !error && (
            <View style={styles.initialContainer}>
              <Ionicons
                name="search-outline"
                size={64}
                color="#cccccc"
                style={styles.initialIcon}
              />
              <Text style={styles.initialTitle}>Tìm kiếm thiết bị</Text>
              <Text style={styles.initialSubtitle}>
                Nhập tên thiết bị hoặc chọn bộ lọc để bắt đầu tìm kiếm
              </Text>
            </View>
          )}

          {/* Empty State */}
          {hasSearched && !loading && results.length === 0 && !error && (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="magnify-close"
                size={64}
                color="#cccccc"
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>Không tìm thấy kết quả</Text>
              <Text style={styles.emptySubtitle}>
                Thử thay đổi từ khóa hoặc bộ lọc để tìm kiếm khác
              </Text>
            </View>
          )}

          {/* Results Grid */}
          {results.length > 0 && !loading && (
            <>
              <View style={styles.resultsGrid}>
                {results.map((item) => (
                  <View key={item.id}>{renderDeviceCard(item)}</View>
                ))}
              </View>

              {/* Load More - Pagination */}
              {!isLastPage && (
                <View style={styles.loadMoreContainer}>
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#111111" />
                  ) : (
                    <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
                      <Text style={styles.loadMoreButtonText}>Tải thêm</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Brand Modal - hiển thị brandName */}
        {renderFilterModal(
          showBrandModal,
          () => setShowBrandModal(false),
          'Chọn thương hiệu',
          brands.map((b) => ({ id: b.brandId, name: b.brandName, brandId: b.brandId })),
          selectedBrandId,
          handleBrandSelect,
          'brandId'
        )}

        {/* Category Modal - hiển thị deviceCategoryName */}
        {renderFilterModal(
          showCategoryModal,
          () => setShowCategoryModal(false),
          'Chọn danh mục',
          categories.map((c) => ({ id: c.id, name: c.name, deviceCategoryId: Number(c.id) })),
          selectedCategoryId,
          handleCategorySelect,
          'deviceCategoryId'
        )}
      </View>
    </SafeAreaView>
  );
}
