import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRegisterForm } from "@/features/register/useRegisterForm";

export default function RegisterScreen() {
  const {
    form,
    error,
    success,
    isSubmitting,
    handleChange,
    handleSubmit,
    registrationType,
    setRegistrationType
  } = useRegisterForm();

  return (
    <View style={styles.page}>
      <View style={styles.innerPage}>
        <ScrollView
          contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Create account</Text>

          {/* TYPE SWITCH */}
          <View style={styles.userTypeBackground}>
            <TouchableOpacity
              style={[
                styles.userTypeButton,
                registrationType === "user" && styles.activeButton
              ]}
              onPress={() => setRegistrationType("user")}
            >
              <Text style={styles.userTypeText}>User</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.userTypeButton,
                registrationType === "clinic" && styles.activeButton
              ]}
              onPress={() => setRegistrationType("clinic")}
            >
              <Text style={styles.userTypeText}>Clinic</Text>
            </TouchableOpacity>
          </View>

          {/* USER / CLINIC FIELDS */}
          {registrationType === "user" ? (
            <>
              <Text style={styles.placeholderTexts}>Imię i nazwisko</Text>
              <TextInput
                style={styles.input}
                value={form.fullName}
                onChangeText={(t) => handleChange("fullName", t)}
              />

              <Text style={styles.placeholderTexts}>Data urodzenia</Text>
              <TextInput
                style={styles.input}
                placeholder="DD.MM.YYYY"
                value={form.birthDate}
                onChangeText={(t) => handleChange("birthDate", t)}
              />
            </>
          ) : (
            <>
              <Text style={styles.placeholderTexts}>Nazwa kliniki</Text>
              <TextInput
                style={styles.input}
                value={form.clinicName}
                onChangeText={(t) => handleChange("clinicName", t)}
              />

              <Text style={styles.placeholderTexts}>NIP</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.nip}
                onChangeText={(t) => handleChange("nip", t)}
              />
            </>
          )}

          {/* COMMON FIELDS */}
          <Text style={styles.placeholderTexts}>Email</Text>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(t) => handleChange("email", t)}
          />

          <Text style={styles.placeholderTexts}>Telefon</Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            placeholder="np. 123123123"
            value={form.phone}
            onChangeText={(t) => handleChange("phone", t)}
          />

          <Text style={styles.placeholderTexts}>Hasło</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="********"
            value={form.password}
            onChangeText={(t) => handleChange("password", t)}
          />

          <Text style={styles.placeholderTexts}>Powtórz hasło</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="********"
            value={form.confirmPassword}
            onChangeText={(t) => handleChange("confirmPassword", t)}
          />

          {/* STATUS */}
          {error ? <Text style={styles.statusTextError}>{error}</Text> : null}
          {success ? <Text style={styles.statusTextSuccess}>{success}</Text> : null}

          {/* SUBMIT */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Utwórz konto</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  innerPage: {
    flex: 1,
    width: "90%",
    alignSelf: "center",
    backgroundColor: "#fff",
    alignItems: "center",
    borderRadius: 60,
    marginTop: 60,
    marginBottom: 40,
    elevation: 8
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 40,
    marginBottom: 40,
    color: "#C75B11"
  },
  input: {
    width: "100%",
    height: 45,
    borderColor: "#D9A848",
    borderWidth: 2,
    borderRadius: 50,
    paddingHorizontal: 10,
    marginBottom: 15
  },
  placeholderTexts: {
    alignSelf: "flex-start",
    marginLeft: 30,
    marginBottom: 6,
    color: "#7B6457"
  },
  userTypeBackground: {
    flexDirection: "row",
    width: "65%",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#D9A848",
    marginBottom: 15
  },
  userTypeButton: {
    flex: 1,
    padding: 10,
    alignItems: "center"
  },
  activeButton: {
    backgroundColor: "#C75B11",
    borderRadius: 50
  },
  userTypeText: {
    fontWeight: "bold",
    color: "#7B6457"
  },
  statusTextError: {
    color: "#B42318",
    marginBottom: 10
  },
  statusTextSuccess: {
    color: "#067647",
    marginBottom: 10
  },
  submitButton: {
    width: "80%",
    backgroundColor: "#C75B11",
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: "center",
    marginTop: 10
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "bold"
  }
});
