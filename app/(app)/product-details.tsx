import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { products } from '../../constants/products';

export default function ProductDetailsScreen() {
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isAccessoriesOpen, setIsAccessoriesOpen] = useState(false);
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

  const { name, model, brand, status, specs, accessories, relatedProducts, reviews } = product;

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

        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Rent Now</Text>
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
});
