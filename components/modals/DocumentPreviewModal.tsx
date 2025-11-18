import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import styles from '@/style/kyc-status.styles';

export type DocumentPreview = {
  label: string;
  uri: string;
};

export type DocumentPreviewModalProps = {
  visible: boolean;
  preview: DocumentPreview;
  imageStyle: StyleProp<ViewStyle>;
  onClose: () => void;
};

export default function DocumentPreviewModal({
  visible,
  preview,
  imageStyle,
  onClose,
}: DocumentPreviewModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <View style={styles.previewContent}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{preview.label}</Text>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close document preview"
            >
              <Ionicons name="close" size={20} color="#111111" />
            </TouchableOpacity>
          </View>
          <Image source={{ uri: preview.uri }} style={[styles.previewImage, imageStyle]} contentFit="contain" />
          <Text style={styles.previewHint}>Use the close button to return to your documents.</Text>
        </View>
      </View>
    </Modal>
  );
}
