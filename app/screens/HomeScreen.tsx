import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const HomeScreen = () => {
  return (
    <View 
    style={{
    flex: 1,
    backgroundColor: '#6a11cb',
    justifyContent: 'center',
    alignItems: 'center',
}}>
      <Text>Hello!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6a11cb',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;