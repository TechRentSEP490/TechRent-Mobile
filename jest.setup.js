// Define __DEV__ for react-native
global.__DEV__ = true;

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
    usePathname: () => '/',
    Link: 'Link',
}));

// Mock expo modules
jest.mock('expo-constants', () => ({
    default: {
        expoConfig: { extra: {} },
    },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
    return {
        default: {
            call: () => { },
            createAnimatedComponent: (component) => component,
            Value: jest.fn(),
            event: jest.fn(),
            add: jest.fn(),
            eq: jest.fn(),
            set: jest.fn(),
            cond: jest.fn(),
            interpolate: jest.fn(),
            View: 'Animated.View',
            ScrollView: 'Animated.ScrollView',
            Text: 'Animated.Text',
            Image: 'Animated.Image',
        },
        useSharedValue: jest.fn(() => ({ value: 0 })),
        useAnimatedStyle: jest.fn(() => ({})),
        withTiming: jest.fn((v) => v),
        withSpring: jest.fn((v) => v),
        withDecay: jest.fn((v) => v),
        withDelay: jest.fn((_, v) => v),
        withSequence: jest.fn(),
        withRepeat: jest.fn(),
        cancelAnimation: jest.fn(),
        runOnJS: jest.fn((fn) => fn),
        runOnUI: jest.fn((fn) => fn),
        Easing: {
            linear: jest.fn(),
            ease: jest.fn(),
            bounce: jest.fn(),
            elastic: jest.fn(),
        },
    };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
    const View = require('react-native').View;
    return {
        Swipeable: View,
        DrawerLayout: View,
        State: {},
        ScrollView: View,
        Slider: View,
        Switch: View,
        TextInput: View,
        ToolbarAndroid: View,
        ViewPagerAndroid: View,
        DrawerLayoutAndroid: View,
        WebView: View,
        NativeViewGestureHandler: View,
        TapGestureHandler: View,
        FlingGestureHandler: View,
        ForceTouchGestureHandler: View,
        LongPressGestureHandler: View,
        PanGestureHandler: View,
        PinchGestureHandler: View,
        RotationGestureHandler: View,
        RawButton: View,
        BaseButton: View,
        RectButton: View,
        BorderlessButton: View,
        FlatList: View,
        gestureHandlerRootHOC: jest.fn(),
        Directions: {},
        GestureHandlerRootView: View,
    };
});

// Set environment variables for tests
process.env.EXPO_PUBLIC_API_URL = 'http://test-api.example.com';

// Global fetch mock (will be overridden by MSW in API contract tests)
global.fetch = jest.fn();

// Suppress console warnings in tests
global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};
