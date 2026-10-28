import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MarketplaceListing, LandUsageType } from '@greenart/shared-types';

export interface PlotMarketplaceViewProps {
  listings: MarketplaceListing[];
  onSelectListing: (listing: MarketplaceListing) => void;
  onRequestValuationForLocality?: (locality: string) => void;
}

export const PlotMarketplaceView: React.FC<PlotMarketplaceViewProps> = ({
  listings,
  onSelectListing,
  onRequestValuationForLocality,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All');
  const [selectedUsage, setSelectedUsage] = useState<string>('All');
  const [maxBudget, setMaxBudget] = useState<number | null>(null);

  const districts = ['All', 'Coimbatore', 'Erode', 'Tiruppur', 'Chennai', 'Salem'];
  const usageTypes = ['All', LandUsageType.Residential, LandUsageType.Commercial, LandUsageType.AgriculturalWet];

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      // District filter
      if (selectedDistrict !== 'All' && item.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
        return false;
      }
      // Usage filter
      if (selectedUsage !== 'All' && item.landUsage !== selectedUsage) {
        return false;
      }
      // Budget filter
      if (maxBudget !== null && item.askingPriceTotal > maxBudget) {
        return false;
      }
      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesLocality = item.locality.toLowerCase().includes(q);
        const matchesDistrict = item.district.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesTaluk = item.taluk ? item.taluk.toLowerCase().includes(q) : false;
        if (!matchesLocality && !matchesDistrict && !matchesTitle && !matchesTaluk) {
          return false;
        }
      }
      return true;
    });
  }, [listings, searchQuery, selectedDistrict, selectedUsage, maxBudget]);

  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Top Marketplace Header */}
      <View style={styles.headerBox}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>BUY DIRECT MARKETPLACE</Text>
        </View>
        <Text style={styles.headerTitle}>Tamil Nadu Land Listings</Text>
        <Text style={styles.headerSubtitle}>
          Direct from verified individual owners and licensed promoters. Every listing displays registered guideline references alongside seller asking prices.
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search locality, taluk, or district (e.g. Saravanampatti)..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* District Filter Pills */}
      <View style={styles.filterSection}>
        <Text style={styles.filterSectionLabel}>DISTRICT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          {districts.map((d) => {
            const active = selectedDistrict === d;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setSelectedDistrict(d)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Land Usage Filter Pills */}
      <View style={styles.filterSection}>
        <Text style={styles.filterSectionLabel}>LAND USAGE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          {usageTypes.map((u) => {
            const active = selectedUsage === u;
            return (
              <TouchableOpacity
                key={u}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setSelectedUsage(u)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {u === 'AgriculturalWet' ? 'Agricultural' : u}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Results Header */}
      <View style={styles.resultsCountRow}>
        <Text style={styles.resultsCountText}>
          Showing <Text style={styles.resultsCountHighlight}>{filteredListings.length}</Text> available plot{filteredListings.length === 1 ? '' : 's'}
        </Text>
        <Text style={styles.resultsSubtext}>100% verified legal boundaries</Text>
      </View>

      {/* Listing Cards */}
      {filteredListings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No matching land listings</Text>
          <Text style={styles.emptyMessage}>
            No active listings found for the selected filters. Try broadening your district or land usage search.
          </Text>
          <TouchableOpacity
            style={styles.resetFilterBtn}
            onPress={() => {
              setSearchQuery('');
              setSelectedDistrict('All');
              setSelectedUsage('All');
              setMaxBudget(null);
            }}
          >
            <Text style={styles.resetFilterBtnText}>Reset All Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filteredListings.map((listing) => {
          return (
            <TouchableOpacity
              key={listing.id}
              style={styles.card}
              onPress={() => onSelectListing(listing)}
              activeOpacity={0.88}
            >
              {/* Plot Image Container */}
              <View style={styles.cardImageContainer}>
                <Image
                  source={{ uri: listing.images[0] || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800' }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <View style={styles.cardBadgeOverlay}>
                  <View style={styles.usageTag}>
                    <Text style={styles.usageTagText}>{listing.landUsage}</Text>
                  </View>
                  {listing.isSellerVerified && (
                    <View style={styles.verifiedTag}>
                      <Text style={styles.verifiedTagText}>✓ Verified Title</Text>
                    </View>
                  )}
                </View>
                <View style={styles.extentBadge}>
                  <Text style={styles.extentBadgeText}>
                    {listing.extentCent} Cents ({listing.extentSqFt.toLocaleString()} sq.ft)
                  </Text>
                </View>
              </View>

              {/* Card Details */}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {listing.title}
                </Text>

                <View style={styles.locationRow}>
                  <View style={styles.locationDot} />
                  <Text style={styles.locationText}>
                    {listing.locality}, {listing.district} {listing.taluk ? `(${listing.taluk} Taluk)` : ''}
                  </Text>
                </View>

                {/* Price Display */}
                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>SELLER ASKING PRICE</Text>
                    <Text style={styles.priceTotal}>{formatCurrency(listing.askingPriceTotal)}</Text>
                  </View>
                  <View style={styles.rateCol}>
                    <Text style={styles.rateLabel}>RATE / CENT</Text>
                    <Text style={styles.rateValue}>{formatCurrency(listing.askingRatePerCent)}</Text>
                  </View>
                </View>

                {/* Benchmark Comparison Strip */}
                <View style={styles.benchmarkStrip}>
                  <View style={styles.benchmarkItem}>
                    <Text style={styles.benchmarkLabel}>Govt Guideline Rate</Text>
                    <Text style={styles.benchmarkVal}>
                      {listing.guidelineRatePerCent ? `${formatCurrency(listing.guidelineRatePerCent)}/cent` : 'Pending'}
                    </Text>
                  </View>
                  <View style={styles.benchmarkDivider} />
                  <View style={styles.benchmarkItem}>
                    <Text style={styles.benchmarkLabel}>Market Median Estimate</Text>
                    <Text style={styles.benchmarkValHighlight}>
                      {listing.estimatedMarketMedianPerCent ? `${formatCurrency(listing.estimatedMarketMedianPerCent)}/cent` : 'Analyzing'}
                    </Text>
                  </View>
                </View>

                {/* Document Verification Checklist */}
                <View style={styles.docRow}>
                  {listing.documentsAvailable.map((doc, idx) => (
                    <View key={idx} style={[styles.docChip, doc.verified ? styles.docChipVerified : styles.docChipUnverified]}>
                      <Text style={[styles.docChipText, doc.verified ? styles.docChipTextVerified : styles.docChipTextUnverified]}>
                        {doc.verified ? '✓' : '•'} {doc.type.replace('Registered', '').replace('Certificate', ' EC')}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* View Details Action Button */}
                <View style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>View Plot Details & Legal Audit →</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  headerBox: {
    marginBottom: 16,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  filterSection: {
    marginBottom: 10,
  },
  filterSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pillRow: {
    gap: 8,
  },
  pill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resultsCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  resultsCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  resultsCountHighlight: {
    color: '#240046',
    fontWeight: '800',
  },
  resultsSubtext: {
    fontSize: 11,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageContainer: {
    height: 170,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardBadgeOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageTag: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  usageTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  verifiedTag: {
    backgroundColor: '#240046',
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  extentBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(36, 0, 70, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
  },
  extentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4AF37',
    marginRight: 6,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  priceLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  priceTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#240046',
  },
  rateCol: {
    alignItems: 'flex-end',
  },
  rateLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  rateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  benchmarkStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FAF5FF',
    paddingVertical: 8,
    marginBottom: 10,
  },
  benchmarkItem: {
    flex: 1,
  },
  benchmarkDivider: {
    width: 1,
    backgroundColor: '#E9D5FF',
    marginHorizontal: 8,
  },
  benchmarkLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  benchmarkVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  benchmarkValHighlight: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  docRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  docChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docChipVerified: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  docChipUnverified: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  docChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  docChipTextVerified: {
    color: '#B45309',
  },
  docChipTextUnverified: {
    color: '#64748B',
  },
  actionBtn: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#240046',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyMessage: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetFilterBtn: {
    backgroundColor: '#240046',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  resetFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

