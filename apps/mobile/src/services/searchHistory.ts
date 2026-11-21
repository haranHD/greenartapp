import { Platform } from 'react-native';

export interface SearchHistoryItem {
  id: string;
  name: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  timestamp: number;
}

const STORAGE_KEY = 'greenart_search_history_v1';
const MAX_HISTORY_ITEMS = 8;

const DEFAULT_INITIAL_HISTORY: SearchHistoryItem[] = [
  { id: 'h-1', name: 'Kannampalayam', district: 'Coimbatore, Tamil Nadu', latitude: 11.0012, longitude: 77.0874, timestamp: Date.now() - 3600000 },
  { id: 'h-2', name: 'Palani', district: 'Dindigul, Tamil Nadu', latitude: 10.4500, longitude: 77.5161, timestamp: Date.now() - 7200000 },
  { id: 'h-3', name: 'Sulur', district: 'Coimbatore, Tamil Nadu', latitude: 11.0260, longitude: 77.1280, timestamp: Date.now() - 10800000 },
  { id: 'h-4', name: 'Saravanampatti', district: 'Coimbatore, Tamil Nadu', latitude: 11.0820, longitude: 76.9985, timestamp: Date.now() - 14400000 },
];

class SearchHistoryService {
  private history: SearchHistoryItem[] = [];
  private listeners: Array<(items: SearchHistoryItem[]) => void> = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.history = parsed;
            return;
          }
        }
      } catch {
        // Fallback to defaults
      }
    }
    this.history = [...DEFAULT_INITIAL_HISTORY];
  }

  private saveHistory() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      } catch {
        // Ignore write failures
      }
    }
    this.notify();
  }

  private notify() {
    const copy = [...this.history];
    this.listeners.forEach((l) => l(copy));
  }

  public subscribe(listener: (items: SearchHistoryItem[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.history]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getHistory(): SearchHistoryItem[] {
    return [...this.history];
  }

  public addSearch(item: {
    name: string;
    district?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
  }) {
    if (!item.name || !item.name.trim()) return;
    const cleanName = item.name.trim();

    // Deduplicate existing entry by name
    const existingIndex = this.history.findIndex(
      (h) => h.name.toLowerCase() === cleanName.toLowerCase()
    );

    const newItem: SearchHistoryItem = {
      id: existingIndex >= 0 ? this.history[existingIndex].id : `h-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      district: item.district || '',
      latitude: item.latitude,
      longitude: item.longitude,
      placeId: item.placeId,
      timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      this.history.splice(existingIndex, 1);
    }

    this.history.unshift(newItem);

    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveHistory();
  }

  public removeSearch(id: string) {
    this.history = this.history.filter((h) => h.id !== id);
    this.saveHistory();
  }

  public clearHistory() {
    this.history = [];
    this.saveHistory();
  }
}

export const searchHistoryService = new SearchHistoryService();
