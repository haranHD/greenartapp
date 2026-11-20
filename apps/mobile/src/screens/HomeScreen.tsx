import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import React, { useEffect, useRef } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { LocalitySearchError } from '../components/LocalitySearchError';
import { Premium } from '../theme/premium';
import { PropertyHero } from '../components/PropertyHero';
import { PremiumPressable } from '../components/PremiumPressable';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Colors } from '../theme/colors';
import { FeatureIcon } from '../components/FeatureIcon';
import {
  MobileTab,
  LocalityReference,
  LocalitySuggestionDto,
  EstimateStep,
} from '../types';

export interface HomeScreenProps {
  bottomInset: number;
  homeSearchQuery: string;
  setHomeSearchQuery: (q: string) => void;
  isSearchingHomeGeocode: boolean;
  homeGeocodingSuggestions: LocalitySuggestionDto[];
  homeFilteredSuggestions: LocalityReference[];
  resolvingPlaceId: string | null;
  searchError: string | null;
  onRetrySearch: () => void;
  handleSelectGeocodingSuggestion: (item: LocalitySuggestionDto, fromTab: 'home') => void;
  handleSelectLocalityRef: (loc: LocalityReference) => void;
  activeLocality: string;
  targetLat: number;
  targetLng: number;
  currentUsageObj: { id: number; label: string };
  executeCalculation: (lat: number, lng: number, usage: number) => void;
  setActiveTab: (tab: MobileTab) => void;
  setEstimateStep: (step: EstimateStep) => void;
  setPreviousTab: (tab: MobileTab) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  bottomInset,
  homeSearchQuery,
  setHomeSearchQuery,
  isSearchingHomeGeocode,
  homeGeocodingSuggestions,
  homeFilteredSuggestions,
  resolvingPlaceId,
  searchError,
  onRetrySearch,
  handleSelectGeocodingSuggestion,
  handleSelectLocalityRef,
  activeLocality,
  targetLat,
  targetLng,
  currentUsageObj,
  executeCalculation,
  setActiveTab,
  setEstimateStep,
  setPreviousTab,
}) => {
  const [searchFocused, setSearchFocused] = React.useState(false);
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 768;
  const isCompact = width < 370;
  const stacked = isCompact || width / fontScale < 380;
  const { reduced: reducedMotion, ready } = useReducedMotion();
  const entrance = useRef(new Animated.Value(1)).current;
  const focus = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready || reducedMotion) { entrance.setValue(1); return; }
    entrance.setValue(.96);
    const animation = Animated.timing(entrance, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [ready, reducedMotion, entrance]);
  useEffect(() => {
    focus.stopAnimation();
    if (reducedMotion) { focus.setValue(searchFocused ? 1 : 0); return; }
    const animation = Animated.timing(focus, { toValue: searchFocused ? 1 : 0, duration: 160, useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [searchFocused, reducedMotion, focus]);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Premium.background }}
      contentContainerStyle={[styles.scrollBody, { paddingHorizontal: isCompact ? 14 : 20, paddingTop: isCompact ? 14 : 20, paddingBottom: 24 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      <Animated.View style={{ gap: isCompact ? 14 : 16, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [.96, 1], outputRange: [5, 0], extrapolate: 'clamp' }) }] }}>
      <View style={[styles.heroSearchLayout, wide && styles.heroSearchLayoutWide]}>
      <PropertyHero wide={wide} compact={isCompact} />

      {/* Primary Location-Search Card */}
      <View style={[styles.primarySearchCard, isCompact && { padding: 14 }, wide && { flex: 1, justifyContent: 'center' }]}>
        <View style={styles.searchHeading}><Feather accessible={false} name="map-pin" size={19} color={Premium.purple} /><Text style={styles.searchCardTitle}>Find a property</Text></View>
        <Text style={styles.searchCardSub}>
          Choose the property location you want to research.
        </Text>

        <Animated.View style={[styles.searchBarBox, { borderColor: focus.interpolate({ inputRange: [0, 1], outputRange: [Premium.border, Premium.highlight] }) }, searchFocused && styles.searchFocus]}>
          <Feather accessible={false} name="search" size={18} color="#73677C" style={{ marginRight: 10 }} />
          <TextInput
            accessibilityLabel="Search property location"
            autoCorrect={false}
            style={[styles.searchBarInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search a locality, town or district"
            placeholderTextColor="#94A3B8"
            value={homeSearchQuery}
            onChangeText={setHomeSearchQuery}
            returnKeyType="search"
          />
          {homeSearchQuery ? (
            <TouchableOpacity onPress={() => setHomeSearchQuery('')} accessibilityLabel="Clear location search" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
              <Feather accessible={false} name="x" size={17} color={Premium.secondary} />
            </TouchableOpacity>
          ) : null}
        </Animated.View>

        {/* Autocomplete Suggestions Dropdown */}
        {homeSearchQuery.trim() !== '' && (
          <View style={styles.suggestionsContainer}>
            {searchError && <LocalitySearchError message={searchError} onRetry={onRetrySearch} />}
            {!searchError && homeSearchQuery.trim().length < 2 && <Text style={styles.searchingText}>Type at least 2 characters to search.</Text>}
            {isSearchingHomeGeocode && homeGeocodingSuggestions.length === 0 && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.searchingText}>Finding matching locations…</Text>
              </View>
            )}

            {/* Google Places Geocoding Suggestions */}
            {homeGeocodingSuggestions.map((item) => (
              <TouchableOpacity
                key={item.placeId}
                style={styles.suggestionRow}
                onPress={() => handleSelectGeocodingSuggestion(item, 'home')}
                disabled={resolvingPlaceId !== null}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionName}>{item.mainText}</Text>
                  <Text style={styles.suggestionDistrict}>{item.secondaryText}</Text>
                </View>
                {resolvingPlaceId === item.placeId ? (
                  <ActivityIndicator size="small" color={Colors.warning} />
                ) : (
                  <View style={styles.suggestionCountBadge}>
                    <Text style={styles.suggestionCountText}>Place</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {/* Existing reference-locality suggestions */}
            {homeFilteredSuggestions
              .filter(
                (loc) =>
                  !homeGeocodingSuggestions.some(
                    (g) => g.mainText.toLowerCase() === loc.name.toLowerCase()
                  )
              )
              .map((loc) => (
                <TouchableOpacity
                  key={loc.name}
                  style={styles.suggestionRow}
                  onPress={() => {
                    handleSelectLocalityRef(loc);
                    setHomeSearchQuery('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{loc.name}</Text>
                    <Text style={styles.suggestionDistrict}>{loc.district}</Text>
                  </View>
                  <View style={styles.suggestionCountBadge}>
                    <Text style={styles.suggestionCountText}>{loc.recordCount} Records</Text>
                  </View>
                </TouchableOpacity>
              ))}

            {!searchError && homeSearchQuery.trim().length >= 2 && !isSearchingHomeGeocode &&
              homeGeocodingSuggestions.length === 0 &&
              homeFilteredSuggestions.length === 0 && (
                <Text style={styles.noSuggestionsText}>No matching localities found.</Text>
              )}
          </View>
        )}

        {/* Selected Location Pill */}
        <PremiumPressable reducedMotion={reducedMotion} accessibilityLabel="Change selected property location" style={styles.selectedLocalityBar} onPress={() => setActiveTab('search')}>
          <View style={styles.selectedPin}><Feather accessible={false} name="map-pin" size={17} color={Premium.purple} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedLocalityName}>
              {activeLocality}
            </Text>
            <Text style={styles.selectedLocalityDistrict}>
              {currentUsageObj.label} land · {targetLat.toFixed(4)}, {targetLng.toFixed(4)}
            </Text>
          </View>
          <Feather accessible={false} name="chevron-right" size={17} color={Premium.purple} />
        </PremiumPressable>

        {/* Action Buttons Row */}
        <View style={[styles.searchCtaRow, stacked && styles.actionsStacked]}>
          {/* Primary CTA */}
          <PremiumPressable
            reducedMotion={reducedMotion}
            containerStyle={stacked ? styles.actionStacked : styles.primaryActionContainer}
            style={styles.primaryFindBtn}
            onPress={() => executeCalculation(targetLat, targetLng, currentUsageObj.id)}
          >
            <Text style={styles.primaryFindBtnText}>Estimate land value</Text><Feather accessible={false} name="arrow-right" size={15} color={Premium.champagne} />
          </PremiumPressable>

          {/* Secondary Action */}
          <PremiumPressable
            reducedMotion={reducedMotion}
            containerStyle={stacked ? styles.actionStacked : styles.secondaryActionContainer}
            style={styles.secondaryMapBtn}
            onPress={() => setActiveTab('search')}
          >
            <Feather accessible={false} name="map" size={16} color={Premium.violet} /><Text style={styles.secondaryMapBtnText}>Choose on map</Text>
          </PremiumPressable>
        </View>
      </View>

      </View>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Research tools</Text><Text style={styles.sectionCaption}>Choose the information you need</Text></View>
      {/* Quick Access Shortcuts */}
      <View style={[styles.quickAccessRow, (isCompact || fontScale > 1.35) && styles.toolsGrid]}>
        <PremiumPressable
          reducedMotion={reducedMotion}
          highlight
          containerStyle={isCompact ? styles.toolContainerGrid : styles.toolContainer}
          style={styles.quickAccessCard}
          onPress={() => {
            setActiveTab('estimate');
            setEstimateStep('selection');
          }}
        >
          <View style={[styles.quickIconCircle, { backgroundColor: 'transparent' }]}>
            <FeatureIcon kind="valuation" />
          </View>
          <Text numberOfLines={1} style={styles.quickAccessTitle}>Valuation</Text>
          <Text numberOfLines={1} style={styles.quickAccessSub}>Market Rates</Text>
        </PremiumPressable>

        <PremiumPressable
          reducedMotion={reducedMotion}
          highlight
          containerStyle={isCompact ? styles.toolContainerGrid : styles.toolContainer}
          style={styles.quickAccessCard}
          onPress={() => {
            setPreviousTab('home');
            setActiveTab('records');
          }}
        >
          <View style={[styles.quickIconCircle, { backgroundColor: 'transparent' }]}>
            <FeatureIcon kind="nearby" />
          </View>
          <Text numberOfLines={1} style={styles.quickAccessTitle}>Nearby</Text>
          <Text numberOfLines={1} style={styles.quickAccessSub}>Comparables</Text>
        </PremiumPressable>

        <PremiumPressable
          reducedMotion={reducedMotion}
          highlight
          containerStyle={isCompact ? styles.toolContainerGrid : styles.toolContainer}
          style={styles.quickAccessCard}
          onPress={() => {
            setPreviousTab('home');
            setActiveTab('guideline');
          }}
        >
          <View style={[styles.quickIconCircle, { backgroundColor: 'transparent' }]}>
            <FeatureIcon kind="guideline" />
          </View>
          <Text numberOfLines={1} style={styles.quickAccessTitle}>Guideline</Text>
          <Text numberOfLines={1} style={styles.quickAccessSub}>Statutory</Text>
        </PremiumPressable>
      </View>
      <View style={styles.evidenceNote}>
        <View style={styles.infoHeading}><Feather accessible={false} name="info" size={17} color={Premium.purple} /><Text style={styles.evidenceNoteTitle}>About the price information</Text></View>
        <Text style={styles.evidenceNoteBody}>Broker-reviewed ranges, registered-sale estimates and government guideline rates are clearly labelled. Where evidence is limited, we tell you.</Text>
      </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: { padding: 20, gap: 18, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  heroSearchLayout: { gap: 16 },
  heroSearchLayoutWide: { flexDirection: 'row', alignItems: 'stretch', gap: 24 },
  primarySearchCard: { minWidth: 0, backgroundColor: Premium.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Premium.border, shadowColor: Premium.violet, shadowOffset: { width: 0, height: 3 }, shadowOpacity: .045, shadowRadius: 12, elevation: 1 },
  searchHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 5 },
  searchCardTitle: { fontSize: 18, fontWeight: '700', color: Premium.text, flexShrink: 1 },
  searchCardSub: { fontSize: 13, lineHeight: 20, color: Premium.secondary, marginBottom: 16 },
  searchBarBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDFCFE', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, minHeight: 50, marginBottom: 12 },
  searchFocus: { backgroundColor: Premium.surface, shadowColor: Premium.highlight, shadowOffset: { width: 0, height: 0 }, shadowOpacity: .1, shadowRadius: 4, elevation: 1 },
  searchBarInput: { flex: 1, minWidth: 0, fontSize: 14, color: Premium.text, paddingVertical: 12 },
  suggestionsContainer: { backgroundColor: Premium.surface, borderRadius: 12, borderWidth: 1, borderColor: Premium.border, marginBottom: 12, overflow: 'hidden' },
  searchingRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchingText: { padding: 12, fontSize: 12, lineHeight: 19, color: Premium.secondary },
  suggestionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Premium.lavender, gap: 8 },
  suggestionName: { fontSize: 14, fontWeight: '600', color: Premium.text },
  suggestionDistrict: { fontSize: 12, lineHeight: 18, color: Premium.secondary, marginTop: 3 },
  suggestionCountBadge: { backgroundColor: Premium.lightGold, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  suggestionCountText: { fontSize: 10, fontWeight: '600', color: Colors.goldText },
  noSuggestionsText: { padding: 14, fontSize: 12, color: Premium.secondary, textAlign: 'center' },
  selectedLocalityBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Premium.lavender, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: Premium.border, marginBottom: 14, gap: 10 },
  selectedPin: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  selectedLocalityName: { fontSize: 14, fontWeight: '700', color: Premium.text },
  selectedLocalityDistrict: { fontSize: 12, lineHeight: 19, color: Premium.secondary, marginTop: 3 },
  searchCtaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionsStacked: { flexDirection: 'column' },
  primaryActionContainer: { flex: 1.2, minWidth: 156 },
  secondaryActionContainer: { flex: 1, minWidth: 136 },
  actionStacked: { width: '100%' },
  primaryFindBtn: { minHeight: 46, flexGrow: 1, flexDirection: 'row', gap: 5, backgroundColor: Premium.violet, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#806032' },
  primaryFindBtnText: { color: '#FFFFFF', fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  secondaryMapBtn: { minHeight: 50, flexGrow: 1, flexDirection: 'row', gap: 5, backgroundColor: Premium.surface, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDD0E8' },
  secondaryMapBtnText: { color: Premium.violet, fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  sectionHeading: { gap: 4, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Premium.text },
  sectionCaption: { fontSize: 13, lineHeight: 20, color: Premium.secondary },
  quickAccessRow: { flexDirection: 'row', gap: 10 },
  toolsStacked: { flexDirection: 'column' },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolContainer: { flex: 1, minWidth: 0 },
  toolContainerGrid: { width: '48%', flexGrow: 1, minWidth: 100 },
  quickAccessCard: { minHeight: 96, flexGrow: 1, justifyContent: 'center', backgroundColor: Premium.surface, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: Premium.border, shadowColor: Premium.violet, shadowOffset: { width: 0, height: 2 }, shadowOpacity: .035, shadowRadius: 8, elevation: 1 },
  quickIconCircle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickAccessTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: Premium.text, textAlign: 'center', maxWidth: '100%' },
  quickAccessSub: { fontSize: 11, lineHeight: 17, color: Premium.secondary, textAlign: 'center', maxWidth: '100%' },
  evidenceNote: { backgroundColor: Premium.lavender, padding: 18, borderWidth: 1, borderColor: Premium.border, borderRadius: 14, borderLeftWidth: 2, borderLeftColor: Premium.gold },
  infoHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  evidenceNoteTitle: { color: Premium.text, fontSize: 14, lineHeight: 21, fontWeight: '700', flexShrink: 1 },
  evidenceNoteBody: { color: Premium.secondary, fontSize: 13, lineHeight: 21 },
});
