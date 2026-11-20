import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { PremiumPressable } from '../components/PremiumPressable';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PremiumChoice } from '../components/PremiumChoice';
import { Premium as P } from '../theme/premium';
import { ScreenUI, withScreenStyles } from '../theme/screenUI';
import { ScreenEntrance } from '../components/ScreenEntrance';
import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LocalitySearchError } from '../components/LocalitySearchError';
import { Colors } from '../theme/colors';
import { NativeInteractiveMap } from '../components/NativeInteractiveMap';
import {
  LocalityReference,
  LocalitySuggestionDto,
  LandRecordDto,
} from '../types';

export interface LocationExplorerScreenProps {
  bottomInset: number;
  searchTabQuery: string;
  setSearchTabQuery: (q: string) => void;
  isSearchingTabGeocode: boolean;
  searchTabGeocodingSuggestions: LocalitySuggestionDto[];
  searchTabFilteredSuggestions: LocalityReference[];
  resolvingPlaceId: string | null;
  searchError: string | null;
  onRetrySearch: () => void;
  handleSelectGeocodingSuggestion: (item: LocalitySuggestionDto, fromTab: 'search') => void;
  handleSelectLocalityRef: (loc: LocalityReference) => void;
  handleSelectCoordinates: (lat: number, lng: number, localityName: string) => void;
  activeLocality: string;
  targetLat: number;
  targetLng: number;
  mapZoom: number;
  setMapZoom: React.Dispatch<React.SetStateAction<number>>;
  records: LandRecordDto[];
  pinRecordsWithin1km: number;
  currentUsageObj: { id: number; label: string };
  executeCalculation: (lat: number, lng: number, usage: number) => void;
  loadingEstimate: boolean;
  landUsage: number;
  localities: LocalityReference[];
  loadingLocalities: boolean;
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
  userDeviceLocation?: { latitude: number; longitude: number } | null;
  locationStatusMessage?: string | null;
  onLocateAddress?: (address: string) => Promise<void>;
  isLocatingAddress?: boolean;
  addressLocateStatus?: string | null;
}

