import { Image, ImageBackground, StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, FlatList, Pressable } from 'react-native'
import React from 'react'
import { scale } from '../utilits/Scale'
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { RenderItems, Renders } from '../component/Card';
import { useState, useEffect } from 'react'
import { time } from '../constants/Services';
import { list } from '../constants/Services';
import { Renders1 } from '../component/Card';
import { Images } from '../assests/icon';
import { Fonts } from '../constants/Fonts';

const BusinessLocation = ({ navigation, route }) => {
    const [selectedDate, setSelectedDate] = useState()
    const [location, setLocation] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [change, setChange] = useState(false)
    const [timeId, setTimeId] = useState(3)

    useEffect(() => {
        console.log('>>>>>>>', route.params.data);
    }, [])

    return (
        <View style={styles.container}>
            <ImageBackground
                source={require('../assests/icon/Rectangle10.png')}
                style={styles.img}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.arrow}>
                        <Image
                            source={Images.back}
                            style={{ height: scale(15), width: scale(15), resizeMode: "contain", tintColor: "white" }}
                        />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: scale(24), color: "white", fontWeight: "bold" }}>Skin Fade Haircut</Text>
                        <View style={{ justifyContent: "space-between", flexDirection: "row", paddingTop: scale(10) }}>
                            <Text style={styles.text}>45 minutes</Text>
                            <Text style={styles.text}>$25</Text>
                        </View>
                    </View>
                </View>
            </ImageBackground>

            <ScrollView style={styles.bottom} contentContainerStyle={{ paddingBottom: scale(30) }}>

                <View style={{ borderBottomWidth: scale(0.5), borderBottomColor: "#E6E8F1" }}>
                    <Text style={{ color: "#16161B", fontSize: scale(18), fontFamily: Fonts.bold }}>Select a professional (Optional)</Text>
                    <Text style={{ color: "#9E98AC", fontSize: scale(12), marginTop: scale(10) }}>You can select your preferred professional</Text>
                    <Pressable
                        onPress={() => setModalVisible(true)}
                        style={styles.select}>
                        <Image
                            source={require('../assests/icon/group.png')}
                            style={styles.group}
                        />
                        <Text style={{ color: "#3244E9", fontSize: scale(14), fontWeight: "bold", paddingHorizontal: scale(10) }}>Select a Professional</Text>
                    </Pressable>
                </View>
                <View style={{ borderBottomWidth: scale(0.5), borderBottomColor: "#E6E8F1" }}>
                    <Text style={styles.title}>Select Date</Text>
                    <Calendar
                        minDate={new Date().toString()}
                        style={{
                            borderWidth: 1,
                            borderColor: '#9E98AC',
                            height: scale(290),
                            borderRadius: scale(20),
                            marginTop: scale(10),
                            marginBottom: scale(20)
                        }}

                        current={new Date().toString()}
                        onDayPress={day => {
                            console.log('selected day', day);
                            setSelectedDate(day.dateString)
                        }}
                        theme={{
                            selectedDayBackgroundColor: "red",
                        }}
                        markedDates={{
                            [selectedDate]: { selected: true, disableTouchEvent: true }
                        }}
                    />
                </View>

                <View style={{ borderBottomWidth: scale(0.5), borderBottomColor: "#E6E8F1" }}>
                    <Text style={styles.title}>
                        Select Time
                    </Text>

                    <FlatList
                        data={time}
                        renderItem={({ item }) => {
                            return (<RenderItems
                                item={item}
                                Time={timeId}
                                onTime={(id) => { setTimeId(id) }}
                            />)
                        }}
                        contentContainerStyle={{ flexGrow: 1, marginBottom: scale(20), marginTop: scale(10) }}
                        horizontal
                        keyExtractor={item => item.id.toString()}

                    />
                </View>
                <Text style={styles.title}>Location</Text>
                <View style={{ flexDirection: "row", gap: scale(5), borderBottomWidth: scale(0.5), borderBottomColor: "#E6E8F1" }}>
                    <TouchableOpacity
                        style={styles.box} onPress={() => setLocation("business")}>
                        <Text style={styles.inbox}>Business{"\n"}
                            Location</Text>
                        <Image
                            source={location == "business" ? require('../assests/icon/after.png') : require('../assests/icon/before.png')}
                            style={styles.check}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.box} onPress={() => setLocation("home")}>
                        <Text style={styles.inbox}>At my{"\n"}
                            Location</Text>
                        <Image
                            source={location == "home" ? require('../assests/icon/after.png') : require('../assests/icon/before.png')}
                            style={styles.check}
                        />
                    </TouchableOpacity>
                </View>
                <Text style={styles.title}>Add Ons</Text>
                <Text style={{ color: "#9E98AC", fontSize: scale(12), marginTop: scale(10) }}>If you add and add ons then appointment time will increase accordingly</Text>
                <View style={{ flexDirection: "row", gap: 20 }}>
                    <TouchableOpacity onPress={() => setChange("add1")}
                        style={styles.last}>
                        <View style={{ borderBottomWidth: scale(0.5), borderBottomColor: "#E6E8F1" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: scale(5) }}>
                                <Text style={{ fontSize: scale(12), color: "black" }}>Haircut</Text>
                                <Image
                                    source={change == "add1" ? require('../assests/icon/after.png') : require('../assests/icon/before.png')}
                                    style={styles.check}
                                />
                            </View>
                            <Text style={{ color: "#16161B", fontWeight: "bold", fontSize: scale(16), paddingTop: scale(10) }}>Add on 1 name goes here</Text>
                            <View style={{ flexDirection: "row", paddingTop: scale(10), paddingBottom: scale(10) }}>
                                <Image
                                    source={require('../assests/icon/clock.png')}
                                    style={{ height: scale(15), width: scale(15), resizeMode: "contain" }}
                                />
                                <Text style={{ fontSize: scale(12), color: "#554F67", paddingHorizontal: scale(5) }}>45 Minutes</Text>
                            </View>
                        </View>
                        <View>
                            <Text style={{ fontSize: scale(13), color: "#554F67", paddingTop: scale(10) }}>Service fee</Text>
                            <Text style={{ fontSize: scale(14), color: "#3244E9", fontWeight: "bold", paddingTop: scale(8) }}>$25</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setChange("add2")}
                        style={styles.last}>
                        <View style={{ borderBottomWidth: scale(0.5), borderBottomColor: "#E6E8F1" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: scale(5) }}>
                                <Text style={{ fontSize: scale(12), color: "black" }}>Haircut</Text>
                                <Image
                                    source={change == "add2" ? require('../assests/icon/after.png') : require('../assests/icon/before.png')}
                                    style={styles.check}
                                />
                            </View>
                            <Text style={{ color: "#16161B", fontWeight: "bold", fontSize: scale(16), paddingTop: scale(10) }}>Add on 2</Text>
                            <View style={{ flexDirection: "row", paddingTop: scale(30), paddingBottom: scale(10) }}>
                                <Image
                                    source={require('../assests/icon/clock.png')}
                                    style={{ height: scale(15), width: scale(15), resizeMode: "contain" }}
                                />
                                <Text style={{ fontSize: scale(12), color: "#554F67", paddingHorizontal: scale(5) }}>45 Minutes</Text>
                            </View>
                        </View>
                        <View>
                            <Text style={{ fontSize: scale(12), color: "black", paddingTop: scale(10) }}>Service fee</Text>
                            <Text style={{ fontSize: scale(14), color: "#3244E9", fontWeight: "bold", paddingTop: scale(8) }}>$25</Text>
                        </View>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Summary')}
                    style={styles.continue}>
                    <Text style={{ fontSize: scale(14), color: "white", fontWeight: "bold" }}>Continue</Text>
                </TouchableOpacity>
            </ScrollView>
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}>
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
                    onPress={() => setModalVisible(false)}>
                    <View style={{ flex: 1, marginTop: scale(100), backgroundColor: "white", borderTopLeftRadius: scale(10), borderTopRightRadius: scale(10), padding: scale(10) }}>
                        <Image
                            source={require('../assests/icon/bar.png')}
                            style={{ height: scale(10), width: scale(45), resizeMode: "contain", alignSelf: "center", marginBottom: scale(15) }}
                        />
                        <Text style={{ color: "#16161B", fontWeight: "bold", fontSize: scale(18), marginBottom: scale(10) }}>Select a professional</Text>
                        <FlatList
                            data={list}
                            renderItem={({ item }) => <Renders1
                                item={item}
                                Name={item.Name}
                                Price={item.Price}
                                Rating={item.Rating}
                                Image={item.Image}
                            />}
                        />

                    </View>

                </TouchableOpacity>
            </Modal>
        </View>
    )
}

