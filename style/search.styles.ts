import { Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

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
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
  },
  searchButton: {
    backgroundColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filters
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555555',
    flex: 1,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  filterChipIcon: {
    marginLeft: 6,
  },

  // Active Filters Summary
  activeFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  activeFilterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4fd',
    borderRadius: 16,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
  },
  activeFilterTagText: {
    fontSize: 13,
    color: '#0066cc',
    fontWeight: '500',
  },
  clearFilterButton: {
    marginLeft: 6,
    padding: 2,
  },
  clearAllFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearAllFiltersText: {
    fontSize: 13,
    color: '#c53030',
    fontWeight: '500',
  },

  // Results Header
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 14,
    color: '#666666',
  },

  // Results Grid
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },

  // Device Card
  deviceCard: {
    width: CARD_WIDTH,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
  },
  deviceImageContainer: {
    width: '100%',
    height: 130,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceImage: {
    width: '100%',
    height: '100%',
  },
  deviceInfo: {
    padding: 12,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  deviceBrand: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 6,
  },
  devicePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  deviceAvailability: {
    fontSize: 11,
    color: '#22c55e',
    marginTop: 4,
    fontWeight: '600',
  },
  deviceUnavailable: {
    color: '#ef4444',
  },
  deviceDeposit: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },

  // Load More
  loadMoreContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#111111',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  loadMoreButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Loading States
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },

  // Empty State
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Error State
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#c53030',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#111111',
    fontWeight: '600',
    fontSize: 14,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    paddingVertical: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalItemSelected: {
    backgroundColor: '#f5f5f5',
  },
  modalItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  modalItemTextSelected: {
    fontWeight: '600',
    color: '#111111',
  },
  modalCheckIcon: {
    marginLeft: 12,
  },

  // Initial state
  initialContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialIcon: {
    marginBottom: 16,
  },
  initialTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  initialSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});

export default styles;
