import { StyleSheet, Text, View, ImageBackground, Image, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import React, { useState } from 'react';
import { scale } from '../utilits/Scale';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Color } from '../constants/Color';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';

const SingUp = ({ navigation }) => {
    const { register, isLoading, error: authError } = useAuth();
    const { showToast } = useToast();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('customer'); // 'customer' | 'barber' | 'shop_owner'
    const [showPassword, setShowPassword] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const validate = () => {
        const errors = {};
        if (!firstName.trim()) {
            errors.firstName = 'First name is required';
        }
        if (!lastName.trim()) {
            errors.lastName = 'Last name is required';
        }
        if (!email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.email = 'Enter a valid email address';
        }
        if (!password) {
            errors.password = 'Password is required';
        } else if (password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        }
        if (password !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSignUp = async () => {
        if (!validate()) {
            return;
        }

        try {
            await register({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                phone: phone.trim() || undefined,
                password: password,
                role: role,
            });
            showToast('Account created successfully!', { type: 'success' });
            navigation.navigate('Services');
        } catch (err) {
            const message = err?.message || 'Registration failed. Please try again.';
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
                        onPress={() => navigation.navigate('Login')}>
                        <Text style={{ fontWeight: 'bold', color: 'white' }}>Login</Text>
                    </TouchableOpacity>
                </View>

                <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <View style={styles.Singup}>
                        <View>
                            <Text style={styles.Text}>SIGN UP</Text>
                        </View>

                        {authError ? (
                            <View style={styles.errorBanner}>
                                <Text style={styles.errorBannerText}>{authError}</Text>
                            </View>
                        ) : null}

                        {/* Role Selector Tabs */}
                        <View style={styles.roleContainer}>
                            <TouchableOpacity
                                style={[styles.roleTab, role === 'customer' && styles.activeRoleTab]}
                                onPress={() => setRole('customer')}>
                                <Text style={[styles.roleText, role === 'customer' && styles.activeRoleText]}>Customer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleTab, role === 'barber' && styles.activeRoleTab]}
                                onPress={() => setRole('barber')}>
                                <Text style={[styles.roleText, role === 'barber' && styles.activeRoleText]}>Barber</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleTab, role === 'shop_owner' && styles.activeRoleTab]}
                                onPress={() => setRole('shop_owner')}>
                                <Text style={[styles.roleText, role === 'shop_owner' && styles.activeRoleText]}>Owner</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.email, { flex: 1, marginRight: 8 }]}>
                                <TextInput
                                    style={styles.Email}
                                    onChangeText={(t) => {
                                        setFirstName(t);
                                        if (validationErrors.firstName) setValidationErrors((prev) => ({ ...prev, firstName: undefined }));
                                    }}
                                    placeholder="First Name"
                                    placeholderTextColor="rgba(255,255,255,0.6)"
                                    value={firstName}
                                />
                            </View>
                            <View style={[styles.email, { flex: 1, marginLeft: 8 }]}>
                                <TextInput
                                    style={styles.Email}
                                    onChangeText={(t) => {
                                        setLastName(t);
                                        if (validationErrors.lastName) setValidationErrors((prev) => ({ ...prev, lastName: undefined }));
                                    }}
                                    placeholder="Last Name"
                                    placeholderTextColor="rgba(255,255,255,0.6)"
                                    value={lastName}
                                />
                            </View>
                        </View>
                        {(validationErrors.firstName || validationErrors.lastName) && (
                            <Text style={styles.errorText}>
                                {validationErrors.firstName || validationErrors.lastName}
                            </Text>
                        )}

                        <View style={styles.email}>
                            <TextInput
                                style={styles.Email}
                                onChangeText={(t) => {
                                    setEmail(t);
                                    if (validationErrors.email) setValidationErrors((prev) => ({ ...prev, email: undefined }));
                                }}
                                placeholder="Email Address"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                            />
                        </View>
                        {validationErrors.email && (
                            <Text style={styles.errorText}>{validationErrors.email}</Text>
                        )}

                        <View style={styles.email}>
                            <TextInput
                                style={styles.Email}
                                onChangeText={setPhone}
                                placeholder="Phone Number (optional)"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                keyboardType="phone-pad"
                                value={phone}
                            />
                        </View>

                        <View style={styles.email}>
                            <TextInput
                                style={styles.Email}
                                secureTextEntry={!showPassword}
                                onChangeText={(t) => {
                                    setPassword(t);
                                    if (validationErrors.password) setValidationErrors((prev) => ({ ...prev, password: undefined }));
                                }}
                                placeholder="Password (min 8 characters)"
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
                        {validationErrors.password && (
                            <Text style={styles.errorText}>{validationErrors.password}</Text>
                        )}

                        <View style={styles.email}>
                            <TextInput
                                style={styles.Email}
                                secureTextEntry={!showPassword}
                                onChangeText={(t) => {
                                    setConfirmPassword(t);
                                    if (validationErrors.confirmPassword) setValidationErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                                }}
                                placeholder="Confirm Password"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                autoCapitalize="none"
                                value={confirmPassword}
                            />
                        </View>
                        {validationErrors.confirmPassword && (
                            <Text style={styles.errorText}>{validationErrors.confirmPassword}</Text>
                        )}

                        <TouchableOpacity
                            onPress={handleSignUp}
                            disabled={isLoading}
                            style={[styles.home, isLoading && styles.disabledButton]}>
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Sign Up</Text>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.continue}>Or sign up with</Text>
                        <View style={styles.last}>
                            <TouchableOpacity onPress={() => showToast('Google sign-up available soon', { type: 'info' })}>
                                <Image
                                    source={require('../assests/icon/Google.png')}
                                    style={styles.lastimage}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => showToast('Apple sign-up available soon', { type: 'info' })}>
                                <Image
                                    source={require('../assests/icon/Apple.png')}
                                    style={styles.lastimage}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => showToast('Facebook sign-up available soon', { type: 'info' })}>
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

export default SingUp;

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
    Singup: {
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 30,
    },
    Text: {
        color: 'white',
        fontSize: scale(30),
        fontWeight: 'bold',
        marginBottom: 10,
    },
    row: {
        flexDirection: 'row',
    },
    roleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 3,
        marginBottom: 15,
    },
    roleTab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 17,
    },
    activeRoleTab: {
        backgroundColor: Color.Primary,
    },
    roleText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '600',
    },
    activeRoleText: {
        color: 'white',
        fontWeight: 'bold',
    },
    email: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        marginTop: 12,
        paddingBottom: 4,
    },
    Email: {
        flex: 1,
        fontSize: 15,
        color: 'white',
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
        marginTop: 20,
    },
    last: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginTop: 15,
        marginBottom: 20,
    },
    lastimage: {
        height: scale(40),
        width: scale(40),
        resizeMode: 'contain',
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