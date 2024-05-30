import { StyleSheet, Text, View, TouchableOpacity, Image, Modal, Alert } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'
import { useState } from 'react'

const Checkout = ({ navigation }) => {
    const [change, setChange] = useState()
    const [modalVisible, setModalVisible] = useState(false);
    const [isOpen, setIsOpen] = useState(false)

    return (
        <View style={{ flex: 1, backgroundColor: "white", padding: 10 }}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}>
                    <Image
                        source={require('../assests/icon/arrow.png')}
                        style={{ height: scale(15), width: scale(15), resizeMode: "contain" }}
                    />
                </TouchableOpacity>
                <Text style={{ fontSize: scale(16), color: "black", fontWeight: "bold" }}>Checkout</Text>
                <View style={styles.arrow}></View>
            </View>
            <View style={{ padding: scale(15), flex: 1 }}>
                <Text style={{ color: "#16161B", fontSize: scale(18), fontWeight: "bold" }}>Cost Breakdown</Text>
                <View style={{ height: scale(150), width: "100%", borderColor: "#EFF3F9", borderWidth: scale(1.5), borderRadius: scale(20), marginTop: scale(15) }} >
                    <View style={{ flexDirection: "row", borderBottomWidth: scale(1.5), borderBottomColor: "#EFF3F9" }}>
                        <View style={{ flex: 1, padding: scale(10) }}>
                            <Text style={styles.text}>Skin fade haircut</Text>
                            <Text style={styles.text}>Add on 1</Text>
                            <Text style={styles.text}>Add on 2</Text>

                        </View>
                        <View style={{ flex: 1, padding: scale(10) }}>
                            <Text style={styles.text2}>$60.00</Text>
                            <Text style={styles.text2}>$15.00</Text>
                            <Text style={styles.text2}>$15.00</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", padding: scale(10) }}>
                        <Text style={styles.text}>Total</Text>
                        <Text style={{ color: "#3244E9", fontSize: scale(12), textAlign: 'right', fontWeight: "bold", paddingTop: scale(10) }}>$90.00</Text>
                    </View>
                </View>
                <Text style={{ color: "#16161B", fontSize: scale(18), fontWeight: "bold", marginTop: scale(10) }}>Payment Method</Text>
                <View
                    style={styles.method}>
                    <TouchableOpacity onPress={() => {
                        setIsOpen(!isOpen)
                        setChange("credit")
                    }}
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                        <View style={styles.box}>
                            <Image
                                source={require('../assests/icon/Payment_Icons.png')}
                                style={styles.img}
                            />
                            <Text style={{ color: "#16161B", fontSize: scale(16), fontWeight: "bold", paddingLeft: scale(10) }}>Debit/Credit Card</Text>
                        </View>
                        <Image
                            source={change == "credit" ? require('../assests/icon/after.png') : require('../assests/icon/before.png')}
                            style={styles.img1}
                        />
                    </TouchableOpacity>
                    {
                        isOpen &&
                        <TouchableOpacity onPress={() => navigation.navigate('BusinessPage')}
                            style={styles.box1}>
                            <Image
                                source={require('../assests/icon/plus.png')}
                                style={{ height: scale(20), width: scale(20), tintColor: "#3244E9" }}
                            />
                            <Text style={{ color: "#3244E9", fontSize: scale(16), fontWeight: "bold", paddingLeft: scale(10) }}>Add Card</Text>
                        </TouchableOpacity>
                    }
                </View>
                <TouchableOpacity onPress={() => setChange('apple')}
                    style={styles.method1}>
                    <View style={styles.box}>
                        <Image
                            source={require('../assests/icon/Payment_Icons(1).png')}
                            style={styles.img}
                        />
                        <Text style={{ color: "#16161B", fontSize: scale(16), fontWeight: "bold", paddingLeft: scale(10) }}>Apple Pay</Text>
                    </View>
                    <Image
                        source={change == "apple" ? require('../assests/icon/after.png') : require('../assests/icon/before.png')}
                        style={styles.img1}
                    />
                </TouchableOpacity>

            </View>
            <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={styles.last}>
                <Text style={{ fontSize: scale(14), color: "white", fontWeight: "bold" }}>Book Appointment</Text>
            </TouchableOpacity>
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => {
                    Alert.alert('Modal has been closed.');
                    setModalVisible(!modalVisible);
                }}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalText}>Payment Successful</Text>
                        <Text style={styles.modalText1}>Your payment will be forwarded once your appointment is done</Text>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => setModalVisible(!modalVisible)}>
                            <Text style={styles.textStyle}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

export default Checkout

const styles = StyleSheet.create({
    header: {
        paddingVertical: scale(40),
        flexDirection: "row",
        justifyContent: "space-between",
        borderBottomWidth: scale(0.5),

    },
    text: {
        color: "#16161B", fontSize: scale(12), paddingTop: scale(10)
    },
    text2: {
        color: "#16161B", fontSize: scale(12), textAlign: 'right', fontWeight: "bold", paddingTop: scale(10)
    },
    img: {
        height: scale(40),
        width: scale(40),
    },
    box: {
        flexDirection: "row",
        alignItems: "center",
    },
    box1: {
        flexDirection: "row",
        alignItems: "center",
        width: "90%",
        justifyContent: "center",
        borderWidth: scale(1.5),
        borderColor: "#EFF3F9",
        borderRadius: scale(20),
        padding: scale(10),

    },
    method: {
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: scale(1.5),
        borderColor: "#EFF3F9",
        padding: scale(10),
        borderRadius: scale(20),
        marginTop: scale(10),
    },
    method1: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: scale(1.5),
        borderColor: "#EFF3F9",
        padding: scale(10),
        borderRadius: scale(20),
        marginTop: scale(10),
        width: "100%"
    },
    img1: {
        height: scale(20),
        width: scale(20),
    },
    last: {
        padding: scale(18),
        width: "100%",
        backgroundColor: "#3244E9",
        borderRadius: scale(50),
        alignItems: "center",
        justifyContent: "center",
        position: "relative"
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: "rgba(0,0,0,0.5)"
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    button: {
        borderRadius: 20,
        padding: 10,
        elevation: 10,
        backgroundColor: "#3244E9",
        width: scale(250),
        height: scale(40),
        justifyContent: "center"
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'center',
        color: "black",
        fontWeight: "bold",
        fontSize: scale(18)
    },
    modalText1: {
        marginBottom: 15,
        textAlign: 'center',
        color: "#554F67",
        fontSize: scale(14)

    },
})