export default BusinessLocation

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white"
    },
    img: {
        height: scale(350),
        width: "100%",
        resizeMode: "center",
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
        paddingVertical: scale(40),
        paddingHorizontal: scale(20),
        justifyContent: "space-between",
        flex: 1
    },
    text: {
        color: "white",
        fontSize: scale(14),
        fontWeight: "bold"
    },
    bottom: {
        flex: 1,
        backgroundColor: "white",
        borderTopLeftRadius: scale(15),
        borderTopRightRadius: scale(16),
        padding: scale(20),
        marginTop: scale(-20)
    },
    select: {
        height: scale(50),
        width: "100%",
        borderWidth: scale(1),
        borderRadius: scale(50),
        borderColor: "#E6E8F1",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: scale(10),
        borderBottomColor: "black",
        borderBottomWidth: scale(1),
        marginBottom: scale(20)
    },
    group: {
        height: scale(25),
        width: scale(25),
        tintColor: "#3244E9"
    },
    title: {
        color: "#16161B",
        fontWeight: "bold",
        fontSize: scale(18),
        marginTop: scale(10)
    },
    box: {
        height: scale(75),
        width: "49%",
        borderWidth: scale(1),
        borderRadius: scale(20),
        borderColor: "#9E98AC",
        marginTop: scale(10),
        flexDirection: "row",
        alignItems: "center",
        padding: scale(10),
        justifyContent: "space-between",
        marginBottom: scale(20)
    },
    inbox: {
        color: "black",
        fontSize: scale(15),
        fontWeight: "bold"
    },
    check: {
        height: scale(20),
        width: scale(20),
        resizeMode: "contain"
    },
    last: {
        borderWidth: scale(1),
        borderColor: "#EFF3F9",
        borderRadius: 20,
        height: scale(175),
        width: "46%",
        marginTop: scale(10),
        padding: scale(10)
    },
    continue: {
        height: scale(50),
        width: "100%",
        backgroundColor: "#3244E9",
        borderRadius: scale(50),
        alignItems: "center",
        justifyContent: "center",
        marginTop: scale(20)
    }
})