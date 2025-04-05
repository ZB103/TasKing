import React, { useState, useContext, useEffect } from 'react';
import { StyleSheet, View, Button, Image, TextInput, Pressable, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FIREBASE_APP, FIREBASE_DB } from '@/firebaseConfig'
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth, onAuthStateChanged } from 'firebase/auth';
import { KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import colors from '../config/colors';
import { SettingsContext } from '../config/SettingsContext';
import bodyData from '../assets/shopdata/bodyData';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';

const OpeningScreen = ({navigation}) => {
    const settings = useContext(SettingsContext);
    const [showLogin, setShowLogin] = useState(true);
    const [showSignUp, setShowSignUp] = useState(false);
    var [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const auth = getAuth(FIREBASE_APP);

    const opacity = useSharedValue(1);
    const scale = useSharedValue(1);

    const handleTransition = () => {
        // Animate fade-out and scale effect
        opacity.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) });
        scale.value = withTiming(0.8, { duration: 600, easing: Easing.out(Easing.ease) });

        // Navigate after animation completes
        setTimeout(() => {
            navigation.replace('Home');
        }, 800);
    };

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }]
    }));

    const toggleLogin = () => {
        setShowLogin(true);
        setShowSignUp(false);
        // Clear input fields
        setEmail('');
        setPassword('');
    }
    
    const toggleSignup = () => {
        setShowSignUp(true);
        setShowLogin(false);
        // Clear input fields
        setEmail('');
        setPassword('');
        setUsername('');
    }

    const signIn = async () => {
        try {
          const response = await signInWithEmailAndPassword(auth, email, password);
          console.log(response);

          //send welcome message with isNewAccount set to false
          welcomeMessage(false);

          handleTransition();
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
                    friends: [],
                    balance: 0,
                    email: email,
                    level: 0,
                    ownedbody: [
                        //all skin tones unlocked by default
                        bodyData[0].imageUrl,
                        bodyData[1].imageUrl,
                        bodyData[2].imageUrl,
                        bodyData[3].imageUrl,
                        bodyData[4].imageUrl,
                    ],
                    ownedshirt: ["null"],
                    ownedpants: ["null"],
                    ownedhat: ["null"],
                    ownedshoes: ["null"],
                    ownedacc: ["null"],
                    equipped: {
                        body: bodyData[3].imageUrl,
                        shirt: "null",
                        pants: "null",
                        hat: "null",
                        shoes: "null",
                        acc: "null",
                    },
                    currentresolution: "4-bit",
                    pfp: "",
                    username: username || "NewUser",
                    xp: 0
                });

                //send welcome message with isNewAccount set to true
                welcomeMessage(true);

                setShowLogin(false);
                setShowSignUp(false);
            } catch (error) {
                console.log(error);
                alert('Sign-up failed: ' + error.message);
            }
  };

  //Welcome or welcome back alert depending on whether account is new
  const welcomeMessage = (isNewAccount) => {
    //create message
    const message = isNewAccount ?
      "Welcome to TasKing! On the home page, swipe up for the task screen, and swipe down for the shop screen. Completing tasks awards points and experience, which can be used to unlock items in the shop and upgrade resolution in the menu. Friends and statistics can also be accessed in the menu, to help you make progress toward your goals. We're sure you'll find TasKing to be your new best friend. When you're ready, let's do this." :
      "Welcome back to TasKing! Let's do this." ;
    alert(message);
  };

    return (
        <GestureHandlerRootView style={{flex: 1}}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
                    <View style={{flex: 1}}>
                        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                            <Animated.View style={[styles.background, animatedStyle]}>
                                <Image style={styles.logo} source={{uri: "https://firebasestorage.googleapis.com/v0/b/tasking-c1d66.firebasestorage.app/o/logo_large.png?alt=media&token=23b05660-b758-4a03-a261-79b3eca54329"}} />
                                
                                {/* Text Input */}
                                <View> 
                                    {/* SignUp */}
                                    <View style={[styles.textFields, { display: showSignUp ? 'flex' : 'none' }]}>
                                        <TextInput
                                            style={[styles.textInput, { borderColor: colors.black}]}
                                            value={email}
                                            placeholder="Set Email"
                                            autoCapitalize="none"
                                            onChangeText={(text) => setEmail(text)}
                                        />
                                        <TextInput 
                                            style={[styles.textInput, { borderColor: colors.black}]}
                                            value={password}
                                            secureTextEntry={true}
                                            placeholder="Set Password"
                                            autoCapitalize="none"
                                            onChangeText={(text) => setPassword(text)}
                                        />
                                        <TextInput
                                          style={[styles.textInput, { borderColor: colors.black }]}
                                          value={username}
                                          placeholder="Set Username"
                                          autoCapitalize="none"
                                          onChangeText={(text) => setUsername(text)}
                                        />
                                        <View style={{height: 20}}></View>
                                        <Button color={colors.accept} title="Confirm Sign Up" onPress={signUp} />
                                    </View>

                                    {/* Login */}
                                    <View style={[styles.textFields, { display: showLogin ? 'flex' : 'none' }]}>
                                        <TextInput
                                            style={[styles.textInput, { borderColor: colors.black}]}
                                            value={email}
                                            placeholder="Enter Email"
                                            autoCapitalize="none"
                                            onChangeText={(text) => setEmail(text)}
                                        />
                                        <TextInput
                                            style={[styles.textInput, { borderColor: colors.black}]}
                                            value={password}
                                            placeholder="Enter Password"
                                            secureTextEntry={true}
                                            autoCapitalize="none"
                                            onChangeText={(text) => setPassword(text)}
                                        />
                                        <View style={{height: 20}}></View>
                                        <Button color={colors.accept} title="Confirm Login" onPress={signIn} />
                                    </View>
                                </View>

                                {/* Buttons */}
                                <View style={styles.buttons}>
                                    <Button color={colors.grey} title="Signup" onPress={toggleSignup}/>
                                    <View style={{width: 15}}/>
                                    <Button color={colors.primary} title="Login" onPress={toggleLogin}/>
                                </View>

                                {/* Forgot Password*/}
                                <View style={styles.forgotPasswordLine}>
                                    <Pressable onPress={() => navigation.navigate("ForgotPass")}>
                                        <Text style={styles.forgotPassword}>Forgot Password? Click Here to Change it.</Text>
                                    </Pressable>
                                </View>
                            </Animated.View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    buttons: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        marginVertical: 20,
    },
    container: {
        flex: 1,
    },
    forgotPassword: {
        color: "blue",
        textDecorationLine: "underline"
    },
    forgotPasswordLine: {
        marginTop: 20,
        alignItems: "center",
    },
    logo: {
        width: 408,
        height: 128,
        marginBottom: 150,
        marginTop: 20
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: "center",
        paddingBottom: 20,
    },
    textFields: {
        width: "100%",
        alignItems: "center",
        marginTop: 10,
    },
    textInput: {
        width: 280,
        height: 50,
        fontSize: 18,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
})

export default OpeningScreen;
