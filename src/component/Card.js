import { StyleSheet, Text, View, TouchableOpacity, Image, ImageBackground } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'
import { Screen } from 'react-native-screens'
import { useState } from 'react'
import { Rating } from 'react-native-ratings'
export const RenderItem = ({ item, onTouch }) => {
    return (

        <TouchableOpacity onPress={onTouch}
            style={{
                flex: 1,
                margin: 10,
            }}>
            <Image
                source={item.Image}
                // source={{uri:item.thumb}}
                style={{ height: 150, width: "100%", resizeMode: "center", }}
            />
            <View style={{ paddingVertical: 20, paddingHorizontal: 10, justifyContent: "space-between" }}>
                <Text style={{ color: '#000000', fontSize: 14, fontWeight: "bold" }}>{item.Name}</Text>
                <Text style={{ color: '#646464', fontSize: 15, fontWeight: "bold", paddingTop: 10 }}>Starting from <Text style={{ color: "blue" }}>${item.Price}</Text></Text>
                <Text style={{ color: '#9E98AC', fontSize: 15, fontWeight: "bold", paddingTop: 10 }}>{item.Time} Minutes</Text>
            </View>
        </TouchableOpacity>
    )
}

export const RenderItems = ({ item, onTime, Time }) => {
    return (
        <TouchableOpacity
            onPress={() => onTime(item.id)}
            style={{ padding: scale(10), borderWidth: scale(0.5), marginRight: scale(10), borderRadius: scale(10) }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: scale(10) }}>
                    <Image
                        source={require('../assests/icon/Ellipse.png')}
                        style={{ height: scale(10), width: scale(10), resizeMode: "contain" }}
                    />
                    <Text style={{ fontSize: scale(12), color: "black", paddingHorizontal: scale(5) }}>Available</Text>
                </View>
                <Image
                    source={Time == item.id ? require('../assests/icon/after.png') : require('../assests/icon/before.png')}
                    style={{ height: scale(20), width: scale(20), resizeMode: "contain" }}
                />
            </View>
            <Text style={{ fontSize: scale(16), color: "black", fontWeight: "bold", padding: scale(10) }}>{item.Time}</Text>


        </TouchableOpacity>)
}

export const Renders1 = ({ item, onTouch }) => {
    return (
        <View style={{ flex: 1, margin: 10, justifyContent: "space-between", backgroundColor: "white" }}>
            <TouchableOpacity
                style={{ borderWidth: scale(1), borderColor: "#EFF3F9", flexDirection: "row", padding: scale(10), borderRadius: scale(10) }}
            >
                <Image
                    source={item.Image}
                    style={{ height: scale(55), width: scale(55), resizeMode: "cover" }}
                />

                <View style={{ flexDirection: "column", paddingVertical: scale(5), paddingHorizontal: scale(10), gap: scale(10), flex: 1 }}>
                    <Text style={styles.text}>
                        {item.Name}
                    </Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: "#16161B", fontSize: scale(14) }}>From{'  '}<Text style={styles.text1}>${item.Price}</Text></Text>
                        <Rating
                            type='custom'
                            ratingColor='#3498db'
                            ratingBackgroundColor='#c8c7c8'
                            ratingCount={5}
                            imageSize={15}
                            onFinishRating={this.ratingCompleted}
                            starContainerStyle={{ paddingHorizontal: 20 }}

                        />

                        <Text style={styles.text2}>{item.Rating}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    )
}
const styles = StyleSheet.create({
    text: {
        color: "#000000",
        fontSize: scale(14),
        fontWeight: "bold",

    },
    text1: {
        color: "#3244E9",
        fontSize: scale(14),
        fontWeight: "bold",
    },
    text2: {
        color: "#16161B",
        fontSize: scale(14),
    }
})