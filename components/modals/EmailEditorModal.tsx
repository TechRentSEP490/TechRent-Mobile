import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import styles from '@/style/orders.styles';

export type EmailEditorModalProps = {
  visible: boolean;
  value: string;
  error?: string | null;
  onChangeText: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function EmailEditorModal({
  visible,
  value,
  error,
  onChangeText,
  onCancel,
  onSave,
}: EmailEditorModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.emailModalOverlay}>
        <View style={styles.emailModalCard}>
          <Text style={styles.emailModalTitle}>Update email address</Text>
          <Text style={styles.emailModalDescription}>
            Enter the email you want to use to receive the verification code.
          </Text>
          <TextInput
            style={[styles.emailInput, error ? styles.emailInputError : null]}
            placeholder="name@example.com"
            value={value}
            onChangeText={onChangeText}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="email"
          />
          {error ? (
            <Text style={styles.emailErrorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <View style={styles.emailModalActions}>
            <Pressable style={styles.emailModalCancelButton} onPress={onCancel}>
              <Text style={styles.emailModalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.emailModalSaveButton} onPress={onSave}>
              <Text style={styles.emailModalSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
