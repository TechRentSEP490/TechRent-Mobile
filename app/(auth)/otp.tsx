import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const CODE_LENGTH = 6;

export default function OtpVerificationScreen() {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleChange = (value: string, index: number) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    const next = [...code];
    next[index] = sanitized.slice(-1);
    setCode(next);

    if (sanitized && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && code[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    router.replace('/(auth)/sign-in');
  };

  const isCodeComplete = useMemo(() => code.every((digit) => digit.trim().length === 1), [code]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code we sent to your inbox to activate your TechRent account.
        </Text>

        <View style={styles.codeRow}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[styles.codeInput, digit && styles.codeInputFilled]}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(value) => handleChange(value, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              returnKeyType="done"
              textContentType="oneTimeCode"
              autoFocus={index === 0}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.resendButton}>
          <Text style={styles.resendText}>Resend code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, !isCodeComplete && styles.actionButtonDisabled]}
          disabled={!isCodeComplete}
          onPress={handleVerify}
        >
          <Text style={styles.actionButtonText}>Verify &amp; Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryLink} onPress={() => router.back()}>
          <Text style={styles.secondaryLinkText}>Back to sign up</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#141414',
  },
  subtitle: {
    fontSize: 15,
    color: '#5a5a5a',
    marginTop: 12,
    lineHeight: 22,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 36,
  },
  codeInput: {
    width: 48,
    height: 64,
    borderWidth: 1,
    borderColor: '#d6d6d6',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    backgroundColor: '#f9f9f9',
  },
  codeInputFilled: {
    borderColor: '#000000',
    backgroundColor: '#ffffff',
  },
  resendButton: {
    marginTop: 32,
    alignSelf: 'flex-start',
  },
  resendText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 15,
  },
  actionButton: {
    marginTop: 40,
    backgroundColor: '#000000',
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryLink: {
    marginTop: 24,
  },
  secondaryLinkText: {
    textAlign: 'center',
    color: '#000000',
    fontSize: 15,
    fontWeight: '500',
  },
});
