import { Platform, StyleSheet } from "react-native";

const raisedShadow = Platform.select({
  web: {
    boxShadow: "0 8px 20px rgba(61, 36, 21, 0.08)"
  },
  default: {
    shadowColor: "#3D2415",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4
  }
});

const buttonShadow = Platform.select({
  web: {
    boxShadow: "0 10px 18px rgba(211, 84, 0, 0.22)"
  },
  default: {
    shadowColor: "#D35400",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 5
  }
});

export const bookWalkStyles = StyleSheet.create({
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
    justifyContent: "center"
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
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
  caregiverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  caregiverInfo: {
    flex: 1
  },
  caregiverName: {
    color: "#3D2415",
    fontSize: 16,
    fontWeight: "800"
  },
  caregiverRole: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 3
  },
  ratingBadge: {
    minWidth: 54,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4
  },
  ratingText: {
    color: "#3D2415",
    fontSize: 12,
    fontWeight: "800"
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  metaItem: {
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "#FFF8F0",
    paddingHorizontal: 10,
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  metaText: {
    color: "#6F5648",
    fontSize: 12,
    fontWeight: "700"
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tag: {
    borderRadius: 999,
    backgroundColor: "#FFF0D2",
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  tagText: {
    color: "#8A4A1F",
    fontSize: 11,
    fontWeight: "800"
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  optionChip: {
    minWidth: 88,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFF8F0",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  optionChipActive: {
    backgroundColor: "#D35400",
    borderColor: "#D35400"
  },
  optionChipText: {
    color: "#3D2415",
    fontSize: 13,
    fontWeight: "700"
  },
  optionChipTextActive: {
    color: "#FFFFFF"
  },
  petRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E4D8"
  },
  petRowLast: {
    borderBottomWidth: 0
  },
  petAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  petAvatarImage: {
    width: 40,
    height: 40
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
  emptyPets: {
    color: "#8A6D5B",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12
  },
  addPetLink: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "800"
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E4D8"
  },
  summaryRowLast: {
    borderBottomWidth: 0,
    paddingTop: 12
  },
  summaryLabel: {
    color: "#8A6D5B",
    fontSize: 13,
    fontWeight: "600"
  },
  summaryValue: {
    color: "#3D2415",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
    marginLeft: 16
  },
  summaryPrice: {
    color: "#D35400",
    fontSize: 22,
    fontWeight: "800"
  },
  statusTextError: {
    color: "#B42318",
    marginBottom: 8,
    textAlign: "center",
    fontSize: 13
  },
  confirmButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    ...buttonShadow
  },
  confirmButtonDisabled: {
    opacity: 0.7
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  progressTrack: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressStep: {
    flex: 1,
    alignItems: "center"
  },
  progressStepTop: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  progressDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F2E4D8",
    alignItems: "center",
    justifyContent: "center"
  },
  progressDotActive: {
    backgroundColor: "#D35400"
  },
  progressDotCurrent: {
    borderWidth: 3,
    borderColor: "#FFE2C8"
  },
  progressLine: {
    flex: 1,
    height: 3,
    backgroundColor: "#F2E4D8",
    marginHorizontal: 4,
    borderRadius: 999
  },
  progressLineActive: {
    backgroundColor: "#D35400"
  },
  progressLabel: {
    color: "#8A6D5B",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center"
  },
  progressLabelActive: {
    color: "#3D2415"
  },

  detailStatusBanner: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  detailStatusBannerWaiting: {
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#F2E4D8"
  },
  detailStatusBannerActive: {
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#ABEFC6"
  },
  detailStatusBannerReturning: {
    backgroundColor: "#EFF8FF",
    borderWidth: 1,
    borderColor: "#B2DDFF"
  },
  detailStatusBannerCompleted: {
    backgroundColor: "#F4F3FF",
    borderWidth: 1,
    borderColor: "#D9D6FE"
  },
  detailStatusTitle: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "800"
  },
  detailStatusText: {
    color: "#6F5648",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },

  mapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  mapSurface: {
    height: 220,
    borderRadius: 16,
    backgroundColor: "#E8F4EA",
    overflow: "hidden",
    position: "relative"
  },
  mapGridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "22%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.65)"
  },
  mapGridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "24%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.65)"
  },
  mapParkPatch: {
    position: "absolute",
    right: "8%",
    top: "18%",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#C8E6C9"
  },
  mapRouteLine: {
    position: "absolute",
    height: 4,
    borderRadius: 999,
    backgroundColor: "#D35400",
    opacity: 0.45
  },
  mapMarkerHome: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E9B5A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF"
  },
  mapMarkerWalker: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF"
  },
  mapLiveBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  mapLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#12B76A"
  },
  mapLiveText: {
    color: "#067647",
    fontSize: 11,
    fontWeight: "800"
  },
  mapCaption: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 10,
    textAlign: "center"
  },

  liveInfoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  liveInfoCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    ...raisedShadow
  },
  liveInfoLabel: {
    color: "#8A6D5B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6
  },
  liveInfoValue: {
    color: "#3D2415",
    fontSize: 18,
    fontWeight: "800"
  },
  phoneButton: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#F1DED0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  phoneButtonText: {
    color: "#D35400",
    fontSize: 14,
    fontWeight: "800"
  },

  detailField: {
    marginBottom: 12
  },
  detailFieldLabel: {
    color: "#8A6D5B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4
  },
  detailFieldValue: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "600"
  }
});
