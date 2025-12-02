import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import styles from '@/style/orders.styles';

export type PaymentModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onOpenInBrowser?: () => void;
  canOpenInBrowser?: boolean;
  errorMessage?: string | null;
  children: ReactNode;
};

export default function PaymentModal({
  visible,
  title,
  onClose,
  onOpenInBrowser,
  canOpenInBrowser = false,
  errorMessage,
  children,
}: PaymentModalProps) {
  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.paymentModalContainer} edges={['top']}>
        <View style={styles.paymentModalHeader}>
          <Pressable style={styles.paymentModalCloseButton} onPress={onClose}>
            <Ionicons name="chevron-back" size={20} color="#111111" />
          </Pressable>
          <Text style={styles.paymentModalTitle}>{title}</Text>
          {canOpenInBrowser ? (
            <Pressable
              style={styles.paymentModalCloseButton}
              onPress={onOpenInBrowser}
              accessibilityRole="button"
              accessibilityLabel="Open checkout in browser"
            >
              <Ionicons name="open-outline" size={20} color="#111111" />
            </Pressable>
          ) : (
            <View style={styles.paymentModalHeaderSpacer} />
          )}
        </View>
        {errorMessage ? (
          <View style={styles.paymentModalErrorBanner}>
            <Ionicons name="warning-outline" size={16} color="#b91c1c" />
            <Text style={styles.paymentModalErrorText}>{errorMessage}</Text>
          </View>
        ) : null}
        <View style={styles.paymentModalBody}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}
