import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface AppHeaderProps {
  isHealthy: boolean;
  onPressProfile?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isHealthy, onPressProfile }) => {
  return (
    <View style={styles.header}>
      {/* Client Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Right Controls: Live status & Profile Avatar */}
      <View style={styles.rightGroup}>
        <View style={[styles.statusBadge, isHealthy ? styles.statusBadgeOnline : styles.statusBadgeOffline]}>
          <View style={[styles.statusDot, isHealthy ? styles.statusDotGreen : styles.statusDotAmber]} />
          <Text style={[styles.statusText, isHealthy ? styles.statusTextGreen : styles.statusTextAmber]}>
            {isHealthy ? 'Live Data' : 'Connecting'}
          </Text>
        </View>

        {onPressProfile && (
          <TouchableOpacity
            style={styles.profileAvatar}
            onPress={onPressProfile}
            activeOpacity={0.75}
            accessibilityLabel="View Analyst Profile"
          >
            <Text style={styles.profileAvatarText}>GA</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 52,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
  },
  logoContainer: {
    justifyContent: 'center',
  },
  logo: {
    width: 125,
    height: 32,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  statusBadgeOnline: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  statusBadgeOffline: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusDotGreen: {
    backgroundColor: '#16A34A',
  },
  statusDotAmber: {
    backgroundColor: '#D97706',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusTextGreen: {
    color: '#15803D',
  },
  statusTextAmber: {
    color: '#B45309',
  },
  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#240046',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

