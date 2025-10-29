import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { formatKycStatusLabel, getKycProgressState } from '@/constants/kyc';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, isSignedIn } = useAuth();

  const kycStatusLabel = useMemo(() => formatKycStatusLabel(user?.kycStatus), [user?.kycStatus]);
  const kycProgress = useMemo(() => getKycProgressState(user?.kycStatus), [user?.kycStatus]);

  const kycSubtitle = useMemo(() => {
    if (!isSignedIn || !user) {
      return 'Sign in to manage your KYC documents.';
    }

    switch (kycProgress) {
      case 'pending':
        return 'Your documents are under review. Tap to check what you submitted.';
      case 'verified':
        return 'You are verified. Review your documents or update them if needed.';
      case 'rejected':
        return 'Action required. Review and upload updated documents.';
      default:
        return 'Verify your identity to unlock rentals and faster checkout.';
    }
  }, [isSignedIn, kycProgress, user]);

  const handleBack = () => {
    router.back();
  };

  const handleOpenKyc = () => {
    router.push('/(app)/kyc-details');
  };

  const isKycOptionDisabled = !isSignedIn || !user;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={22} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.optionCard, isKycOptionDisabled && styles.optionCardDisabled]}
          onPress={handleOpenKyc}
          disabled={isKycOptionDisabled}
        >
          <View style={[styles.optionIconWrapper, isKycOptionDisabled && styles.optionIconWrapperDisabled]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={isKycOptionDisabled ? '#9ca3af' : '#111111'} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>View KYC Information</Text>
            <Text style={styles.optionSubtitle} numberOfLines={2}>
              {isSignedIn && user ? `Status: ${kycStatusLabel}` : 'KYC status unavailable'}
            </Text>
            <Text style={styles.optionHelper} numberOfLines={2}>
              {kycSubtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#c1c1c1" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f3f3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  headerPlaceholder: {
    width: 36,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  optionCardDisabled: {
    opacity: 0.6,
  },
  optionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
  },
  optionIconWrapperDisabled: {
    backgroundColor: '#f9fafb',
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  optionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4b5563',
  },
  optionHelper: {
    fontSize: 12,
    color: '#6b7280',
  },
});
