import type { DocumentPickerAsset } from "expo-document-picker"

export type PetDocument = DocumentPickerAsset & {
    id: string,
    serverId?: string,
    petId?: string,
    expiresAt: string,
    reminderDaysBefore: number,
}