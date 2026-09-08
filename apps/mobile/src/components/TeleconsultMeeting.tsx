import React, { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isMeetingLink } from '../services/teleconsultClient';
import type { TeleconsultRole } from '../services/teleconsultClient';
import { teleconsultCopy as copy } from '../i18n/translations/teleconsult';

export interface TeleconsultMeetingProps {
  meetingLink: string;
  role: TeleconsultRole;
  onJoined: () => void;
  onLeft: () => void;
}

// Metro uses the .web implementation in browsers; this fallback works in Expo Go.
export function TeleconsultMeeting({ meetingLink }: TeleconsultMeetingProps) {
  const [error, setError] = useState('');
  const open = async () => {
    try {
      setError('');
      if (!isMeetingLink(meetingLink)) throw new Error('Invalid meeting link');
      await Linking.openURL(meetingLink);
    } catch (e) { setError(e instanceof Error ? e.message : copy.error); }
  };
  return <View style={styles.container}>
    <Text>{copy.native}</Text>
    <TouchableOpacity accessibilityRole="link" onPress={open} style={styles.button}>
      <Text style={styles.label}>{copy.external}</Text>
    </TouchableOpacity>
    <Text selectable>{meetingLink}</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12 }, button: { backgroundColor: '#156B62', padding: 16, borderRadius: 10 },
  label: { color: '#fff', fontWeight: '600' }, error: { color: '#B42318' },
});
