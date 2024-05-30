import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, TextInput } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'

const Reset = ({ navigation }) => {
    const [text, onChangeText] = React.useState('')

    return (
        <View style={styles.container}>
            <ImageBackground
                source={require("../assests/icon/login.png")}
                style={styles.img}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.arrow}>
                        <Image
                            source={require('../assests/icon/arrow.png')}
                            style={{ height: scale(15), width: scale(15), resizeMode: "contain", tintColor: "white" }}
                        />
                    </TouchableOpacity>
                </View>
                <View style={styles.middle}>
                    <Text style={styles.Text}>RESET{"\n"}
                        PASSWORD?</Text>
                    <Text style={styles.text}>Enter a new password</Text>
                    <View style={styles.email}>
                        <TextInput style={styles.Email}
                            onChangeText={onChangeText}
                            placeholder='New Password'
                            placeholderTextColor={"white"}
                            keyboardType='text'
                        />
                        <TouchableOpacity>
                                <Image
                                    source={require('../assests/icon/Icons.png')}

                                    style={{ height: scale(20), width: scale(20) }}
                                />
                            </TouchableOpacity>
                    </View>
                    <View style={styles.email}>
                        <TextInput style={styles.Email}
                        secureTextEntry={true}
                            onChangeText={onChangeText}
                            placeholder='Confirm Password'
                            placeholderTextColor={"white"}
                            keyboardType='text'
                        />
                        <TouchableOpacity>
                                <Image
                                    source={require('../assests/icon/Icons.png')}

                                    style={{ height: scale(20), width: scale(20) }}
                                />
                            </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Login')}
                        style={styles.submit}>
                        <Text style={{ color: "white", fontSize: 16, }}>Submit</Text>
                    </TouchableOpacity>
                </View>
            </ImageBackground>
        </View>
    )
}

export default Reset

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "black",

    },
    img: {
        flex: 1,
        resizeMode: "contain",
        padding: 20,
    },
    arrow: {
        height: scale(40),
        width: scale(40),
        borderRadius: 80,
        backgroundColor: "#00000080",
        alignItems: "center",
        justifyContent: "center",
    },
    header: {
        paddingVertical: 45,
        flex: 0.2
    },
    Text: {
        fontSize: 40,
        fontWeight: "bold",
        color:"white"
    },
    middle: {
        flex: 1

    },
    text: {
        fontSize: 16,
        marginTop: 20,
        color:"white"
    },
    email: {
        height: scale(50),
        width: "100%",
        backgroundColor: "#554F6780",
        justifyContent: "space-between",
        alignItems: "center",
        flexDirection: "row",
        paddingHorizontal: 20,
        borderRadius: 10,
        marginTop: 20,

    },
    Email: {
        color: "white",
        fontSize: 16,
        width: "90%"
    },
    submit: {
        height: scale(50),
        width: "100%",
        backgroundColor: "#3244E9",
        borderRadius: 50,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 30
    }
})