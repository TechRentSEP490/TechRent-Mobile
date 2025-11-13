import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { useAuth } from '@/contexts/AuthContext';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const normalizeInput = (value: string) => value.trim();

type FieldErrors = Partial<Record<'fullName' | 'email' | 'phoneNumber', string>>;

export default function UpdateProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setEmail(user?.email ?? '');
    setPhoneNumber(user?.phoneNumber ?? '');
  }, [user?.fullName, user?.email, user?.phoneNumber]);

  const isFormDirty = useMemo(() => {
    const normalizedFullName = normalizeInput(fullName);
    const normalizedEmail = normalizeInput(email);
    const normalizedPhone = normalizeInput(phoneNumber);

    return (
      normalizedFullName !== normalizeInput(user?.fullName ?? '') ||
      normalizedEmail !== normalizeInput(user?.email ?? '') ||
      normalizedPhone !== normalizeInput(user?.phoneNumber ?? '')
    );
  }, [email, fullName, phoneNumber, user?.email, user?.fullName, user?.phoneNumber]);

  const validate = useCallback((): FieldErrors => {
    const errors: FieldErrors = {};

    const normalizedFullName = normalizeInput(fullName);
    const normalizedEmail = normalizeInput(email);
    const normalizedPhone = normalizeInput(phoneNumber);

    if (!normalizedFullName) {
      errors.fullName = 'Full name is required.';
    }

    if (!normalizedEmail) {
      errors.email = 'Email is required.';
    } else if (!emailPattern.test(normalizedEmail)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!normalizedPhone) {
      errors.phoneNumber = 'Phone number is required.';
    } else if (normalizedPhone.replace(/[^0-9+]/g, '').length < 8) {
      errors.phoneNumber = 'Enter a valid phone number.';
    }

    return errors;
  }, [email, fullName, phoneNumber]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    const validationErrors = validate();
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      fullName: normalizeInput(fullName),
      email: normalizeInput(email),
      phoneNumber: normalizeInput(phoneNumber),
    };

    try {
      await updateProfile(payload);
      Toast.show({
        type: 'success',
        text1: 'Profile updated',
        text2: 'Your account details have been saved successfully.',
      });
      router.back();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'We were unable to update your profile. Please try again.';
      setFormError(message);
      Toast.show({ type: 'error', text1: 'Update failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  }, [email, fullName, isSubmitting, phoneNumber, router, updateProfile, validate]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.emptyState}>
          <Ionicons name="person-circle-outline" size={72} color="#111111" />
          <Text style={styles.emptyStateTitle}>You need to be signed in</Text>
          <Text style={styles.emptyStateSubtitle}>
            Sign in to manage your profile details and keep your account information up to date.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 12, android: 0 }) ?? 0}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color="#111111" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Update profile</Text>
            <View style={styles.headerPlaceholder} />
          </View>

          <Text style={styles.subtitle}>
            Review your contact details so we can reach you with rental updates and account notifications.
          </Text>

          {formError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={20} color="#b91c1c" />
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (fieldErrors.fullName) {
                  setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                }
              }}
              placeholder="Enter your full name"
              style={[styles.input, fieldErrors.fullName && styles.inputError]}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />
            {fieldErrors.fullName ? <Text style={styles.fieldErrorText}>{fieldErrors.fullName}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="name@example.com"
              style={[styles.input, fieldErrors.email && styles.inputError]}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            {fieldErrors.email ? <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                if (fieldErrors.phoneNumber) {
                  setFieldErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                }
              }}
              placeholder="Enter your phone number"
              style={[styles.input, fieldErrors.phoneNumber && styles.inputError]}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              returnKeyType="done"
            />
            {fieldErrors.phoneNumber ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.phoneNumber}</Text>
            ) : null}
          </View>

          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={18} color="#4b5563" />
            <Text style={styles.hintText}>
              Bank information is securely stored and will continue to be submitted automatically with each
              update.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (!isFormDirty || isSubmitting) && styles.submitButtonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!isFormDirty || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#f87171',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: {
    flex: 1,
    color: '#7f1d1d',
    fontSize: 13,
    lineHeight: 18,
  },
  hintBox: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    padding: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  submitButton: {
    borderRadius: 16,
    backgroundColor: '#111111',
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },
});
