import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
    padding: 16
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#D35400"
  },
  subtitle: {
    fontSize: 14,
    color: "#E67E22",
    marginTop: 2
  },
  icons: {
    flexDirection: "row",
    gap: 12,
    fontSize: 18
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },

  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#333"
  },
  cardDesc: {
    fontSize: 13,
    color: "#777",
    marginBottom: 12
  },

  button: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    alignSelf: "flex-start"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold"
  },

  buttonOrange: {
    backgroundColor: "#D35400"
  },
  buttonGreen: {
    backgroundColor: "#1E9B5A"
  },
  iconOrange: {
    backgroundColor: "#FFE6D5"
  },
  iconGreen: {
    backgroundColor: "#DFF7E6"
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center"
  },
  addText: {
    color: "#D35400",
    fontWeight: "600"
  },

  emptyBox: {
    backgroundColor: "#FFF3E6",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center"
  },

  emptyIcon: {
    fontSize: 30,
    marginBottom: 8
  },

  emptyTitle: {
    fontWeight: "bold",
    color: "#D35400",
    marginBottom: 4
  },

  emptySubtitle: {
    fontSize: 12,
    color: "#B85C00"
  }
});