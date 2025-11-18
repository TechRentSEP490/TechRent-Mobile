import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomerSupportChat } from '@/components/chat/CustomerSupportChat';
import { useAuth } from '@/contexts/AuthContext';
import styles from '@/style/chat.styles';

export default function ChatScreen() {
  const router = useRouter();
  const { isSignedIn, isHydrating, user, session, ensureSession } = useAuth();
  const shouldPromptSignIn = !isHydrating && !isSignedIn;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support chat</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {shouldPromptSignIn ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Sign in to chat with us</Text>
            <Text style={styles.noticeSubtitle}>
              We&apos;ll connect you with a support specialist as soon as you sign in to your account.
            </Text>
            <TouchableOpacity
              style={styles.noticeButton}
              onPress={() => router.push('/(auth)/sign-in')}
              accessibilityRole="button"
            >
              <Text style={styles.noticeButtonText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : !user ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Loading your profile…</Text>
            <Text style={styles.noticeSubtitle}>We&apos;re fetching your account details. Please try again shortly.</Text>
          </View>
        ) : (
          <View style={styles.chatBody}>
            <CustomerSupportChat
              customerId={user.customerId}
              customerName={user.fullName ?? user.username}
              ensureSession={ensureSession}
              session={session}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
