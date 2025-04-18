import React, { useContext, useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, FlatList, Animated, Pressable, TouchableOpacity, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { collection, deleteDoc, doc, updateDoc, query, where, getDoc, onSnapshot, increment, setDoc } from "firebase/firestore";
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from "@react-navigation/native";

import useTheme from '../config/useTheme';
import { SettingsContext } from '../config/SettingsContext';
import { FIREBASE_DB } from '@/firebaseConfig';
import { authContext } from '../config/authContext';

type Subtask = {
    text: string;
    completed: boolean;
}

type Task = {
    id: string;
    name: string;
    date: string;
    time: string;
    repeat: string | { type: string; interval: number };
    completed?: boolean;
    createdAt: string;
    subtasks: Subtask[];
    notificationPreset?: number | null;
    userId?: string,
    collaboratorId?: string,
    collaboratorPermission: string,
};

const TaskScreen = () => {
    const settings = useContext(SettingsContext);
    const colors = useTheme();
    const { user } = useContext(authContext);
    const [allTasks, setAllTasks] = useState<any[]>([]);
    const [showOnlyShared, setShowOnlyShared] = useState<boolean>(false);
    const [userMap, setUserMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);
    const [sortOption, setSortOption] = useState<string>('createdAt');
    const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
    const navigation = useNavigation();

    const [notificationModalVisible, setNotificationModalVisible] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [inAppNotifications, setInAppNotifications] = useState<Array<{ id: string, title: string, message: string }>>([]);

    useEffect(() => {
        if (!user) return;

        const tasksRef = collection(FIREBASE_DB, "tasks");

        const ownerQuery = query(tasksRef, where("userId", "==", user.uid));
        const collaboratorQuery = query(tasksRef, where("collaboratorId", "==", user.uid));

        const unsubOwner = onSnapshot(ownerQuery, (ownerSnapshot) => {
            const ownerTasks = ownerSnapshot.docs.map(doc => normalizeTask(doc.id, doc.data()));
            setAllTasks(prev => mergeTaskLists(prev, ownerTasks));
        });

        const unsubCollaborator = onSnapshot(collaboratorQuery, (collabSnapshot) => {
            const collabTasks = collabSnapshot.docs.map(doc => normalizeTask(doc.id, doc.data()));
            setAllTasks(prev => mergeTaskLists(prev, collabTasks));
        });

        return () => {
            unsubOwner();
            unsubCollaborator();
        };
    }, [user]);

    useEffect(() => {
        const fetchUsers = async () => {
            const usersSnapshot = await getDoc(doc(FIREBASE_DB, "users", user.uid));
            const userMapData: Record<string, string> = {};
    
            if (usersSnapshot.exists()) {
                userMapData[user.uid] = usersSnapshot.data().username;
            }
    
            const taskUsers = allTasks.reduce<string[]>((acc, task) => {
                if (task.userId && !acc.includes(task.userId)) acc.push(task.userId);
                if (task.collaboratorId && !acc.includes(task.collaboratorId)) acc.push(task.collaboratorId);
                return acc;
            }, []);
    
            await Promise.all(taskUsers.map(async (uid) => {
                if (!userMapData[uid]) {
                    const snap = await getDoc(doc(FIREBASE_DB, "users", uid));
                    if (snap.exists()) userMapData[uid] = snap.data().username;
                }
            }));
    
            setUserMap(userMapData);
        };
    
        if (user) fetchUsers();
    }, [allTasks]);

    useEffect(() => {
        if (!user) return;
      
        const notifRef = collection(FIREBASE_DB, `users/${user.uid}/notifications`);
        const unsubscribe = onSnapshot(notifRef, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                const data = change.doc.data();
                Toast.show({
                    type: 'success',
                    text1: data.title,
                    text2: data.message,
                    position: 'top',
                    visibilityTime: 5000,
                });
                }
            });
        });
      
        return () => unsubscribe();
    }, [user]);   
    
    const normalizeTask = (id: string, data: any): Task => {
        return {
            id,
            ...data,
            subtasks: Array.isArray(data.subtask) ? data.subtask.map((sub: any) => ({text: sub.text, completed: sub.completed ?? false})) : []
        };
    };
    
    const mergeTaskLists = (prev: any[], incoming: any[]) => {
        const map = new Map(prev.map(task => [task.id, task]));
        for (let task of incoming) {
            map.set(task.id, task);
        }
        return sortTasks(Array.from(map.values()), sortOption);
    };

    const getSharingLabel = (task: Task): string | null => {
        if (!user || !userMap) return null;
        if (task.userId === user.uid && task.collaboratorId) {
          return `Shared with ${userMap[task.collaboratorId] || 'collaborator'}`;
        }
        if (task.collaboratorId === user.uid) {
          return `Shared by ${userMap[task.userId] || 'creator'}`;
        }
        return null;
    };

    const scheduleNotification = async (task: Task, presetHours: number) => {
        const taskDueDate = new Date(`${task.date}T${task.time}`);
        const triggerTime = new Date(taskDueDate.getTime() - presetHours * 60 * 60 * 1000);
        
        const now = Date.now();
    
        if (triggerTime.getTime() <= now) {
            console.warn("Notification time is in the past. Cannot schedule.");
            return;
        }
    
        const delay = triggerTime.getTime() - now;
    
        setTimeout(() => {
            Toast.show({
                type: 'info',
                text1: "Upcoming Task Reminder",
                text2: `${task.name} is due in ${presetHours} hour(s)!`,
                position: 'top',
                visibilityTime: 5000, // The banner will be visible for 5 seconds.
            });
        }, delay);
    
        // This doesn't really do much until I actually make notifications work work
        await updateDoc(doc(FIREBASE_DB, "tasks", task.id), {
            notificationPreset: presetHours,
        });
    };
    
    

    const handleNotificationPress = (taskId: string) => {
        setSelectedTaskId(taskId);
        setNotificationModalVisible(true);
    };

    const handlePresetSelection = async (presetHours: number) => {
        setNotificationModalVisible(false);
        const task = allTasks.find(t => t.id === selectedTaskId);
        if (task) {
            await scheduleNotification(task, presetHours);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            await deleteDoc(doc(FIREBASE_DB, "tasks", taskId));
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    };

    const updateTaskCompletion = async (task: Task, markComplete: boolean) => {
        if (!user) return;
    
        const taskRef = doc(FIREBASE_DB, "tasks", task.id);
        const userRef = doc(FIREBASE_DB, "users", user.uid);
        const statsRef = doc(FIREBASE_DB, "stats", user.uid);
    
        const [taskSnap, userSnap, statsSnap] = await Promise.all([
            getDoc(taskRef),
            getDoc(userRef),
            getDoc(statsRef)
        ]);
    
        if (!taskSnap.exists() || !userSnap.exists()) {
            console.error("Task or user not found!");
            return;
        }
    
        const taskData = taskSnap.data();
        const userData = userSnap.data();
        const statsData = statsSnap.exists() ? statsSnap.data() : null;
    
        const taskXp = taskData.xp || 0;
        const taskBalance = taskData.balance || 0;
        const now = new Date();
        const todayStr = new Date().toLocaleDateString('en-CA');
        const wasRewarded = taskData.rewarded || false;
    
        let baseXp = userData.xp || 0;
        let baseBalance = userData.balance || 0;
    
        let newXp = markComplete ? baseXp + taskXp : baseXp - taskXp;
        let newBalance = markComplete ? baseBalance + taskBalance : baseBalance - taskBalance;
    
        // === Only update XP/balance/stats if reward state is changing ===
        if (markComplete && !wasRewarded) {
            await updateDoc(userRef, {
                xp: Math.max(0, newXp),
                balance: Math.max(0, newBalance),
            });
    
            // Bonus incentives for shared tasks
            if (taskData.collaboratorId) {
                const bonusXp = Math.floor(taskXp * 0.3);
                const bonusBalance = Math.floor(taskBalance * 0.3);
    
                const creatorRef = doc(FIREBASE_DB, "users", taskData.userId);
                const collaboratorRef = doc(FIREBASE_DB, "users", taskData.collaboratorId);
        
                await Promise.all([
                updateDoc(creatorRef, {
                    xp: increment(bonusXp),
                    balance: increment(bonusBalance),
                }),
                updateDoc(collaboratorRef, {
                    xp: increment(bonusXp),
                    balance: increment(bonusBalance),
                }),
                ]);
            }
    
            // Handle repeat task scheduling
            if (task.repeat && task.repeat !== "none") {
                let nextDate = new Date(task.date);
                if (typeof task.repeat === "object") {
                if (task.repeat.type === "days") nextDate.setDate(nextDate.getDate() + task.repeat.interval);
                if (task.repeat.type === "weeks") nextDate.setDate(nextDate.getDate() + task.repeat.interval * 7);
                if (task.repeat.type === "months") nextDate.setMonth(nextDate.getMonth() + task.repeat.interval);
                } else if (task.repeat === "daily") {
                    nextDate.setDate(nextDate.getDate() + 1);
                } else if (task.repeat === "weekly") {
                    nextDate.setDate(nextDate.getDate() + 7);
                } else if (task.repeat === "monthly") {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                }
    
                await updateDoc(taskRef, {
                    date: nextDate.toISOString().split("T")[0],
                    completed: false,
                    rewarded: false
                });
            } else {
                await updateDoc(taskRef, {
                completed: true,
                rewarded: true
                });
            }
    
            // === Handle stats ===
            if (!statsData) {
                await setDoc(statsRef, {
                    tasksCompleted: 1,
                    totalBalanceEarned: taskBalance,
                    totalXpEarned: taskXp,
                    tasksCompletedThisWeek: 1,
                    daysActive: 1,
                    lastLoginDate: todayStr,
                    currentStreak: 1,
                    longestStreak: 1,
                    lastTaskCompletedDate: now.toISOString(),
                }, { merge: true });
            } else {
                const updates: any = {
                    tasksCompleted: increment(1),
                    totalBalanceEarned: increment(taskBalance),
                    totalXpEarned: increment(taskXp),
                    lastTaskCompletedDate: now.toISOString(),
            };
    
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
    
            const lastCompleted = statsData.lastTaskCompletedDate ? new Date(statsData.lastTaskCompletedDate) : null;
            const completedThisWeek = lastCompleted && lastCompleted >= startOfWeek;
    
            updates.tasksCompletedThisWeek = completedThisWeek ? increment(1) : 1;
    
            const lastLogin = statsData.lastLoginDate;
            const lastDate = lastLogin ? new Date(lastLogin) : null;
            const lastDateStr = lastDate?.toISOString().split("T")[0] ?? null;
    
            if (lastDateStr !== todayStr) {
                updates.lastLoginDate = todayStr;
        
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toLocaleDateString('en-CA');
                const isYesterday = lastDateStr === yesterdayStr;
    
                if (isYesterday) {
                    const nextStreak = (statsData.currentStreak || 0) + 1;
                    updates.currentStreak = nextStreak;
                    if (nextStreak > (statsData.longestStreak || 0)) {
                        updates.longestStreak = nextStreak;
                    }
                } else {
                    updates.currentStreak = 1;
                    if ((statsData.longestStreak || 0) < 1) {
                        updates.longestStreak = 1;
                    }
                }
            }
    
            await updateDoc(statsRef, updates);
        }
    
        } else if (!markComplete && wasRewarded) {
            await updateDoc(userRef, {
                xp: Math.max(0, newXp),
            });
    
            const updates: any = {
                tasksCompleted: increment(-1),
                totalXpEarned: increment(-taskXp),
                tasksCompletedThisWeek: increment(-1),
            };
    
            await updateDoc(statsRef, updates);
            await updateDoc(taskRef, { completed: false, rewarded: false });

            if (taskData.collaboratorId) {
                const bonusXp = Math.floor(taskXp * 0.3);
        
                const creatorRef = doc(FIREBASE_DB, "users", taskData.userId);
                const collaboratorRef = doc(FIREBASE_DB, "users", taskData.collaboratorId);
        
                await Promise.all([
                    updateDoc(creatorRef, {
                        xp: increment(-bonusXp),
                    }),
                    updateDoc(collaboratorRef, {
                        xp: increment(-bonusXp),
                    }),
                ]);
            }
        } else {
            await updateDoc(taskRef, { completed: markComplete });
        }
    
        Toast.show({
            type: markComplete ? 'success' : 'info',
            text1: markComplete ? "Task Completed!" : "Task Undone",
            text2: markComplete ? `You gained ${taskXp} XP and ${taskBalance} coins.` + (taskData.collaboratorId ? ` (+${Math.floor(taskXp * 0.3)} bonus XP & +${Math.floor(taskBalance * 0.3)} bonus coins for collaboration)` : '') : `You lost ${taskXp} XP.` + (taskData.collaboratorId ? ` (+${Math.floor(taskXp * 0.3)} bonus XP)` : ''),
            position: 'top',
            visibilityTime: 5000,
        });

        if (taskData.collaboratorId) {
            const collaboratorNotifRef = doc(FIREBASE_DB, `users/${taskData.collaboratorId}/notifications`, task.id);
          
            await setDoc(collaboratorNotifRef, {
                title: markComplete ? "Shared Task Completed 🎉" : "Task Reopened ✏️",
                message: markComplete ? `${userData.username || 'Your friend'} completed "${task.name}"` : `${userData.username || 'Your friend'} reopened "${task.name}"`,
                createdAt: new Date().toISOString(),
            });
        }
          
        if (markComplete && !wasRewarded) {
            const collaboratorNotifRef = doc(FIREBASE_DB, `users/${taskData.collaboratorId}/notifications`, task.id);
          
            await setDoc(collaboratorNotifRef, {
                title: "Shared Task Completed 🎉",
                message: `${userData.username || 'Your friend'} completed "${task.name}"`,
                createdAt: new Date().toISOString(),
            });
        }
    };            

    const handleCompleteTask = async (task: Task) => {
        const markComplete = !task.completed;
        const updatedSubtasks = task.subtasks.map(sub => ({ ...sub, completed: markComplete }));
        const taskRef = doc(FIREBASE_DB, "tasks", task.id);
        await updateDoc(taskRef, { subtask: updatedSubtasks });
        await updateTaskCompletion({ ...task, subtasks: updatedSubtasks }, markComplete);
    };

    const toggleSubtaskCompletion = async (taskId: string, subtaskIndex: number) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
    
        const updatedSubtasks = [...task.subtasks];
        updatedSubtasks[subtaskIndex].completed = !updatedSubtasks[subtaskIndex].completed;
        const allSubtasksCompleted = updatedSubtasks.every(sub => sub.completed);
        const taskRef = doc(FIREBASE_DB, "tasks", taskId);
    
        await updateDoc(taskRef, {
            subtask: updatedSubtasks,
            completed: allSubtasksCompleted
        });
    
        if (allSubtasksCompleted && !task.completed) {
            await updateTaskCompletion({ ...task, subtasks: updatedSubtasks }, true);
        } else if (!allSubtasksCompleted && task.completed) {
            await updateTaskCompletion({ ...task, subtasks: updatedSubtasks }, false);
        }
    };
    
    const sortTasks = (tasks: Task[], option: string): Task[] => {
        return [...tasks].sort((a, b) => {
            if (option === 'name') return a.name.localeCompare(b.name);
            if (option === 'date') return new Date(a.date).getTime() - new Date(b.date).getTime();
            if (option === 'createdAt') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            if (option === 'reverseCreatedAt') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return 0;
        });
    };

    const filteredTasks = showOnlyShared ? allTasks.filter(t => (t.userId === user.uid && !!t.collaboratorId) || t.collaboratorId === user.uid) : allTasks;
    
    const formatRepeat = (repeat: string | { type: string; interval: number; } | null) => {
        if (!repeat || repeat === "none") return "";
    
        if (typeof repeat === 'object' && repeat !== null) {
            return `${repeat.interval} ${repeat.type}`;
        }
    
        return repeat.charAt(0).toUpperCase() + repeat.slice(1);
    };

    const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, taskId: string) => {
        const translateX = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [-100, 0],
            extrapolate: 'clamp',
        });
      
        const opacity = dragX.interpolate({
            inputRange: [80, 100],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });
      
        return (
            <Animated.View style={[styles.deleteContainer, { transform: [{ translateX }], opacity }]}>
                <Text style={styles.deleteText}>Deleting...</Text>
            </Animated.View>
        );
    };
      
    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, task: Task) => {
        const translateX = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [0, 100],
            extrapolate: 'clamp',
        });
      
        const opacity = dragX.interpolate({
            inputRange: [-100, -80],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });
      
        return (
            <Animated.View style={[styles.completeContainer, { transform: [{ translateX }], opacity }]}>
                <Text style={styles.completeText}>{task.completed ? "Undoing..." : "Completing..."}</Text>
            </Animated.View>
        );
      };

    const handleTaskPress = (taskId: string) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task || !Array.isArray(task.subtasks) || task.subtasks.length === 0) {
            return;
        }
        setExpandedTask(expandedTask === taskId ? null : taskId);
    };

    const canEditTask = (task: Task): boolean => {
        return (
          task.userId === user.uid ||
          (task.collaboratorId === user.uid && task.collaboratorPermission === 'edit')
        );
    };

    if (!settings || !user) return null;
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <SafeAreaView style={styles.container}>
                    {/* In-App Notification Banner */}
                    {inAppNotifications.map(notification => (
                        <View key={notification.id} style={styles.notificationBanner}>
                            <Text style={styles.notificationTitle}>{notification.title}</Text>
                            <Text style={styles.notificationMessage}>{notification.message}</Text>
                        </View>
                    ))}

                    {/* Task Sorter */}
                    {filteredTasks.length > 0 && (
                        <View style={styles.sortContainer}>
                            <Text style={[styles.sortLabel, { color: colors.black}]}>Sort By:</Text>
                            <Picker
                                selectedValue={sortOption}
                                onValueChange={(itemValue) => setSortOption(itemValue)}
                                style={[styles.sortPicker, { color: colors.black}]}
                                mode="dropdown"
                                dropdownIconColor={colors.black}
                            >
                                <Picker.Item label="Name" value="name" />
                                <Picker.Item label="Date" value="date" />
                                <Picker.Item label="Time Created (Oldest First)" value="createdAt" />
                                <Picker.Item label="Time Created (Newest First)" value="reverseCreatedAt" />
                            </Picker>
                            <TouchableOpacity onPress={() => setShowOnlyShared(!showOnlyShared)} style={styles.sharedToggle}>
                                <Text style={{ color: colors.black, fontSize: 16 }}>{showOnlyShared ? 'Show All Tasks' : 'Show Shared Only'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Task List */}
                    {filteredTasks.length === 0 ? (
                        <Text style={styles.noTasksText}>No tasks available</Text>
                    ) : (
                        <FlatList
                            data={filteredTasks}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <Swipeable
                                    ref={(ref) => ref && (swipeableRefs[item.id] = ref)}
                                    leftThreshold={100}
                                    rightThreshold={100}
                                    friction={2}
                                    onSwipeableOpen={(direction) => {
                                        if (direction === 'left') {
                                            requestAnimationFrame(() => handleDeleteTask(item.id));
                                        } else if (direction === 'right') {
                                            requestAnimationFrame(() => handleCompleteTask(item));
                                        }
                                        requestAnimationFrame(() => swipeableRefs[item.id]?.close());
                                    }}
                                    renderLeftActions={(progress, dragX) => renderLeftActions(progress, dragX, item.id)}
                                    renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
                                >
                                    <Pressable onPress={() => handleTaskPress(item.id)}>
                                        <View style={[
                                            styles.taskContainer,
                                            item.completed && styles.completedTask,
                                            { backgroundColor: colors.white }
                                        ]}>
                                            {/* Task Name, Edit Button, and Notif Bell */}
                                            <View style={styles.headerRow}>
                                                <Text style={[styles.taskTitle, { color: colors.black }]}>
                                                    {item.name} {item.completed ? "✅" : ""}
                                                </Text>
                                                {canEditTask(item) && (
                                                    <TouchableOpacity style={{left: 130}} onPress={() => navigation.navigate("Create Task", { taskId: item.id })}>
                                                        <Icon name="edit" size={20} color={colors.grey} />
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity onPress={() => handleNotificationPress(item.id)}>
                                                    <Icon name="bell" size={20} color={item.notificationPreset ? 'orange' : 'gray'} />
                                                </TouchableOpacity>
                                            
                                            </View>

                                            {/* Date and Time */}
                                            <Text style={[styles.taskDetails, { color: colors.black }]}>
                                                📅 {item.date} ⏰ {item.time}
                                            </Text>
                                            
                                            {/* Repeat */}
                                            {item.repeat !== "none" && (
                                                <Text style={[styles.taskDetails, { color: colors.black }]}>
                                                    🔁 Repeat: {formatRepeat(item.repeat)}
                                                </Text>
                                            )}

                                            {/* Shared */}
                                            {getSharingLabel(item) && <Text style={[styles.sharingLabel, { color: colors.secondary }]}>{getSharingLabel(item)}</Text>}

                                            {/* Subtasks */}
                                            {expandedTask === item.id && item.subtasks && item.subtasks.length > 0 && (
                                                <View>
                                                    {item.subtasks.map((subtask, index) => (
                                                        <Pressable key={index} onPress={() => toggleSubtaskCompletion(item.id, index)}>
                                                            <Text style={[
                                                                styles.taskDetails,
                                                                { 
                                                                    color: colors.black,
                                                                    textDecorationLine: subtask.completed ? 'line-through' : 'none',
                                                                    opacity: subtask.completed ? 0.5 : 1,
                                                                }
                                                            ]}>
                                                                • {subtask.text} {subtask.completed ? "✅" : ""}
                                                            </Text>
                                                        </Pressable>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    </Pressable>
                                </Swipeable>
                            )}
                        />
                    )}

                    {/* Notification Preset Modal */}
                    <Modal
                        transparent={true}
                        animationType="slide"
                        visible={notificationModalVisible}
                        onRequestClose={() => setNotificationModalVisible(false)}
                    >
                        <View style={styles.modalContainer}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select Notification Preset</Text>
                                <TouchableOpacity onPress={() => handlePresetSelection(1)} style={styles.presetButton}>
                                    <Text style={styles.presetButtonText}>1 Hour Before</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handlePresetSelection(2)} style={styles.presetButton}>
                                    <Text style={styles.presetButtonText}>2 Hours Before</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handlePresetSelection(24)} style={styles.presetButton}>
                                    <Text style={styles.presetButtonText}>24 Hours Before</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setNotificationModalVisible(false)} style={styles.cancelButton}>
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                </SafeAreaView>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    deleteContainer: {
        backgroundColor: 'red',
        justifyContent: 'center',
        alignItems: 'center',
        width: 100,
    },
    deleteText: { 
        color: 'white', 
        fontSize: 18, 
        fontWeight: 'bold' 
    },
    completeContainer: {
        backgroundColor: 'green',
        justifyContent: 'center',
        alignItems: 'center',
        width: 100,
    },
    completeText: { 
        color: 'white', 
        fontSize: 18, 
        fontWeight: 'bold' 
    },
    noTasksText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 30,
        fontWeight: "bold",
    },
    sharedToggle: { 
        padding: 8, 
        borderRadius: 8 
    },
    sharingLabel: {
        fontStyle: 'italic',
        fontSize: 13,
        marginTop: 2,
        marginLeft: 4,
    },  
    sortContainer: { 
        flexDirection: "row", 
        alignItems: "center", 
        padding: 10,
    },
    sortLabel: { 
        fontSize: 16, 
        fontWeight: "bold", 
        marginRight: 10 
    },
    sortPicker: { 
        width: 200, 
        height: 50,
    },
    taskContainer: {
        padding: 12,
        marginVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    taskDetails: {
        fontSize: 14,
        marginTop: 2,
    },
    taskTitle: {
        fontSize: 18,
        fontWeight: "bold",
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 20,
        alignItems: 'center'
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15
    },
    presetButton: {
        backgroundColor: '#2196F3',
        padding: 10,
        borderRadius: 8,
        marginVertical: 5,
        width: '80%',
        alignItems: 'center'
    },
    presetButtonText: {
        color: 'white',
        fontSize: 16
    },
    cancelButton: {
        marginTop: 10
    },
    cancelButtonText: {
        color: 'red',
        fontSize: 16
    },
    notificationBanner: {
        backgroundColor: '#f0ad4e',
        padding: 10,
        margin: 10,
        borderRadius: 8,
    },
    notificationTitle: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#fff',
    },
    notificationMessage: {
        fontSize: 14,
        color: '#fff',
    },
});

export default TaskScreen;