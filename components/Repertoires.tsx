import { View, StyleSheet, Text } from "react-native";

export default function Repertoires() {
  return (
    <View style={styles.container}>
      <Text>Repertoires</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "black",
    width: "100%",
  },
});
