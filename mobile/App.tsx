import 'process/browser';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import React from 'react';
import { NavigationContainer,  } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PhotoGallery from './src/PhotoGallery';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Tab = createBottomTabNavigator();

export type RootStackParamList = {
  PhotoGallery: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="PhotoGallery" screenOptions={{
        headerStyle: {
          backgroundColor: '#141414',
        },
        headerTintColor: 'white',
      }}>
        <Stack.Screen
          name="PhotoGallery"
          component={PhotoGallery}
          options={{ title: 'Photos', headerShown: true }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
