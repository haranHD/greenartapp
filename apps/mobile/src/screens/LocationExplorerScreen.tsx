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
  const [isMapExpanded, setIsMapExpanded] = React.useState(false);
  const mapHeight = isMapExpanded ? 540 : 420;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + bottomInset, flexGrow: 1 }]}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      {/* Screen Title & Subtitle */}
      <View style={styles.screenHeaderBox}>
        <Text style={styles.viewTitle}>Location Explorer</Text>
        <Text style={styles.viewSubtitle}>
          Pan, zoom, or tap the interactive map to select target coordinates.
        </Text>
      </View>

      {/* Locality Search Input */}
      <View style={styles.card}>
        <View style={styles.searchBarBox}>
          <TextInput
            style={styles.searchBarInput}
            placeholder="Enter address, locality, or coords..."
            placeholderTextColor="#94A3B8"
            value={searchTabQuery}
            onChangeText={setSearchTabQuery}
            onSubmitEditing={() => onLocateAddress && onLocateAddress(searchTabQuery)}
            returnKeyType="search"
          />
          {searchTabQuery ? (
            <TouchableOpacity onPress={() => setSearchTabQuery('')} style={{ padding: 6 }}>
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
              <Text style={styles.locateBtnText}>Move Pin 📍</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FAF5FF',
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E9D5FF',
              gap: 6,
            }}
            onPress={onUseCurrentLocation}
            disabled={isLocating}
            activeOpacity={0.75}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#240046" />
            ) : (
              <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#240046', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D4AF37' }} />
              </View>
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
            {/* Direct Address Geocode & Pin Mover Row */}
            <TouchableOpacity
              style={styles.directLocateRow}
              onPress={() => onLocateAddress && onLocateAddress(searchTabQuery)}
              activeOpacity={0.8}
            >
              <View style={styles.directLocateIconBox}>
                <Text style={{ fontSize: 13 }}>📍</Text>
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
                <Text style={styles.searchingText}>Searching locations via Google Places...</Text>
              </View>
            )}

            {/* Google Places Geocoding Suggestions */}
            {searchTabGeocodingSuggestions.map((item) => (
              <TouchableOpacity
                key={item.placeId}
                style={styles.suggestionRow}
                onPress={() => handleSelectGeocodingSuggestion(item, 'search')}
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

            {!isSearchingTabGeocode &&
              searchTabGeocodingSuggestions.length === 0 &&
              searchTabFilteredSuggestions.length === 0 && (
                <TouchableOpacity
                  style={styles.fallbackLocateRow}
                  onPress={() => onLocateAddress && onLocateAddress(searchTabQuery)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 15 }}>📍</Text>
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
              <TouchableOpacity
                key={loc.name}
                style={[styles.localityChip, isSelected && styles.localityChipActive]}
                onPress={() => handleSelectLocalityRef(loc)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.localityChipText,
                    isSelected && styles.localityChipTextActive,
                  ]}
                >
                  {loc.name} ({loc.recordCount})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Interactive Geographic Map Card */}
      <View style={[styles.mapCard, isMapExpanded && styles.mapCardExpanded]}>
        <View style={styles.mapCardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.mapCardTitle}>{activeLocality}</Text>
              <View style={styles.liveMapBadge}>
                <View style={styles.liveMapDot} />
                <Text style={styles.liveMapText}>Live Map</Text>
              </View>
            </View>
            <Text style={styles.mapCardSubtitle}>
              {targetLat.toFixed(4)}° N, {targetLng.toFixed(4)}° E • 1,000m Buffer
            </Text>
          </View>

          <View style={styles.mapZoomControls}>
            <TouchableOpacity
              style={[styles.expandBtn, isMapExpanded && styles.expandBtnActive]}
              onPress={() => setIsMapExpanded(!isMapExpanded)}
              activeOpacity={0.8}
            >
              <Text style={[styles.expandBtnText, isMapExpanded && styles.expandBtnTextActive]}>
                {isMapExpanded ? 'Collapse ✕' : 'Bigger Map ⛶'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setMapZoom((z) => Math.min(z + 1, 18))}
              activeOpacity={0.7}
            >
              <Text style={styles.zoomBtnText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setMapZoom((z) => Math.max(z - 1, 12))}
              activeOpacity={0.7}
            >
              <Text style={styles.zoomBtnText}>−</Text>
            </TouchableOpacity>
          </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13 }}>👆</Text>
            <Text style={styles.mapFooterCoord}>Single-touch to pan & tap anywhere to move pin</Text>
          </View>
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
        <TouchableOpacity
          style={styles.primaryFindBtn}
          onPress={() => executeCalculation(targetLat, targetLng, landUsage)}
          disabled={loadingEstimate}
          activeOpacity={0.85}
        >
          {loadingEstimate ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryFindBtnText}>Find Land Value for this Pin →</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollBody: {
    padding: 16,
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
    borderRadius: 16,
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
    fontSize: 11,
    fontWeight: '700',
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
    borderRadius: 20,
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
    borderRadius: 16,
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
  liveMapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
  },
  liveMapDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveMapText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#065F46',
  },
  expandBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBtnActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  expandBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#240046',
  },
  expandBtnTextActive: {
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
  mapZoomControls: {
    flexDirection: 'row',
    gap: 6,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  zoomBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#240046',
    lineHeight: 18,
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
  mapFooterCoord: {
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
    borderRadius: 16,
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
    borderRadius: 14,
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
});

