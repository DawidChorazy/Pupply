import { StyleSheet, Text, View, TouchableOpacity, TextInput, Pressable, ScrollView, Image } from "react-native";
import { useState, useRef, useEffect } from "react";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getMySitterProfile } from "@/features/marketplace/services/sitters-service";

export default function ChatScreen(){

  const [messages, setMessages] = useState([
  { id: "1", text: "Cześć! O której mogę przyprowadzić Figę?", mine: true, messageTime: Date.now() },
  { id: "2", text: "Cześć! Zapraszam o 9:00 😊", mine: false, messageTime: Date.now() },
  ]);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMySitterProfile().then(({profile}) => {
        if(active) setMyPhotoUrl(profile.photoUrl);//
    }).catch((error) => {
        console.error('Błąd pobierania zdjęcia', error);
    })
    return () => {
        active = false;
    };
  }, []);

  const sendMessage = () => {
    const text = draft.trim();
    if(!text) return;

    setMessages((current) => [
        ...current,
        {id: Date.now().toString(), text, mine: true, messageTime: Date.now() }
    ]);
    setDraft("");
  }

    return(
        
        
        <View style={styles.container}>
            <Text style={styles.title}>Chat</Text>
            <View style={styles.conversation}>
            <ScrollView 
                showsVerticalScrollIndicator={false}
                ref={scrollRef}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({animated: true})}
                >
            <View style={styles.messages}>
                {messages.map((message, index) => (
            <View
                key={message.id}
                style={[styles.messageRow, { flexDirection: message.mine ? "row-reverse" : "row" }]}
            >
                <Image
                source={ message.mine && myPhotoUrl ? {uri: myPhotoUrl}: require("@/assets/images/icon.png")}
                style={styles.avatar}
                />

                <View
                style={[styles.bubble, { backgroundColor: message.mine ? "#D35400" : "#F3E8DE" }]}
                >
                <Text
                    style={[styles.messageText, { color: message.mine ? "#FFFFFF" : "#3D2415" }]}
                >
                    {message.text}
                </Text>
                <Text style={[styles.messageTime, { color: message.mine ? "#FFFFFF" : "#3D2415" }]}>
                {new Date(message.messageTime).toLocaleTimeString("pl-PL", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                })}
                </Text>
                </View>
            </View>
            ))}
            </View>
            </ScrollView>
                </View>

            <View
            style={styles.composer}
            >
                <TextInput 
                    value={draft}
                    onChangeText={setDraft}
                    onKeyPress={(e) =>{
                        if(e.nativeEvent.key === "Enter"){
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    placeholder="Napisz wiadomość"
                    placeholderTextColor="#8A7A70"
                    multiline
                    style={styles.input}>
                </TextInput>
                <TouchableOpacity
                onPress={sendMessage}
                
                disabled={!draft.trim}
                style={[styles.sendButton, { opacity: draft.trim() ? 1 : 0.5 }]}>
                    <FontAwesome name="send" size={24} color="#D35400" />
                </TouchableOpacity>
                </View>
        </View>
    )
}


const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#FFF8F0" },
  title: { fontSize: 28, fontWeight: "bold" },
  conversation: { backgroundColor: "#FFFFFF", borderColor: "#F2E4D8", borderRadius: 18, borderWidth: 1, height: "80%", maxHeight: "80%", padding: 15 },
  messages: { marginTop: 24, gap: 12 },
  messageRow: { alignItems: "flex-end", gap: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignSelf: "center" },
  bubble: { padding: 14, borderRadius: 18, maxWidth: "75%" },
  messageText: { fontSize: 15, lineHeight: 21 },
  messageTime: { fontSize: 11 },
  composer: { marginTop: "auto", width:"40%", flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 10 },
  input: { flex:1, marginTop: "auto", backgroundColor: "#FFFFFF", borderWidth:1, borderColor:"#E8D8CB", borderRadius:24, paddingHorizontal:18, paddingVertical:14, fontSize:16, minHeight:"auto", maxHeight: "auto" },
  sendButton: { backgroundColor: "D35400", padding: 14, borderRadius: 18, alignItems: "flex-end", marginTop: 8 }
});
