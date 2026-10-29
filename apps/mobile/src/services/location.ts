// Consent-Based Device Location Service for Greenart Properties
// Foreground-only location access for nearby land search.
// Zero background tracking. Zero permanent device location storage.

import { Platform } from 'react-native';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied' | 'unavailable';

export interface DeviceLocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface LocationServiceResponse {
  success: boolean;
  location?: DeviceLocationResult;
  status: LocationPermissionStatus;
  errorMessage?: string;
}

class LocationService {
  private lastKnownLocation: DeviceLocationResult | null = null;
  private permissionStatus: LocationPermissionStatus = 'undetermined';

  public getPermissionStatus(): LocationPermissionStatus {
    return this.permissionStatus;
  }

  public getLastKnownLocation(): DeviceLocationResult | null {
    return this.lastKnownLocation;
  }

  /**
   * Requests foreground location permission from the device.
   * Explains the intent before triggering browser or OS permission dialogues.
   */
  public async requestForegroundLocation(): Promise<LocationServiceResponse> {
    // 1. Check if Geolocation API is available in runtime
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.permissionStatus = 'unavailable';
      return {
        success: false,
        status: 'unavailable',
        errorMessage: 'GPS geolocation is not supported on this device/runtime.',
      };
    }

    return new Promise((resolve) => {
      const options: PositionOptions = {
        enableHighAccuracy: false, // Low battery consumption; adequate for 1km land search
        timeout: 12000,           // 12s timeout
        maximumAge: 120000,       // 2 minutes cached position
      };

      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Validate coordinates within valid WGS 84 bounds
          if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
            resolve({
              success: false,
              status: 'unavailable',
              errorMessage: 'Invalid GPS coordinates returned by device.',
            });
            return;
          }

          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            resolve({
              success: false,
              status: 'unavailable',
              errorMessage: 'Out-of-range GPS coordinates received.',
            });
            return;
          }

          const result: DeviceLocationResult = {
            latitude: Math.round(lat * 100000) / 100000,
            longitude: Math.round(lng * 100000) / 100000,
            accuracy: position.coords.accuracy ? Math.round(position.coords.accuracy) : undefined,
            timestamp: position.timestamp || Date.now(),
          };

          this.permissionStatus = 'granted';
          this.lastKnownLocation = result;

          resolve({
            success: true,
            location: result,
            status: 'granted',
          });
        },
        (error: GeolocationPositionError) => {
          let status: LocationPermissionStatus = 'unavailable';
          let errorMessage = 'Unable to determine device location.';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              status = 'denied';
              errorMessage = 'Location permission was declined. Manual map search remains fully available.';
              break;
            case error.POSITION_UNAVAILABLE:
              status = 'unavailable';
              errorMessage = 'GPS signal is currently unavailable. Ensure device location is enabled.';
              break;
            case error.TIMEOUT:
              status = 'unavailable';
              errorMessage = 'Location request timed out. Please retry or select your locality manually.';
              break;
          }

          this.permissionStatus = status;

          resolve({
            success: false,
            status,
            errorMessage,
          });
        },
        options
      );
    });
  }

  public clearSessionLocation(): void {
    this.lastKnownLocation = null;
  }
}

export const locationService = new LocationService();

