import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  showTime?: boolean;
  label?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

const formatTimeDisplay = (date: Date) => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatDateTimeDisplay = (date: Date) => {
  return `${formatDisplayDate(date)} ${formatTimeDisplay(date)}`;
};

export default function DatePickerField({ value, minimumDate, onChange, showTime = true, label }: DatePickerFieldProps) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(value));
  const [tempDate, setTempDate] = useState(value);
  const [selectedHour, setSelectedHour] = useState(value.getHours());
  const [selectedMinute, setSelectedMinute] = useState(value.getMinutes());

  const normalizedMinimum = useMemo(() => minimumDate, [minimumDate]);

  useEffect(() => {
    if (!isPickerVisible) {
      setActiveMonth(startOfMonth(value));
      setTempDate(value);
      setSelectedHour(value.getHours());
      setSelectedMinute(value.getMinutes());
    }
  }, [isPickerVisible, value]);

  const calendarDays = useMemo(() => generateCalendarDays(activeMonth), [activeMonth]);

  const handleOpen = () => {
    setIsPickerVisible(true);
  };

  const handleClose = () => {
    setIsPickerVisible(false);
  };

  const handleDaySelect = (day: Date) => {
    // Create new date with selected day but keep current time
    const newDate = new Date(day);
    newDate.setHours(selectedHour, selectedMinute, 0, 0);
    setTempDate(newDate);
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    const newDate = new Date(tempDate);
    newDate.setHours(hour, selectedMinute, 0, 0);
    setTempDate(newDate);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    const newDate = new Date(tempDate);
    newDate.setHours(selectedHour, minute, 0, 0);
    setTempDate(newDate);
  };

  const handleConfirm = () => {
    const finalDate = new Date(tempDate);
    finalDate.setHours(selectedHour, selectedMinute, 0, 0);

    // Validate minimum date
    if (finalDate.getTime() < normalizedMinimum.getTime()) {
      // Snap to minimum
      onChange(normalizedMinimum);
    } else {
      onChange(finalDate);
    }
    setIsPickerVisible(false);
  };

  const goToPreviousMonth = () => {
    setActiveMonth((current) => addMonths(current, -1));
  };

  const goToNextMonth = () => {
    setActiveMonth((current) => addMonths(current, 1));
  };

  const canNavigatePrev = useMemo(() => {
    const previousMonthEnd = endOfMonth(addMonths(activeMonth, -1));
    return previousMonthEnd.getTime() >= clampToStartOfDay(normalizedMinimum).getTime();
  }, [activeMonth, normalizedMinimum]);

  const isDayDisabled = (day: Date) => {
    const dayStart = clampToStartOfDay(day);
    const minStart = clampToStartOfDay(normalizedMinimum);
    return dayStart.getTime() < minStart.getTime();
  };

  const isTimeDisabled = (hour: number, minute: number) => {
    if (!showTime) return false;

    const testDate = new Date(tempDate);
    testDate.setHours(hour, minute, 0, 0);
    return testDate.getTime() < normalizedMinimum.getTime();
  };

  const displayValue = showTime ? formatDateTimeDisplay(value) : formatDisplayDate(value);

  return (
    <>
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={label || "Chọn ngày và giờ"}
        activeOpacity={0.85}
      >
        <Ionicons name="calendar-outline" size={18} color="#6f6f6f" style={styles.datePickerIcon} />
        <Text style={styles.datePickerValue} numberOfLines={1}>{displayValue}</Text>
      </TouchableOpacity>

      {isPickerVisible && (
        <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
          <View style={styles.datePickerModalBackdrop}>
            <View style={[styles.datePickerModalContent, showTime && localStyles.modalContentExtended]}>
              {/* Calendar Section */}
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
                  {activeMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
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
                  const isDisabled = isDayDisabled(day);
                  const isSelected = isSameDay(day, tempDate);

                  return (
                    <TouchableOpacity
                      key={day.getTime()}
                      style={[
                        styles.datePickerDayButton,
                        !isFromCurrentMonth && styles.datePickerDayOutside,
                        isSelected && styles.datePickerDaySelected,
                        isDisabled && styles.datePickerDayDisabled,
                      ]}
                      onPress={() => handleDaySelect(day)}
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

              {/* Time Picker Section */}
              {showTime && (
                <View style={localStyles.timeSection}>
                  <Text style={localStyles.timeSectionTitle}>Chọn giờ</Text>
                  <View style={localStyles.timePickerRow}>
                    {/* Hour Picker */}
                    <View style={localStyles.timeColumn}>
                      <Text style={localStyles.timeColumnLabel}>Giờ</Text>
                      <ScrollView
                        style={localStyles.timeScroll}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={localStyles.timeScrollContent}
                      >
                        {HOURS.map((hour) => {
                          const isDisabled = isTimeDisabled(hour, selectedMinute);
                          const isSelected = selectedHour === hour;
                          return (
                            <TouchableOpacity
                              key={hour}
                              style={[
                                localStyles.timeItem,
                                isSelected && localStyles.timeItemSelected,
                                isDisabled && localStyles.timeItemDisabled,
                              ]}
                              onPress={() => !isDisabled && handleHourSelect(hour)}
                              disabled={isDisabled}
                            >
                              <Text
                                style={[
                                  localStyles.timeItemText,
                                  isSelected && localStyles.timeItemTextSelected,
                                  isDisabled && localStyles.timeItemTextDisabled,
                                ]}
                              >
                                {hour.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Separator */}
                    <Text style={localStyles.timeSeparator}>:</Text>

                    {/* Minute Picker */}
                    <View style={localStyles.timeColumn}>
                      <Text style={localStyles.timeColumnLabel}>Phút</Text>
                      <ScrollView
                        style={localStyles.timeScroll}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={localStyles.timeScrollContent}
                      >
                        {MINUTES.map((minute) => {
                          const isDisabled = isTimeDisabled(selectedHour, minute);
                          const isSelected = selectedMinute === minute;
                          return (
                            <TouchableOpacity
                              key={minute}
                              style={[
                                localStyles.timeItem,
                                isSelected && localStyles.timeItemSelected,
                                isDisabled && localStyles.timeItemDisabled,
                              ]}
                              onPress={() => !isDisabled && handleMinuteSelect(minute)}
                              disabled={isDisabled}
                            >
                              <Text
                                style={[
                                  localStyles.timeItemText,
                                  isSelected && localStyles.timeItemTextSelected,
                                  isDisabled && localStyles.timeItemTextDisabled,
                                ]}
                              >
                                {minute.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Selected DateTime Preview */}
                  <View style={localStyles.previewRow}>
                    <Ionicons name="time-outline" size={16} color="#047857" />
                    <Text style={localStyles.previewText}>
                      {formatDateTimeDisplay(tempDate)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={localStyles.actionRow}>
                <TouchableOpacity
                  style={[localStyles.actionButton, localStyles.cancelButton]}
                  onPress={handleClose}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={localStyles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[localStyles.actionButton, localStyles.confirmButton]}
                  onPress={handleConfirm}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm"
                >
                  <Text style={localStyles.confirmButtonText}>Xác nhận</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const localStyles = StyleSheet.create({
  modalContentExtended: {
    maxHeight: '90%',
  },
  timeSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  timeSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
    textAlign: 'center',
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 8,
  },
  timeColumn: {
    alignItems: 'center',
    width: 70,
  },
  timeColumnLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  timeScroll: {
    height: 120,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    width: '100%',
  },
  timeScrollContent: {
    paddingVertical: 8,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
    marginTop: 32,
  },
  timeItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 2,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  timeItemSelected: {
    backgroundColor: '#111111',
  },
  timeItemDisabled: {
    opacity: 0.3,
  },
  timeItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  timeItemTextSelected: {
    color: '#ffffff',
  },
  timeItemTextDisabled: {
    color: '#9ca3af',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  confirmButton: {
    backgroundColor: '#111111',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
