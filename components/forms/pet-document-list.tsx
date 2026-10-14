import type { PetDocument } from "@/types/pet-document";
import { Platform, Text, View, TouchableOpacity, TextInput } from "react-native";
import { petDocumentListStyles as styles } from "@/styles/pet-document-list";
import { getDocumentStatus } from "@/utils/document-date"

type PetDocumentListProps = {
    documents: PetDocument[];
    onRemove?: (index: number) => void;
    onExpiryChange?: (documentId: string, value: string) => void;
    onReminderChange?: (documentId: string, days: number) => void;
};


export function PetDocumentList({documents, onRemove, onExpiryChange, onReminderChange}: PetDocumentListProps){
    return (
        <View>
            {documents.length === 0 && (
                <Text>Brak dokumentów</Text>
            )}
            {documents.map((document, index) => (
                <View key = {`${document.uri}-${index}`}>
                    <TouchableOpacity
                    onPress={() => {
                        if(Platform.OS === "web"){
                            window.open(document.uri, "_blank", "noopener,noreferrer")
                        }
                    }}>
                        <Text>{document.name} - Otwórz PDF</Text>
                    </TouchableOpacity>
                    <Text>{getDocumentStatus(
                        document.expiresAt,
                        document.reminderDaysBefore
                    )}</Text>

                    {onExpiryChange && (
                        <TextInput style={styles.expiryInput} placeholder="Ważny do DD.MM.YYYY" value={document.expiresAt} onChangeText={(value) =>
                            onExpiryChange?.(document.id, value)
                        }></TextInput>
                    )}

                    {onReminderChange && (
                        <View>
                            <Text>Przypomnij o wygaśnięciu</Text>
                            <TextInput
                            value={String(document.reminderDaysBefore)}
                            keyboardType="number-pad"
                            style={styles.expiryInput} 
                            onChangeText={(value) => {
                            if (/^\d*$/.test(value)) {
                                onReminderChange?.(document.id, Number(value));
                            }
                        }}></TextInput>
                        </View>
                    )}
                    
                    {onRemove && (
                        <TouchableOpacity onPress={() => {
                            onRemove(index)
                        }}>
                            <Text>Usuń</Text>
                        </TouchableOpacity>
                    )}
                </View>
                
            ))}
        </View>
    )
}