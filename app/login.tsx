import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panel Logowania</Text>
      <Text style={styles.subtitle}>Tutaj możesz się zalogować</Text>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>Wróć</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7B6457',
  },
  title: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    fontSize: 18,
    color: '#E0E0E0',
    marginTop: 10,
  },
  backButton: {
    marginTop: 40,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#7B6457',
    fontWeight: 'bold',
  }
});
