import { API_BASE_URL } from "@/constants/api";
import { ApiError } from "@/services/api-client";
import { registerClinic, registerUser } from "@/services/auth-service";
import { saveAuthTokens } from "@/services/auth-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function RegisterSteps() {
  const router = useRouter();

  const[form, setForm] = useState({
    fullName: '',
    email: '',
    phonePrefix: '+48',
    phone: '',
    birthDate: '',
    password: '',
    confirmPassword: '',
    clinicName: '',
    nip: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({...prev, [key]: value}));
  }

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{7,}$/;
    return regex.test(password);
  };

  const [registrationType, setRegistrationType] = useState<'user' | 'clinic'>('user');

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    const normalizedPhone = form.phone.startsWith('+')
      ? form.phone.trim()
      : `${form.phonePrefix}${form.phone.trim()}`;

    if (!form.email.trim() || !form.phone.trim() || !form.password.trim() || !form.confirmPassword.trim()) {
      setError('Uzupełnij wszystkie wymagane pola*');
      return;
    }

    if (!validatePassword(form.password)) {
      setError('Hasło musi mieć min. 8 znaków, małą i wielką literę oraz znak specjalny*');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Hasła nie są takie same*');
      return;
    }

    if (registrationType === 'user' && !form.fullName.trim()) {
      setError('Imię i nazwisko jest wymagane*');
      return;
    }

    if (registrationType === 'clinic') {
      if (!form.clinicName.trim()) {
        setError('Nazwa kliniki jest wymagana*');
        return;
      }

      if (!/^\d{10}$/.test(form.nip.trim())) {
        setError('NIP musi zawierać dokładnie 10 cyfr*');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const email = form.email.trim().toLowerCase();
      const password = form.password;
      const confirmPassword = form.confirmPassword;

      const response = registrationType === 'user'
        ? await registerUser({
            fullName: form.fullName.trim(),
            email,
            phone: normalizedPhone,
            birthDate: form.birthDate.trim() || undefined,
            password,
            confirmPassword
          })
        : await registerClinic({
            clinicName: form.clinicName.trim(),
            nip: form.nip.trim(),
            email,
            phone: normalizedPhone,
            password,
            confirmPassword
          });

      await saveAuthTokens(response.accessToken, response.refreshToken);
      setSuccess('Konto utworzone, trwa logowanie...');
      router.replace('/(tabs)/home');
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message || 'Rejestracja nie powiodła się*');
      } else {
        const errorDetails = requestError instanceof Error && requestError.message ? ` (${requestError.message})` : '';
        setError(`Brak połączenia z API${errorDetails}. URL: ${API_BASE_URL}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
        <View style={styles.page}>
          <View style={styles.innerPage}>
            <ScrollView
                style={{width:'100%'}}
                contentContainerStyle={{ alignItems: 'center', paddingBottom: 40, }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Create account</Text>
                <View style={styles.userTypeBackground}>
                  <TouchableOpacity
                    style={[
                      styles.userTypeButton,
                      registrationType === 'user' && styles.activeButton
                    ]}
                    onPress={() => setRegistrationType('user')}
                  >
                    <Text style={styles.userTypeText}>User</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.userTypeButton,
                      registrationType === 'clinic' && styles.activeButton
                    ]}
                    onPress={() => setRegistrationType('clinic')}
                  >
                    <Text style={styles.userTypeText}>Clinic</Text>
                  </TouchableOpacity>
                  
                </View> 
                {registrationType === 'user' ? (
                  <>
                  <Text style={styles.placeholderTexts}>Imię i nazwisko</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Wpisz imię i nazwisko"
                    value={form.fullName}
                    onChangeText={text => handleChange('fullName', text)}>
                  </TextInput> 
                  <Text style={styles.placeholderTexts}>Data urodzenia (opcjonalnie)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="RRRR-MM-DD"
                    value={form.birthDate}
                    onChangeText={text => handleChange('birthDate', text)}>
                  </TextInput>
                  </>) : (
                    <>
                    <Text style={styles.placeholderTexts}>Nazwa kliniki</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Nazwa kliniki"
                        value={form.clinicName}
                        onChangeText={text => handleChange('clinicName', text)}>
                      </TextInput> 
                    <Text style={styles.placeholderTexts}>NIP</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Wpisz NIP"
                        value={form.nip}
                        keyboardType="number-pad"
                        onChangeText={text => handleChange('nip', text)}>
                      </TextInput> 
                    </>
                  )}
                  <Text style={styles.placeholderTexts}>Adres email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Wpisz email"
                    value={form.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={text => handleChange('email', text)}>
                  </TextInput>
                  <Text style={styles.placeholderTexts}>Numer telefonu</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Wpisz numer telefonu"
                    value={form.phone}
                    keyboardType="phone-pad"
                    onChangeText={text => handleChange('phone', text)}>
                  </TextInput>
                  <Text style={styles.placeholderTexts}>Hasło</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Utwórz hasło"
                    value={form.password}
                    secureTextEntry
                    onChangeText={text => handleChange('password', text)}>
                  </TextInput>
                  <Text style={styles.placeholderTexts}>Potwierdź hasło</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Potwierdź hasło"
                    value={form.confirmPassword}
                    secureTextEntry
                    onChangeText={text => handleChange('confirmPassword', text)}>
                  </TextInput>
                  {error ? <Text style={[styles.statusText, styles.statusTextError]}>{error}</Text> : null}
                  {success ? <Text style={[styles.statusText, styles.statusTextSuccess]}>{success}</Text> : null}
                  <TouchableOpacity
                    style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : null]}
                    disabled={isSubmitting}
                    onPress={handleSubmit}
                  >
                    {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Utwórz konto</Text>}
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
  pager:{
    flex: 1,
    paddingHorizontal: 20,
  },
  innerPage: {
    flex: 1,
    width: "90%",
    alignSelf: 'center',
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    borderRadius: 60,
    marginTop: 60,
    marginBottom: 40,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOpacity: 0.2,
    shadowOffset: {width: 2, height: -10},
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    justifyContent: "flex-start",
    marginTop: 40,
    marginBottom: 40,
    color:"#C75B11"
  },
  input:{
    width: "80%",
    height: 45,
    backgroundColor: "white",
    borderColor: '#D9A848',
    borderRadius: 50,
    borderWidth: 2,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  placeholderTexts:{
    marginLeft: 50,
    marginBottom: 6,
    alignSelf: 'flex-start',
    color: '#7B6457'
  },
  userTypeBackground:{
    flexDirection: 'row',
    height: '8%',
    width:'65%',
    backgroundColor:'#FFF8F0',
    borderColor:'#D9A848',
    borderRadius:50,
    borderWidth: 1,
    marginBottom: 15,
  },
  userTypeButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#C75B11',
    borderRadius: 50,
  },
  userTypeText: {
    borderRadius: 50,
    color: '#7B6457',
    fontWeight: 'bold'
  },
  statusText: {
    width: '80%',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600'
  },
  statusTextError: {
    color: '#B42318'
  },
  statusTextSuccess: {
    color: '#067647'
  },
  submitButton: {
    width: '80%',
    backgroundColor: '#C75B11',
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10
  },
  submitButtonDisabled: {
    opacity: 0.7
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  }
});