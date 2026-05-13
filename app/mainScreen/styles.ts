import { StyleSheet } from "react-native";

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
    shadowColor: "#6B3A18",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
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
    shadowColor: "#6B3A18",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
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
    shadowColor: "#6B3A18",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
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
    shadowColor: "#6B3A18",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
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
