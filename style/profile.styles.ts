import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  unauthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  unauthTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  unauthSubtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
  },
  authButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  authPrimaryButton: {
    backgroundColor: '#111111',
  },
  authPrimaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  authSecondaryButton: {
    borderWidth: 1,
    borderColor: '#111111',
  },
  authSecondaryButtonText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 16,
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
  headerActionButtonDisabled: {
    opacity: 0.6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#7f1d1d',
  },
  profileCard: {
    borderRadius: 16,
    backgroundColor: '#f9f9f9',
    padding: 20,
    gap: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
  },
  profileUsername: {
    fontSize: 14,
    color: '#6b7280',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666666',
  },
  profileBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
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
    marginBottom: 6,
  },
  selfieStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    textTransform: 'uppercase',
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
  contactItemLast: {
    borderBottomWidth: 0,
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 20,
    gap: 16,
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
    flex: 1,
  },
  kycDescription: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },
  kycErrorText: {
    fontSize: 13,
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: '600',
  },
  kycStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  kycStatusBadgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  kycStatusBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  kycStatusBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  kycStatusBadgeNeutral: {
    backgroundColor: '#e5e7eb',
  },
  kycStatusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  kycStatusBadgeTextSuccess: {
    color: '#166534',
  },
  kycStatusBadgeTextWarning: {
    color: '#92400e',
  },
  kycStatusBadgeTextDanger: {
    color: '#b91c1c',
  },
  kycStatusBadgeTextNeutral: {
    color: '#1f2937',
  },
  kycPlaceholderText: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 12,
  },
  kycLinkButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  kycLinkButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kycLinkIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycLinkCopy: {
    flex: 1,
    gap: 2,
  },
  kycLinkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  kycLinkSubtitle: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  kycActionButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
  },
  kycActionButtonPrimary: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  kycActionButtonSecondary: {
    backgroundColor: '#ffffff',
    borderColor: '#111111',
  },
  kycActionButtonDisabled: {
    opacity: 0.6,
  },
  kycActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  kycActionButtonTextPrimary: {
    color: '#ffffff',
  },
  kycActionButtonTextSecondary: {
    color: '#111111',
  },
  settingsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  settingsModalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  settingsModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    zIndex: 1,
  },
  settingsModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  settingsModalOptions: {
    gap: 12,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  settingsOptionComingSoon: {
    opacity: 0.85,
  },
  settingsOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsOptionIconDisabled: {
    backgroundColor: '#f1f5f9',
  },
  settingsOptionCopy: {
    flex: 1,
    gap: 2,
  },
  settingsOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  settingsOptionSubtitle: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  settingsCancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingsCancelText: {
    fontSize: 15,
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
  profileErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  profileErrorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  profileErrorSubtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default styles;
