import { StyleSheet, Text, View, ImageBackground, Image, TouchableOpacity, TextInput, Alert, } from 'react-native'
import React, { useEffect, useState } from 'react'
import { scale } from '../utilits/Scale'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { Color } from '../constants/Color'

const Login = ({ navigation, route }) => {
    const [text, onChangeText] = React.useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isEmail, setIsEmail] = useState(false)
    const [isPassword, setIsPassword] = useState(false)

    const handleFetch = async () => {
        if (email == '') {
            setIsEmail(true);
            return
        } else if (password == '') {
            setIsPassword(true);
            return;
        } else {
            try {
                fetch(`https://dummyjson.com/products/${route.params.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({

                        username: email,
                        password: password,
                    })
                })
                    .then(res => res.json())
                    .then(result => {
                        console.log(result);
                        setEmail('');
                        setPassword('')
                    });
            } catch (error) {
                console.log(error)
            }
        }
    }

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
                        style={styles.button} onPress={() => navigation.navigate('SingUp')}>
                        <Text style={{ fontWeight: "bold", color: "white" }}>Sign Up</Text>
                    </TouchableOpacity>
                </View>
                <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }}>

                    <View style={styles.login}>
                        <View>
                            <Text style={styles.Text} >LOGIN</Text>
                        </View>
                        <View style={styles.email}>
                            <TextInput style={styles.Email}
                                onChangeText={(text) => {
                                    setIsEmail(false)
                                    setEmail(text)
                                }}
                                placeholder='Email Address'
                                placeholderTextColor={"white"}
                                keyboardType='email-address'
                                value={email}
                            />
                            <View style={styles.img}></View>
                        </View>
                        {isEmail && <Text style={{ color: Color.red }}>Email is empty</Text>}
                        <View style={styles.email}>
                            <TextInput style={styles.Email}
                                secureTextEntry={true}
                                onChangeText={(text) => {
                                    setIsPassword(false)
                                    setPassword(text)
                                }}
                                placeholder='Password'
                                placeholderTextColor={"white"}
                                keyboardType='default'
                                value={password}
                            />
                            <TouchableOpacity>
                                <Image
                                    source={require('../assests/icon/Icons.png')}

                                    style={{ height: scale(20), width: scale(20) }}
                                />
                            </TouchableOpacity>
                        </View>
                        {isPassword && <Text style={{ color: 'red' }}>Email is empty</Text>}

                        <TouchableOpacity onPress={() => navigation.navigate('Forgot')}>
                            <Text style={styles.pass}>Forgot password?</Text>

                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { navigation.navigate('Services') }} style={styles.home}>
                            <Text style={{ color: "white", fontSize: 16, }}>Login</Text>
                        </TouchableOpacity>
                        <Text style={styles.continue}>Or continue with</Text>
                        <View style={styles.last}>
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
                        </View>
                    </View>
                </KeyboardAwareScrollView>
            </ImageBackground>
        </View>
    )
}

export default Login

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "black",

    },
    img: {
        flex: 1,
        resizeMode: "contain",
        padding: 10,
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
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",

    },
    header: {

        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: scale(30),
        paddingHorizontal: 10
    },
    login: {
        flex: 1,
        padding: 10,
        paddingTop: 50,

    },
    Text: {
        color: "white",
        fontSize: 50,
        fontWeight: "bold",

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
        marginTop: 30,

    },
    Email: {
        color: "white",
        fontSize: 16,
        width: "90%"
    },
    pass: {
        color: "white",
        marginTop: 30,
    },
    home: {
        height: scale(50),
        width: "100%",
        backgroundColor: "#3244E9",
        borderRadius: 50,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 30
    },
    continue: {
        textAlign: "center",
        fontSize: 15,
        color: "white",
        marginTop: 30
    },
    lastimage: {
        height: scale(50),
        width: scale(50),
        resizeMode: "contain"
    },
    last: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 30,
        gap: 25,
    }
})