import { useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const { height } = Dimensions.get("window");

export default function RegisterSteps() {

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

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({...prev, [key]: value}));
  }

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{7,}$/;
    return regex.test(password);
  };

  const [registrationType, setRegistrationType] = useState<'user' | 'clinic'>('user');


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
                        onChangeText={text => handleChange('nip', text)}>
                      </TextInput> 
                    </>
                  )}
                  <Text style={styles.placeholderTexts}>Adres email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Wpisz email"
                    value={form.email}
                    onChangeText={text => handleChange('email', text)}>
                  </TextInput>
                  <Text style={styles.placeholderTexts}>Numer telefonu</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Wpisz numer telefonu"
                    value={form.phone}
                    onChangeText={text => handleChange('phone', text)}>
                  </TextInput>
                  <Text style={styles.placeholderTexts}>Hasło</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Utwórz hasło"
                    value={form.password}
                    onChangeText={text => handleChange('password', text)}>
                  </TextInput>
                  <Text style={styles.placeholderTexts}>Potwierdź hasło</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Potwierdź hasło"
                    value={form.confirmPassword}
                    onChangeText={text => handleChange('confirmPassword', text)}>
                  </TextInput>
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
  }
});