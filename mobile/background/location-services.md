# Lokasyon Servisleri

Mobil uygulamalarda lokasyon servisleri, kullanıcı deneyimini zenginleştiren önemli bir bileşendir. Bu bölümde, lokasyon tabanlı servislerin güvenli, verimli ve kullanıcı dostu şekilde nasıl implement edileceği ele alınacaktır.

## Temel Kavramlar

### 1. Lokasyon Hassasiyeti
- **High Accuracy**: GPS + Network + Passive
- **Balanced Power**: Network + Passive
- **Low Power**: Passive only
- **No Power**: Cache'd locations only

### 2. Lokasyon Türleri
- **GPS**: En hassas, en yüksek batarya tüketimi
- **Network**: Orta hassasiyet, orta batarya tüketimi
- **Passive**: Düşük hassasiyet, düşük batarya tüketimi

## Platform-Spesifik Implementasyonlar

### iOS Core Location

#### Temel Kurulum
```swift
import CoreLocation

class LocationManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private var locationUpdateHandler: ((CLLocation) -> Void)?
    
    override init() {
        super.init()
        setupLocationManager()
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10.0 // 10 metre minimum hareket
    }
    
    func requestLocationPermission() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            // Kullanıcıyı ayarlara yönlendir
            showLocationSettingsAlert()
        case .authorizedWhenInUse:
            // İzin var, lokasyon isteyebiliriz
            break
        case .authorizedAlways:
            // Tam izin var
            break
        @unknown default:
            break
        }
    }
    
    func startLocationUpdates(updateHandler: @escaping (CLLocation) -> Void) {
        self.locationUpdateHandler = updateHandler
        locationManager.startUpdatingLocation()
    }
    
    func stopLocationUpdates() {
        locationManager.stopUpdatingLocation()
        locationUpdateHandler = nil
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        locationUpdateHandler?(location)
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \\(error.localizedDescription)")
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            startLocationUpdates { location in
                // Handle location update
            }
        case .denied, .restricted:
            showLocationSettingsAlert()
        default:
            break
        }
    }
}
```

#### Background Location
```swift
// Background location için gerekli konfigürasyon
class BackgroundLocationManager: NSObject {
    private let locationManager = CLLocationManager()
    
    func enableBackgroundLocationUpdates() {
        // Info.plist'e eklenmiş olmalı:
        // <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
        // <key>UIBackgroundModes</key>
        // <array><string>location</string></array>
        
        locationManager.requestAlwaysAuthorization()
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
    }
    
    func optimizeForBattery() {
        // Batarya optimizasyonu için
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.distanceFilter = 100.0
        locationManager.pausesLocationUpdatesAutomatically = true
    }
}
```

### Android Location Services

#### Modern Location API
```kotlin
import com.google.android.gms.location.*
import com.google.android.gms.tasks.Task

class LocationService {
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private lateinit var locationCallback: LocationCallback
    
    fun initializeLocationServices(context: Context) {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        createLocationRequest()
        createLocationCallback()
    }
    
    private fun createLocationRequest() {
        locationRequest = LocationRequest.create().apply {
            interval = 10000 // 10 saniye
            fastestInterval = 5000 // 5 saniye
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
            smallestDisplacement = 10f // 10 metre
        }
    }
    
    private fun createLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    handleLocationUpdate(location)
                }
            }
            
            override fun onLocationAvailability(locationAvailability: LocationAvailability) {
                if (!locationAvailability.isLocationAvailable) {
                    // Lokasyon servisi mevcut değil
                    handleLocationUnavailable()
                }
            }
        }
    }
    
    @SuppressLint("MissingPermission")
    fun startLocationUpdates() {
        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
    }
    
    fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }
    
    @SuppressLint("MissingPermission")
    fun getLastKnownLocation(): Task<Location> {
        return fusedLocationClient.lastLocation
    }
    
    private fun handleLocationUpdate(location: Location) {
        // Lokasyon güncellemesini işle
        val latitude = location.latitude
        val longitude = location.longitude
        val accuracy = location.accuracy
        
        // Lokasyonu kaydet veya kullan
        saveLocationToDatabase(latitude, longitude, accuracy)
    }
}
```

#### Permission Handling
```kotlin
class LocationPermissionManager {
    companion object {
        const val LOCATION_PERMISSION_REQUEST_CODE = 1001
        
        fun hasLocationPermission(context: Context): Boolean {
            return ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        }
        
        fun requestLocationPermission(activity: Activity) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                LOCATION_PERMISSION_REQUEST_CODE
            )
        }
        
        fun shouldShowRationale(activity: Activity): Boolean {
            return ActivityCompat.shouldShowRequestPermissionRationale(
                activity,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        }
    }
}

// Activity'de kullanım
class MainActivity : AppCompatActivity() {
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        when (requestCode) {
            LocationPermissionManager.LOCATION_PERMISSION_REQUEST_CODE -> {
                if (grantResults.isNotEmpty() && 
                    grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    // İzin verildi
                    startLocationServices()
                } else {
                    // İzin reddedildi
                    showPermissionDeniedMessage()
                }
            }
        }
    }
}
```

