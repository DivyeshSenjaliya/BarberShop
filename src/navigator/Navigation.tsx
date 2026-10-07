import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Welcome from '../screen/Welcome';
import Welcome1 from '../screen/Welcome1';
import Welcome2 from '../screen/Welcome2';
import Login from '../screen/Login';
import SingUp from '../screen/SingUp';
import Forgot from '../screen/Forgot';
import Reset from '../screen/Reset';

// Booking & Discovery Flow
import DiscoverySearch from '../screen/DiscoverySearch';
import ShopDetail from '../screen/ShopDetail';
import Services from '../screen/Services';
import SelectProfessional from '../screen/SelectProfessional';
import Summary from '../screen/Summary';
import Checkout from '../screen/Checkout';
import BusinessLocation from '../screen/BusinessLocation';
import BusinessPage from '../screen/BusinessPage';

// Customer Management & Account
import AppointmentsHistory from '../screen/AppointmentsHistory';
import WalletLoyalty from '../screen/WalletLoyalty';
import AddressesManagement from '../screen/AddressesManagement';
import NotificationCenter from '../screen/NotificationCenter';
import SupportFaq from '../screen/SupportFaq';

// Staff & Owner Dashboards
import BarberSchedule from '../screen/BarberSchedule';
import BarberEarnings from '../screen/BarberEarnings';
import OwnerDashboard from '../screen/OwnerDashboard';
import OwnerCatalogManagement from '../screen/OwnerCatalogManagement';

const Stack = createNativeStackNavigator();

const Navigation: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Welcome">
        {/* Onboarding & Auth */}
        <Stack.Screen name="Welcome" component={Welcome} />
        <Stack.Screen name="Welcome1" component={Welcome1} />
        <Stack.Screen name="Welcome2" component={Welcome2} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="SingUp" component={SingUp} />
        <Stack.Screen name="Forgot" component={Forgot} />
        <Stack.Screen name="Reset" component={Reset} />

        {/* Discovery & Booking Flow */}
        <Stack.Screen name="DiscoverySearch" component={DiscoverySearch} />
        <Stack.Screen name="ShopDetail" component={ShopDetail} />
        <Stack.Screen name="Services" component={Services} />
        <Stack.Screen name="SelectProfessional" component={SelectProfessional} />
        <Stack.Screen name="Summary" component={Summary} />
        <Stack.Screen name="Checkout" component={Checkout} />
        <Stack.Screen name="BusinessLocation" component={BusinessLocation} />
        <Stack.Screen name="BusinessPage" component={BusinessPage} />

        {/* Customer Self-Service */}
        <Stack.Screen name="AppointmentsHistory" component={AppointmentsHistory} />
        <Stack.Screen name="WalletLoyalty" component={WalletLoyalty} />
        <Stack.Screen name="AddressesManagement" component={AddressesManagement} />
        <Stack.Screen name="NotificationCenter" component={NotificationCenter} />
        <Stack.Screen name="SupportFaq" component={SupportFaq} />

        {/* Staff & Owner */}
        <Stack.Screen name="BarberSchedule" component={BarberSchedule} />
        <Stack.Screen name="BarberEarnings" component={BarberEarnings} />
        <Stack.Screen name="OwnerDashboard" component={OwnerDashboard} />
        <Stack.Screen name="OwnerCatalogManagement" component={OwnerCatalogManagement} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;