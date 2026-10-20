import { Text, View, TouchableOpacity, TextInput, Pressable, ScrollView } from "react-native";
import { useState, useRef } from "react";
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function ChatScreen(){

  const [messages, setMessages] = useState([
  { id: "1", text: "Cześć! O której mogę przyprowadzić Figę?", mine: true },
  { id: "2", text: "Cześć! Zapraszam o 9:00 😊", mine: false },
  ]);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = () => {
    const text = draft.trim();
    if(!text) return;

    setMessages((current) => [
        ...current,
        {id: Date.now().toString(), text, mine: true }
    ]);
    setDraft("");
  }

    return(
        
        
        <View style={{flex: 1, padding: 24, backgroundColor: "#FFF8F0"}}>
            <Text style={{fontSize: 28, fontWeight: "bold"}}>Chat</Text>
            <ScrollView 
                showsVerticalScrollIndicator={false}
                ref={scrollRef}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({animated: true})}
                >
            <View style={{ marginTop: 24, gap: 12 }}>
                {messages.map((message) => (
                    <View
                    key={message.id}
                    style={{
                        alignSelf: message.mine ? "flex-end": "flex-start",
                        backgroundColor: message.mine ? "#D35400": "#FFFFFF",
                        padding: 14,
                        borderRadius: 18,
                        maxWidth: "auto",
                    }}>
                        <Text style={{ color: message.mine ? "#FFFFFF": "#3D2415"}}>
                            {message.text}
                        </Text>

                    </View>
                ))}
            </View>
            </ScrollView>

            <View
            style={{
                marginTop: "auto",
                width:"40%",
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "center",
                gap: 10,
            }}
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
                    style={{
                    flex:1,
                    marginTop: "auto",
                    backgroundColor: "#FFFFFF",
                    borderWidth:1,
                    borderColor:"#E8D8CB",
                    borderRadius:24,
                    paddingHorizontal:18,
                    paddingVertical:14,
                    fontSize:16,
                    // maxWidth: "40%",
                    // width:"40%",
                    minHeight:"auto",
                    maxHeight: "auto",
                }}>
                </TextInput>
                <TouchableOpacity
                onPress={sendMessage}
                
                disabled={!draft.trim}
                style={{
                    backgroundColor: "D35400",
                    opacity: draft.trim() ? 1 : 0.5,
                    padding: 14,
                    borderRadius: 18,
                    alignItems: "flex-end",
                    marginTop: 8,
                }}>
                    <FontAwesome name="send" size={24} color="#D35400" />
                </TouchableOpacity>
                </View>
        </View>
    )
}