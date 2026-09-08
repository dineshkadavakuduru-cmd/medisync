import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '@medisync/shared';
import { getVoiceSupport, startVoiceRecognition, mapTranscriptToSymptoms, SymptomLabel, VoiceResult, VoiceFailure } from '../services/voiceService';
import { voiceVitalsText } from '../i18n/voiceVitals';

export interface VoiceInputButtonProps {
  language: string;
  catalogue: readonly SymptomLabel[];
  onResult: (result: VoiceResult) => void;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ language, catalogue, onResult }) => {
  const copy = voiceVitalsText(language);
  const [visible, setVisible] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [source, setSource] = useState<VoiceResult['source']>('manual');
  const [error, setError] = useState<VoiceFailure | null>(null);
  const session = useRef<ReturnType<typeof startVoiceRecognition> | null>(null);
  const recognizedIds = mapTranscriptToSymptoms(transcript, catalogue);
  useEffect(() => {
    session.current?.cancel();
    setListening(false);
    setTranscript('');
    setVisible(false);
    return () => session.current?.cancel();
  }, [language]);

  const close = () => { session.current?.cancel(); session.current = null; setListening(false); setVisible(false); };
  const start = () => {
    session.current?.cancel();
    setVisible(true);
    setTranscript('');
    const failure = getVoiceSupport();
    setError(failure);
    if (failure) return;
    setListening(true);
    setSource('web-speech');
    try {
      session.current = startVoiceRecognition(language, {
        onTranscript: text => setTranscript(text),
        onError: setError,
        onEnd: () => setListening(false),
      });
    } catch { setListening(false); setError('failed'); }
  };
  return <View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={copy.voice} style={styles.button} onPress={() => { setVisible(true); setError(getVoiceSupport()); }}>
      <Text style={styles.buttonText}>{copy.voice}</Text>
    </TouchableOpacity>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{copy.voice}</Text>
        <Text>{copy.privacy}</Text>
        {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{copy[error]}</Text>}
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={listening ? () => session.current?.stop() : start}>
          <Text style={styles.buttonText}>{listening ? `${copy.listening} ${copy.stop}` : copy.listen}</Text>
        </TouchableOpacity>
        <TextInput accessibilityLabel={copy.manual} placeholder={copy.manual} multiline style={styles.input} value={transcript}
          editable={!listening} onChangeText={text => { setSource('manual'); setTranscript(text); }} />
        <Text>{copy.review}</Text>
        <Text>{copy.matched}: {recognizedIds.join(', ') || '-'}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={listening || !transcript.trim()} style={[styles.button, (listening || !transcript.trim()) && styles.disabled]}
          onPress={() => { onResult({ transcript: transcript.trim(), recognizedIds, source }); close(); setTranscript(''); }}>
          <Text style={styles.buttonText}>{copy.apply}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.cancel} onPress={close}><Text>{copy.cancel}</Text></TouchableOpacity>
      </ScrollView></View>
    </Modal>
  </View>;
};
const styles = StyleSheet.create({
  button: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  buttonText: { color: COLORS.textOnPrimary, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  content: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 16, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, minHeight: 100, color: COLORS.textPrimary },
  error: { color: COLORS.emergency }, cancel: { padding: 14, alignItems: 'center' }, disabled: { opacity: 0.5 },
});
