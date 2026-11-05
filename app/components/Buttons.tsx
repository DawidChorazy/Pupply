import { Pressable, Text, StyleSheet } from "react-native";
import type { PressableProps } from "react-native";

type ButtonProps = PressableProps & {
    children: string,
}

export function PrimaryButton({children, style, ...props}: ButtonProps) {
    return (
        <Pressable style={styles.primaryButton} {...props} ><Text style={styles.buttonText}>{children}</Text></Pressable>
    )
}

export function SecondaryButton({children, style, ...props}: ButtonProps){
    return (
        <Pressable style={styles.secondaryButton}{...props}><Text style={styles.secondaryButtonText}>{children}</Text></Pressable>
    )
}

const styles = StyleSheet.create({
    primaryButton: {
    backgroundColor: "#D35400",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    flex: 1,
    marginTop: 12
    },

    secondaryButton: { padding: 12, alignItems: "center", marginTop: 12 },

    buttonText: { color: "#FFFFFF", fontWeight: "700" },

    secondaryButtonText: { color: "#D35400", fontWeight: "700"}
})

