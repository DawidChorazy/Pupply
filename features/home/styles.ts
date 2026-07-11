import { Platform, StyleSheet } from "react-native";

const raisedShadow = Platform.select({
  web: {
    boxShadow: "0 8px 14px rgba(107, 58, 24, 0.06)"
  },
  default: {
    shadowColor: "#6B3A18",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  }
});

const buttonShadow = Platform.select({
  web: {
    boxShadow: "0 8px 14px rgba(211, 84, 0, 0.2)"
  },
  default: {
    shadowColor: "#D35400",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  }
});

const smallShadow = Platform.select({
  web: {
    boxShadow: "0 6px 12px rgba(107, 58, 24, 0.08)"
  },
  default: {
    shadowColor: "#6B3A18",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  }
});

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24
  },
  eyebrow: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#3D2415",
    fontSize: 30,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8A6D5B",
    fontSize: 14,
    marginTop: 4
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...smallShadow
  },

  quickActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22
  },
  actionCard: {
    flex: 1,
    minHeight: 164,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    ...raisedShadow
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  actionTitle: {
    color: "#3D2415",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6
  },
  actionDescription: {
    color: "#8A6D5B",
    fontSize: 12,
    lineHeight: 17,
    flex: 1
  },
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12
  },
  actionText: {
    fontSize: 13,
    fontWeight: "800"
  },

  section: {
    marginBottom: 22
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    ...raisedShadow
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  sectionTitle: {
    color: "#3D2415",
    fontSize: 18,
    fontWeight: "800"
  },
  sectionAction: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "800"
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    ...raisedShadow
  },
  emptyIllustration: {
    height: 108,
    borderRadius: 16,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  emptyTitle: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 5
  },
  emptySubtitle: {
    color: "#8A6D5B",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  },
  petsError: {
    color: "#B42318",
    fontSize: 13,
    textAlign: "center"
  },
  petRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E4D8"
  },
  petRowLast: {
    borderBottomWidth: 0
  },
  petAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    overflow: "hidden"
  },
  petAvatarImage: {
    width: 34,
    height: 34
  },
  petInfo: {
    flex: 1
  },
  petName: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "800"
  },
  petMeta: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 2
  },
  addAnotherPetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F2E4D8"
  },
  addAnotherPetText: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700"
  },

  walksEmptyContent: {
    minHeight: 148,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10
  },
  walksIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  walksList: {
    gap: 10
  },
  walkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E4D8",
    gap: 10
  },
  walkRowLast: {
    borderBottomWidth: 0
  },
  walksIconCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  walkInfo: {
    flex: 1
  },
  walkTitle: {
    color: "#3D2415",
    fontSize: 14,
    fontWeight: "800"
  },
  walkMeta: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 2
  },
  walkStatusBadge: {
    borderRadius: 999,
    backgroundColor: "#ECFDF3",
    paddingVertical: 6,
    paddingHorizontal: 9
  },
  walkStatusText: {
    color: "#067647",
    fontSize: 11,
    fontWeight: "800"
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#D35400"
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  }
});

export const addDogStyles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
    paddingBottom: 22
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...smallShadow
  },
  headerCopy: {
    flex: 1
  },
  eyebrow: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#3D2415",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8A6D5B",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4
  },

  photoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  photoPlaceholder: {
    height: 170,
    borderRadius: 18,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",

  },
  photoPreview: {
    height: 190,
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: "#FFF0D2"
  },
  photoActions: {
    flexDirection: "row",
    gap: 10
  },
  photoButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  photoButtonText: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "800"
  },
  photoRemoveButton: {
    width: 44,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F6C8C3",
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center"
  },
  photoTitle: {
    color: "#3D2415",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 8
  },
  photoSubtitle: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 4
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  sectionTitle: {
    color: "#3D2415",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  halfInput: {
    flex: 1
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#F1DED0",
    paddingHorizontal: 14,
    color: "#3D2415",
    fontSize: 14,
    marginBottom: 10
  },
  textArea: {
    minHeight: 92,
    paddingTop: 13
  },

  fieldLabel: {
    color: "#6F5648",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  genderRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10
  },
  genderOption: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFF8F0",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  genderOptionActive: {
    backgroundColor: "#D35400",
    borderColor: "#D35400"
  },
  genderIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  genderIconCircleActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)"
  },
  genderLabel: {
    color: "#3D2415",
    fontSize: 13,
    fontWeight: "700"
  },
  genderLabelActive: {
    color: "#FFFFFF"
  },

  documentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8
  },
  documentAddButton: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFF8F0",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7
  },
  documentAddButtonText: {
    color: "#D35400",
    fontSize: 12,
    fontWeight: "800"
  },
  documentsList: {
    gap: 8,
    marginBottom: 10
  },
  documentRow: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFF8F0",
    padding: 10,
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  documentIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  documentInfo: {
    flex: 1
  },
  documentName: {
    color: "#3D2415",
    fontSize: 13,
    fontWeight: "800"
  },
  documentMeta: {
    color: "#8A6D5B",
    fontSize: 11,
    marginTop: 2
  },
  documentRemoveButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center"
  },
  documentsEmpty: {
    color: "#8A6D5B",
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 10
  },

  statusTextError: {
    color: "#B42318",
    marginBottom: 8,
    textAlign: "center",
    fontSize: 13
  },
  statusTextSuccess: {
    color: "#067647",
    marginBottom: 8,
    textAlign: "center",
    fontSize: 13
  },

  saveButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    ...buttonShadow
  },
  saveButtonDisabled: {
    opacity: 0.7
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  },

  previewPhotoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  previewPhoto: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    backgroundColor: "#FFF0D2"
  },
  previewPhotoPlaceholder: {
    height: 220,
    borderRadius: 18,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  previewPhotoPlaceholderText: {
    color: "#8A6D5B",
    fontSize: 13,
    fontWeight: "600"
  },
  previewHero: {
    marginBottom: 14,
    gap: 10
  },
  previewName: {
    color: "#3D2415",
    fontSize: 30,
    fontWeight: "800"
  },
  previewGenderBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF0D2",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  previewGenderText: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700"
  },
  previewRow: {
    flexDirection: "row",
    gap: 12
  },
  previewHalfField: {
    flex: 1
  },
  previewField: {
    marginBottom: 14
  },
  previewLabel: {
    color: "#8A6D5B",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  previewValue: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21
  },
  previewValueMultiline: {
    lineHeight: 22
  },
  editButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...buttonShadow
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  },
  editActionsRow: {
    flexDirection: "row",
    gap: 10
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelButtonText: {
    color: "#6F5648",
    fontSize: 15,
    fontWeight: "800"
  },
  saveButtonInline: {
    flex: 1.4
  }
});
