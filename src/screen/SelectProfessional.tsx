import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useBooking } from '../context/BookingContext';
import { apiClient } from '../api';
import type { StaffMember, Slot } from '../api';

const DEFAULT_STAFF: StaffMember[] = [
  {
    id: 'stf-1',
    shopId: 'shop-main',
    userId: 'usr-1',
    role: 'master_barber',
    title: 'Master Barber',
    bio: 'Precision fades, hot towel razor shaves, 12 years experience.',
    commissionBps: 6000,
    status: 'active',
    ratingAverage: 4.9,
    reviewCount: 142,
    firstName: 'Marcus',
    lastName: 'Vance',
  },
  {
    id: 'stf-2',
    shopId: 'shop-main',
    userId: 'usr-2',
    role: 'senior_barber',
    title: 'Senior Stylist',
    bio: 'Beard sculpting, scissor work and contemporary textured styles.',
    commissionBps: 5500,
    status: 'active',
    ratingAverage: 4.8,
    reviewCount: 98,
    firstName: 'Derrick',
    lastName: 'Hayes',
  },
  {
    id: 'stf-3',
    shopId: 'shop-main',
    userId: 'usr-3',
    role: 'barber',
    title: 'Barber & Stylist',
    bio: 'Modern tapers, buzz cuts and traditional grooming.',
    commissionBps: 5000,
    status: 'active',
    ratingAverage: 4.7,
    reviewCount: 64,
    firstName: 'Leo',
    lastName: 'Romero',
  },
];

const GENERATED_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

const SelectProfessional = ({ navigation }: any) => {
  const { staff: selectedStaff, setStaff, slot: selectedSlot, setSlot, setDate } = useBooking();
  const [staffList, setStaffList] = useState<StaffMember[]>(DEFAULT_STAFF);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [chosenTime, setChosenTime] = useState<string | null>(null);

  // Generate 7 upcoming days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      dayName: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isoDate: d.toISOString().split('T')[0],
    };
  });

  useEffect(() => {
    setDate(dates[0].isoDate);
  }, []);

  const handleSelectStaff = (member: StaffMember) => {
    setStaff(member);
  };

  const handleSelectDate = (index: number) => {
    setSelectedDateIndex(index);
    setDate(dates[index].isoDate);
    setChosenTime(null);
    setSlot(null);
  };

  const handleSelectTime = (timeStr: string) => {
    setChosenTime(timeStr);
    const dateStr = dates[selectedDateIndex].isoDate;
    setSlot({
      startTime: `${dateStr}T${timeStr}`,
      endTime: `${dateStr}T${timeStr}`,
      staffId: selectedStaff?.id || 'any',
      staffName: selectedStaff ? `${selectedStaff.firstName} ${selectedStaff.lastName}` : 'Any Professional',
    });
  };

  const canProceed = Boolean(selectedStaff && chosenTime);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Professional</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Staff Section */}
        <Text style={styles.sectionTitle}>Choose Barber</Text>
        <View style={styles.staffList}>
          {staffList.map((member) => {
            const isSelected = selectedStaff?.id === member.id;
            return (
              <TouchableOpacity
                key={member.id}
                style={[styles.staffCard, isSelected && styles.staffCardSelected]}
                onPress={() => handleSelectStaff(member)}
                activeOpacity={0.7}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{member.firstName?.[0] || 'B'}</Text>
                </View>
                <View style={styles.staffDetails}>
                  <Text style={styles.staffName}>
                    {member.firstName} {member.lastName}
                  </Text>
                  <Text style={styles.staffRole}>{member.title || 'Barber'}</Text>
                  <Text style={styles.staffRating}>
                    ★ {member.ratingAverage.toFixed(1)} ({member.reviewCount} reviews)
                  </Text>
                </View>
                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date Section */}
        <Text style={[styles.sectionTitle, { marginTop: scale(20) }]}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
          {dates.map((d, index) => {
            const isDateSelected = selectedDateIndex === index;
            return (
              <TouchableOpacity
                key={d.isoDate}
                style={[styles.dateCard, isDateSelected && styles.dateCardSelected]}
                onPress={() => handleSelectDate(index)}>
                <Text style={[styles.dateDayName, isDateSelected && styles.dateTextSelected]}>
                  {d.dayName}
                </Text>
                <Text style={[styles.dateNumber, isDateSelected && styles.dateTextSelected]}>
                  {d.dayNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Slots Section */}
        <Text style={[styles.sectionTitle, { marginTop: scale(20) }]}>Available Time Slots</Text>
        <View style={styles.slotsGrid}>
          {GENERATED_SLOTS.map((timeStr) => {
            const isTimeSelected = chosenTime === timeStr;
            return (
              <TouchableOpacity
                key={timeStr}
                style={[styles.slotChip, isTimeSelected && styles.slotChipSelected]}
                onPress={() => handleSelectTime(timeStr)}>
                <Text style={[styles.slotText, isTimeSelected && styles.slotTextSelected]}>
                  {timeStr}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.selectionSummaryText}>
            {selectedStaff ? `${selectedStaff.firstName}` : 'Pick a barber'} •{' '}
            {chosenTime || 'Pick a time'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.continueButton, !canProceed && styles.continueButtonDisabled]}
          disabled={!canProceed}
          onPress={() => navigation.navigate('Summary')}>
          <Text style={styles.continueButtonText}>Review Summary →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SelectProfessional;

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
  scrollContent: {
    padding: scale(16),
    paddingBottom: scale(100),
  },
  sectionTitle: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: scale(12),
  },
  staffList: {
    gap: scale(10),
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: scale(14),
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  staffCardSelected: {
    borderColor: Color.Primary,
    backgroundColor: '#F0FDF4',
  },
  avatarPlaceholder: {
    height: scale(48),
    width: scale(48),
    borderRadius: scale(24),
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: scale(20),
    fontWeight: 'bold',
    color: '#475569',
  },
  staffDetails: {
    flex: 1,
    marginLeft: scale(12),
  },
  staffName: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  staffRole: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 2,
  },
  staffRating: {
    fontSize: scale(12),
    color: '#F59E0B',
    marginTop: 2,
  },
  radioCircle: {
    height: scale(20),
    width: scale(20),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: Color.Primary,
  },
  radioInner: {
    height: scale(10),
    width: scale(10),
    borderRadius: scale(5),
    backgroundColor: Color.Primary,
  },
  dateRow: {
    flexDirection: 'row',
  },
  dateCard: {
    width: scale(64),
    height: scale(72),
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(10),
  },
  dateCardSelected: {
    borderColor: Color.Primary,
    backgroundColor: Color.Primary,
  },
  dateDayName: {
    fontSize: scale(12),
    color: '#64748B',
  },
  dateNumber: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 4,
  },
  dateTextSelected: {
    color: 'white',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
  },
  slotChip: {
    width: '30%',
    paddingVertical: scale(12),
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  slotChipSelected: {
    borderColor: Color.Primary,
    backgroundColor: Color.Primary,
  },
  slotText: {
    fontSize: scale(13),
    color: '#334155',
    fontWeight: '500',
  },
  slotTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  selectionSummaryText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#475569',
  },
  continueButton: {
    backgroundColor: Color.Primary,
    paddingHorizontal: scale(20),
    paddingVertical: scale(12),
    borderRadius: 24,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    color: 'white',
    fontSize: scale(14),
    fontWeight: 'bold',
  },
});