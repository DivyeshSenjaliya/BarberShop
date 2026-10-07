import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'Bookings',
    question: 'How do I cancel or reschedule an appointment?',
    answer:
      'You can cancel or reschedule any upcoming appointment up to 2 hours before the scheduled start time directly from the "My Appointments" tab. Refunds are automatically credited back to your original payment method or wallet balance.',
  },
  {
    id: 'faq-2',
    category: 'Bookings',
    question: 'What happens if I am late to my appointment?',
    answer:
      'We provide a 10-minute grace period. If you arrive later than 10 minutes, the shop may need to adjust or shorten the service to accommodate subsequent scheduled appointments.',
  },
  {
    id: 'faq-3',
    category: 'Loyalty',
    question: 'How do loyalty reward points work?',
    answer:
      'You earn points on every completed appointment based on your tier (Bronze: 1x, Silver: 1.25x, Gold: 1.5x, Platinum: 2x). 100 loyalty points can be redeemed for $1.00 off at checkout.',
  },
  {
    id: 'faq-4',
    category: 'Payments',
    question: 'Which payment methods are accepted?',
    answer:
      'We accept Visa, Mastercard, American Express, Apple Pay, Google Pay, in-app Digital Wallet balance, and cash payment at venue.',
  },
  {
    id: 'faq-5',
    category: 'Payments',
    question: 'How do refunds work for cancelled bookings?',
    answer:
      'Approved refunds for online payments are processed within 3-5 business days. Wallet credits are refunded instantly.',
  },
];

const SupportFaq = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'terms'>('faq');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');

  // Contact Form State
  const [subject, setSubject] = useState<string>('');
  const [inquiryType, setInquiryType] = useState<string>('Appointment');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredFaq = FAQ_DATA.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmitTicket = () => {
    if (!subject.trim() || !message.trim()) {
      showToast('Please fill out both subject and message', { type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      showToast('Support ticket #SUP-4921 created. We will reply within 24h.', {
        type: 'success',
      });
      setSubject('');
      setMessage('');
    }, 500);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'faq' && styles.tabItemActive]}
          onPress={() => setActiveTab('faq')}>
          <Text style={[styles.tabText, activeTab === 'faq' && styles.tabTextActive]}>FAQ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'contact' && styles.tabItemActive]}
          onPress={() => setActiveTab('contact')}>
          <Text style={[styles.tabText, activeTab === 'contact' && styles.tabTextActive]}>Contact Us</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'terms' && styles.tabItemActive]}
          onPress={() => setActiveTab('terms')}>
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>Terms & Policy</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* FAQ TAB */}
        {activeTab === 'faq' && (
          <View>
            <View style={styles.searchBox}>
              <Image source={require('../assests/icon/search.png')} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search frequent questions..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.faqList}>
              {filteredFaq.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                return (
                  <TouchableOpacity
                    key={faq.id}
                    style={styles.faqCard}
                    activeOpacity={0.8}
                    onPress={() => setExpandedFaqId(isExpanded ? null : faq.id)}>
                    <View style={styles.faqTop}>
                      <Text style={styles.faqQuestion}>{faq.question}</Text>
                      <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                    {isExpanded && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* CONTACT US TAB */}
        {activeTab === 'contact' && (
          <View style={styles.contactCard}>
            <Text style={styles.formTitle}>Submit a Support Inquiry</Text>
            <Text style={styles.formSubtitle}>Our customer concierge team is here 7 days a week.</Text>

            <Text style={styles.fieldLabel}>Topic</Text>
            <View style={styles.topicRow}>
              {['Appointment', 'Billing', 'App Bug', 'General'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.topicChip, inquiryType === cat && styles.topicChipActive]}
                  onPress={() => setInquiryType(cat)}>
                  <Text style={[styles.topicChipText, inquiryType === cat && styles.topicChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Question about my invoice BS-884129"
              placeholderTextColor="#94A3B8"
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={styles.fieldLabel}>Detailed Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your issue or question in detail..."
              placeholderTextColor="#94A3B8"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitTicket}
              disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Ticket</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* TERMS & PRIVACY TAB */}
        {activeTab === 'terms' && (
          <View style={styles.termsCard}>
            <Text style={styles.policyHeading}>1. Terms of Service</Text>
            <Text style={styles.policyText}>
              By using the BarberShop platform, you agree to respect appointment schedules, adhere to individual
              barber shop cancellation guidelines, and treat salon personnel with courtesy and dignity.
            </Text>

            <Text style={styles.policyHeading}>2. Cancellation & No-Show Policy</Text>
            <Text style={styles.policyText}>
              Cancellations made at least 2 hours before the scheduled appointment are eligible for a 100% full
              refund. No-shows or cancellations within the 2-hour window may incur a cancellation fee.
            </Text>

            <Text style={styles.policyHeading}>3. Privacy & Data Protection</Text>
            <Text style={styles.policyText}>
              We never sell or distribute your personal data, phone number, or payment details. Passwords are
              hashed using scrypt cryptographic key derivation, and tokens are encrypted over TLS.
            </Text>

            <Text style={styles.policyHeading}>4. Wallet & Loyalty Points</Text>
            <Text style={styles.policyText}>
              Loyalty points are non-transferable and can only be redeemed toward appointments booked directly
              through the BarberShop platform.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SupportFaq;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scale(45),
    paddingBottom: scale(15),
    paddingHorizontal: scale(20),
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    height: scale(16),
    width: scale(16),
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerRightPlaceholder: {
    width: scale(24),
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: scale(12),
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Color.Primary,
  },
  tabText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: Color.Primary,
    fontWeight: 'bold',
  },
  content: {
    padding: scale(16),
    paddingBottom: scale(40),
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: scale(12),
    height: scale(44),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: scale(14),
  },
  searchIcon: {
    height: scale(16),
    width: scale(16),
    resizeMode: 'contain',
    tintColor: '#64748B',
  },
  searchInput: {
    flex: 1,
    marginLeft: scale(8),
    fontSize: scale(14),
    color: '#0F172A',
  },
  faqList: {
    gap: scale(10),
  },
  faqCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: scale(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  faqTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
    paddingRight: scale(10),
  },
  expandChevron: {
    fontSize: scale(12),
    color: '#64748B',
  },
  faqAnswer: {
    fontSize: scale(13),
    color: '#475569',
    marginTop: scale(10),
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: scale(8),
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: scale(20),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTitle: {
    fontSize: scale(17),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  formSubtitle: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: 4,
    marginBottom: scale(16),
  },
  fieldLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  topicRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  topicChip: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  topicChipActive: {
    backgroundColor: Color.Primary,
  },
  topicChipText: {
    fontSize: scale(12),
    color: '#475569',
    fontWeight: '500',
  },
  topicChipTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    fontSize: scale(13),
    color: '#0F172A',
  },
  textArea: {
    minHeight: scale(90),
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: Color.Primary,
    marginTop: scale(20),
    height: scale(46),
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: scale(14),
    fontWeight: 'bold',
  },
  termsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: scale(20),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  policyHeading: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: scale(14),
    marginBottom: 4,
  },
  policyText: {
    fontSize: scale(13),
    color: '#475569',
    lineHeight: 19,
  },
});
