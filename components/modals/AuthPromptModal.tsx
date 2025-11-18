import { Modal, Text, TouchableOpacity, View } from 'react-native';

import styles from '@/style/product-details.styles';

export type AuthPromptModalProps = {
  visible: boolean;
  mode: 'rent' | 'cart' | null;
  onClose: () => void;
  onNavigate: (path: string) => void;
};

export default function AuthPromptModal({ visible, mode, onClose, onNavigate }: AuthPromptModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.authModalContent}>
          <Text style={styles.authModalTitle}>Sign in required</Text>
          <Text style={styles.authModalDescription}>
            {mode === 'cart'
              ? 'Sign in or create an account to add this device to your cart.'
              : 'Sign in or create an account to rent this device.'}
          </Text>
          <View style={styles.authModalActions}>
            <TouchableOpacity style={styles.authModalSecondary} onPress={onClose}>
              <Text style={styles.authModalSecondaryText}>Maybe later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.authModalPrimary}
              onPress={() => onNavigate('/(auth)/sign-in')}
            >
              <Text style={styles.authModalPrimaryText}>Sign In</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.authModalLink} onPress={() => onNavigate('/(auth)/sign-up')}>
            <Text style={styles.authModalLinkText}>New here? Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