## React Native Lokasyon Servisleri

### Geolocation API
```javascript
import Geolocation from '@react-native-community/geolocation';
import {PermissionsAndroid, Platform} from 'react-native';

class LocationService {
  constructor() {
    this.watchId = null;
    this.currentLocation = null;
    this.isTracking = false;
  }
  
  async requestLocationPermission() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Lokasyon İzni',
            message: 'Uygulamanın lokasyonunuza erişmesi gerekiyor',
            buttonNeutral: 'Daha Sonra Sor',
            buttonNegative: 'İptal',
            buttonPositive: 'Tamam',
          }
        );
        
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS için permission Info.plist'te tanımlı
  }
  
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          this.currentLocation = position;
          resolve(position);
        },
        error => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }
  
  startTracking(onLocationUpdate) {
    this.watchId = Geolocation.watchPosition(
      position => {
        this.currentLocation = position;
        onLocationUpdate(position);
      },
      error => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // 10 metre minimum hareket
        interval: 10000, // 10 saniye interval (Android)
        fastestInterval: 5000, // 5 saniye minimum interval (Android)
      }
    );
    
    this.isTracking = true;
  }
  
  stopTracking() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
    }
  }
  
  // Batarya optimizasyonu için düşük hassasiyet modu
  startLowPowerTracking(onLocationUpdate) {
    this.watchId = Geolocation.watchPosition(
      position => {
        this.currentLocation = position;
        onLocationUpdate(position);
      },
      error => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: false, // Düşük hassasiyet
        distanceFilter: 100, // 100 metre minimum hareket
        interval: 60000, // 1 dakika interval
        fastestInterval: 30000, // 30 saniye minimum interval
      }
    );
  }
}

// Hook kullanımı
import {useState, useEffect} from 'react';

export const useLocation = () => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const locationService = new LocationService();
  
  const getCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const hasPermission = await locationService.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Lokasyon izni reddedildi');
      }
      
      const position = await locationService.getCurrentLocation();
      setLocation(position);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const startTracking = async (callback) => {
    const hasPermission = await locationService.requestLocationPermission();
    if (hasPermission) {
      locationService.startTracking(callback);
    }
  };
  
  const stopTracking = () => {
    locationService.stopTracking();
  };
  
  return {
    location,
    loading,
    error,
    getCurrentLocation,
    startTracking,
    stopTracking,
  };
};
```

## Flutter Location Services

### Geolocator Package
```dart
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

class LocationService {
  static const LocationSettings _locationSettings = LocationSettings(
    accuracy: LocationAccuracy.high,
    distanceFilter: 10,
  );
  
  Future<bool> requestLocationPermission() async {
    PermissionStatus permission = await Permission.locationWhenInUse.status;
    
    if (permission.isDenied) {
      permission = await Permission.locationWhenInUse.request();
    }
    
    if (permission.isPermanentlyDenied) {
      // Kullanıcıyı ayarlara yönlendir
      openAppSettings();
      return false;
    }
    
    return permission.isGranted;
  }
  
  Future<Position?> getCurrentLocation() async {
    try {
      bool hasPermission = await requestLocationPermission();
      if (!hasPermission) return null;
      
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Lokasyon servisi kapalı');
      }
      
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      
      return position;
    } catch (e) {
      print('Lokasyon alınamadı: $e');
      return null;
    }
  }
  
  Stream<Position> getLocationStream() {
    return Geolocator.getPositionStream(
      locationSettings: _locationSettings,
    );
  }
  
  // Mesafe hesaplama
  double calculateDistance(Position start, Position end) {
    return Geolocator.distanceBetween(
      start.latitude,
      start.longitude,
      end.latitude,
      end.longitude,
    );
  }
  
  // Batarya dostu tracking
  Stream<Position> getBatteryOptimizedLocationStream() {
    const LocationSettings batteryOptimizedSettings = LocationSettings(
      accuracy: LocationAccuracy.low,
      distanceFilter: 100, // 100 metre
    );
    
    return Geolocator.getPositionStream(
      locationSettings: batteryOptimizedSettings,
    );
  }
}

// Provider kullanımı
class LocationProvider extends ChangeNotifier {
  Position? _currentPosition;
  bool _isTracking = false;
  StreamSubscription<Position>? _positionSubscription;
  
  Position? get currentPosition => _currentPosition;
  bool get isTracking => _isTracking;
  
  final LocationService _locationService = LocationService();
  
  Future<void> getCurrentLocation() async {
    Position? position = await _locationService.getCurrentLocation();
    if (position != null) {
      _currentPosition = position;
      notifyListeners();
    }
  }
  
  void startTracking() {
    if (_isTracking) return;
    
    _positionSubscription = _locationService.getLocationStream().listen(
      (Position position) {
        _currentPosition = position;
        notifyListeners();
      },
      onError: (error) {
        print('Location tracking error: $error');
      },
    );
    
    _isTracking = true;
    notifyListeners();
  }
  
  void stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _isTracking = false;
    notifyListeners();
  }
  
  @override
  void dispose() {
    stopTracking();
    super.dispose();
  }
}
```

