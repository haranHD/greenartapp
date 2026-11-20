import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AppText as Text } from './AppText';
import { mobileApi, PublicResearchEvidence } from '../services/api';
import { Premium as P } from '../theme/premium';
import { ScreenUI } from '../theme/screenUI';
export function ResearchEvidenceModal({ researchId, onClose }: { researchId: string; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 370;
  const isTablet = width >= 768;
  const [data, setData] = useState<PublicResearchEvidence | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); let active = true;
    mobileApi.getResearchEvidence(researchId, controller.signal).then(v => { if (active) setData(v); }).catch(() => { if (active) setError('Supporting evidence could not be loaded.'); });
    return () => { active = false; controller.abort(); };
  }, [researchId]);
  const openSource = (url: string) => { if (!/^https:\/\//i.test(url)) return;
    void Linking.openURL(url).catch(() => setError('Could not open this source.')); };
  return <Modal transparent animationType="slide" visible onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: 'rgba(22,0,38,.5)', justifyContent: isTablet ? 'center' : 'flex-end', alignItems: isTablet ? 'center' : undefined, padding: isTablet ? 24 : 0 }}>
      <View style={{ backgroundColor: P.background, maxHeight: '90%', maxWidth: isTablet ? 640 : undefined, width: isTablet ? '100%' : undefined, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: isTablet ? 22 : 0, borderBottomRightRadius: isTablet ? 22 : 0, padding: isCompact ? 16 : 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: '700', flex: 1 }}>Asking-price evidence</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close research evidence" onPress={onClose} style={ScreenUI.secondary}><Text style={ScreenUI.secondaryText}>Close</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
          {!data && !error && <ActivityIndicator color={P.violet} />}
          {!!error && <Text accessibilityRole="alert">{error}</Text>}
          {data && <><Text style={{ fontSize: 14, lineHeight: 22 }}>{data.locality}, {data.district} · {data.reviewStatus}</Text>
            <Text style={{ fontSize: 13, lineHeight: 20 }}>These are advertised asking observations checked for evidence consistency. They are not completed-sale records or independent confirmation of market value.</Text>
            <Text>Source provenance: client-authorized references.</Text>
            {data.evidence.length === 0 && <Text>No publishable source observations are available.</Text>}
            {data.evidence.map(e => <View key={e.id} style={ScreenUI.card}>
              <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '700' }}>{e.sourceName}</Text>
              <Text>{e.sourceCategory} · {e.verificationStatus}</Text>
              <Text>{e.locationDescription} · {e.distanceMeters == null ? 'Distance unknown' : `${Math.round(e.distanceMeters)} m from selected pin`}</Text>
              <Text>Advertised ₹{e.originalAskingPrice.toLocaleString('en-IN')} · {e.originalArea} {e.originalAreaUnit}</Text>
              <Text>₹{e.ratePerCent?.toLocaleString('en-IN')} / cent · ₹{e.ratePerSqFt?.toLocaleString('en-IN')} / sq ft</Text>
              <Text>Observed {e.observationDate ? new Date(e.observationDate).toLocaleDateString('en-IN') : 'Unknown'} · Retrieved {new Date(e.retrievedAtUtc).toLocaleDateString('en-IN')}</Text>
              <TouchableOpacity accessibilityRole="link" onPress={() => openSource(e.sourceUrl)} style={ScreenUI.secondary}><Text style={ScreenUI.secondaryText}>Open original source</Text></TouchableOpacity>
            </View>)}
            <Text>{data.limitations.join(' ')}</Text>
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
