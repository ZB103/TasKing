import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button, Text, View, StyleSheet, Pressable, Dimensions, FlatList, TextInput, Alert, Modal, Image, Platform, InteractionManager} from 'react-native';
import { Bell, UserPlus } from 'lucide-react-native';
import { collection, doc, getDoc, updateDoc, query, where, getDocs, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import Toast from 'react-native-toast-message';

import { themes } from '@/config/colors';
import useTheme from '@/config/useTheme';
import { SettingsContext } from '@/config/SettingsContext';
import CustomMenu from '@/config/customMenu';
import { FIREBASE_DB } from '@/firebaseConfig';
import { authContext } from '@/config/authContext';

// Data used to pull images
import bodyData from '../assets/shopdata/bodyData';
import shirtData from '../assets/shopdata/shirtData';
import pantsData from '../assets/shopdata/pantsData';
import hatData from '../assets/shopdata/hatData';
import shoesData from '../assets/shopdata/shoesData';
import accData from '../assets/shopdata/accData';
import PressableButton from '@/config/PressableButton';

const FriendsScreen = () => {
    const { user } = useContext(authContext);
    const colors = useTheme();
    const [friends, setFriends] = useState([]);
    const [friendUsername, setFriendUsername] = useState('');
    const [friendRequests, setFriendRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [requestModalVisible, setRequestModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState("received");
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [friendModalVisible, setFriendModalVisible] = useState(false);
    const [friendStats, setFriendStats] = useState(null);
    const navigation = useNavigation();
    const settings = useContext(SettingsContext);

    if (!settings || !user) return null;

    useFocusEffect(
        useCallback(() => {
            if (!user) return;
        
            const userRef = doc(FIREBASE_DB, "users", user.uid);
            const unsubscribeFriends = onSnapshot(userRef, async (userSnap) => {
                if (!userSnap.exists()) return;
                const friendIds = userSnap.data().friends || [];
            
                const friendData = await Promise.all(friendIds.map(async (id) => {
                    const friendDoc = await getDoc(doc(FIREBASE_DB, "users", id));
                    if (friendDoc.exists()) {
                        const data = friendDoc.data();
                        return {
                            id,
                            username: data.username || "Unknown",
                            level: data.level || 0,
                            pfp: data.pfp || null,
                            equipped: data.equipped || {},
                            currentresolution: data.currentresolution || "fourBit",
                            online: data.online ?? false,
                        };
                    } else {
                        return {
                            id,
                            username: "Unknown",
                            level: 0,
                            pfp: null,
                            online: false,
                        };
                    }
                }));
            
                setFriends(friendData);
            });
        
            const receivedQuery = query(collection(FIREBASE_DB, "friendRequests"), where("receiverId", "==", user.uid));
            const unsubscribeRequests = onSnapshot(receivedQuery, async (snapshot) => {
                const requests = await Promise.all(snapshot.docs.map(async (docSnap) => {
                    const requestData = docSnap.data();
                    const senderRef = doc(FIREBASE_DB, "users", requestData.senderId);
                    const senderSnap = await getDoc(senderRef);
        
                    return {
                        id: docSnap.id,
                        senderId: requestData.senderId,
                        senderUsername: senderSnap.exists() ? senderSnap.data().username : "Unknown",
                        status: requestData.status,
                    };
                }));
    
                if (requests.length > friendRequests.length) {
                    const newRequest = requests.find(req => !friendRequests.some(existing => existing.id === req.id));
                }
    
                setFriendRequests(requests);
            });
        
            const sentQuery = query(collection(FIREBASE_DB, "friendRequests"), where("senderId", "==", user.uid));
            const unsubscribeSentRequests = onSnapshot(sentQuery, async (snapshot) => {
                const requests = await Promise.all(snapshot.docs.map(async (docSnap) => {
                    const requestData = docSnap.data();
                    const receiverRef = doc(FIREBASE_DB, "users", requestData.receiverId);
                    const receiverSnap = await getDoc(receiverRef);
        
                    return {
                        id: docSnap.id,
                        receiverId: requestData.receiverId,
                        receiverUsername: receiverSnap.exists() ? receiverSnap.data().username : "Unknown",
                        status: requestData.status,
                    };
                }));
                
                setSentRequests(requests);
            });
        
            return () => {
                unsubscribeFriends();
                unsubscribeRequests();
                unsubscribeSentRequests();
            };
        }, [user])
    );

    const handleSendFriendRequest = async () => {
        if (!friendUsername.trim()) {
            Alert.alert("Error", "Please enter a username.");
            return;
        }
    
        try {
            const q = query(collection(FIREBASE_DB, "users"), where("username", "==", friendUsername.trim()));
            const querySnapshot = await getDocs(q);
    
            if (querySnapshot.empty) {
                Alert.alert("Error", "No user found with that username.");
                return;
            }
    
            const friendDoc = querySnapshot.docs[0];
            const friendId = friendDoc.id;
    
            if (friendId === user.uid) {
                Alert.alert("Error", "You cannot send a friend request to yourself.");
                return;
            }
    
            const requestsQuery = query(
                collection(FIREBASE_DB, "friendRequests"),
                where("senderId", "==", user.uid),
                where("receiverId", "==", friendId)
            );
            const existingRequest = await getDocs(requestsQuery);
    
            if (!existingRequest.empty) {
                Alert.alert("Error", "You have already sent a friend request to this user.");
                return;
            }
    
            await addDoc(collection(FIREBASE_DB, "friendRequests"), {
                senderId: user.uid,
                receiverId: friendId,
                status: "pending",
                timestamp: new Date()
            });
    
            setFriendUsername("");
            setModalVisible(false);
        } catch (error) {
            console.error("Error sending friend request:", error);
            Alert.alert("Error", "Something went wrong. Please try again.");
        }
    };

    const handleAcceptFriendRequest = async (requestId, senderId) => {
        try {
            if (!requestId) {
                Alert.alert("Error", "Invalid request ID.");
                return;
            }
    
            const userRef = doc(FIREBASE_DB, "users", user.uid);
            const senderRef = doc(FIREBASE_DB, "users", senderId);
    
            const userSnap = await getDoc(userRef);
            const senderSnap = await getDoc(senderRef);
    
            if (!userSnap.exists() || !senderSnap.exists()) {
                Alert.alert("Error", "User data not found.");
                return;
            }
    
            const userData = userSnap.data();
            const senderData = senderSnap.data();
    
            await updateDoc(userRef, {
                friends: [...(userData.friends || []), senderId]
            });
    
            await updateDoc(senderRef, {
                friends: [...(senderData.friends || []), user.uid]
            });
    
            await deleteDoc(doc(FIREBASE_DB, "friendRequests", requestId));
    
            setFriendRequests((prevRequests) => prevRequests.filter((req) => req.id !== requestId));
    
        } catch (error) {
            console.error("Error accepting friend request:", error);
            Alert.alert("Error", "Something went wrong. Please try again.");
        }
    };    

    const handleDeclineFriendRequest = async (requestId) => {
        try {
            if (!requestId) {
                Alert.alert("Error", "Invalid request ID.");
                return;
            }
    
            await deleteDoc(doc(FIREBASE_DB, "friendRequests", requestId));
    
            setFriendRequests((prevRequests) => prevRequests.filter((req) => req.id !== requestId));
    
        } catch (error) {
            console.error("Error declining friend request:", error);
            Alert.alert("Error", "Something went wrong. Please try again.");
        }
    };    
    
    const handleCancelFriendRequest = async (requestId) => {
        try {
            if (!requestId) {
                Alert.alert("Error", "Invalid request ID.");
                return;
            }
    
            await deleteDoc(doc(FIREBASE_DB, "friendRequests", requestId));
    
            setSentRequests((prevRequests) =>
                prevRequests.filter((req) => req.id !== requestId)
            );
        } catch (error) {
            console.error("Error canceling friend request:", error);
            Alert.alert("Error", "Something went wrong. Please try again.");
        }
    };
    
    // Used to grab the current character design.
    const getItemUrl = (
        data: any[],
        id: number | undefined | null,
        resolution: string = "fourBit"
    ) => {
        if (typeof id !== "number") return null;
      
        const item = data.find((i) => i.id === id);
        const key = resolution + "Url"; // "fourBitUrl", "eightBitUrl", etc.
        return item?.[key] || null;
    };
    
    // Used to figure out the resolution in use for the selected friend modal.
    const resolution = selectedFriend?.currentresolution || "fourBit";
    
    const renderFriendItem = ({ item }) => {
        return (
            <Pressable 
                style={[styles.friendItem, { backgroundColor: colors.primary }]} 
                onPress={async () => {
                    // Open modal and show basic data
                    setSelectedFriend({
                        ...item,
                        online: item.online ?? false, // ✅ Preserve .online in modal
                      });                      
                    setFriendModalVisible(true);
                
                    // Fetch stats
                    const statsRef = doc(FIREBASE_DB, "stats", item.id);
                    const statsSnap = await getDoc(statsRef);
                    if (statsSnap.exists()) {
                        setFriendStats(statsSnap.data());
                    } else {
                        setFriendStats(null);
                    }
                
                    // Fetch lastLoginDate from a user's stats document
                    const userDoc = await getDoc(doc(FIREBASE_DB, "stats", item.id));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();

                        setSelectedFriend(prev => ({
                            ...prev,
                            lastLoginDate: userData.lastLoginDate ? new Date(userData.lastLoginDate) : null,
                        }));
                    }
                }}            
            >
                <View style={styles.friendCardContent}>
                    {/* Avatar or placeholder */}
                    <View style={styles.headCropContainer}>
                        <Image source={{ uri: getItemUrl(bodyData, item?.equipped?.body, "fourBit") }} style={styles.headImage} />
                    </View>

                    {/* Username and level */}
                    <Text style={styles.friendText}>
                        {`${item.username} · Lvl ${item.level ?? 0}`}
                    </Text>
                </View>
            </Pressable>
        );
    };

    const handleRemoveFriend = async (friendId: string) => {
        try {
            const userRef = doc(FIREBASE_DB, "users", user.uid);
            const friendRef = doc(FIREBASE_DB, "users", friendId);
    
            const [userSnap, friendSnap] = await Promise.all([
                getDoc(userRef),
                getDoc(friendRef)
            ]);
    
            if (!userSnap.exists() || !friendSnap.exists()) {
                Alert.alert("Error", "Friend data not found.");
                return;
            }
    
            const userData = userSnap.data();
            const friendData = friendSnap.data();
    
            // Remove friend from your list
            const updatedUserFriends = (userData.friends || []).filter(id => id !== friendId);
            await updateDoc(userRef, { friends: updatedUserFriends });
    
            // Remove you from their list
            const updatedFriendFriends = (friendData.friends || []).filter(id => id !== user.uid);
            await updateDoc(friendRef, { friends: updatedFriendFriends });
    
            // Close modal and reset selected friend
            setFriendModalVisible(false);
            setSelectedFriend(null);
            setFriendStats(null);
    
            Toast.show({
                type: 'success',
                text1: 'Friend Removed',
                position: 'top'
            });
        } catch (error) {
            console.error("Error removing friend:", error);
            Alert.alert("Error", "Something went wrong while removing the friend.");
        }
    };    

    const formatLastLogin = (date: Date | null, isOnline: boolean): string => {
        if (isOnline) return "🟢 Online";
        if (!date || isNaN(date.getTime())) return "Offline";
    
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
        if (diffMinutes < 60) return `Last on ${diffMinutes} min ago`;
        if (diffHours < 24) return `Last on ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        if (diffDays === 1) return "Last on Yesterday";
        return `Last on ${diffDays} days ago`;
    };
    
    const handleBackPress = () => {
        setFriendModalVisible(false);
        setFriendStats(null);
        setSelectedFriend(null);
        InteractionManager.runAfterInteractions(() => {
            navigation.goBack();
        });
    };

    return (
        <View style={{flex: 1}}>
            <View style={[styles.background, { backgroundColor: colors.white }]}>
                { /* Header */}
                <View style={styles.headerContainer}>
                    <View style={{ position: 'absolute', left: 15, top: Platform.OS === 'ios' ? 50 : 30, backgroundColor: colors.secondary, borderRadius: 3 }}>
                        <PressableButton onPress={handleBackPress} haptic style={styles.button}>
                            <Text style={{color: themes.light.white, fontWeight: 'bold', fontSize: 14}}>BACK</Text>
                        </PressableButton>
                    </View>
                    
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={[styles.headerText, { color: colors.black }]}>
                            Your Friends
                        </Text>
                    </View>

                    <View style={{ position: 'absolute', right: 15, top: Platform.OS === 'ios' ? 50 : 30}}>
                        <PressableButton onPress={() => setRequestModalVisible(true)}>
                            <Bell size={35} color={colors.black} />
                            {friendRequests.length > 0 && (
                                <View style={[styles.notifIndicator, {backgroundColor: themes.light.decline}]}>
                                    <Text style={{fontSize: 12, color: themes.light.black, fontWeight: 'bold'}}>{friendRequests.length > 9 ? "9+" : friendRequests.length}</Text>
                                </View>
                            )}
                        </PressableButton>
                    </View>
                </View>

                { /* Request Modal */}
                <Modal 
                    visible={requestModalVisible} 
                    animationType="slide" 
                    transparent={true}
                    onRequestClose={() => setRequestModalVisible(false)}
                >
                    <View style={styles.modalBackground}>
                        <View style={styles.modalContainer}>
                            <View style={styles.tabBar}>
                                <View style={[styles.tab, activeTab === "received" && { borderBottomWidth: 2, borderColor: colors.secondary, backgroundColor: "transparent" }]}>
                                    <PressableButton onPress={() => setActiveTab("received")} shadow={false} haptic>
                                        <Text style={{ fontWeight: activeTab === "received" ? "bold" : "normal" }}>Received</Text>
                                    </PressableButton>
                                </View>
                                <View style={[styles.tab, activeTab === "sent" && { borderBottomWidth: 2, borderColor: colors.secondary, backgroundColor: "transparent" }]}>
                                    <PressableButton onPress={() => setActiveTab("sent")} shadow={false} haptic>
                                        <Text style={{ fontWeight: activeTab === "sent" ? "bold" : "normal" }}>Sent</Text>
                                    </PressableButton>
                                </View>
                            </View>

                            {activeTab === "received" ? (
                                <FlatList
                                    data={friendRequests}
                                    keyExtractor={(item) => item.id}
                                    renderItem={({ item }) => (
                                        <View style={styles.tabContent}>
                                            <Text style={{marginHorizontal: 15}}>Request from {item.senderUsername}</Text>
                                            <View style={[styles.button, {backgroundColor: colors.accept}]}>
                                                <PressableButton onPress={() => handleAcceptFriendRequest(item.id, item.senderId)} haptic>
                                                    <Text style={{color: themes.light.white, fontWeight: 'bold', fontSize: 14}}>ACCEPT</Text>
                                                </PressableButton>
                                            </View>
                                            <View style={[styles.button, {backgroundColor: colors.decline}]}>
                                                <PressableButton onPress={() => handleDeclineFriendRequest(item.id)} haptic>
                                                    <Text style={{color: themes.light.white, fontWeight: 'bold', fontSize: 14}}>DECLINE</Text>
                                                </PressableButton>
                                            </View>
                                        </View>
                                    )}
                                />
                            ) : (
                                <FlatList
                                    data={sentRequests}
                                    keyExtractor={(item) => item.id}
                                    renderItem={({ item }) => (
                                        <View style={styles.tabContent}>
                                            <Text style={{marginHorizontal: 15}}>Request to {item.receiverUsername}</Text>
                                            <View style={[styles.button, {backgroundColor: colors.decline}]}>
                                                <PressableButton onPress={() => handleDeclineFriendRequest(item.id)} haptic>
                                                    <Text style={{color: themes.light.white, fontWeight: 'bold', fontSize: 14}}>CANCEL</Text>
                                                </PressableButton>
                                            </View>
                                        </View>
                                    )}
                                />
                            )}
                            <View style={[styles.button, { backgroundColor: colors.secondary }]}>
                                <PressableButton onPress={() => setRequestModalVisible(false)} haptic>
                                    <Text style={{color: themes.light.white, fontWeight: 'bold', fontSize: 14}}>CLOSE</Text>
                                </PressableButton>
                            </View>
                        </View>
                    </View>
                </Modal>

                { /* Friends List */}
                <View style={styles.friendList}>
                    {friends.length === 0 ? (
                        <Text style={[styles.noFriendsText, { color: colors.black }]}>You have no friends</Text>
                    ) : (
                        <FlatList
                            data={friends}
                            keyExtractor={(item, index) => item.id || index.toString()}
                            renderItem={renderFriendItem}
                        />)}
                </View>
            </View>

            { /* Selected Friend Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={friendModalVisible}
                onRequestClose={() => {
                    setFriendModalVisible(false);
                    setFriendStats(null);
                }}
            >
                <View style={styles.modalBackground}>
                    <View style={styles.modalContainer}>
                        {selectedFriend && (
                            <>
                                {/* Top: Friends Name and Level */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <View>
                                        <Text style={{ fontSize: 22, fontWeight: 'bold' }}>{selectedFriend.username}</Text>
                                        <Text style={{ fontSize: 16 }}>Level {selectedFriend.level}</Text>
                                    </View>
                                    <Text style={{ fontSize: 12, color: selectedFriend.online ? 'green' : 'gray' }}>
                                        {formatLastLogin(selectedFriend.lastLoginDate, selectedFriend.online)}
                                    </Text>

                                </View>

                                <View style={{ flexDirection: "row", width: "100%", marginTop: 10 }}>
                                    {/* Left: Character Image */}
                                    <View style={[styles.friendImageBackground, { backgroundColor: themes.dark.grey }]}>
                                        <View style={styles.friendImageContainer}>
                                            <Image source={{ uri: getItemUrl(bodyData, selectedFriend?.equipped?.body, resolution) }} style={styles.image} />
                                            <Image source={{ uri: getItemUrl(shoesData, selectedFriend?.equipped?.shoes, resolution) }} style={styles.image} />
                                            <Image source={{ uri: getItemUrl(shirtData, selectedFriend?.equipped?.shirt, resolution) }} style={styles.image} />
                                            <Image source={{ uri: getItemUrl(pantsData, selectedFriend?.equipped?.pants, resolution) }} style={styles.image} />
                                            <Image source={{ uri: getItemUrl(hatData, selectedFriend?.equipped?.hat, resolution) }} style={styles.hatImage} />
                                            <Image source={{ uri: getItemUrl(accData, selectedFriend?.equipped?.acc, resolution) }} style={styles.image} />
                                        </View>
                                    </View>

                                    {/* Divider Line */}
                                    <View style={{ width: 2, backgroundColor: themes.light.black, marginHorizontal: 10 }}></View>

                                    {/* Right: Stats */}
                                    <View style={{ flex: 1 }}>
                                    {friendStats ? (
                                        <>
                                            <Text>Total Task Completed {friendStats.tasksCompleted ?? 0}</Text>
                                            <Text>Tasks This Week: {friendStats.tasksCompletedThisWeek ?? 0}</Text>
                                            <Text>Current Streak: {friendStats.currentStreak ?? 0}</Text>
                                            <Text>Longest Streak: {friendStats.longestStreak ?? 0}</Text>
                                            <Text>Days Active: {friendStats.daysActive ?? 0}</Text>
                                            <Text>Total XP Earned {friendStats.totalXpEarned ?? 0}</Text>
                                            <Text>Total Coins Earned {friendStats.totalBalanceEarned ?? 0}</Text>
                                        </>
                                    ) : (
                                        <Text>No stats available</Text>
                                    )}
                                    </View>
                                </View>

                                <View style={{ marginTop: 15, alignSelf: "center", flexDirection: "row", gap: 10}}>
                                    <View style={[styles.button, { backgroundColor: colors.decline }]}>
                                        <PressableButton 
                                            onPress={() => {
                                                Alert.alert(
                                                    "Remove Friend",
                                                    `Are you sure you want to remove ${selectedFriend.username}?`,
                                                    [
                                                        { text: "Cancel", style: "cancel" },
                                                        { text: "Remove", style: "destructive", onPress: () => handleRemoveFriend(selectedFriend.id) }
                                                    ]
                                                );
                                            }} 
                                            haptic
                                        >
                                            <Text style={{color: themes.light.white, fontWeight: 'bold', fontSize: 14}}>REMOVE FRIEND</Text>
                                        </PressableButton>
                                    </View>
                                    <View style={[styles.button, { backgroundColor: colors.secondary }]}>
                                        <PressableButton onPress={() => setFriendModalVisible(false)} haptic>
                                            <Text style={{color: themes.light.white, fontWeight: 'bold', fontSize: 14}}>CLOSE</Text>
                                        </PressableButton>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            { /* Navbar */}
            <View style={[styles.navbar, {backgroundColor: colors.primary}]}>
                <CustomMenu />
                <View style={{width: "65%"}}></View>
                <PressableButton style={styles.addFriend} onPress={() => setModalVisible(true)}>
                    <UserPlus size={70} color={themes.light.black} />
                </PressableButton>
            </View>

            { /* Add Friend Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalBackground}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Add Friend</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter friend's username"
                            autoCapitalize="none"
                            value={friendUsername}
                            onChangeText={setFriendUsername}
                        />
                        <View style={styles.modalButtons}>
                            <View style={[styles.button, { backgroundColor: colors.decline }]}>
                                <PressableButton onPress={() => setModalVisible(false)} haptic>
                                    <Text style={{color: themes.light.black, fontWeight: 'bold', fontSize: 14}}>CANCEL</Text>
                                </PressableButton>
                            </View>
                            <View style={[styles.button, { backgroundColor: colors.accept }]}>
                                <PressableButton onPress={handleSendFriendRequest} haptic>
                                    <Text style={{color: themes.light.black, fontWeight: 'bold', fontSize: 14}}>ADD FRIEND</Text>
                                </PressableButton>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    addFriend: {
        width: "17.5%",
        height: 75,
        justifyContent: "center",
        alignItems: "center",
    },
    background: {
        flex: 1,
        alignItems: "center",
    },
    button: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    friendCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
    },
    friendImageBackground: {
        alignItems: "center",
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#666',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    friendImageContainer: {
        width: 140,
        height: 200,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    friendItem: {
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 10,
        width: 'auto',
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    friendList: {
        marginTop: 15,
        paddingHorizontal: 10,
        width: '100%',
        alignItems: 'center',
    },
    friendText: {
        fontSize: 18,
        fontWeight: '600',
    },
    hatImage: {
        width: Dimensions.get('window').width * (2/7),
        height: Dimensions.get('window').height * (1/7),
        objectFit: 'fill',
        position: 'absolute',
        top: -40,
    },
    headCropContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
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
    headImage: {
        width: 50,
        height: 90,
        transform: [{ translateY: -5 }],
    },
    headerText: {
        fontSize: 26,
        fontWeight: 'bold',
    },
    image: {
        width: Dimensions.get('window').width * (2/7),
        height: Dimensions.get('window').height * (1/7),
        objectFit: 'fill',
        position: 'absolute',
    },
    input: {
        width: "100%",
        padding: 10,
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 10,
    },
    modalBackground: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
    },
    modalContainer: {
        width: "90%",
        height: "auto",
        padding: 20,
        backgroundColor: "white",
        borderRadius: 10,
        alignItems: "center",
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 10,
    },
    navbar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopWidth: 2,
        paddingVertical: 10,
        height: 75,
        width: "100%",
        paddingHorizontal: 15,
    },
    noFriendsText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 20,
        fontWeight: "bold",
    },
    notifIndicator: {
        position: 'absolute', 
        top: -4,
        right: -6,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notification: {
        position: "absolute",
        top: "1%",
        right: "2%",
    },
    tab: {
        padding: 10,
        borderBottomWidth: 2,
        borderColor: "transparent",
    },
    tabBar: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginBottom: 20,
    },
    tabContent: {
        flexDirection: "row", 
        alignItems: "center", 
        marginBottom: 10
    },
});

export default FriendsScreen;