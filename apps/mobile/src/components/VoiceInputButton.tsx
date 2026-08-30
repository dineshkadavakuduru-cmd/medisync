import React, { useState, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  language: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onResult, language }) => {
  const [isListening, setIsListening] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(8)).current;
  const waveAnim2 = useRef(new Animated.Value(16)).current;
  const waveAnim3 = useRef(new Animated.Value(12)).current;

  const startListening = () => {
    setIsListening(true);
    setModalVisible(true);
    pulseWave();

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 300, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      setIsListening(false);
      setModalVisible(false);
      import('../services/voiceService').then(({ simulateVoiceInput }) => {
        simulateVoiceInput(language).then((transcript) => {
          onResult(transcript);
        });
      });
    }, 2000);
  };

  const pulseWave = () => {
    const animate = () => {
      if (!isListening) return;
      Animated.sequence([
        Animated.timing(waveAnim1, { toValue: 24, duration: 400, useNativeDriver: true }),
        Animated.timing(waveAnim1, { toValue: 8, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        if (isListening) animate();
      });
      Animated.sequence([
        Animated.timing(waveAnim2, { toValue: 20, duration: 500, useNativeDriver: true }),
        Animated.timing(waveAnim2, { toValue: 16, duration: 500, useNativeDriver: true }),
      ]).start(() => {
        if (isListening) animate();
      });
      Animated.sequence([
        Animated.timing(waveAnim3, { toValue: 28, duration: 600, useNativeDriver: true }),
        Animated.timing(waveAnim3, { toValue: 12, duration: 600, useNativeDriver: true }),
      ]).start(() => {
        if (isListening) animate();
      });
    };
    animate();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.micButton, isListening && styles.micButtonActive]}
        onPress={startListening}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.micInner, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.micIcon}>🎤</Text>
        </Animated.View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.listeningText}>🎤 {isListening ? 'Listening...' : 'Listening...'}</Text>
            <View style={styles.waveContainer}>
              <Animated.View style={[styles.waveBar, { height: waveAnim1 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim2 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim3 }]} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  micButtonActive: {
    backgroundColor: COLORS.severityRed,
  },
  micInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    fontSize: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.lg,
    minWidth: 200,
  },
  listeningText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    height: 40,
  },
  waveBar: {
    width: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    minHeight: 8,
  },
});