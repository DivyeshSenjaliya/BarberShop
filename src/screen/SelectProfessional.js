import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native'
import React from 'react'
import { useState } from 'react'
import { scale } from '../utilits/Scale'


const SelectProfessional = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [change, setChange] = useState()


    return (
        <View style={{ justifyContent: "center", backgroundColor: "white", flex: 1 }}>
            <View>
                <View
                    style={styles.method}>
                    <TouchableOpacity onPress={() => setIsOpen(!isOpen)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
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
                        <TouchableOpacity style={styles.box1}>
                            <Image
                                source={require('../assests/icon/plus.png')}
                                style={styles.img}
                            />
                            <Text style={{ color: "#16161B", fontSize: scale(16), fontWeight: "bold", paddingLeft: scale(10) }}>Add Card</Text>
                        </TouchableOpacity>
                    }
                </View>
            </View>
        </View>
    )
}

export default SelectProfessional

const styles = StyleSheet.create({
    box: {
        flexDirection: "row",
        alignItems: "center",
        width: "90%",
    },
    box1: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        justifyContent: "center"
    },
    method: {
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: scale(1.5),
        borderColor: "#EFF3F9",
        padding: scale(10),
        borderRadius: scale(20),
        marginTop: scale(10)
    },
    img1: {
        height: scale(20),
        width: scale(20),
    },
    img: {
        height: scale(40),
        width: scale(40),
    },
})