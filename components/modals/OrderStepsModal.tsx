import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Modal, Pressable, Text, View, type DimensionValue } from 'react-native';

import styles from '@/style/orders.styles';

export type OrderStepsModalProps = {
  visible: boolean;
  onClose: () => void;
  currentStep: number;
  progressWidth: DimensionValue;
  progressStage?: string;
  title?: string;
  children: ReactNode;
};

export default function OrderStepsModal({
  visible,
  onClose,
  currentStep,
  progressWidth,
  progressStage = 'Final Review',
  title = 'Complete Rental Agreement',
  children,
}: OrderStepsModalProps) {
  return (
    <Modal animationType="slide" visible={visible} transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#111" />
            </Pressable>
          </View>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Step {currentStep} of 3</Text>
            <Text style={styles.progressStage}>{progressStage}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
