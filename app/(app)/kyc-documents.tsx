import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const steps = [
  {
    id: 'front',
    title: 'Front Side',
    subtitle: 'Take a picture',
  },
  {
    id: 'back',
    title: 'Back Side',
    subtitle: 'Take a picture',
  },
  {
    id: 'selfie',
    title: 'Selfie with the ID card',
    subtitle: 'Take a picture',
  },
];

export default function KycDocumentsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View>
          <Text style={styles.title}>KYC Verification</Text>
          <Text style={styles.subtitle}>Please align your ID card within the borders.</Text>
        </View>

        <View style={styles.stepList}>
          {steps.map((step) => (
            <View key={step.id} style={styles.stepCard}>
              <View style={styles.iconWrapper}>
                <Ionicons name="cloud-upload-outline" size={22} color="#111" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#c1c1c1" />
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => router.push('/(app)/kyc-details')}
          >
            <Text style={[styles.buttonText, styles.primaryText]}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6f6f6f',
  },
  stepList: {
    gap: 16,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e4e4',
    backgroundColor: '#ffffff',
    gap: 16,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eeeeee',
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#7a7a7a',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#111111',
    backgroundColor: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#111111',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryText: {
    color: '#111111',
  },
  primaryText: {
    color: '#ffffff',
  },
});
