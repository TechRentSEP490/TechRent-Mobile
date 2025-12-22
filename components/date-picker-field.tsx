import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import styles from '@/style/cart.styles';
import {
  addMonths,
  clampToStartOfDay,
  endOfMonth,
  formatDisplayDate,
  generateCalendarDays,
  isSameDay,
  startOfMonth,
  WEEKDAY_LABELS,
} from '@/utils/dates';

export type DatePickerFieldProps = {
  value: Date;
  minimumDate: Date;
  onChange: (date: Date) => void;
};

export default function DatePickerField({ value, minimumDate, onChange }: DatePickerFieldProps) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(value));
  const normalizedMinimum = useMemo(() => clampToStartOfDay(minimumDate), [minimumDate]);

  useEffect(() => {
    if (!isPickerVisible) {
      setActiveMonth(startOfMonth(value));
    }
  }, [isPickerVisible, value]);

  const calendarDays = useMemo(() => generateCalendarDays(activeMonth), [activeMonth]);

  const handleOpen = () => {
    setIsPickerVisible(true);
  };

  const handleClose = () => {
    setIsPickerVisible(false);
  };

  const handleSelect = (nextDate: Date) => {
    const normalized = clampToStartOfDay(nextDate);
    if (normalized.getTime() < normalizedMinimum.getTime()) {
      return;
    }

    setIsPickerVisible(false);
    onChange(normalized);
  };

  const goToPreviousMonth = () => {
    setActiveMonth((current) => addMonths(current, -1));
  };

  const goToNextMonth = () => {
    setActiveMonth((current) => addMonths(current, 1));
  };

  const canNavigatePrev = useMemo(() => {
    const previousMonthEnd = endOfMonth(addMonths(activeMonth, -1));
    return previousMonthEnd.getTime() >= normalizedMinimum.getTime();
  }, [activeMonth, normalizedMinimum]);

  return (
    <>
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel="Select date"
        activeOpacity={0.85}
      >
        <Ionicons name="calendar-outline" size={18} color="#6f6f6f" style={styles.datePickerIcon} />
        <Text style={styles.datePickerValue}>{formatDisplayDate(value)}</Text>
      </TouchableOpacity>

      {isPickerVisible && (
        <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
          <View style={styles.datePickerModalBackdrop}>
            <View style={styles.datePickerModalContent}>
              <View style={styles.datePickerModalHeader}>
                <TouchableOpacity
                  style={[styles.datePickerModalButton, !canNavigatePrev && styles.datePickerModalButtonDisabled]}
                  onPress={canNavigatePrev ? goToPreviousMonth : undefined}
                  disabled={!canNavigatePrev}
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={!canNavigatePrev ? '#c5c5c5' : '#111111'}
                  />
                </TouchableOpacity>
                <Text style={styles.datePickerModalTitle}>
                  {activeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity
                  style={styles.datePickerModalButton}
                  onPress={goToNextMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                >
                  <Ionicons name="chevron-forward" size={20} color="#111111" />
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerWeekdaysRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.datePickerWeekday}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.datePickerDaysGrid}>
                {calendarDays.map((day) => {
                  const isFromCurrentMonth = day.getMonth() === activeMonth.getMonth();
                  const isDisabled = day.getTime() < normalizedMinimum.getTime();
                  const isSelected = isSameDay(day, value);

                  return (
                    <TouchableOpacity
                      key={day.getTime()}
                      style={[
                        styles.datePickerDayButton,
                        !isFromCurrentMonth && styles.datePickerDayOutside,
                        isSelected && styles.datePickerDaySelected,
                        isDisabled && styles.datePickerDayDisabled,
                      ]}
                      onPress={() => handleSelect(day)}
                      disabled={isDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={formatDisplayDate(day)}
                    >
                      <Text
                        style={[
                          styles.datePickerDayText,
                          !isFromCurrentMonth && styles.datePickerDayTextOutside,
                          isSelected && styles.datePickerDayTextSelected,
                          isDisabled && styles.datePickerDayTextDisabled,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.datePickerCloseButton}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
              >
                <Text style={styles.datePickerCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
