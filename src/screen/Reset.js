import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, TextInput, ActivityIndicator } from 'react-native';
import React, { useState } from 'react';
import { scale } from '../utilits/Scale';
import { useToast } from '../components/ToastContext';
import { Color } from '../constants/Color';

const Reset = ({ navigation }) => {
    const { showToast } = useToast();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!password) {
            setError('Please enter a new password');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsSubmitting(true);
        setError('');

        setTimeout(() => {
            setIsSubmitting(false);
            showToast('Password reset successfully! Please log in.', { type: 'success' });
            navigation.navigate('Login');
        }, 500);
    };

    return (
        <View style={styles.container}>
            <ImageBackground
                source={require('../assests/icon/login.png')}
                style={styles.img}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.arrow}>
                        <Image
                            source={require('../assests/icon/arrow.png')}
                            style={{ height: scale(15), width: scale(15), resizeMode: 'contain', tintColor: 'white' }}
                        />
                    </TouchableOpacity>
                </View>
                <View style={styles.middle}>
                    <Text style={styles.Text}>RESET{'\n'}PASSWORD?</Text>
                    <Text style={styles.text}>Enter your new password below.</Text>

                    <View style={styles.email}>
                        <TextInput
                            style={styles.Email}
                            secureTextEntry={!showPassword}
                            onChangeText={(t) => {
                                setPassword(t);
                                if (error) setError('');
                            }}
                            placeholder="New Password"
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            autoCapitalize="none"
                            value={password}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Image
                                source={
                                    showPassword
                                        ? require('../assests/icon/hide.png')
                                        : require('../assests/icon/Icons.png')
                                }
                                style={{ height: scale(20), width: scale(20), tintColor: 'white' }}
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.email}>
                        <TextInput
                            style={styles.Email}
                            secureTextEntry={!showPassword}
                            onChangeText={(t) => {
                                setConfirmPassword(t);
                                if (error) setError('');
                            }}
                            placeholder="Confirm Password"
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            autoCapitalize="none"
                            value={confirmPassword}
                        />
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        style={[styles.submit, isSubmitting && styles.disabledButton]}>
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Update Password</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ImageBackground>
        </View>
    );
};

export default Reset;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    img: {
        flex: 1,
        resizeMode: 'contain',
        padding: 20,
    },
    arrow: {
        height: scale(40),
        width: scale(40),
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginTop: 20,
    },
    middle: {
        marginTop: 60,
    },
    Text: {
        color: 'white',
        fontSize: scale(28),
        fontWeight: 'bold',
        lineHeight: scale(36),
    },
    text: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 15,
        lineHeight: 20,
    },
    email: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        marginTop: 25,
        paddingBottom: 5,
    },
    Email: {
        flex: 1,
        fontSize: 16,
        color: 'white',
    },
    submit: {
        height: scale(48),
        width: '100%',
        borderRadius: 24,
        backgroundColor: Color.Primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 35,
    },
    disabledButton: {
        opacity: 0.6,
    },
    errorText: {
        color: Color.red || '#EF4444',
        fontSize: 12,
        marginTop: 6,
    },
});