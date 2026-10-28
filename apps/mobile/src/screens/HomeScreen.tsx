import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';
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
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      {/* Premium Hero Surface */}
      <View style={styles.homeHeroCard}>
        <View style={styles.heroPill}>
          <Text style={styles.heroPillText}>Land Market Rate Analyst</Text>
        </View>
        <Text style={styles.homeHeroTitle}>Discover your land's value.</Text>
        <Text style={styles.homeHeroSub}>
          Explore nearby land records and understand local market rates.
        </Text>
      </View>

      {/* Primary Location-Search Card */}
      <View style={styles.primarySearchCard}>
        <Text style={styles.searchCardTitle}>Find a property</Text>
        <Text style={styles.searchCardSub}>
          Search across available localities, towns, and districts:
        </Text>

        <View style={styles.searchBarBox}>
          <View style={styles.searchIconRing}>
            <View style={styles.searchIconCircle} />
            <View style={styles.searchIconHandle} />
          </View>
          <TextInput
            style={styles.searchBarInput}
            placeholder="Enter locality (e.g. Kannampalayam, Sulur)..."
            placeholderTextColor="#94A3B8"
            value={homeSearchQuery}
            onChangeText={setHomeSearchQuery}
            returnKeyType="search"
          />
          {homeSearchQuery ? (
            <TouchableOpacity onPress={() => setHomeSearchQuery('')} style={{ padding: 6 }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Autocomplete Suggestions Dropdown */}
        {homeSearchQuery.trim() !== '' && (
          <View style={styles.suggestionsContainer}>
            {isSearchingHomeGeocode && homeGeocodingSuggestions.length === 0 && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.searchingText}>Searching locations via Google Places...</Text>
              </View>
            )}

            {/* Google Places Geocoding Suggestions */}
            {homeGeocodingSuggestions.map((item) => (
              <TouchableOpacity
                key={item.placeId}
                style={styles.suggestionRow}
                onPress={() => handleSelectGeocodingSuggestion(item, 'home')}
                disabled={resolvingPlaceId === item.placeId}
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

            {/* Pilot Reference Locality Fallback */}
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

            {!isSearchingHomeGeocode &&
              homeGeocodingSuggestions.length === 0 &&
              homeFilteredSuggestions.length === 0 && (
                <Text style={styles.noSuggestionsText}>No matching localities found.</Text>
              )}
          </View>
        )}

        {/* Selected Location Pill */}
        <View style={styles.selectedLocalityBar}>
          <View style={styles.locPinDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedLocalityName}>
              {activeLocality}{' '}
              <Text style={styles.selectedLocalityCoords}>
                ({targetLat.toFixed(4)}, {targetLng.toFixed(4)})
              </Text>
            </Text>
            <Text style={styles.selectedLocalityDistrict}>
              Coimbatore District • {currentUsageObj.label} Zoning
            </Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.searchCtaRow}>
          {/* Primary CTA */}
          <TouchableOpacity
            style={styles.primaryFindBtn}
            onPress={() => executeCalculation(targetLat, targetLng, currentUsageObj.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryFindBtnText}>Find Land Value</Text>
          </TouchableOpacity>

          {/* Secondary Action */}
          <TouchableOpacity
            style={styles.secondaryMapBtn}
            onPress={() => setActiveTab('search')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryMapBtnText}>Choose on map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feature Navigation Cards (3 destinations) */}
      <View style={styles.featureGrid}>
        {/* 1. Market Estimate */}
        <TouchableOpacity
          style={styles.featureCard}
          onPress={() => {
            setActiveTab('estimate');
            setEstimateStep('selection');
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.featureIconBadge, { backgroundColor: '#F3E8FF' }]}>
            <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#581C87' }} />
          </View>
          <Text style={styles.featureCardTitle}>Market Estimate</Text>
          <Text style={styles.featureCardDesc}>
            Statistical 1,000m radius median land valuation.
          </Text>
          <Text style={styles.featureCardLink}>Explore Valuation →</Text>
        </TouchableOpacity>

        {/* 2. Nearby Land Records */}
        <TouchableOpacity
          style={styles.featureCard}
          onPress={() => {
            setPreviousTab('home');
            setActiveTab('records');
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.featureIconBadge, { backgroundColor: '#FEF3C7' }]}>
            <View style={{ width: 12, height: 8, borderWidth: 1.5, borderColor: '#D97706', borderRadius: 2 }} />
          </View>
          <Text style={styles.featureCardTitle}>Nearby Records</Text>
          <Text style={styles.featureCardDesc}>
            PostGIS spatial proximity deeds and asking prices.
          </Text>
          <Text style={[styles.featureCardLink, { color: '#B45309' }]}>View Comparables →</Text>
        </TouchableOpacity>

        {/* 3. Government Guideline Rate */}
        <TouchableOpacity
          style={styles.featureCard}
          onPress={() => {
            setPreviousTab('home');
            setActiveTab('guideline');
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.featureIconBadge, { backgroundColor: '#DBEAFE' }]}>
            <View style={{ width: 12, height: 12, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#1D4ED8' }} />
          </View>
          <Text style={styles.featureCardTitle}>Guideline Rate</Text>
          <Text style={styles.featureCardDesc}>
            Official TNREGINET statutory stamp duty rates.
          </Text>
          <Text style={[styles.featureCardLink, { color: '#1D4ED8' }]}>Statutory Rates →</Text>
        </TouchableOpacity>
      </View>

      {/* Transparent Valuation Trust Statement */}
      <View style={styles.trustCard}>
        <View style={styles.trustHeaderRow}>
          <View style={styles.shieldIconRing}>
            <View style={styles.shieldInner} />
          </View>
          <Text style={styles.trustTitle}>Transparent Valuation</Text>
        </View>
        <Text style={styles.trustDesc}>
          Estimates depend strictly on registered comparable transactions within 1,000 metres. If
          evidence is insufficient, our statistical engine requires field verification rather than
          generating speculative pricing.
        </Text>
        <View style={styles.trustPillsRow}>
          <View style={styles.trustPillItem}>
            <Text style={styles.trustPillItemText}>1,000m Geodesic Radius</Text>
          </View>
          <View style={styles.trustPillItem}>
            <Text style={styles.trustPillItemText}>Zero Synthetic Rates</Text>
          </View>
          <View style={styles.trustPillItem}>
            <Text style={styles.trustPillItemText}>Statutory Separation</Text>
          </View>
        </View>
      </View>

      {/* Methodology & Coverage Shortcut Bar */}
      <View style={styles.homeFootLinksRow}>
        <TouchableOpacity
          style={styles.footLinkBtn}
          onPress={() => {
            setPreviousTab('home');
            setActiveTab('guideline');
          }}
        >
          <Text style={styles.footLinkText}>Valuation Methodology</Text>
        </TouchableOpacity>
        <Text style={styles.footLinkSep}>•</Text>
        <TouchableOpacity style={styles.footLinkBtn} onPress={() => setActiveTab('search')}>
          <Text style={styles.footLinkText}>Pilot Coverage Map</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    padding: 16,
    gap: 16,
  },
  homeHeroCard: {
    backgroundColor: '#240046',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4AF37',
    marginBottom: 10,
  },
  heroPillText: {
    color: '#FDE047',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  homeHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  homeHeroSub: {
    fontSize: 13,
    color: '#E9D5FF',
    lineHeight: 18,
    maxWidth: 320,
  },
  primarySearchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  searchCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  searchCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8FC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 10,
  },
  searchIconRing: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    position: 'relative',
  },
  searchIconCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#240046',
  },
  searchIconHandle: {
    width: 2,
    height: 6,
    backgroundColor: '#D4AF37',
    position: 'absolute',
    bottom: 2,
    right: 3,
    transform: [{ rotate: '-45deg' }],
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E1B4B',
    paddingVertical: 8,
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  searchingRow: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchingText: {
    fontSize: 12,
    color: '#64748B',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FAF5FF',
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  suggestionDistrict: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  suggestionCountBadge: {
    backgroundColor: '#FEFCE8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  suggestionCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  noSuggestionsText: {
    padding: 12,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  selectedLocalityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 14,
    gap: 10,
  },
  locPinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D4AF37',
  },
  selectedLocalityName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  selectedLocalityCoords: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  selectedLocalityDistrict: {
    fontSize: 11,
    color: '#581C87',
    marginTop: 2,
  },
  searchCtaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryFindBtn: {
    flex: 1.4,
    backgroundColor: '#240046',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryFindBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryMapBtn: {
    flex: 1,
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  secondaryMapBtnText: {
    color: '#240046',
    fontSize: 13,
    fontWeight: '700',
  },
  featureGrid: {
    gap: 10,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  featureIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  featureCardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  featureCardLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#240046',
  },
  trustCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  trustHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  shieldIconRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#240046',
  },
  shieldInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4AF37',
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  trustDesc: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  trustPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trustPillItem: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  trustPillItemText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#581C87',
  },
  homeFootLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  footLinkBtn: {
    paddingVertical: 4,
  },
  footLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#240046',
    textDecorationLine: 'underline',
  },
  footLinkSep: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

