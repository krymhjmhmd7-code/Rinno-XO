import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import screens
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CustomersScreen } from './src/screens/CustomersScreen';
import { SalesScreen } from './src/screens/SalesScreen';
import { DebtsScreen } from './src/screens/DebtsScreen';
import { CylinderLoansScreen } from './src/screens/CylinderLoansScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#f3f4f6' },
          }}
        >
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Customers" component={CustomersScreen} />
          <Stack.Screen name="Sales" component={SalesScreen} />
          <Stack.Screen name="Debts" component={DebtsScreen} />
          <Stack.Screen name="CylinderLoans" component={CylinderLoansScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
