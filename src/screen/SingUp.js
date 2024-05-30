import { StyleSheet, Text, View, ImageBackground, Image, TouchableOpacity, TextInput, } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

const SingUp = ({ navigation }) => {
    const [text, onChangeText] = React.useState('')
    const [show, setShow] = React.useState(false);

    return (
        <View style={styles.container}>
            <ImageBackground
                source={require("../assests/icon/login.png")}
                style={styles.img}>
                <View style={styles.header}>
                    <Image
                        source={require("../assests/icon/logo.png")}
                        style={styles.Image}
                    />
                    <TouchableOpacity
                        style={styles.button} onPress={() => navigation.navigate('Login')}>
                        <Text style={{ fontWeight: "bold", color: "white" }}>Login</Text>
                    </TouchableOpacity>
                </View>
                <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }}>

                    <View style={styles.Singup}>
                        <View>
                            <Text style={styles.Text} >SIGN UP</Text>
                        </View>
                        <View style={styles.email}>
                            <TextInput style={styles.Email}
                                onChangeText={onChangeText}
                                placeholder='Full Name'
                                placeholderTextColor={"white"}
                                keyboardType='text'
                            />
                            <View style={styles.img}></View>
                        </View>
                        <View style={styles.email}>
                            <TextInput style={styles.Email}
                                onChangeText={onChangeText}
                                placeholder='Email Address'
                                placeholderTextColor={"white"}
                                keyboardType='text'
                            />
                        </View>
                        <View style={styles.email}>
                            <TextInput style={styles.Email}
                                secureTextEntry={show}
                                onChangeText={onChangeText}
                                placeholder='Password'
                                placeholderTextColor={"white"}
                                keyboardType='text'
                            />
                            <TouchableOpacity onPress={() => setShow(!show)}>
                                {show ? <Image
                                    source={require('../assests/icon/hide.png')}

                                    style={{ height: scale(18), width: scale(18), tintColor: "white" }}
                                /> : <Image
                                    source={require('../assests/icon/Icons.png')}

                                    style={{ height: scale(20), width: scale(20) }}
                                />}
                            </TouchableOpacity>
                        </View>
                        <View style={styles.require}>
                            <Image
                                source={require('../assests/icon/information.png')}
                                style={styles.info}
                            />
                            <Text style={styles.pass}>Minimum 8 digits</Text>
                        </View>
                        <View style={styles.email}>
                            <TextInput style={styles.Email}
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
                        <Text style={styles.pass1}>I agree to the Privacy Policy & T&C</Text>

                        <TouchableOpacity style={styles.home}
                            onPress={() => navigation.navigate('Login')}>
                            <Text style={{ color: "white", fontSize: 17, }}>Signup</Text>
                        </TouchableOpacity>
                        <Text style={styles.continue}>Or continue with</Text>
                        <View style={styles.last}>
                            {/* <View style={styles.lastimage}></View> */}
                            <TouchableOpacity>
                                <Image
                                    source={require("../assests/icon/Google.png")}
                                    style={styles.lastimage}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity>
                                <Image
                                    source={require("../assests/icon/Apple.png")}
                                    style={styles.lastimage}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity>
                                <Image
                                    source={require("../assests/icon/Facebook.png")}
                                    style={styles.lastimage}
                                />
                            </TouchableOpacity>
                            {/* <View style={styles.lastimage}></View> */}
                        </View>
                    </View>
                </KeyboardAwareScrollView>
            </ImageBackground>
        </View>
    )
}

export default SingUp

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "black",
    },
    img: {
        flex: 1,
        resizeMode: "contain",
        padding: scale(10),
        justifyContent: "space-between",
    },
    Image: {
        height: scale(50),
        width: "30%",
        resizeMode: "contain",
    },
    button: {
        backgroundColor: "#554F6780",
        height: scale(35),
        width: "25%",
        borderRadius: scale(40),
        alignItems: "center",
        justifyContent: "center",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: scale(30),
        paddingHorizontal: scale(10)
    },
    login: {
        flex: 1,
        padding: scale(10),
        paddingTop: scale(50),
    },
    Text: {
        color: "white",
        fontSize: scale(45),
        fontWeight: "bold",
    },
    email: {
        height: scale(50),
        width: "100%",
        backgroundColor: "#554F6780",
        justifyContent: "space-between",
        alignItems: "center",
        flexDirection: "row",
        paddingHorizontal: scale(20),
        borderRadius: scale(10),
        marginTop: scale(20),
    },
    Email: {
        color: "white",
        fontSize: scale(15),
        width: "90%"
    },
    pass: {
        color: "white",
        paddingLeft: scale(10)
    },
    home: {
        height: scale(50),
        width: "100%",
        backgroundColor: "#3244E9",
        borderRadius: 50,
        alignItems: "center",
        justifyContent: "center",
        marginTop: scale(25)
    },
    continue: {
        textAlign: "center",
        fontSize: scale(15),
        color: "white",
        marginTop: scale(20)
    },
    lastimage: {
        height: scale(50),
        width: scale(50),
        resizeMode: "contain"
    },
    last: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: scale(30),
        gap: scale(10)
    },
    info: {
        height: scale(15),
        width: scale(15),
        tintColor: "white"
    },
    require: {
        flexDirection: "row",
        marginTop: scale(10),
        paddingLeft: 10
    },
    pass1: {
        color: "white",
        paddingLeft: scale(10),
        marginTop: scale(20)
    },
})