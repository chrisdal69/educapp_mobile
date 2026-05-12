import { View, StyleSheet, Text } from "react-native";

export default function Cards() {
  return (
    <View style={styles.container}>
      <Text>Cards</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "black",
    width: "100%",
  },
});