## Geofencing

### iOS Geofencing
```swift
import CoreLocation

class GeofenceManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private var geofences: [CLCircularRegion] = []
    
    override init() {
        super.init()
        locationManager.delegate = self
    }
    
    func addGeofence(identifier: String, center: CLLocationCoordinate2D, radius: CLLocationDistance) {
        let geofence = CLCircularRegion(
            center: center,
            radius: radius,
            identifier: identifier
        )
        
        geofence.notifyOnEntry = true
        geofence.notifyOnExit = true
        
        locationManager.startMonitoring(for: geofence)
        geofences.append(geofence)
    }
    
    func removeGeofence(identifier: String) {
        if let region = locationManager.monitoredRegions.first(where: { $0.identifier == identifier }) {
            locationManager.stopMonitoring(for: region)
        }
        
        geofences.removeAll { $0.identifier == identifier }
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        print("Geofence'e girildi: \\(region.identifier)")
        handleGeofenceEntry(region.identifier)
    }
    
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        print("Geofence'den çıkıldı: \\(region.identifier)")
        handleGeofenceExit(region.identifier)
    }
    
    private func handleGeofenceEntry(_ identifier: String) {
        // Geofence'e girildiğinde yapılacak işlemler
        sendLocalNotification(title: "Bölgeye Girildi", body: "\\(identifier) bölgesine girdiniz")
    }
    
    private func handleGeofenceExit(_ identifier: String) {
        // Geofence'den çıkıldığında yapılacak işlemler
        sendLocalNotification(title: "Bölgeden Çıkıldı", body: "\\(identifier) bölgesinden çıktınız")
    }
}
```

### Android Geofencing
```kotlin
import com.google.android.gms.location.*

class GeofenceManager(private val context: Context) {
    private lateinit var geofencingClient: GeofencingClient
    private val geofenceList = mutableListOf<Geofence>()
    
    init {
        geofencingClient = LocationServices.getGeofencingClient(context)
    }
    
    fun addGeofence(id: String, latitude: Double, longitude: Double, radius: Float) {
        val geofence = Geofence.Builder()
            .setRequestId(id)
            .setCircularRegion(latitude, longitude, radius)
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
            .build()
            
        geofenceList.add(geofence)
        addGeofences()
    }
    
    @SuppressLint("MissingPermission")
    private fun addGeofences() {
        val geofencingRequest = GeofencingRequest.Builder().apply {
            setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            addGeofences(geofenceList)
        }.build()
        
        geofencingClient.addGeofences(geofencingRequest, geofencePendingIntent)
    }
    
    private val geofencePendingIntent: PendingIntent by lazy {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        PendingIntent.getBroadcast(
            context, 
            0, 
            intent, 
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}

class GeofenceBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent)
        
        if (geofencingEvent?.hasError() == true) {
            return
        }
        
        val geofenceTransition = geofencingEvent?.geofenceTransition
        
        when (geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> {
                // Geofence'e girildi
                handleGeofenceEntry(geofencingEvent.triggeringGeofences)
            }
            Geofence.GEOFENCE_TRANSITION_EXIT -> {
                // Geofence'den çıkıldı
                handleGeofenceExit(geofencingEvent.triggeringGeofences)
            }
        }
    }
    
    private fun handleGeofenceEntry(geofences: List<Geofence>?) {
        geofences?.forEach { geofence ->
            // Notification gönder
            sendNotification("Bölgeye Girildi", "${geofence.requestId} bölgesine girdiniz")
        }
    }
    
    private fun handleGeofenceExit(geofences: List<Geofence>?) {
        geofences?.forEach { geofence ->
            // Notification gönder
            sendNotification("Bölgeden Çıkıldı", "${geofence.requestId} bölgesinden çıktınız")
        }
    }
}
```

## En İyi Uygulamalar

### 1. Batarya Optimizasyonu
- Gerekli olmadığında lokasyon servisini durdurun
- Düşük hassasiyet modunu kullanın
- Minimum hareket mesafesi belirleyin

### 2. Güvenlik ve Gizlilik
- Kullanıcıdan açık izin alın
- Lokasyon verilerini güvenli şekilde saklayın
- Gereksiz lokasyon verisi toplamayın

### 3. Kullanıcı Deneyimi
- İzin isteme nedenini açık şekilde belirtin
- Lokasyon servisi kapalıysa alternatif sunun
- Loading state'leri gösterin

### 4. Error Handling
- Lokasyon bulunamadığında fallback plan hazırlayın
- Timeout durumlarını handle edin
- Kullanıcıya anlaşılır hata mesajları verin

Bu implementasyonlar ile güçlü, verimli ve kullanıcı dostu lokasyon servisleri geliştirebilirsiniz.
