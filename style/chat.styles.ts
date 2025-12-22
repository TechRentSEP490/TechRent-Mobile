import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
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
  chatBody: {
    flex: 1,
  },
  noticeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ededed',
    padding: 20,
    backgroundColor: '#fefefe',
    gap: 8,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  noticeSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555555',
  },
  noticeButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderRadius: 999,
  },
  noticeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default styles;
