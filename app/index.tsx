import * as React from "react";
import { Text, View, StyleSheet } from "react-native";
//to install run: npm install @react-navigation/native
import { NavigationContainer } from "@react-navigation/native";
//to install run: npx expo install react-native-screens react-native-safe-area-context
import { createNativeStackNavigator } from "@react-navigation/native-stack";
//talks to files found in screens folder
import OpeningScreen from "./screens/OpeningScreen";
import ShopScreen from "./screens/ShopScreen";
import HomeScreen from "./screens/HomeScreen";
import TaskScreen from "./screens/TaskScreen";
import FriendsScreen from "./screens/FriendsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import StatisticsScreen from "./screens/StatisticsScreen";
import CreateTaskScreen from "./screens/CreateTaskScreen";
import ForgotPassScreen from "./screens/ForgotPassScreen";
import { SettingsProvider } from "./SettingsContext";

//creating stack navigator
const Stack = createNativeStackNavigator();

const Index = () => {
    return (
        /* Stack consists of the stack of screens in project.
        Project opens on the Welcome / Opening screen and will be
        navigated to other  screens via Stack. */
        <SettingsProvider>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Welcome" component={OpeningScreen}/>
                <Stack.Screen name="ForgotPass" component={ForgotPassScreen}/>
                <Stack.Screen name="Home" component={HomeScreen}/>
                <Stack.Screen name="Shop" component={ShopScreen}/>
                <Stack.Screen name="Tasks" component={TaskScreen}/>
                <Stack.Screen name="Create Task" component={CreateTaskScreen}/>
                <Stack.Screen name="Friends" component={FriendsScreen}/>
                <Stack.Screen name="Stats" component={StatisticsScreen}/>
                <Stack.Screen name="Settings" component={SettingsScreen}/>
            </Stack.Navigator>
        </SettingsProvider>
    );
};

export default Index;
