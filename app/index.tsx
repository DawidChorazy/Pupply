import { API_BASE_URL } from '@/constants/api';
import { Fonts } from '@/constants/theme';
import { ApiError } from '@/services/api-client';
import { loginUser } from '@/services/auth-service';
import { saveAuthTokens } from '@/services/auth-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height } = Dimensions.get("window");

export default function HomeScreen()  {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginValidation = async () => {
      if (email.trim() === '' && password.trim() === '') {
        setError('Adres email i hasło są wymagane*');
      } else if(email.trim() === '') {
        setError('Adres email jest wymagany*');
      } else if(password.trim() === '') {
        setError('Hasło jest wymagane*');
      } else {
        setError('');
        setIsSubmitting(true);

        try {
          const response = await loginUser({
            email: email.trim().toLowerCase(),
            password
          });

          await saveAuthTokens(response.accessToken, response.refreshToken);
          router.replace('/(tabs)/home');
        } catch (requestError) {
          if (requestError instanceof ApiError) {
            setError(requestError.message || 'Logowanie nie powiodło się*');
          } else {
            const errorDetails = requestError instanceof Error && requestError.message ? ` (${requestError.message})` : '';
            setError(`Brak połączenia z API${errorDetails}. URL: ${API_BASE_URL}`);
          }
        } finally {
          setIsSubmitting(false);
        }
      }

  }

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.innerContainer}>

          {/* Nazwa apki */}
          <View style={styles.logoContainer}>
            <Text style={styles.appName}>Pupply</Text>
          </View>

          {/* Kontener na przyciski/formularz */}
          <View style={styles.innerPage}>
            <View style={styles.formContainer}>

              <TextInput
                style={[styles.loginPlaceholders, error && email.trim() === '' ? styles.inputErrorBorder : null]}
                placeholder='Wpisz adres email'
                value={email}
                onChangeText={setEmail}
                placeholderTextColor="#888"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                style={[styles.loginPlaceholders, error && password.trim() === '' ? styles.inputErrorBorder : null]}
                placeholder='Wpisz hasło'
                value={password}
                onChangeText={setPassword}
                placeholderTextColor="#888"
                secureTextEntry={true}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.loginButton}
                activeOpacity={0.8}
                disabled={isSubmitting}
                // onPress={loginValidation} <- TODO podmienione na potrzeby testowania MainScreen'a, do podmiany po stworzeniu
                onPress={() => router.push("../mainScreen/MainScreen")}> 
                {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Zaloguj się</Text>}
              </TouchableOpacity>

              <TouchableOpacity 
              style={styles.registerLink}
              onPress={() => router.push("../register/RegisterScreen")}>
                <Text style={styles.registerText}>Nie masz konta? Zarejestruj się</Text>
              </TouchableOpacity>

            </View>
          </View>

        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 70,
  },
  appName: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#C75B11',
    fontFamily: Fonts.rounded,
  },
  formContainer: {
    justifyContent: 'center',
    width: '100%',
    gap: 15,
    flex: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  inputErrorBorder: {
    borderWidth: 2,
    borderColor: 'red',
  },
  loginPlaceholders: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#D9A848',
    alignSelf: 'center',
    width: '80%',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#C75B11',
    paddingVertical: 16,
    borderRadius: 50,
    width: '80%',
    marginTop: 20,
    alignItems: 'center',
    alignSelf: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Fonts.rounded,
  },
  registerLink: {
    marginTop: 5,
    alignItems: 'center',
  },
  registerText: {
    color: '#D9A848',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  innerPage: {
    height: (height/6) * 3.5,
    width: "95%",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    borderRadius: 60,
    marginTop: 60,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOpacity: 0.2,
    shadowOffset: {width: 2, height: -10},
    elevation: 8,
  },
});
