import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
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
import { products } from '../../constants/products';

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
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState(() => formatDate(new Date()));
  const [endDate, setEndDate] = useState(() => formatDate(addDays(new Date(), 7)));
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();

  const product = useMemo(() => {
    if (typeof productId === 'string') {
      const match = products.find((item) => item.id === productId);
      if (match) {
        return match;
      }
    }
    return products[0];
  }, [productId]);

  const { name, model, brand, status, specs, accessories, relatedProducts, reviews, price, stock } = product;

  const isOutOfStock = stock <= 0;
  const maxQuantity = Math.max(stock, 1);
  const stockLabel = stock > 0 ? `${stock} in stock` : 'Out of stock';

  const rentalDuration = useMemo(() => {
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return 0;
    }
    const diff = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [startDate, endDate]);

  const rentalDurationLabel = rentalDuration === 1 ? '1 day' : `${rentalDuration} days`;

  const openRentModal = () => {
    const today = new Date();
    setQuantity(1);
    setStartDate(formatDate(today));
    setEndDate(formatDate(addDays(today, 7)));
    setIsRentOpen(true);
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

        <View style={styles.imagePreview}>
          <Text style={styles.imageText}>Explore images of the product.</Text>
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

        <TouchableOpacity style={styles.primaryButton} onPress={openRentModal}>
          <Text style={styles.primaryButtonText}>Rent Now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={openRentModal}>
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

      <Modal visible={isRentOpen} transparent animationType="fade" onRequestClose={() => setIsRentOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.rentModalContent}>
            <View style={styles.rentModalHeader}>
              <Text style={styles.rentModalTitle}>Rent Device</Text>
              <TouchableOpacity style={styles.rentModalClose} onPress={() => setIsRentOpen(false)}>
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
                style={[styles.rentSecondaryAction, isOutOfStock && styles.disabledButton]}
                disabled={isOutOfStock}
              >
                <Text style={styles.rentSecondaryActionText}>Add to Cart</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rentPrimaryAction, isOutOfStock && styles.disabledButton]}
                disabled={isOutOfStock}
              >
                <Text style={styles.rentPrimaryActionText}>Rent Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isSpecsOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Device Specifications</Text>
            {specs.map((item) => (
              <View key={item.label} style={styles.modalRow}>
                <Text style={styles.modalLabel}>{item.label}</Text>
                <Text style={styles.modalValue}>{item.value}</Text>
              </View>
            ))}
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
  imagePreview: {
    height: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  imageText: {
    color: '#6c6c6c',
    fontSize: 15,
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
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rentSecondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  rentSecondaryActionText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600',
  },
  rentPrimaryAction: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#111111',
    paddingVertical: 16,
    alignItems: 'center',
  },
  rentPrimaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
