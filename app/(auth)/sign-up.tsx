import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { registerUser } from '@/services/auth';

export default function SignUpScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFormValid = useMemo(() => {
    const hasRequiredFields =
      username.trim().length > 0 &&
      email.trim().length > 0 &&
      phoneNumber.trim().length > 0 &&
      password.length >= 6;

    return hasRequiredFields && password === confirmPassword;
  }, [confirmPassword, email, password, phoneNumber, username]);

  const handleCreateAccount = async () => {
    if (!isFormValid) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
      });

      Alert.alert('Registration successful', 'Enter the verification code we emailed to you.');

      router.push({
        pathname: '/(auth)/otp',
        params: { email: email.trim() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create your account.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <Text style={styles.title}>Create your account</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Choose a username"
            placeholderTextColor="#7f7f7f"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#7f7f7f"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <Text style={styles.helperText}>Find what you need easily!</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            placeholderTextColor="#7f7f7f"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#7f7f7f"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            placeholderTextColor="#7f7f7f"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            (!isFormValid || submitting) && styles.primaryButtonDisabled,
          ]}
          disabled={!isFormValid || submitting}
          onPress={() => {
            void handleCreateAccount();
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[styles.buttonText, styles.primaryText]}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.outlineButton]}
          onPress={() => router.replace('/(auth)/sign-in')}
        >
          <Text style={[styles.buttonText, styles.outlineText]}>Sign In</Text>
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
    paddingTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
    color: '#141414',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  helperText: {
    marginTop: 8,
    color: '#7f7f7f',
    fontSize: 13,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#000000',
  },
  primaryButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
    marginTop: 16,
  },
  outlineText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonText: {
    textAlign: 'center',
  },
});
