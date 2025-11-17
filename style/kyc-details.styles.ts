import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    fontSize: 14,
    color: '#6f6f6f',
    lineHeight: 20,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  previewItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e4e4e4',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  },
  previewImage: {
    width: '100%',
    height: 120,
  },
  previewPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
    color: '#5f5f5f',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldGroup: {
    gap: 10,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 16,
  },
  inlineField: {
    flex: 1,
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
    backgroundColor: '#ffffff',
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  segmentLabel: {
    fontSize: 13,
    color: '#5f5f5f',
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  disabledButton: {
    opacity: 0.6,
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
  errorMessage: {
    color: '#d64545',
    fontSize: 13,
  },
});

export default styles;
