import { StyleSheet } from 'react-native';

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
  authNoticeCard: {
    borderRadius: 16,
    backgroundColor: '#111111',
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  authNoticeTextGroup: {
    flex: 1,
    gap: 6,
  },
  authNoticeTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  authNoticeSubtitle: {
    color: '#f5f5f5',
    fontSize: 14,
    lineHeight: 20,
  },
  authNoticeButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  authNoticeButtonText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChips: {
    gap: 12,
    paddingRight: 8,
    marginBottom: 16,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#d5d5d5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  categoryChipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  categoryDetails: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 24,
  },
  categoryDetailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  categoryDetailsDescription: {
    fontSize: 14,
    color: '#444444',
  },
  categoryDetailsDescriptionMuted: {
    fontSize: 14,
    color: '#888888',
  },
  categoryDetailsError: {
    marginTop: 12,
    fontSize: 13,
    color: '#c53030',
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
    marginBottom: 12,
    fontSize: 14,
  },
  helperTextError: {
    color: '#c53030',
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
  },
  retryButtonText: {
    color: '#111111',
    fontWeight: '600',
  },
  horizontalList: {
    gap: 16,
    paddingBottom: 12,
  },
  productCard: {
    width: 200,
    borderRadius: 16,
    backgroundColor: '#f6f6f6',
    padding: 16,
  },
  productThumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  productBrand: {
    fontSize: 14,
    color: '#555555',
    marginVertical: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  productAvailability: {
    fontSize: 12,
    color: '#6f6f6f',
    marginTop: 2,
    fontWeight: '600',
  },
  productDeposit: {
    fontSize: 12,
    color: '#6f6f6f',
    marginTop: 2,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    color: '#777777',
    fontSize: 14,
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

export default styles;
