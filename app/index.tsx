import { Fonts } from "@/constants/theme";
import { useLoginForm } from "@/features/auth/useLoginForm";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const {
    email,
    setEmail,
    password,
    setPassword,
    error,
    isSubmitting,
    isGoogleSubmitting,
    googleRequest,
    handleGoogleLogin,
    goToRegister
  } = useLoginForm();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.logoContainer}>
          <Text style={styles.appName}>Pupply</Text>
        </View>

        <View style={styles.innerPage}>
          <View style={styles.formContainer}>
            <TextInput
              style={[styles.loginPlaceholders, error && email.trim() === "" ? styles.inputErrorBorder : null]}
              placeholder="Wpisz adres email"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#888"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={[styles.loginPlaceholders, error && password.trim() === "" ? styles.inputErrorBorder : null]}
              placeholder="Wpisz hasło"
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#888"
              secureTextEntry
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.8}
              disabled={isSubmitting || isGoogleSubmitting || !googleRequest}
              onPress={handleGoogleLogin}
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
              onPress={() => router.push("../mainScreen/MainScreen")}
            >
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Zaloguj się</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.registerLink} onPress={goToRegister}>
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
    backgroundColor: "#FFF8F0"
  },
  scrollContent: {
    flexGrow: 1
  },
  innerContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 30
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 70
  },
  appName: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#C75B11",
    fontFamily: Fonts.rounded
  },
  formContainer: {
    justifyContent: "center",
    width: "100%",
    gap: 15,
    flex: 1
  },
  errorText: {
    color: "red",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "bold"
  },
  inputErrorBorder: {
    borderWidth: 2,
    borderColor: "red"
  },
  loginPlaceholders: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#D9A848",
    alignSelf: "center",
    width: "80%",
    fontSize: 16
  },
  loginButton: {
    backgroundColor: "#C75B11",
    paddingVertical: 16,
    borderRadius: 50,
    width: "80%",
    marginTop: 20,
    alignItems: "center",
    alignSelf: "center"
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: Fonts.rounded
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 50,
    width: "80%",
    borderWidth: 2,
    borderColor: "#D9A848",
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10
  },
  googleButtonText: {
    color: "#1F2937",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: Fonts.rounded
  },
  registerLink: {
    marginTop: 5,
    alignItems: "center"
  },
  registerText: {
    color: "#D9A848",
    fontSize: 14,
    textDecorationLine: "underline"
  },
  innerPage: {
    height: (height / 6) * 3.5,
    width: "95%",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    borderRadius: 60,
    marginTop: 60,
    ...Platform.select({
      web: {
        boxShadow: "2px -10px 10px rgba(0, 0, 0, 0.2)"
      },
      default: {
        shadowColor: "#000",
        shadowRadius: 10,
        shadowOpacity: 0.2,
        shadowOffset: { width: 2, height: -10 },
        elevation: 8
      }
    })
  }
});
