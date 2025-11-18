import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import type { ShippingAddress } from '@/services/shipping-addresses';
import styles from '@/style/cart.styles';

export type SavedAddressesModalProps = {
  visible: boolean;
  addresses: ShippingAddress[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onManage: () => void;
  onSelect: (address: ShippingAddress) => void;
  onClose: () => void;
  getTimestampLabel: (address: ShippingAddress) => string | null;
};

export default function SavedAddressesModal({
  visible,
  addresses,
  isLoading,
  isRefreshing,
  onRefresh,
  onManage,
  onSelect,
  onClose,
  getTimestampLabel,
}: SavedAddressesModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.addressPickerBackdrop}>
        <View style={styles.addressPickerContainer}>
          <View style={styles.addressPickerHeader}>
            <Text style={styles.addressPickerTitle}>Saved addresses</Text>
            <TouchableOpacity
              style={styles.addressPickerCloseButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close saved addresses"
            >
              <Ionicons name="close" size={20} color="#111111" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.addressPickerLoading}>
              <ActivityIndicator size="small" color="#111111" />
              <Text style={styles.addressPickerLoadingText}>Loading addresses…</Text>
            </View>
          ) : addresses.length > 0 ? (
            <ScrollView
              style={styles.addressPickerList}
              contentContainerStyle={styles.addressPickerListContent}
              showsVerticalScrollIndicator={false}
            >
              {addresses.map((address) => {
                const timestamp = getTimestampLabel(address);
                return (
                  <TouchableOpacity
                    key={address.shippingAddressId}
                    style={styles.addressPickerItem}
                    onPress={() => onSelect(address)}
                    accessibilityRole="button"
                    accessibilityLabel="Use this shipping address"
                  >
                    <Text style={styles.addressPickerItemText}>{address.address}</Text>
                    {timestamp ? (
                      <Text style={styles.addressPickerItemMeta}>{timestamp}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.addressPickerEmpty}>
              <Ionicons name="home-outline" size={42} color="#6f6f6f" />
              <Text style={styles.addressPickerEmptyTitle}>No saved addresses</Text>
              <Text style={styles.addressPickerEmptySubtitle}>
                Manage your addresses to add one before selecting it here.
              </Text>
            </View>
          )}

          <View style={styles.addressPickerFooter}>
            <TouchableOpacity
              style={[styles.addressPickerRefreshButton, isRefreshing && styles.addressPickerRefreshButtonDisabled]}
              onPress={onRefresh}
              disabled={isRefreshing}
              accessibilityRole="button"
              accessibilityLabel="Refresh saved addresses"
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#111111" />
              ) : (
                <>
                  <Ionicons
                    name="refresh"
                    size={18}
                    color="#111111"
                    style={styles.addressPickerRefreshIcon}
                  />
                  <Text style={styles.addressPickerRefreshText}>Refresh</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addressPickerManageButton}
              onPress={onManage}
              accessibilityRole="button"
              accessibilityLabel="Manage shipping addresses"
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color="#111111"
                style={styles.addressPickerManageIcon}
              />
              <Text style={styles.addressPickerManageText}>Manage</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
