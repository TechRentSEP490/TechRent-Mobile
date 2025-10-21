import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

type NotificationAction = {
  label: string;
};

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'alert' | 'info';
  action?: NotificationAction;
};

const notifications: NotificationItem[] = [
  {
    id: '1',
    title: 'Order Confirmed',
    description: 'Complete process now for order #ORD-12345',
    timestamp: '2 minutes ago',
    status: 'success',
    action: { label: 'Continue Process' },
  },
  {
    id: '2',
    title: 'Order Rejected',
    description: 'Order #ORD-12346 rejected due to KYC verification failure',
    timestamp: '15 minutes ago',
    status: 'alert',
  },
  {
    id: '3',
    title: 'Order Cancelled',
    description: 'Order #ORD-12347 cancelled - insufficient devices passed QC',
    timestamp: '1 hour ago',
    status: 'alert',
  },
  {
    id: '4',
    title: 'Customer Service Update',
    description: 'Order #ORD-12348 updated due to insufficient device quantity',
    timestamp: '2 hours ago',
    status: 'info',
  },
  {
    id: '5',
    title: 'Delivery Scheduled',
    description: 'Your order will be delivered on Jan 15, 2025 between 2-4 PM',
    timestamp: 'Yesterday',
    status: 'info',
    action: { label: 'Change Time' },
  },
  {
    id: '6',
    title: 'Contract Ending Soon',
    description: 'Your contract expires on Jan 30, 2025. Renew to continue service',
    timestamp: 'Yesterday',
    status: 'alert',
    action: { label: 'Renew' },
  },
  {
    id: '7',
    title: 'Pickup Scheduled',
    description: 'Device pickup scheduled for Jan 22, 2025 at 10:00 AM',
    timestamp: '2 days ago',
    status: 'info',
    action: { label: 'Change Time' },
  },
  {
    id: '8',
    title: 'Late Payment Reminder',
    description: 'Payment required for late delivery on Order #ORD-12349',
    timestamp: '2 days ago',
    status: 'alert',
    action: { label: 'Pay Now' },
  },
  {
    id: '9',
    title: 'Proof of Damage',
    description: 'Please submit damage proof for Order #ORD-12350',
    timestamp: '3 days ago',
    status: 'alert',
    action: { label: 'Take Action' },
  },
];

const statusStyles = {
  success: { icon: 'checkmark-circle', color: '#2ecc71', background: '#eafaf1' },
  alert: { icon: 'close-circle', color: '#e74c3c', background: '#fdecea' },
  info: { icon: 'information-circle', color: '#3498db', background: '#ebf5fb' },
} as const;

export default function NotificationsScreen() {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  const visibleNotifications = useMemo(
    () => (showAll ? notifications : notifications.slice(0, 4)),
    [showAll]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Today</Text>

        <FlatList
          data={visibleNotifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const status = statusStyles[item.status];

            return (
              <View style={styles.notificationCard}>
                <View style={[styles.iconBadge, { backgroundColor: status.background }]}>
                  <Ionicons name={status.icon as any} size={20} color={status.color} />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationDescription}>{item.description}</Text>
                  <View style={styles.notificationFooter}>
                    <Text style={styles.timestamp}>{item.timestamp}</Text>
                    {item.action ? (
                      <TouchableOpacity style={styles.actionButton}>
                        <Text style={styles.actionLabel}>{item.action.label}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            !showAll ? (
              <TouchableOpacity style={styles.loadMoreButton} onPress={() => setShowAll(true)}>
                <Text style={styles.loadMoreText}>Load more notifications</Text>
              </TouchableOpacity>
            ) : null
          }
        />
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
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    gap: 4,
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
  timestamp: {
    fontSize: 12,
    color: '#9a9a9a',
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
});
