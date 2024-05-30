import { Image, StyleSheet, Text, View } from 'react-native'
import React, { useEffect } from 'react'
import { scale } from '../utilits/Scale'

const Welcome = ({ navigation }) => {
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      navigation.replace('Welcome1');
    }, 3000)
    return () => clearTimeout(splashTimer)
  })
  return (
    <View style={styles.container}>
      <Image
        source={require('../assests/icon/logo.png')}
        style={styles.img}
      />

    </View>
  )
}

export default Welcome

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center"
  },
  img: {
    height: scale(60),
    width: "50%"

  }
})