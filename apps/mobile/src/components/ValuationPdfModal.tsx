import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { ValuationPdfReport } from '@greenart/shared-types';
import { calculateMarketRateBuffer } from '../utils/formatters';

export interface ValuationPdfModalProps {
  report: ValuationPdfReport | null;
  visible: boolean;
  onClose: () => void;
}

export const ValuationPdfModal: React.FC<ValuationPdfModalProps> = ({
  report,
  visible,
  onClose,
}) => {
  if (!report) return null;

  const handlePrintOrDownload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    } else {
      alert(`Valuation Report ${report.reportId} ready for export. Printing is available in web mode.`);
    }
  };

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
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Control Bar */}
        <View style={styles.topControlBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.barTitle}>Institutional Valuation Report</Text>
          <TouchableOpacity onPress={handlePrintOrDownload} style={styles.printBtn} activeOpacity={0.8}>
            <Text style={styles.printBtnText}>⬇ Download / Print PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Printable Certificate Sheet */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.paperSheet}>
            {/* Certificate Header */}
            <View style={styles.certHeader}>
              <View>
                <Text style={styles.certBrand}>GREENART PROPERTIES</Text>
                <Text style={styles.certBrandSub}>Land Market Rate Analyst — Spatial Intelligence Bureau</Text>
              </View>
              <View style={styles.certMetaCol}>
                <Text style={styles.certReportId}>REPORT ID: {report.reportId}</Text>
                <Text style={styles.certDate}>
                  Generated: {new Date(report.generatedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.certDivider} />

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.sheetHeading}>LAND PARCEL ALGORITHMIC VALUATION CERTIFICATE</Text>
              <Text style={styles.sheetSubheading}>
                Prepared in accordance with PostGIS spatial evidence heuristics and Tamil Nadu registration deed observations.
              </Text>
            </View>

            {/* Target Property Subject Profile */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionBlockHeader}>1. SUBJECT LAND IDENTIFIERS</Text>
              <View style={styles.gridTable}>
                <View style={styles.gridRow}>
                  <Text style={styles.gridKey}>Locality & Taluk:</Text>
                  <Text style={styles.gridVal}>{report.targetLocation.locality}, {report.targetLocation.district}</Text>
                </View>
                <View style={styles.gridRow}>
                  <Text style={styles.gridKey}>State Jurisdiction:</Text>
                  <Text style={styles.gridVal}>{report.targetLocation.state}, India</Text>
                </View>
                <View style={styles.gridRow}>
                  <Text style={styles.gridKey}>Geographic Coordinates:</Text>
                  <Text style={styles.gridVal}>
                    {report.targetLocation.coordinates.latitude.toFixed(5)}° N, {report.targetLocation.coordinates.longitude.toFixed(5)}° E
                  </Text>
                </View>
                <View style={styles.gridRow}>
                  <Text style={styles.gridKey}>Zoning & Usage:</Text>
                  <Text style={styles.gridVal}>{report.landUsage}</Text>
                </View>
                <View style={styles.gridRow}>
                  <Text style={styles.gridKey}>Subject Land Extent:</Text>
                  <Text style={styles.gridValBold}>
                    {report.extentCent} Cents ({report.extentSqFt.toLocaleString()} Sq.Ft • {(report.extentSqFt / 2400).toFixed(2)} Grounds • {(report.extentCent / 100).toFixed(3)} Acres)
                  </Text>
                </View>
              </View>
            </View>

            {/* Valuation Brackets */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionBlockHeader}>2. ALGORITHMIC MARKET RATE ESTIMATE</Text>

              {(() => {
                const marketBuffer = calculateMarketRateBuffer(report.valuationRange.medianRatePerCent, 'Cent');
                return (
                  <View style={styles.marketBufferPdfRow}>
                    <View style={styles.marketBufferPill}>
                      <Text style={styles.marketBufferPdfLabel}>ESTIMATED RANGE</Text>
                      <Text style={styles.marketBufferPdfVal}>{marketBuffer.rangeFormatted} / Cent</Text>
                    </View>
                    <View style={[styles.marketBufferPill, styles.marketBufferPillHighlight]}>
                      <Text style={styles.marketBufferPdfLabel}>APPROXIMATE MARKET RATE</Text>
                      <Text style={[styles.marketBufferPdfVal, { color: '#7E22CE' }]}>
                        {marketBuffer.approximateFormatted} / Cent
                      </Text>
                    </View>
                  </View>
                );
              })()}

              <View style={styles.bracketBox}>
                <View style={styles.bracketCol}>
                  <Text style={styles.bracketLabel}>CONSERVATIVE (25TH %ILE)</Text>
                  <Text style={styles.bracketVal}>{formatCurrency(report.valuationRange.p25RatePerCent)} / Cent</Text>
                  <Text style={styles.bracketSub}>≈ {formatCurrency(Math.round((report.valuationRange.p25RatePerCent / 435.6) * 2400))} / Ground</Text>
                </View>
                <View style={[styles.bracketCol, styles.bracketColPrimary]}>
                  <Text style={styles.bracketLabelPrimary}>MEDIAN MARKET RATE</Text>
                  <Text style={styles.bracketValPrimary}>{formatCurrency(report.valuationRange.medianRatePerCent)} / Cent</Text>
                  <Text style={styles.bracketSubPrimary}>
                    ≈ ₹{Math.round(report.valuationRange.medianRatePerCent / 435.6).toLocaleString('en-IN')} / sq.ft • {formatCurrency(Math.round((report.valuationRange.medianRatePerCent / 435.6) * 2400))} / Ground
                  </Text>
                </View>
                <View style={styles.bracketCol}>
                  <Text style={styles.bracketLabel}>OPTIMISTIC (75TH %ILE)</Text>
                  <Text style={styles.bracketVal}>{formatCurrency(report.valuationRange.p75RatePerCent)} / Cent</Text>
                  <Text style={styles.bracketSub}>≈ {formatCurrency(Math.round((report.valuationRange.p75RatePerCent / 435.6) * 2400))} / Ground</Text>
                </View>
              </View>

              {/* Total Estimated Plot Value */}
              <View style={styles.totalValueBanner}>
                <Text style={styles.totalValueLabel}>TOTAL ESTIMATED PLOT CONSIDERATION (MEDIAN)</Text>
                <Text style={styles.totalValueAmount}>
                  {formatCurrency(report.valuationRange.totalEstimatedMedianValue)}
                </Text>
                <Text style={styles.totalValueSpan}>
                  Expected Value Range: {formatCurrency(report.valuationRange.p25RatePerCent * report.extentCent)} — {formatCurrency(report.valuationRange.p75RatePerCent * report.extentCent)}
                </Text>
              </View>
            </View>

            {/* Guideline Comparison Benchmark */}
            {report.guidelineReference && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionBlockHeader}>3. GOVERNMENT STATUTORY GUIDELINE REFERENCE</Text>
                <View style={styles.guidelineCard}>
                  <View style={styles.guidelineRow}>
                    <Text style={styles.guidelineTitle}>TN Registration Department Guideline Rate:</Text>
                    <Text style={styles.guidelineAmount}>
                      {formatCurrency(report.guidelineReference.guidelineRatePerCent)} / Cent
                    </Text>
                  </View>
                  <Text style={styles.guidelineNote}>
                    Note: Statutory guideline rates represent minimum values for stamp duty and registration fees in Tamil Nadu. Government guideline values are strictly segregated from algorithmic market transaction medians.
                  </Text>
                </View>
              </View>
            )}

            {/* Comparable Deed Evidence */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionBlockHeader}>
                4. RECENT COMPARABLE EVIDENCE BASIS ({report.comparablesCount} RECORDS ANALYZED)
              </Text>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableTh, { flex: 1.5 }]}>Locality</Text>
                  <Text style={[styles.tableTh, { flex: 1 }]}>Distance</Text>
                  <Text style={[styles.tableTh, { flex: 1.5 }]}>Deed Date</Text>
                  <Text style={[styles.tableTh, { flex: 1.2 }]}>Source Category</Text>
                  <Text style={[styles.tableTh, { flex: 1.5, textAlign: 'right' }]}>Rate / Cent</Text>
                </View>
                {report.comparables.map((c, i) => (
                  <View key={i} style={styles.tableDataRow}>
                    <Text style={[styles.tableTd, { flex: 1.5 }]}>{c.locality}</Text>
                    <Text style={[styles.tableTd, { flex: 1 }]}>{c.distanceMeters}m</Text>
                    <Text style={[styles.tableTd, { flex: 1.5 }]}>{c.observationDate.split('T')[0]}</Text>
                    <Text style={[styles.tableTd, { flex: 1.2 }]}>{c.sourceCategory}</Text>
                    <Text style={[styles.tableTdBold, { flex: 1.5, textAlign: 'right' }]}>
                      {formatCurrency(c.ratePerCent)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Confidence & Outlier Rules */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionBlockHeader}>5. STATISTICAL CONFIDENCE & BOUNDS</Text>
              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceLabel}>Confidence Rating:</Text>
                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceText}>{report.confidence.toUpperCase()}</Text>
                </View>
                <Text style={styles.confidenceDesc}>
                  Evaluated with 36-month freshness filter, 1000m spatial search radius, and interquartile outlier suppression.
                </Text>
              </View>
            </View>

            {/* Cryptographic Hash Seal */}
            <View style={styles.hashBlock}>
              <Text style={styles.hashLabel}>CRYPTOGRAPHIC SHA-256 AUDIT SEAL</Text>
              <Text style={styles.hashVal}>{report.verificationHash}</Text>
            </View>

            {/* Statutory Disclaimer */}
            <View style={styles.disclaimerBlock}>
              <Text style={styles.disclaimerHeading}>STATUTORY LIMITATIONS & LEGAL DISCLAIMER</Text>
              <Text style={styles.disclaimerBody}>{report.disclaimer}</Text>
            </View>

            {/* Certificate Footer */}
            <View style={styles.certFooter}>
              <Text style={styles.certFooterText}>
                Greenart Properties Private Limited • Chennai & Coimbatore, Tamil Nadu
              </Text>
              <Text style={styles.certFooterText}>
                Confidential Document • For Indicative Valuation & Strategic Underwriting Only
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#334155',
  },
  topControlBar: {
    height: 54,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  closeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  barTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  printBtn: {
    backgroundColor: '#240046',
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  printBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  paperSheet: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 24,
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  certBrand: {
    fontSize: 18,
    fontWeight: '900',
    color: '#240046',
    letterSpacing: 1,
  },
  certBrandSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  certMetaCol: {
    alignItems: 'flex-end',
  },
  certReportId: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  certDate: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  certDivider: {
    height: 2,
    backgroundColor: '#D4AF37',
    marginVertical: 14,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  sheetSubheading: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 500,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionBlockHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#240046',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: '#E9D5FF',
    paddingBottom: 4,
    marginBottom: 8,
  },
  gridTable: {
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  gridKey: {
    fontSize: 11,
    color: '#64748B',
  },
  gridVal: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '600',
  },
  gridValBold: {
    fontSize: 11,
    color: '#240046',
    fontWeight: '800',
  },
  marketBufferPdfRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  marketBufferPill: {
    flex: 1,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginRight: 6,
  },
  marketBufferPillHighlight: {
    backgroundColor: '#F3E8FF',
    borderColor: '#D8B4FE',
    marginRight: 0,
    marginLeft: 6,
  },
  marketBufferPdfLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#6B21A8',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  marketBufferPdfVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#240046',
  },
  bracketBox: {
    flexDirection: 'row',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  bracketCol: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  bracketColPrimary: {
    backgroundColor: '#FAF5FF',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#D4AF37',
  },
  bracketLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  bracketVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  bracketLabelPrimary: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 4,
  },
  bracketValPrimary: {
    fontSize: 14,
    fontWeight: '900',
    color: '#240046',
  },
  bracketSubPrimary: {
    fontSize: 9,
    color: '#B45309',
    marginTop: 2,
  },
  bracketSub: {
    fontSize: 8.5,
    color: '#64748B',
    marginTop: 2,
  },
  totalValueBanner: {
    backgroundColor: '#240046',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  totalValueLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D4AF37',
    letterSpacing: 0.5,
  },
  totalValueAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 2,
  },
  totalValueSpan: {
    fontSize: 10,
    color: '#FDE047',
  },
  guidelineCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    padding: 10,
  },
  guidelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  guidelineTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  guidelineAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
  },
  guidelineNote: {
    fontSize: 9,
    lineHeight: 13,
    color: '#3B82F6',
  },
  table: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableTh: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tableTd: {
    fontSize: 10,
    color: '#334155',
  },
  tableTdBold: {
    fontSize: 10,
    fontWeight: '700',
    color: '#240046',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  confidencePill: {
    backgroundColor: '#FEFCE8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  confidenceDesc: {
    fontSize: 10,
    color: '#64748B',
    flex: 1,
  },
  hashBlock: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 14,
  },
  hashLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hashVal: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#334155',
  },
  disclaimerBlock: {
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
    paddingLeft: 8,
    marginBottom: 16,
  },
  disclaimerHeading: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  disclaimerBody: {
    fontSize: 9,
    lineHeight: 13,
    color: '#64748B',
  },
  certFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    alignItems: 'center',
    gap: 2,
  },
  certFooterText: {
    fontSize: 9,
    color: '#94A3B8',
  },
});

