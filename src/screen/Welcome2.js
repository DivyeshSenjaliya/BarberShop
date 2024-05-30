import { ImageBackground, StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'

const Welcome2 = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <ImageBackground
                source={require("../assests/icon/slide2.png")}
                style={styles.img}>
                <View style={{
                    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10,
                    justifyContent: "space-between",
                }}>
                    <View style={styles.header}>
                        <Image
                            source={require("../assests/icon/logo.png")}
                            style={styles.Image}
                        />
                        <TouchableOpacity
                            style={styles.button} onPress={() => navigation.navigate('Login')}>
                            <Text style={{ fontWeight: "bold", color: "white" }}>Skip</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.bottom}>
                        <Text style={styles.Text}>ENJOY{"\n"}
                            YOUR{"\n"}
                            TREATMENT</Text>
                        <Text style={{ fontSize: 17, paddingBottom: 50, color: "white" }}>Sit back and relax to enjoy a treatment that makes you happy everyday.</Text>
                        <View style={styles.last}>
                            <Image
                                source={require("../assests/icon/side2.png")}
                                style={styles.side}
                            />
                            <TouchableOpacity
                                style={styles.next}
                                onPress={() => navigation.navigate('Login')}>
                                <Text style={{ color: "white", fontWeight: "bold" }}>Lets Get Started</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ImageBackground>
        </View>
    )
}

export default Welcome2

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "black",

    },
    img: {
        flex: 1,
        resizeMode: "contain",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 40,
        paddingHorizontal: 10
    },
    Image: {
        height: scale(50),
        width: "30%",
        resizeMode: "contain",

    },
    button: {
        backgroundColor: "#554F6780",
        height: scale(35),
        width: "20%",
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",

    },
    bottom: {
        padding: 20,
        justifyContent: "space-between"
    },
    Text: {
        color: "white",
        fontSize: 40,
        fontWeight: "bold",

    },
    side: {
        height: scale(50),
        width: "20%",
        resizeMode: "contain"
    },
    next: {
        height: scale(40),
        width: "40%",
        backgroundColor: "#3244E9",
        borderRadius: 35,
        alignItems: "center",
        justifyContent: "center",
    },
    last: {
        flexDirection: "row",
        justifyContent: 'space-between',
        alignItems: "center"
    }
})