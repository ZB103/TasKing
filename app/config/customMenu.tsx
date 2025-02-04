import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Entypo } from "@expo/vector-icons";
import Popover from 'react-native-popover-view';

import colors from "./colors";
import { useNavigation } from 'expo-router';

const CustomMenu = () => {
    const [showPopover, setShowPopover] = useState(false);
    const navigation = useNavigation();

    return (
        <Popover 
            from={(
                <Pressable style={styles.menu} onPress={() => setShowPopover(true)}>
                    <Entypo name="menu" color={colors.black} size={70} />
                </Pressable>
            )}
            isVisible={showPopover}
            onRequestClose={() => setShowPopover(false)}
            backgroundStyle={{backgroundColor: 'transparent'}}
            arrowSize={{width: 50, height: 20}}
            arrowShift={-1}>
                <Pressable style={{flexDirection: "row", alignItems: "center"}} onPress={() => navigation.navigate('Friends')}>
                    <Entypo name="user" color={colors.black} size={50} />
                    <View style={styles.divider}></View>
                    <Text style={{fontSize: 40}}>Friends</Text>
                </Pressable>
                <View style={{height: 4}}></View>
                <Pressable style={{flexDirection: "row", alignItems: "center"}} onPress={() => navigation.navigate('Stats')}>
                    <Entypo name="line-graph" color={colors.black} size={50} />
                    <View style={styles.divider}></View>
                    <Text style={{fontSize: 40}}>Statistics</Text>
                </Pressable>
                <View style={{height: 4}}></View>
                <Pressable style={{flexDirection: "row", alignItems: "center"}} onPress={() => 
                    <Modal>
                        <Text>You found it!</Text>
                    </Modal>}>
                    <Entypo name="arrow-up" color={colors.black} size={50} />
                    <View style={styles.divider}></View>
                    <Text style={{fontSize: 40}}>Resolution</Text>
                </Pressable>
                <View style={{height: 4}}></View>
                <Pressable style={{flexDirection: "row", alignItems: "center"}} onPress={() => navigation.navigate('Settings')}>
                    <Entypo name="cog" color={colors.black} size={50} />
                    <View style={styles.divider}></View>
                    <Text style={{fontSize: 40}}>Settings</Text>
                </Pressable>
        </Popover>
    );
}

const styles = StyleSheet.create({
    divider: {
        width: "3%",
        backgroundColor: colors.white,
    },
    menu: {
        width: "17.5%",
        height: 75,
    },
})

export default CustomMenu;