import { Modal, Text, TouchableOpacity, View } from 'react-native';

import styles from '@/style/product-details.styles';

export type DeviceSpecsModalProps = {
  visible: boolean;
  items: { label: string; value: string }[];
  onClose: () => void;
};

export default function DeviceSpecsModal({ visible, items, onClose }: DeviceSpecsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Device Specifications</Text>
          {items.length > 0 ? (
            items.map((item) => (
              <View key={`${item.label}-${item.value}`} style={styles.modalRow}>
                <Text style={styles.modalLabel}>{item.label}</Text>
                <Text style={styles.modalValue}>{item.value}</Text>
              </View>
            ))
          ) : (
            <View style={styles.modalEmptyState}>
              <Text style={styles.modalEmptyText}>
                Specifications will appear once they are available.
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
