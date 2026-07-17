import { Fonts } from "@/constants/theme";
import { useLoginForm } from "@/features/auth/useLoginForm";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    error,
    isSubmitting,
    isGoogleSubmitting,
    handleEmailLogin,
    goToRegister
  } = useLoginForm();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.innerContainer}>
          <View style={styles.logoContainer}>
            <Text style={styles.appName}>Pupply</Text>
          </View>

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
              style={styles.loginButton}
              activeOpacity={0.8}
              disabled={isSubmitting || isGoogleSubmitting}
              onPress={handleEmailLogin}
            >
              {isSubmitting ? <ActivityIndicator color="#4B3621" /> : <Text style={styles.loginButtonText}>Zaloguj się</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.registerLink} onPress={goToRegister}>
              <Text style={styles.registerText}>Nie masz konta? Zarejestruj się</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#7B6457"
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
    color: "#FFFFFF",
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
    borderRadius: 16,
    width: "100%",
    fontSize: 16
  },
  loginButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 5px rgba(0, 0, 0, 0.2)"
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5
      }
    })
  },
  loginButtonText: {
    color: "#4B3621",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: Fonts.rounded
  },
  registerLink: {
    marginTop: 5,
    alignItems: "center"
  },
  registerText: {
    color: "#E0E0E0",
    fontSize: 14,
    textDecorationLine: "underline"
  }
});
