import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'

const Summary = ({ navigation }) => {
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
                <Text style={{ fontSize: scale(16), color: "black", fontWeight: "bold" }}>Summary</Text>
                <View style={styles.arrow}></View>
            </View>
            <View style={{ padding: 20 }}>
                <View style={{ height: scale(400), width: "100%", borderColor: "#EFF3F9", borderWidth: scale(1.5), borderRadius: scale(20), flexDirection: "row" }}>
                    <View style={{ justifyContent: "space-between", flex: 1, padding: scale(20) }}>
                        <Text style={styles.text}>Service</Text>
                        <Text style={styles.text}>Service cost</Text>
                        <Text style={styles.text}>Add ons</Text>
                        <Text style={styles.text}>Add ons total cost</Text>
                        <Text style={styles.text}>Duration</Text>
                        <Text style={styles.text}>Appointment Date</Text>
                        <Text style={styles.text}>Appointment Time</Text>
                        <Text style={styles.text}>Professional</Text>
                        <Text style={styles.text}>Service Location</Text>
                        <Text style={styles.text}>Address</Text>
                    </View>
                    <View style={{ justifyContent: "space-between", flex: 1, padding: scale(20), }}>
                        <Text style={styles.text2}>Straight Hair</Text>
                        <Text style={{ color: "#3244E9", fontSize: scale(12), textAlign: 'right', fontWeight: "bold" }}>$60.00</Text>
                        <Text style={styles.text2}>Add On 1{'\n'}
                            Add On 2</Text>
                        <Text style={{ color: "#3244E9", fontSize: scale(12), textAlign: 'right', fontWeight: "bold" }}>$30.00</Text>
                        <Text style={styles.text2}>45 minutes</Text>
                        <Text style={styles.text2}>23rd March, 2022</Text>
                        <Text style={styles.text2}>12:00PM-1:00PM</Text>
                        <Text style={styles.text2}>Johnathan Morrison</Text>
                        <Text style={styles.text2}>Your location</Text>
                        <Text style={styles.text2}>Some address line goes here</Text>
                    </View>
                </View>
            </View>
            <View style={styles.last}>
                <View style={{ justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "#16161B", fontSize: scale(18), }}>Total:<Text style={{ color: "#16161B", fontSize: scale(18), fontWeight: "bold", paddingHorizontal: scale(5) }}>$90.00</Text>
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Checkout')}
                    style={styles.continue}>
                    <Text style={{ fontSize: scale(14), color: "white", fontWeight: "bold" }}>Checkout</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default Summary

const styles = StyleSheet.create({
    header: {
        paddingVertical: scale(40),
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: scale(20),
        borderBottomWidth: scale(0.5),

    },
    last: {
        height: scale(500),
        width: "100%",
        borderWidth: scale(1.5),
        borderColor: "#EFF3F9",
        marginTop: scale(80),
        padding: scale(10)
    },
    continue: {
        height: scale(50),
        width: "100%",
        backgroundColor: "#3244E9",
        borderRadius: scale(50),
        alignItems: "center",
        justifyContent: "center",
        marginTop: scale(15),

    },
    text: {
        color: "#16161B", fontSize: scale(12)
    },
    text2: {
        color: "#16161B", fontSize: scale(12), textAlign: 'right', fontWeight: "bold"
    }
})