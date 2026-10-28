import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

export type MobileTab =
  | 'home'
  | 'marketplace'
  | 'estimate'
  | 'sell'
  | 'profile'
  | 'search'
  | 'history'
  | 'records'
  | 'guideline';

export interface FloatingBottomNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  bottomInset: number;
}

// ---------------------------------------------------------------------------
// Stroke-Based Vector Icons (Zero Emojis, 100% Vector Geometry)
// ---------------------------------------------------------------------------

const TabIconHome = ({ active }: { active: boolean }) => {
  const color = active ? '#240046' : '#64748B';
  return (
    <View style={iconStyles.box}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderBottomWidth: 7,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          width: 13,
          height: 9,
          borderWidth: 1.6,
          borderTopWidth: 0,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <View style={{ width: 4, height: 4, backgroundColor: active ? '#D4AF37' : color }} />
      </View>
    </View>
  );
};

const TabIconMarketplace = ({ active }: { active: boolean }) => {
  const color = active ? '#240046' : '#64748B';
  return (
    <View style={iconStyles.box}>
      <View
        style={{
          width: 16,
          height: 14,
          borderRadius: 2,
          borderWidth: 1.6,
          borderColor: color,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View style={{ width: 8, height: 1.6, backgroundColor: active ? '#D4AF37' : color, marginBottom: 2 }} />
        <View style={{ width: 8, height: 1.6, backgroundColor: color }} />
      </View>
    </View>
  );
};

const TabIconEstimateCenter = ({ active }: { active: boolean }) => {
  return (
    <View style={iconStyles.centerBox}>
      {/* Outer valuation gauge ring */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: active ? '#D4AF37' : '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Needle / Value target */}
        <View
          style={{
            width: 2,
            height: 8,
            backgroundColor: active ? '#D4AF37' : '#FDE047',
            borderRadius: 1,
            transform: [{ rotate: '-35deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>
    </View>
  );
};

const TabIconSell = ({ active }: { active: boolean }) => {
  const color = active ? '#240046' : '#64748B';
  return (
    <View style={iconStyles.box}>
      <View
        style={{
          width: 15,
          height: 15,
          borderRadius: 3,
          borderWidth: 1.6,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 7, height: 1.6, backgroundColor: color }} />
        <View
          style={{
            position: 'absolute',
            width: 1.6,
            height: 7,
            backgroundColor: active ? '#D4AF37' : color,
          }}
        />
      </View>
    </View>
  );
};

const TabIconProfile = ({ active }: { active: boolean }) => {
  const color = active ? '#240046' : '#64748B';
  return (
    <View style={iconStyles.box}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          borderWidth: 1.6,
          borderColor: active ? '#D4AF37' : color,
          marginBottom: 1,
        }}
      />
      <View
        style={{
          width: 14,
          height: 6,
          borderTopLeftRadius: 5,
          borderTopRightRadius: 5,
          borderWidth: 1.6,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
};

const iconStyles = StyleSheet.create({
  box: {
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ---------------------------------------------------------------------------
// Floating Bottom Navigation Component
// ---------------------------------------------------------------------------

export const FloatingBottomNav: React.FC<FloatingBottomNavProps> = ({
  activeTab,
  onSelectTab,
  bottomInset,
}) => {
  const isEstimateActive = activeTab === 'estimate';

  return (
    <View
      style={[
        styles.navWrapper,
        { bottom: Math.max(bottomInset, 12) + (Platform.OS === 'ios' ? 0 : 4) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.navBar}>
        {/* 1. Home */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onSelectTab('home')}
          activeOpacity={0.7}
        >
          <TabIconHome active={activeTab === 'home'} />
          <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>
            Home
          </Text>
        </TouchableOpacity>

        {/* 2. Buy Marketplace */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onSelectTab('marketplace')}
          activeOpacity={0.7}
        >
          <TabIconMarketplace active={activeTab === 'marketplace' || activeTab === 'search'} />
          <Text
            style={[
              styles.navLabel,
              (activeTab === 'marketplace' || activeTab === 'search') && styles.navLabelActive,
            ]}
          >
            Buy Plots
          </Text>
        </TouchableOpacity>

        {/* 3. Center Elevated Action: Valuation Estimate */}
        <View style={styles.centerItemWrapper}>
          <TouchableOpacity
            style={[styles.elevatedBtn, isEstimateActive && styles.elevatedBtnActive]}
            onPress={() => onSelectTab('estimate')}
            activeOpacity={0.85}
          >
            <TabIconEstimateCenter active={isEstimateActive} />
          </TouchableOpacity>
          <Text
            style={[
              styles.elevatedBtnLabel,
              isEstimateActive && styles.elevatedBtnLabelActive,
            ]}
          >
            Valuation
          </Text>
        </View>

        {/* 4. Sell Land Flow */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onSelectTab('sell')}
          activeOpacity={0.7}
        >
          <TabIconSell active={activeTab === 'sell'} />
          <Text style={[styles.navLabel, activeTab === 'sell' && styles.navLabelActive]}>
            Sell
          </Text>
        </TouchableOpacity>

        {/* 5. Profile & Vault */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onSelectTab('profile')}
          activeOpacity={0.7}
        >
          <TabIconProfile active={activeTab === 'profile'} />
          <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  navBar: {
    width: '100%',
    maxWidth: 440,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    // Subtle luxury ambient shadow
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: '#240046',
    fontWeight: '700',
  },
  centerItemWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  elevatedBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#240046',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 3,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 9,
  },
  elevatedBtnActive: {
    backgroundColor: '#3B0764',
    borderColor: '#FDE047',
    shadowOpacity: 0.5,
  },
  elevatedBtnLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  elevatedBtnLabelActive: {
    color: '#240046',
    fontWeight: '700',
  },
});
