declare module '@react-native-community/datetimepicker' {
  import type { ComponentType } from 'react';
  import type { ViewProps } from 'react-native';

  type AndroidDisplay = 'default' | 'spinner' | 'clock' | 'calendar';
  type IOSDisplay = 'default' | 'spinner' | 'compact' | 'inline';

  type DatePickerMode = 'date' | 'time' | 'datetime';

  type NativeEvent = {
    timestamp: number;
  };

  export type DateTimePickerEvent =
    | {
        type: 'set';
        nativeEvent: NativeEvent;
      }
    | {
        type: 'dismissed';
        nativeEvent: NativeEvent;
      };

  export type DateTimePickerProps = ViewProps & {
    value: Date;
    mode?: DatePickerMode;
    display?: AndroidDisplay | IOSDisplay;
    minimumDate?: Date;
    maximumDate?: Date;
    minuteInterval?: number;
    locale?: string;
    timeZoneOffsetInMinutes?: number;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    testID?: string;
    textColor?: string;
  };

  const DateTimePicker: ComponentType<DateTimePickerProps>;

  export default DateTimePicker;
}
