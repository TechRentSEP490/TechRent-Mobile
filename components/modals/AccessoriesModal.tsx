import { Modal, Text, TouchableOpacity, View } from 'react-native';

import styles from '@/style/product-details.styles';

export type AccessoriesModalProps = {
  visible: boolean;
  items: { label: string; category: string }[];
  onClose: () => void;
};

export default function AccessoriesModal({ visible, items, onClose }: AccessoriesModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Accessories</Text>
          {items.map((item) => (
            <View key={item.label} style={styles.modalRow}>
              <Text style={styles.modalLabel}>{item.label}</Text>
              <Text style={styles.modalValue}>{item.category}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
