import { View, Text, StyleSheet } from "react-native";

export default function TabList() {
  return (
    <View style={styles.container}>
      <Text>TabList</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "black",
    width: "100%",
  },
});
