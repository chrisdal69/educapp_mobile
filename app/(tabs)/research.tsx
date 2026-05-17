import { View, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <AppText style={styles.text}>Research screen</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
  },
});
