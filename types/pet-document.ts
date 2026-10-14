import type { DocumentPickerAsset } from "expo-document-picker"

export type PetDocument = DocumentPickerAsset & {
    id: string,
    expiresAt: string,
    reminderDaysBefore: number,
}