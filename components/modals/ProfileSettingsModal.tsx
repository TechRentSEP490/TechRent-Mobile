import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import styles from '@/style/profile.styles';

export type ProfileSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  onUpdateProfile: () => void;
  onAddShippingAddress: () => void;
};

export default function ProfileSettingsModal({
  visible,
  onClose,
  onUpdateProfile,
  onAddShippingAddress,
}: ProfileSettingsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.settingsModalBackdrop}>
        <Pressable style={styles.settingsModalDismissArea} onPress={onClose} />
        <View style={styles.settingsModalContainer}>
          <Text style={styles.settingsModalTitle}>Profile settings</Text>
          <View style={styles.settingsModalOptions}>
            <TouchableOpacity
              style={styles.settingsOption}
              onPress={onUpdateProfile}
              accessibilityRole="button"
              accessibilityLabel="Update profile"
            >
              <View style={styles.settingsOptionIcon}>
                <Ionicons name="person-outline" size={20} color="#111111" />
              </View>
              <View style={styles.settingsOptionCopy}>
                <Text style={styles.settingsOptionTitle}>Update profile</Text>
                <Text style={styles.settingsOptionSubtitle}>
                  Edit your contact details and keep your account current.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingsOption, styles.settingsOptionComingSoon]}
              onPress={onAddShippingAddress}
              accessibilityRole="button"
              accessibilityLabel="Add shipping address"
            >
              <View style={[styles.settingsOptionIcon, styles.settingsOptionIconDisabled]}>
                <Ionicons name="location-outline" size={20} color="#9ca3af" />
              </View>
              <View style={styles.settingsOptionCopy}>
                <Text style={styles.settingsOptionTitle}>Add shipping address</Text>
                <Text style={styles.settingsOptionSubtitle}>Available in an upcoming update.</Text>
              </View>
              <Ionicons name="time-outline" size={18} color="#d1d5db" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.settingsCancelButton}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.settingsCancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
