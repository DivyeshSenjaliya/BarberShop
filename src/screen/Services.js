import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'
import { Service } from '../constants/Services'
import { RenderItem } from '../component/Card'

const Services = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Image
                        source={require('../assests/icon/arrow.png')}
                        style={styles.img}
                    />
                </TouchableOpacity>
                <Text style={styles.text}>Hair Services</Text>
                <TouchableOpacity>
                    <Image
                        source={require('../assests/icon/search.png')}
                        style={styles.img}
                    />
                </TouchableOpacity>

            </View>
            <View style={{ flex: 1 }}>
                <FlatList
                    data={Service}
                    renderItem={({ item }) => <RenderItem
                        item={item}
                        Image={item.Image}
                        Name={item.Name}
                        Price={item.Price}
                        Tome={item.Time}
                        onTouch={() => { navigation.navigate('BusinessLocation', { data: item }) }}

                    />}
                    keyExtractor={item => item.id.toString()}
                    numColumns={2}

                />
            </View>
        </View>
    )
}

export default Services

const styles = StyleSheet.create({
    container: {
        flex: scale(1),
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: scale(30),
        paddingHorizontal: scale(20),
        borderBottomWidth: scale(1),
        borderBottomColor: "gray"
    },
    img: {
        height: scale(20),
        width: scale(20),
        resizeMode: "contain"
    },
    text: {
        fontSize: 18,
        color: "black",
        fontWeight: "bold"
    }
})