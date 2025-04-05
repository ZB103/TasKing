import React, { useState, useContext } from 'react';
import { Button, Text, View, Switch, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { getAuth, signOut, updatePassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

import { SettingsContext } from '../config/SettingsContext';
import colors from '../config/colors';

const SettingsScreen = ({ navigation }) => {
  const settings = useContext(SettingsContext);
  const auth = getAuth();
  const db = getFirestore();

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log('User logged out successfully');
      alert("See you soon! You've got this.");
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleUsernameUpdate = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { username: newUsername });
        alert("Nice to meet you, " + newUsername + "!");
        console.log('Username updated successfully');
        setNewUsername('');
      }
    } catch (error) {
      console.error('Failed to update username:', error);
    }
  };

  const handlePasswordUpdate = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        alert('Password updated successfully!');
        console.log('Password updated successfully');
        setNewPassword('');
      }
    } catch (error) {
      console.error('Failed to update password:', error);
    }
  };

  if (!settings) return null;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={[styles.background, { backgroundColor: settings.darkMode ? colors.black : colors.white }]}>
            <View style={styles.headerContainer}>
              <View style={{ position: 'absolute', left: 15, top: Platform.OS === 'ios' ? 50 : 30 }}>
                <Button title="Back" color={settings.darkMode ? colors.secondary : colors.primary} onPress={() => navigation.goBack()} />
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[styles.headerText, { color: settings.darkMode ? colors.white : colors.black }]}>
                  Your Settings
                </Text>
              </View>
            </View>

            <View style={styles.toggleContainer}>
              <Text style={[styles.label, { color: settings.darkMode ? colors.white : colors.black }]}>
                Dark Mode
              </Text>
              <Switch
                value={settings.darkMode}
                onValueChange={settings.toggleDarkMode}
              />
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <View style={styles.changeContainer}>
              <Text style={[styles.changeText, { color: settings.darkMode ? colors.white : colors.black }]}>
                Change Username
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: settings.darkMode ? colors.white : colors.black,
                    borderColor: settings.darkMode ? colors.white : colors.black,
                  },
                ]}
                placeholder="New Username"
                placeholderTextColor={settings.darkMode ? colors.white : colors.black}
                value={newUsername}
                onChangeText={(text) => {setNewUsername(text)}}
              />
              <TouchableOpacity style={[styles.button, {backgroundColor: settings.darkMode ? colors.secondary : colors.primary}]} onPress={handleUsernameUpdate}>
                <Text style={styles.buttonText}>Update Username</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.changeContainer}>
              <Text style={[styles.changeText, { color: settings.darkMode ? colors.white : colors.black }]}>
                Change Password
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: settings.darkMode ? colors.white : colors.black,
                    borderColor: settings.darkMode ? colors.white : colors.black,
                  },
                ]}
                placeholder="New Password"
                placeholderTextColor={settings.darkMode ? colors.white : colors.black}
                secureTextEntry
                value={newPassword}
                onChangeText={(text) => {setNewPassword(text)}}
              />
              <TouchableOpacity style={[styles.button, {backgroundColor: settings.darkMode ? colors.secondary : colors.primary}]} onPress={handlePasswordUpdate}>
                <Text style={styles.buttonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    position: 'relative',
  },    
  headerText: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 18,
  },
  logoutButton: {
    backgroundColor: 'red',
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 50,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  changeContainer: {
    width: '80%',
    alignItems: 'center',
    marginTop: 30,
  },
  changeText: {
    fontSize: 18,
    marginBottom: 10,
  },
  input: {
    width: '100%',
    height: 50, 
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 18,
    marginBottom: 15,
  },
  button: {
    paddingVertical: 15, 
    paddingHorizontal: 25,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180, 
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 20,
  },  
});
