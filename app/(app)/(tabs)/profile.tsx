import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const contactItems = [
  {
    id: 'email',
    label: 'Email',
    value: 'john.doe@example.com',
    icon: 'mail-outline',
  },
  {
    id: 'phone',
    label: 'Phone',
    value: '+123456789',
    icon: 'call-outline',
  },
  {
    id: 'billing',
    label: 'Billing Address',
    value: '123 Main St, Anytown, USA',
    icon: 'home-outline',
  },
  {
    id: 'shipping',
    label: 'Shipping Address',
    value: '456 Elm St, Anytown, USA',
    icon: 'location-outline',
  },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Ionicons name="person-circle-outline" size={32} color="#111" />
          <Text style={styles.headerTitle}>User Profile</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton}>
              <Ionicons name="notifications-outline" size={22} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton}>
              <Ionicons name="pencil-outline" size={22} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>John Doe</Text>
          <Text style={styles.profileEmail}>john.doe@example.com</Text>
        </View>

        <View style={styles.selfieCard}>
          <MaterialCommunityIcons name="camera" size={28} color="#999" />
          <Text style={styles.selfieTitle}>Your Selfies</Text>
          <Text style={styles.selfieSubtitle}>Upload a selfie to personalize your profile.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.contactList}>
            {contactItems.map((item) => (
              <View key={item.id} style={styles.contactItem}>
                <View style={styles.contactIconWrapper}>
                  <Ionicons name={item.icon as any} size={22} color="#111" />
                </View>
                <View style={styles.contactDetails}>
                  <Text style={styles.contactLabel}>{item.label}</Text>
                  <Text style={styles.contactValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.kycCard}>
          <View style={styles.kycHeader}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#f6a609" />
            <Text style={styles.kycTitle}>KYC Reminder</Text>
          </View>
          <Text style={styles.kycDescription}>Don’t forget to complete your KYC.</Text>
          <TouchableOpacity style={styles.kycButton}>
            <Text style={styles.kycButtonText}>Complete KYC</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
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
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginHorizontal: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    borderRadius: 16,
    backgroundColor: '#f9f9f9',
    padding: 20,
    gap: 6,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666666',
  },
  selfieCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 20,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  selfieTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  selfieSubtitle: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  contactList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ececec',
    overflow: 'hidden',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  contactIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactDetails: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  kycCard: {
    borderRadius: 16,
    backgroundColor: '#fff6e5',
    padding: 20,
    gap: 12,
  },
  kycHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kycTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  kycDescription: {
    fontSize: 14,
    color: '#555555',
  },
  kycButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f6a609',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  kycButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  logoutButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#111111',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
});
