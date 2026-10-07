import { StyleSheet, Text, View, ImageBackground, Image, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import React, { useState } from 'react';
import { scale } from '../utilits/Scale';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Color } from '../constants/Color';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';

const Login = ({ navigation }) => {
    const { login, isLoading, error: authError } = useAuth();
    const { showToast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const validate = () => {
        const errors = {};
        if (!email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.email = 'Enter a valid email address';
        }

        if (!password) {
            errors.password = 'Password is required';
        } else if (password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleLogin = async () => {
        if (!validate()) {
            return;
        }

        try {
            await login({
                email: email.trim(),
                password: password,
            });
            showToast('Logged in successfully', { type: 'success' });
            navigation.navigate('Services');
        } catch (err) {
            const message = err?.message || 'Login failed. Please check your credentials.';
            showToast(message, { type: 'error' });
        }
    };

    return (
        <View style={styles.container}>
            <ImageBackground
                source={require('../assests/icon/login.png')}
                style={styles.img}>
                <View style={styles.header}>
                    <Image
                        source={require('../assests/icon/logo.png')}
                        style={styles.Image}
                    />
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => navigation.navigate('SingUp')}>
                        <Text style={{ fontWeight: 'bold', color: 'white' }}>Sign Up</Text>
                    </TouchableOpacity>
                </View>
                <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <View style={styles.login}>
                        <View>
                            <Text style={styles.Text}>LOGIN</Text>
                        </View>

                        {authError ? (
                            <View style={styles.errorBanner}>
                                <Text style={styles.errorBannerText}>{authError}</Text>
                            </View>
                        ) : null}

                        <View style={styles.email}>
                            <TextInput
                                style={styles.Email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    if (validationErrors.email) {
                                        setValidationErrors((prev) => ({ ...prev, email: undefined }));
                                    }
                                }}
                                placeholder="Email Address"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                            />
                        </View>
                        {validationErrors.email ? (
                            <Text style={styles.errorText}>{validationErrors.email}</Text>
                        ) : null}

                        <View style={styles.email}>
                            <TextInput
                                style={styles.Email}
                                secureTextEntry={!showPassword}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    if (validationErrors.password) {
                                        setValidationErrors((prev) => ({ ...prev, password: undefined }));
                                    }
                                }}
                                placeholder="Password"
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
                        {validationErrors.password ? (
                            <Text style={styles.errorText}>{validationErrors.password}</Text>
                        ) : null}

                        <TouchableOpacity onPress={() => navigation.navigate('Forgot')}>
                            <Text style={styles.pass}>Forgot password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={isLoading}
                            style={[styles.home, isLoading && styles.disabledButton]}>
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Login</Text>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.continue}>Or continue with</Text>
                        <View style={styles.last}>
                            <TouchableOpacity onPress={() => showToast('Google sign-in available soon', { type: 'info' })}>
                                <Image
                                    source={require('../assests/icon/Google.png')}
                                    style={styles.lastimage}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => showToast('Apple sign-in available soon', { type: 'info' })}>
                                <Image
                                    source={require('../assests/icon/Apple.png')}
                                    style={styles.lastimage}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => showToast('Facebook sign-in available soon', { type: 'info' })}>
                                <Image
                                    source={require('../assests/icon/Facebook.png')}
                                    style={styles.lastimage}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAwareScrollView>
            </ImageBackground>
        </View>
    );
};

export default Login;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    img: {
        flex: 1,
        resizeMode: 'contain',
        padding: 10,
        justifyContent: 'space-between',
    },
    Image: {
        height: scale(50),
        width: scale(50),
        resizeMode: 'contain',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginTop: 20,
    },
    button: {
        height: scale(36),
        width: scale(88),
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    Text: {
        color: 'white',
        fontSize: scale(30),
        fontWeight: 'bold',
        marginBottom: 10,
    },
    email: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        marginTop: 15,
        paddingBottom: 5,
    },
    Email: {
        flex: 1,
        fontSize: 16,
        color: 'white',
    },
    pass: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 15,
        textAlign: 'right',
    },
    home: {
        height: scale(48),
        width: '100%',
        borderRadius: 24,
        backgroundColor: Color.Primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 25,
    },
    disabledButton: {
        opacity: 0.6,
    },
    continue: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 25,
    },
    last: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginTop: 20,
        marginBottom: 20,
    },
    lastimage: {
        height: scale(40),
        width: scale(40),
        resizeMode: 'contain',
    },
    login: {
        paddingHorizontal: 20,
        marginTop: 40,
    },
    errorText: {
        color: Color.red || '#EF4444',
        fontSize: 12,
        marginTop: 4,
    },
    errorBanner: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: '#EF4444',
        borderWidth: 1,
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    errorBannerText: {
        color: '#FCA5A5',
        fontSize: 13,
        textAlign: 'center',
    },
});