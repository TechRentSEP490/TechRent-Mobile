import { Text, View } from 'react-native';
import styles from '@/style/search.styles';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Search functionality coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}


