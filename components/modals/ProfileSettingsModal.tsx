import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import styles from '@/style/profile.styles';

export type ProfileSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  onUpdateProfile: () => void;
  onAddShippingAddress: () => void;
  onManageBankInfo: () => void;
};

export default function ProfileSettingsModal({
  visible,
  onClose,
  onUpdateProfile,
  onAddShippingAddress,
  onManageBankInfo,
}: ProfileSettingsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.settingsModalBackdrop}>
        <Pressable style={styles.settingsModalDismissArea} onPress={onClose} />
        <View style={styles.settingsModalContainer}>
          <Text style={styles.settingsModalTitle}>Cài đặt hồ sơ</Text>
          <View style={styles.settingsModalOptions}>
            <TouchableOpacity
              style={styles.settingsOption}
              onPress={onUpdateProfile}
              accessibilityRole="button"
              accessibilityLabel="Cập nhật hồ sơ"
            >
              <View style={styles.settingsOptionIcon}>
                <Ionicons name="person-outline" size={20} color="#111111" />
              </View>
              <View style={styles.settingsOptionCopy}>
                <Text style={styles.settingsOptionTitle}>Cập nhật hồ sơ</Text>
                <Text style={styles.settingsOptionSubtitle}>
                  Chỉnh sửa thông tin liên lạc của bạn.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsOption}
              onPress={onManageBankInfo}
              accessibilityRole="button"
              accessibilityLabel="Quản lý thông tin ngân hàng"
            >
              <View style={styles.settingsOptionIcon}>
                <Ionicons name="card-outline" size={20} color="#111111" />
              </View>
              <View style={styles.settingsOptionCopy}>
                <Text style={styles.settingsOptionTitle}>Thông tin ngân hàng</Text>
                <Text style={styles.settingsOptionSubtitle}>
                  Quản lý tài khoản để nhận hoàn tiền cọc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsOption, styles.settingsOptionComingSoon]}
              onPress={onAddShippingAddress}
              accessibilityRole="button"
              accessibilityLabel="Thêm địa chỉ giao hàng"
            >
              <View style={[styles.settingsOptionIcon, styles.settingsOptionIconDisabled]}>
                <Ionicons name="location-outline" size={20} color="#9ca3af" />
              </View>
              <View style={styles.settingsOptionCopy}>
                <Text style={styles.settingsOptionTitle}>Địa chỉ giao hàng</Text>
                <Text style={styles.settingsOptionSubtitle}>Sắp ra mắt trong bản cập nhật tới.</Text>
              </View>
              <Ionicons name="time-outline" size={18} color="#d1d5db" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.settingsCancelButton}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.settingsCancelText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