export const LocationExplorerScreen: React.FC<LocationExplorerScreenProps> = ({
  bottomInset,
  searchTabQuery,
  setSearchTabQuery,
  isSearchingTabGeocode,
  searchTabGeocodingSuggestions,
  searchTabFilteredSuggestions,
  resolvingPlaceId,
  searchError,
  onRetrySearch,
  handleSelectGeocodingSuggestion,
  handleSelectLocalityRef,
  handleSelectCoordinates,
  activeLocality,
  targetLat,
  targetLng,
  mapZoom,
  setMapZoom,
  records,
  pinRecordsWithin1km,
  currentUsageObj,
  executeCalculation,
  loadingEstimate,
  landUsage,
  localities,
  loadingLocalities,
  onUseCurrentLocation,
  isLocating = false,
  userDeviceLocation = null,
  locationStatusMessage = null,
  onLocateAddress,
  isLocatingAddress = false,
  addressLocateStatus = null,
}) => {
  const { reduced } = useReducedMotion();
  const { width } = useWindowDimensions();
  const isCompact = width < 370;
  const isTablet = width >= 768;
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [isMapExpanded, setIsMapExpanded] = React.useState(false);
  const mapHeight = isCompact ? (isMapExpanded ? 460 : 340) : isTablet ? (isMapExpanded ? 640 : 480) : (isMapExpanded ? 540 : 420);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollBody, isCompact && { paddingHorizontal: 14, paddingTop: 14 }, { paddingBottom: 24 + bottomInset, flexGrow: 1 }]}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      <ScreenEntrance>
      {/* Screen Title & Subtitle */}
      <View style={styles.screenHeaderBox}>
        <Text style={styles.viewTitle}>Location Explorer</Text>
        <Text style={styles.viewSubtitle}>
          Pan, zoom, or tap the interactive map to select target coordinates.
        </Text>
      </View>

      {/* Locality Search Input */}
      <View style={styles.card}>
        <View style={[styles.searchBarBox, searchFocused && { borderColor: P.highlight }]}><Feather accessible={false} name="search" size={18} color={P.secondary} style={{ marginRight: 9 }} />
          <TextInput
            accessibilityLabel="Search property location on map"
            autoCorrect={false}
            style={[styles.searchBarInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Enter address, locality, or coords..."
            placeholderTextColor="#94A3B8"
            value={searchTabQuery}
            onChangeText={setSearchTabQuery}
            onSubmitEditing={() => onLocateAddress && onLocateAddress(searchTabQuery)}
            returnKeyType="search"
          />
          {searchTabQuery ? (
            <TouchableOpacity onPress={() => setSearchTabQuery('')} accessibilityLabel="Clear location search" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.locateBtn, (!searchTabQuery.trim() || isLocatingAddress) && styles.locateBtnDisabled]}
            onPress={() => onLocateAddress && onLocateAddress(searchTabQuery)}
            disabled={!searchTabQuery.trim() || isLocatingAddress}
            activeOpacity={0.8}
          >
            {isLocatingAddress ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.locateBtnText}>Move Pin</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Address Geocoding Status Banner */}
        {addressLocateStatus && (
          <View style={styles.addressStatusBanner}>
            <Text style={styles.addressStatusText}>{addressLocateStatus}</Text>
          </View>
        )}

        {/* Use My Current Location Action Button */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: P.border }}>
          <TouchableOpacity
            accessibilityRole="button" accessibilityLabel="Use My Current Location"
            style={{ ...ScreenUI.secondary, flexDirection: 'row', gap: 8, paddingHorizontal: 12 }}
            onPress={onUseCurrentLocation}
            disabled={isLocating}
            activeOpacity={0.75}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#240046" />
            ) : (
              <Feather accessible={false} name="crosshair" size={17} color={P.purple} />
            )}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#240046' }}>
              {isLocating ? 'Acquiring GPS Location...' : 'Use My Current Location'}
            </Text>
          </TouchableOpacity>

          {userDeviceLocation && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#047857' }}>
                GPS Active
              </Text>
            </View>
          )}
        </View>

        {/* Location Status Notice */}
        {locationStatusMessage && (
          <View style={{ marginTop: 8, padding: 8, backgroundColor: '#FEF3C7', borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
            <Text style={{ fontSize: 11, color: '#92400E', lineHeight: 15 }}>
              {locationStatusMessage}
            </Text>
          </View>
        )}

        {searchTabQuery.trim() !== '' && (
          <View style={styles.suggestionsContainer}>
            {searchError && <LocalitySearchError message={searchError} onRetry={onRetrySearch} />}
            {!searchError && searchTabQuery.trim().length < 2 && <Text style={styles.searchingText}>Type at least 2 characters to search.</Text>}
            {/* Direct Address Geocode & Pin Mover Row */}
            <TouchableOpacity
              style={styles.directLocateRow}
              onPress={() => onLocateAddress && onLocateAddress(searchTabQuery)}
              activeOpacity={0.8}
            >
              <View style={styles.directLocateIconBox}>
                <Feather name="map-pin" size={16} color="#6D6873" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.directLocateTitle} numberOfLines={1}>
                  Move Pin to "{searchTabQuery}"
                </Text>
                <Text style={styles.directLocateSub}>
                  Geocode address and center Google Map here
                </Text>
              </View>
              <Text style={styles.directLocateArrow}>→</Text>
            </TouchableOpacity>

            {isSearchingTabGeocode && searchTabGeocodingSuggestions.length === 0 && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.searchingText}>Finding matching locations…</Text>
              </View>
            )}

            {/* Google Places Geocoding Suggestions */}
            {searchTabGeocodingSuggestions.map((item) => (
              <TouchableOpacity
                key={item.placeId}
                style={styles.suggestionRow}
                onPress={() => handleSelectGeocodingSuggestion(item, 'search')}
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

            {/* Pilot Reference Locality Fallback */}
            {searchTabFilteredSuggestions
              .filter(
                (loc) =>
                  !searchTabGeocodingSuggestions.some(
                    (g) => g.mainText.toLowerCase() === loc.name.toLowerCase()
                  )
              )
              .map((loc) => (
                <TouchableOpacity
                  key={loc.name}
                  style={styles.suggestionRow}
                  onPress={() => {
                    handleSelectLocalityRef(loc);
                    setSearchTabQuery('');
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

            {!searchError && searchTabQuery.trim().length >= 2 && !isSearchingTabGeocode &&
              searchTabGeocodingSuggestions.length === 0 &&
              searchTabFilteredSuggestions.length === 0 && (
                <TouchableOpacity
                  style={styles.fallbackLocateRow}
                  onPress={() => onLocateAddress && onLocateAddress(searchTabQuery)}
                  activeOpacity={0.8}
                >
                  <Feather name="map-pin" size={17} color="#6D6873" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fallbackLocateTitle} numberOfLines={1}>
                      Place Pin at "{searchTabQuery}"
                    </Text>
                    <Text style={styles.fallbackLocateSub}>
                      Tap to geocode exact address and move Google Map pin
                    </Text>
                  </View>
                  <View style={styles.fallbackLocateBadge}>
                    <Text style={styles.fallbackLocateBadgeText}>Find Pin →</Text>
                  </View>
                </TouchableOpacity>
              )}
          </View>
        )}

        {/* Quick Locality Shortcut Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginTop: 10 }}
        >
          {localities.map((loc) => {
            const isSelected = activeLocality === loc.name;
            return (
              <PremiumChoice key={loc.name} label={`${loc.name} (${loc.recordCount})`} selected={isSelected} onPress={() => handleSelectLocalityRef(loc)} />
            );
          })}
        </ScrollView>
      </View>

      {/* Interactive Geographic Map Card */}
      <View style={[styles.mapCard, isMapExpanded && styles.mapCardExpanded]}>
        <View style={styles.mapCardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.mapCardTitle} >{activeLocality}</Text>
            <Text style={styles.mapCardSubtitle}>
              {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E • 1,000m Buffer
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button" accessibilityState={{ expanded: isMapExpanded }}
            style={[styles.expandIconBtn, isMapExpanded && styles.expandIconBtnActive]}
            onPress={() => setIsMapExpanded(!isMapExpanded)}
            activeOpacity={0.8}
            accessibilityLabel={isMapExpanded ? 'Collapse map' : 'Expand map'}
          >
            <Feather accessible={false} name={isMapExpanded ? 'minimize-2' : 'maximize-2'} size={19} color={isMapExpanded ? '#FFFFFF' : P.violet} />
          </TouchableOpacity>
        </View>

        {/* Map Viewport Canvas with enlarged height */}
        <NativeInteractiveMap
          targetLat={targetLat}
          targetLng={targetLng}
          mapZoom={mapZoom}
          activeLocality={activeLocality}
          records={records}
          userLocation={userDeviceLocation}
          height={mapHeight}
          onSelectLocation={(lat, lng) => handleSelectCoordinates(lat, lng, 'Map Pin')}
        />

        <View style={styles.mapFooterBar}>
          <Text style={styles.mapFooterHint}>Tap map to reposition pin</Text>
          <Text style={styles.mapFooterRadius}>Radius: 1,000m</Text>
        </View>
      </View>

      {/* Selected Pin Confirmation & Immediate Valuation Card */}
      <View style={styles.pinConfirmationCard}>
        <View style={styles.pinHeaderRow}>
          <View style={styles.pinIconWrap}>
            <View style={styles.pinDotInner} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinConfirmationTitle}>{activeLocality}</Text>
            <Text style={styles.pinConfirmationCoords}>
              {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E • {currentUsageObj.label}
            </Text>
          </View>
          <View
            style={[
              styles.pinCountBadge,
              pinRecordsWithin1km >= 3 ? styles.pinCountBadgeSuccess : styles.pinCountBadgeWarning,
            ]}
          >
            <Text
              style={[
                styles.pinCountBadgeText,
                pinRecordsWithin1km >= 3 ? styles.pinCountBadgeTextSuccess : styles.pinCountBadgeTextWarning,
              ]}
            >
              {pinRecordsWithin1km} Comp{pinRecordsWithin1km === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        {/* Primary CTA */}
        <PremiumPressable reducedMotion={reduced}
          style={styles.primaryFindBtn}
          onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
          disabled={loadingEstimate}
        >
          {loadingEstimate ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryFindBtnText}>Find Land Value for this Pin →</Text>
          )}
        </PremiumPressable>
      </View>
      </ScreenEntrance>
    </ScrollView>
  );
};

const styles = withScreenStyles({
  scrollView: {
    flex: 1,
  },
  scrollBody: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: 20,
    gap: 16,
  },
  screenHeaderBox: {
    marginBottom: 4,
  },
  viewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  viewSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8FC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    paddingHorizontal: 12,
    height: 46,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E1B4B',
    paddingVertical: 8,
  },
  locateBtn: {
    backgroundColor: '#240046',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateBtnDisabled: {
    backgroundColor: '#CBD5E1',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  locateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  addressStatusBanner: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  addressStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#240046',
    lineHeight: 16,
  },
  directLocateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FEFCE8',
    borderBottomWidth: 1.5,
    borderBottomColor: '#FDE68A',
    gap: 10,
  },
  directLocateIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  directLocateTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#240046',
  },
  directLocateSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  directLocateArrow: {
    fontSize: 15,
    fontWeight: '800',
    color: '#240046',
    marginLeft: 6,
  },
  fallbackLocateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FAF5FF',
    gap: 10,
  },
  fallbackLocateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#240046',
  },
  fallbackLocateSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fallbackLocateBadge: {
    backgroundColor: '#240046',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  fallbackLocateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginTop: 8,
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
  localityChip: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  localityChipActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  localityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  localityChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    overflow: 'hidden',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  mapCardExpanded: {
    borderColor: '#D4AF37',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  expandIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 2,
    elevation: 2,
  },
  expandIconBtnActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  expandIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#240046',
    lineHeight: 18,
  },
  expandIconTextActive: {
    color: '#FFFFFF',
  },
  mapCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FAF5FF',
  },
  mapCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  mapCardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  mapFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FAF8FC',
    borderTopWidth: 1,
    borderTopColor: '#FAF5FF',
  },
  mapFooterHint: {
    fontSize: 11,
    color: '#64748B',
  },
  mapFooterRadius: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  pinConfirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  pinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#240046',
  },
  pinDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D4AF37',
  },
  pinConfirmationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  pinConfirmationCoords: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  pinCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  pinCountBadgeSuccess: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FDE68A',
  },
  pinCountBadgeWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  pinCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pinCountBadgeTextSuccess: {
    color: '#B45309',
  },
  pinCountBadgeTextWarning: {
    color: '#B45309',
  },
  primaryFindBtn: {
    backgroundColor: '#240046',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryFindBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
}, {
  scrollView: ScreenUI.canvas, screenHeaderBox: { marginBottom: 0 }, viewTitle: ScreenUI.heading, viewSubtitle: { ...ScreenUI.subtitle, marginTop: 6 }, card: ScreenUI.card,
  searchBarBox: { minHeight: 54, height: undefined, borderRadius: 12, borderColor: P.border, backgroundColor: '#FDFCFE' }, searchBarInput: { minWidth: 0, fontSize: 14, color: P.text, paddingVertical: 12 }, locateBtn: { minHeight: 44, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderColor: P.violet }, locateBtnText: { fontSize: 14, lineHeight: 21 },
  addressStatusBanner: { backgroundColor: P.lavender, borderColor: P.border, borderRadius: 12, padding: 13 }, addressStatusText: { color: P.violet, fontSize: 12, lineHeight: 19 },
  localityChip: ScreenUI.chip, localityChipActive: ScreenUI.chipActive, localityChipText: ScreenUI.chipText, localityChipTextActive: ScreenUI.chipTextActive,
  mapCard: { borderRadius: 20, borderColor: P.border, shadowOpacity: .04 }, mapCardHeader: { padding: 16, borderBottomColor: P.border }, mapCardTitle: { color: P.text, fontSize: 16, lineHeight: 23 }, mapCardSubtitle: { color: P.secondary, fontSize: 12, lineHeight: 19 }, expandIconBtn: { minHeight: 44, width: 44, height: 44, borderRadius: 12, backgroundColor: P.lavender, borderColor: P.border, borderWidth: 1, elevation: 0 }, expandIconBtnActive: { backgroundColor: P.violet, borderColor: P.gold },
  mapFooterBar: { backgroundColor: P.lavender, flexWrap: 'wrap', gap: 8, padding: 13 }, mapFooterHint: { color: P.secondary }, mapFooterRadius: { color: P.violet },
  pinConfirmationCard: ScreenUI.card, pinHeaderRow: { flexWrap: 'wrap', gap: 10 }, pinConfirmationTitle: { color: P.text, fontSize: 17, lineHeight: 24 }, pinConfirmationCoords: { color: P.secondary, fontSize: 12, lineHeight: 19 }, primaryFindBtn: ScreenUI.primary, primaryFindBtnText: ScreenUI.primaryText,
});

