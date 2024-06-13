import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Welcome from '../screen/Welcome'
import Welcome1 from '../screen/Welcome1'
import Login from '../screen/Login'
import Welcome2 from '../screen/Welcome2'
import Forgot from '../screen/Forgot'
import Reset from '../screen/Reset'
import SingUp from '../screen/SingUp'
import Services from '../screen/Services'
import BusinessLocation from '../screen/BusinessLocation'
import SelectProfessional from '../screen/SelectProfessional'
import Summary from '../screen/Summary'
import Checkout from '../screen/Checkout'
import BusinessPage from '../screen/BusinessPage'
const Stack = createNativeStackNavigator()

const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name='Welcome' component={Welcome} />
        <Stack.Screen name='Welcome1' component={Welcome1} />
        <Stack.Screen name='Login' component={Login} />
        <Stack.Screen name='Welcome2' component={Welcome2} />
        <Stack.Screen name='Forgot' component={Forgot} />
        <Stack.Screen name='Reset' component={Reset} />
        <Stack.Screen name='SingUp' component={SingUp} />
        <Stack.Screen name='Services' component={Services} />
        <Stack.Screen name='BusinessLocation' component={BusinessLocation} />
        <Stack.Screen name='SelectProfessional' component={SelectProfessional} />
        <Stack.Screen name='Summary' component={Summary} />
        <Stack.Screen name='Checkout' component={Checkout} />
        <Stack.Screen name='BusinessPage' component={BusinessPage} />

      </Stack.Navigator>
    </NavigationContainer>

  )
}

export default Navigation

const styles = StyleSheet.create({})