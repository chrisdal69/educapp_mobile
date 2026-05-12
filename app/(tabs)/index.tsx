import { Text, View,  StyleSheet } from 'react-native';
import TabList from '@/components/TabList';
import Repertoires from '@/components/Repertoires';
import Cards from '@/components/Cards';    


export default function Index() {
  return (
    <View style={styles.container}>
     <Repertoires />
     <Cards />
     <TabList />      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
  },
});
