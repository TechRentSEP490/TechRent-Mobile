import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const categories = [
  { id: 'mobile', title: 'Mobile Phones', icon: 'phone-portrait-outline' },
  { id: 'laptop', title: 'Laptops', icon: 'laptop-outline' },
  { id: 'desktop', title: 'Desktops', icon: 'desktop-outline' },
  { id: 'gaming', title: 'Gaming Consoles', icon: 'game-controller-outline' },
];

const products = [
  {
    id: '1',
    name: 'Sleek smartphone',
    model: 'SmartPhone X',
    price: '$5/day',
  },
  {
    id: '2',
    name: 'Gaming Laptop',
    model: 'PowerPlay Z',
    price: '$25/day',
  },
  {
    id: '3',
    name: 'Tablet 2-in-1',
    model: 'FlexTab 12',
    price: '$10/day',
  },
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
  const bottomItems = useMemo(
    () => [
      { key: 'Home', icon: 'home-outline' },
      { key: 'Search', icon: 'search-outline' },
      { key: 'Orders', icon: 'cube-outline' },
      { key: 'Profile', icon: 'person-outline' },
    ],
    []
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.brand}>TechRent</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.headerIconButton}>
                <Ionicons name="notifications-outline" size={22} color="#111" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconButton}>
                <Ionicons name="cart-outline" size={22} color="#111" />
              </TouchableOpacity>
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
            data={products}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <View style={styles.productCard}>
                <MaterialCommunityIcons name="laptop" size={36} color="#111" style={styles.productIcon} />
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productModel}>{item.model}</Text>
                <Text style={styles.productPrice}>{item.price}</Text>
              </View>
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

        <View style={styles.bottomNav}>
          {bottomItems.map((item, index) => (
            <TouchableOpacity key={item.key} style={styles.bottomNavItem}>
              <Ionicons
                name={item.icon as any}
                size={22}
                color={index === 0 ? '#000' : '#6f6f6f'}
              />
              <Text style={[styles.bottomNavLabel, index === 0 && styles.bottomNavLabelActive]}>
                {item.key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
    paddingBottom: 120,
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
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#eaeaea',
    backgroundColor: '#ffffff',
  },
  bottomNavItem: {
    alignItems: 'center',
    gap: 4,
  },
  bottomNavLabel: {
    fontSize: 12,
    color: '#6f6f6f',
  },
  bottomNavLabelActive: {
    color: '#000000',
    fontWeight: '600',
  },
});
