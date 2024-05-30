import { StyleSheet, Text, View, TouchableOpacity, Image, TextInput } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'
import { useState } from 'react'

const BusinessPage = ({ navigation }) => {
    const [text, onChangeText] = React.useState('Useless Text');

    return (
        <View style={{ flex: 1, backgroundColor: "white" }}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}>
                    <Image
                        source={require('../assests/icon/arrow.png')}
                        style={{ height: scale(15), width: scale(15), resizeMode: "contain" }}
                    />
                </TouchableOpacity>
                <Text style={{ fontSize: scale(16), color: "black", fontWeight: "bold" }}>Add Debit/Credit Card</Text>
                <View style={styles.arrow}></View>
            </View>
            <View style={styles.input}>
                <TextInput style={styles.box}
                    placeholder='Name On Card'
                    placeholderTextColor={"#554F67"}
                    onChangeText={onChangeText}
                    keyboardType='default'
                />
                <TextInput style={styles.box}
                    placeholder='Card Number'
                    placeholderTextColor={"#554F67"}
                    onChangeText={onChangeText}
                    keyboardType='numeric'
                />
                <View style={{ flexDirection: "row", gap: scale(10) }}>
                    <TextInput style={styles.box1}
                        placeholder='Card Expiry'
                        placeholderTextColor={"#554F67"}
                        onChangeText={onChangeText}
                        keyboardType='phone-pad'
                    />
                    <TextInput style={styles.box1}
                        placeholder='CVV'
                        placeholderTextColor={"#554F67"}
                        onChangeText={onChangeText}
                        maxLength={3}
                        keyboardType='number-pad'
                    />
                </View>
                <TouchableOpacity
                    onPress={() => navigation.navigate("Checkout")}
                    style={styles.last}>
                    <Text style={{ fontSize: scale(14), color: "white", fontWeight: "bold" }}>Book Appointment</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default BusinessPage

const styles = StyleSheet.create({
    header: {
        paddingVertical: scale(40),
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: scale(20),
        borderBottomWidth: scale(0.5),

    },
    box: {
        width: "100%",
        borderWidth: scale(1.5),
        borderColor: "#EFF3F9",
        borderRadius: scale(10),
        marginBottom: scale(10),
        padding: scale(10),
        color: "black",
        fontSize: 14,
    },
    box1: {
        width: "49%",
        borderWidth: scale(1.5),
        borderColor: "#EFF3F9",
        borderRadius: scale(10),
        marginBottom: scale(10),
        padding: scale(10),
        color: "black",
        fontSize: 14,
    },
    input: {
        flex: 1,
        padding: scale(10)
    },
    last: {
        width: "100%",
        padding: scale(15),
        backgroundColor: "#3244E9",
        borderRadius: scale(50),
        alignItems: "center",
        justifyContent: "center",
        marginBottom: scale(10),
        position: "absolute",
        bottom: scale(0),
        alignSelf: "center"
    },

})