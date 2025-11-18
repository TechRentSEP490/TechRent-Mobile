import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f4f4',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  markAllText: {
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: '600',
  },
  markAllTextDisabled: {
    color: '#c5cae9',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f7f7f',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  notificationCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededed',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  notificationCardUnread: {
    borderColor: '#c7d2fe',
    backgroundColor: '#f8f9ff',
  },
  notificationCardRead: {
    opacity: 0.9,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    gap: 6,
  },
  notificationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  notificationDescription: {
    fontSize: 14,
    color: '#4d4d4d',
    lineHeight: 20,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  notificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#9a9a9a',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#111111',
  },
  actionLabel: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  loadMoreButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  loadMoreText: {
    fontSize: 15,
    color: '#4f46e5',
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 16,
  },
  footerSpacer: {
    height: 16,
  },
  typeBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  realtimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  realtimeStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  realtimeStatusDotConnected: {
    backgroundColor: '#22c55e',
  },
  realtimeStatusDotConnecting: {
    backgroundColor: '#f59e0b',
  },
  realtimeStatusDotDisconnected: {
    backgroundColor: '#ef4444',
  },
  realtimeStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  realtimeErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#dc2626',
  },
  realtimeRetryButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  realtimeRetryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#4d4d4d',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    backgroundColor: '#ffffff',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  stateText: {
    fontSize: 16,
    color: '#4d4d4d',
    textAlign: 'center',
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#111111',
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default styles;
