import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, TextInput, ActivityIndicator } from 'react-native';
import React, { useState } from 'react';
import { scale } from '../utilits/Scale';
import { useToast } from '../components/ToastContext';
import { Color } from '../constants/Color';

const Forgot = ({ navigation }) => {
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError('Enter a valid email address');
            return;
        }

        setIsSubmitting(true);
        setError('');

        // Simulate password reset email dispatch
        setTimeout(() => {
            setIsSubmitting(false);
            showToast('Reset link sent to your email', { type: 'success' });
            navigation.navigate('Reset');
        }, 600);
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
                    <Text style={styles.Text}>FORGOT{'\n'}PASSWORD?</Text>
                    <Text style={styles.text}>Enter your email address and we’ll send you an email with instructions.</Text>
                    <View style={styles.email}>
                        <TextInput
                            style={styles.Email}
                            onChangeText={(t) => {
                                setEmail(t);
                                if (error) setError('');
                            }}
                            placeholder="Email Address"
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
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
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Submit</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ImageBackground>
        </View>
    );
};

export default Forgot;

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
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.4)',
        marginTop: 35,
        paddingBottom: 5,
    },
    Email: {
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