import { useState } from 'react';
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

import { useAuth } from '@/contexts/AuthContext';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (isSubmitting) {
      return;
    }

    if (!usernameOrEmail.trim() || !password.trim()) {
      setErrorMessage('Please enter your email or username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await signIn({ usernameOrEmail: usernameOrEmail.trim(), password: password.trim() });
      router.replace('/(app)/(tabs)/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <Text style={styles.title}>Welcome Back!</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email or Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email or username"
            placeholderTextColor="#7f7f7f"
            keyboardType="email-address"
            value={usernameOrEmail}
            onChangeText={(text) => {
              setUsernameOrEmail(text);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            autoCapitalize="none"
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
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
          />
        </View>

        {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}

        <View style={styles.inlineButtons}>
          <TouchableOpacity
            style={[styles.button, styles.inlineButton, styles.secondaryButton]}
            disabled={isSubmitting}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.inlineButton, styles.primaryButton]}
            onPress={() => void handleSignIn()}
            disabled={isSubmitting}
          >
            <Text style={[styles.buttonText, styles.primaryText]}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, styles.outlineButton]} disabled={isSubmitting}>
          <Text style={[styles.buttonText, styles.outlineText]}>Login with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton, styles.fullWidthButton]}
          onPress={() => router.push('/(auth)/sign-up')}
          disabled={isSubmitting}
        >
          <Text style={[styles.buttonText, styles.primaryText]}>Sign Up</Text>
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
  inlineButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#000000',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
  },
  secondaryText: {
    color: '#000000',
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
  fullWidthButton: {
    marginTop: 16,
  },
  buttonText: {
    textAlign: 'center',
  },
  errorMessage: {
    color: '#d93025',
    marginTop: 4,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '500',
  },
});
