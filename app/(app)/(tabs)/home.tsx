import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { productSummaries } from '../../../constants/products';

const categories = [
  { id: 'mobile', title: 'Mobile Phones', icon: 'phone-portrait-outline' },
  { id: 'laptop', title: 'Laptops', icon: 'laptop-outline' },
  { id: 'desktop', title: 'Desktops', icon: 'desktop-outline' },
  { id: 'gaming', title: 'Gaming Consoles', icon: 'game-controller-outline' },
];

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
  const quickActions = useMemo(
    () => [
      { key: 'notifications', icon: 'notifications-outline' },
      { key: 'cart', icon: 'cart-outline' },
    ],
    []
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.brand}>TechRent</Text>
            <View style={styles.headerIcons}>
              {quickActions.map((item) => (
                <TouchableOpacity key={item.key} style={styles.headerIconButton}>
                  <Ionicons name={item.icon as any} size={22} color="#111" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoriesGrid}>
            {categories.map((item) => (
              <View key={item.id} style={styles.categoryCard}>
                <View style={styles.categoryIconWrapper}>
                  <Ionicons name={item.icon as any} size={28} color="#111" />
                </View>
                <Text style={styles.categoryTitle}>{item.title}</Text>
              </View>
            ))}
          </View>

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
          <Text style={styles.helperText}>Find what you need easily!</Text>

          <Text style={styles.sectionTitle}>Our Products</Text>
          <FlatList
            data={productSummaries}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.productCard}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/product-details',
                    params: { productId: item.id },
                  })
                }
              >
                <MaterialCommunityIcons name="laptop" size={36} color="#111" style={styles.productIcon} />
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productModel}>{item.model}</Text>
                <Text style={styles.productPrice}>{item.price}</Text>
              </TouchableOpacity>
            )}
          />

          <Text style={styles.sectionTitle}>Customer Ratings</Text>
          <FlatList
            data={reviews}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <View style={styles.reviewCard}>
                <Ionicons name="chatbubbles-outline" size={28} color="#111" style={styles.reviewIcon} />
                <Text style={styles.reviewTitle}>{item.title}</Text>
                <Text style={styles.reviewContent}>{item.content}</Text>
              </View>
            )}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  categoryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  helperText: {
    color: '#777777',
    marginBottom: 24,
    fontSize: 14,
  },
  horizontalList: {
    gap: 16,
    paddingBottom: 12,
  },
  productCard: {
    width: 180,
    borderRadius: 16,
    backgroundColor: '#f6f6f6',
    padding: 16,
  },
  productIcon: {
    marginBottom: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  productModel: {
    fontSize: 14,
    color: '#555555',
    marginVertical: 6,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  reviewCard: {
    width: 200,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  reviewIcon: {
    marginBottom: 12,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
  },
  reviewContent: {
    fontSize: 14,
    color: '#555555',
  },
});
