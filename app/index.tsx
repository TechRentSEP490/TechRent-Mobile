import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { isSignedIn } = useAuth();

  return <Redirect href={isSignedIn ? '/(app)/(tabs)/home' : '/(auth)/sign-in'} />;
}
