import React, { useState, useContext } from 'react';
import { StyleSheet, View, Button, Image, TextInput, Pressable, Text, Platform } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { FIREBASE_APP, FIREBASE_DB } from '@/firebaseConfig'
import { collection, doc, setDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, } from 'react-native';
import colors from '../config/colors';
import { SettingsContext } from '../config/SettingsContext';

const OpeningScreen = ({navigation}) => {
    const settings = useContext(SettingsContext);
    const [showLogin, setShowLogin] = useState(true);
    const [showSignUp, setShowSignUp] = useState(false);
    var [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const auth = getAuth(FIREBASE_APP);

    const toggleLogin = () => {
        setShowLogin(!showLogin);
        if (showSignUp) {
            setShowSignUp(false)
        }
    }

    const toggleSignup = () => {
        setShowSignUp(!showSignUp);
        if (showLogin) {
            setShowLogin(false)
        }
    }

    const signIn = async () => {
        try {
          const response = await signInWithEmailAndPassword(auth, email, password);
          console.log(response);
          // navigation.navigate('Shop') # Debugging purposes if rootnav doesn't work
        } catch (error) {
          console.log(error);
          alert('sign in failed: ' + error.message);
        }
      };

      const signUp = async () => {
        try {
            // Create a user in Firebase Authentication
            const response = await createUserWithEmailAndPassword(auth, email, password);
            const user = response.user;

            // Store additional user data in Firestore
            await setDoc(doc(FIREBASE_DB, "users", user.uid), {
                Friends: [],
                balance: 0,
                email: email,
                level: 0,
                owneditems: [],
                pfp: "",
                username: username || "NewUser",
                xp: 0
            });

            alert('Sign-up successful!');
            setShowLogin(false);
            setShowSignUp(false);
        } catch (error) {
            console.log(error);
            alert('Sign-up failed: ' + error.message);
        }
    };

    return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
                    <SafeAreaView style={styles.container}>
                        <View style={styles.background}>
                            <Image style={styles.logo} source={require("../assets/imgs/logo_large.png")} />
                            <View style={styles.buttons}>
                                <Button color={colors.grey} title="Signup" onPress={toggleSignup}/>
                                {showSignUp && (
                                    <View style={styles.textFields} >
                                        <TextInput
                                            value={email}
                                            placeholder="Enter Email"
                                            autoCapitalize="none"
                                            onChangeText={(text) => setEmail(text)}
                                        />
                                        <TextInput 
                                            secureTextEntry={true}
                                            value={password}
                                            placeholder="Enter Password"
                                            autoCapitalize="none"
                                            onChangeText={(text) => setPassword(text)}
                                        />
                                        <Button color={colors.accept} title="Confirm Sign Up" onPress={signUp} />
                                    </View>
                                )}
                                <View style={{width: 15}}/>
                                <Button color={colors.primary} title="Login" onPress={toggleLogin}/>
                                {showLogin && (
                                    <View style={styles.textFields}>
                                        <TextInput
                                            value={email}
                                            placeholder="Enter Email"
                                            autoCapitalize="none"
                                            onChangeText={(text) => setEmail(text)} // <- Add this
                                        />
                                        <TextInput
                                            value={password}
                                            placeholder="Enter Password"
                                            secureTextEntry={true}
                                            autoCapitalize="none"
                                            onChangeText={(text) => setPassword(text)} // <- Add this
                                        />
                                        <Button color={colors.accept} title="Confirm Login" onPress={signIn} />
                                    </View>
                                )}
                            </View>
                            <View style={styles.changePassLine}>
                                <Pressable onPress={() => navigation.navigate("ForgotPass")}>
                                    <Text style={styles.forgotPassword}>Forgot Password? Click Here to Change it.</Text>
                                </Pressable>
                            </View>
                        </View>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    buttons: {
        position: "absolute",
        top: "50%",
        height: 70,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
    },
    container: {
        flex: 1,
    },
    changePassLine: {
        position: "absolute",
        top: "60%",
    },
    forgotPassword: {
        color: "blue",
        textDecorationLine: "underline"
    },
    logo: {
        width: 408,
        height: 128,
        position: "absolute",
        top: 10,
    },
    signUpButton: {
        backgroundColor: colors.primary
    },
    textFields: {
        position: "absolute",
        bottom: 70,
    },
})

export default OpeningScreen;
