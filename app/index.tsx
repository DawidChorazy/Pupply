import { API_BASE_URL } from '@/constants/api';
import { Fonts } from '@/constants/theme';
import { ApiError } from '@/services/api-client';
import { loginUser, loginWithGoogle } from '@/services/auth-service';
import { saveAuthTokens } from '@/services/auth-storage';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height } = Dimensions.get("window");
const missingGoogleClientId = "missing-google-client-id";
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const googleRedirectUri =
  Platform.OS === "web"
    ? AuthSession.makeRedirectUri({ path: "" })
    : process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim();

WebBrowser.maybeCompleteAuthSession();

function getGoogleClientIdForPlatform() {
  if (Platform.OS === "android") {
    return googleAndroidClientId;
  }

  if (Platform.OS === "ios") {
    return googleIosClientId;
  }

  return googleWebClientId;
}

export default function HomeScreen()  {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const googleClientIdConfigured = Boolean(getGoogleClientIdForPlatform());
  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    clientId: missingGoogleClientId,
    webClientId: googleWebClientId || missingGoogleClientId,
    androidClientId: googleAndroidClientId || missingGoogleClientId,
    iosClientId: googleIosClientId || missingGoogleClientId,
    redirectUri: googleRedirectUri,
    selectAccount: true
  });

  useEffect(() => {
    if (!googleResponse) {
      return;
    }

    if (googleResponse.type === "success") {
      const idToken = googleResponse.params.id_token || googleResponse.authentication?.idToken;

      if (!idToken) {
        setError("Google nie zwrocil tokenu logowania*");
        setIsGoogleSubmitting(false);
        return;
      }

      loginWithGoogle({ idToken })
        .then(async (response) => {
          await saveAuthTokens(response.accessToken, response.refreshToken);
          router.replace('/mainScreen/MainScreen');
        })
        .catch((requestError) => {
          if (requestError instanceof ApiError) {
            setError(requestError.message || "Logowanie Google nie powiodlo sie*");
          } else {
            const errorDetails = requestError instanceof Error && requestError.message ? ` (${requestError.message})` : '';
            setError(`Brak polaczenia z API${errorDetails}. URL: ${API_BASE_URL}`);
          }
        })
        .finally(() => {
          setIsGoogleSubmitting(false);
        });

      return;
    }

    if (googleResponse.type === "error") {
      setError(googleResponse.error?.message || "Logowanie Google nie powiodlo sie*");
    }

    setIsGoogleSubmitting(false);
  }, [googleResponse, router]);

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
          router.replace('/mainScreen/MainScreen');
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

  const googleLoginValidation = async () => {
    if (!googleClientIdConfigured) {
      setError("Brak konfiguracji Google Client ID dla tej platformy*");
      return;
    }

    setError('');
    setIsGoogleSubmitting(true);

    try {
      const result = await promptGoogleSignIn();

      if (result.type !== "success") {
        setIsGoogleSubmitting(false);
      }
    } catch (requestError) {
      const errorDetails = requestError instanceof Error && requestError.message ? ` (${requestError.message})` : '';
      setError(`Logowanie Google nie powiodlo sie${errorDetails}`);
      setIsGoogleSubmitting(false);
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
                style={styles.googleButton}
                activeOpacity={0.8}
                disabled={isSubmitting || isGoogleSubmitting || !googleRequest}
                onPress={googleLoginValidation}
              >
                {isGoogleSubmitting ? (
                  <ActivityIndicator color="#1F2937" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#1F2937" />
                    <Text style={styles.googleButtonText}>Zaloguj przez Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.loginButton}
                activeOpacity={0.8}
                disabled={isSubmitting || isGoogleSubmitting}
                onPress={loginValidation}
              >
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
  googleButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 50,
    width: '80%',
    borderWidth: 2,
    borderColor: '#D9A848',
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
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
