<!-- filepath: /Users/eren/Desktop/system_design/mobile/cross-platform-development.md -->
# Çapraz Platform Mobil Geliştirme

## Framework Karşılaştırma Diyagramı

```mermaid
graph TD
    Native[Native (iOS/Android)]
    RN[React Native]
    Flutter[Flutter]
    Xamarin[Xamarin]
    Ionic[Ionic]
    Shared[Paylaşılan Kod]
    UI[UI Katmanı]
    Logic[İş Mantığı]
    Platform[Platform API]

    Shared --> RN
    Shared --> Flutter
    Shared --> Xamarin
    Shared --> Ionic
    RN --> UI
    Flutter --> UI
    Xamarin --> UI
    Ionic --> UI
    UI --> Platform
## Framework Karşılaştırma Matrisi

### Özellik Karşılaştırması

```typescript
interface FrameworkKarsilastirma {
  framework: string;
  dil: string;
  performans: string;
  gelistirmeHizi: number; // 1-10
  kodPaylasimi: number; // Yüzde
  yerelOzellikler: string;
  toplulukDestegi: string;
  ogrenmeEgrisi: string;
}

const frameworkKarsilastirma: FrameworkKarsilastirma[] = [
  {
    framework: 'React Native',
    dil: 'JavaScript/TypeScript',
    performans: 'İyi',
    gelistirmeHizi: 8,
    kodPaylasimi: 85,
    yerelOzellikler: 'Yüksek',
    toplulukDestegi: 'Mükemmel',
    ogrenmeEgrisi: 'Orta'
  },
  {
    framework: 'Flutter',
    dil: 'Dart',
    performans: 'Mükemmel',
    gelistirmeHizi: 9,
    kodPaylasimi: 95,
    yerelOzellikler: 'Yüksek',
    toplulukDestegi: 'Çok İyi',
    ogrenmeEgrisi: 'Orta-Yüksek'
  },
  {
    framework: 'Xamarin',
    dil: 'C#',
    performans: 'Çok İyi',
    gelistirmeHizi: 7,
    kodPaylasimi: 75,
    yerelOzellikler: 'Mükemmel',
    toplulukDestegi: 'İyi',
    ogrenmeEgrisi: 'Yüksek'
  },
  {
    framework: 'Ionic',
    dil: 'JavaScript/TypeScript',
    performans: 'Orta',
    gelistirmeHizi: 9,
    kodPaylasimi: 90,
    yerelOzellikler: 'Orta',
    toplulukDestegi: 'İyi',
    ogrenmeEgrisi: 'Düşük-Orta'
  }
];
```

## React Native Uygulaması

### Mimari Kurulum

```typescript
// React Native Çapraz Platform Mimari
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

// Platforma özel servis soyutlaması
interface PlatformServisi {
  initialize(): Promise<void>;
  getCihazBilgisi(): CihazBilgisi;
  derinBaglantiYonet(url: string): void;
  izinleriIste(): Promise<IzinDurumu>;
}

class IOSPlatformServisi implements PlatformServisi {
  async initialize(): Promise<void> {
    // iOS'a özel başlatma
    await this.iosOzelOzellikleriKur();
  }
  getCihazBilgisi(): CihazBilgisi {
    return {
      platform: 'ios',
      versiyon: Platform.Version as string,
      model: 'iPhone',
    };
  }
  derinBaglantiYonet(url: string): void {
    // iOS derin bağlantı yönetimi
    console.log('iOS derin bağlantı:', url);
  }
  async izinleriIste(): Promise<IzinDurumu> {
    // iOS izin yönetimi
    return 'izin verildi';
  }
  private async iosOzelOzellikleriKur(): Promise<void> {
    // Push Bildirimleri, Touch ID gibi iOS'a özel özelliklerin kurulumu
  }
}

class AndroidPlatformServisi implements PlatformServisi {
  async initialize(): Promise<void> {
    // Android'e özel başlatma
    await this.androidOzelOzellikleriKur();
  }
  getCihazBilgisi(): CihazBilgisi {
    return {
      platform: 'android',
      versiyon: Platform.Version.toString(),
      model: 'Android Cihaz',
    };
  }
  derinBaglantiYonet(url: string): void {
    // Android derin bağlantı yönetimi
    console.log('Android derin bağlantı:', url);
  }
  async izinleriIste(): Promise<IzinDurumu> {
    // Android izin yönetimi
    return 'izin verildi';
  }
  private async androidOzelOzellikleriKur(): Promise<void> {
    // Android'e özel özelliklerin kurulumu
  }
}

// Platform Servis Fabrikası
class PlatformServisFabrikasi {
  static olustur(): PlatformServisi {
    return Platform.OS === 'ios'
      ? new IOSPlatformServisi()
      : new AndroidPlatformServisi();
  }
}

// Çapraz Platform Uygulama Bileşeni
const App: React.FC = () => {
  const [platformServisi] = useState(() => PlatformServisFabrikasi.olustur());
  useEffect(() => {
    platformServisi.initialize();
  }, []);
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
};

// Platforma özel stiller
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.select({
      ios: 44,
      android: 25,
    }),
  },
  button: {
    backgroundColor: Platform.select({
      ios: '#007AFF',
      android: '#2196F3',
    }),
    borderRadius: Platform.select({
      ios: 8,
      android: 4,
    }),
  },
});

// Yeniden kullanılabilir çapraz platform bileşenleri
interface ButonProps {
  baslik: string;
  onPress: () => void;
  varyant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const CaprazPlatformButon: React.FC<ButonProps> = ({
  baslik,
  onPress,
  varyant = 'primary',
  disabled = false,
}) => {
  const buttonStyle = [
    styles.button,
    styles[`button${varyant.charAt(0).toUpperCase() + varyant.slice(1)}`],
    disabled && styles.buttonDisabled,
  ];
  const textStyle = [
    styles.buttonText,
    styles[`buttonText${varyant.charAt(0).toUpperCase() + varyant.slice(1)}`],
    disabled && styles.buttonTextDisabled,
  ];
  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={textStyle}>{baslik}</Text>
    </TouchableOpacity>
  );
};

interface GirdiProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}

export const CaprazPlatformGirdi: React.FC<GirdiProps> = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
}) => {
  return (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor={Platform.select({
        ios: '#999',
        android: '#666',
      })}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Platform.select({ ios: 8, android: 6 }),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: Platform.select({
      ios: '#007AFF',
      android: '#2196F3',
    }),
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Platform.select({
      ios: '#007AFF',
      android: '#2196F3',
    }),
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: Platform.select({ ios: 8, android: 4 }),
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 8 }),
    fontSize: 16,
  },
});

## Flutter Uygulaması

### Çapraz Platform Mimari

```dart
// Flutter Çapraz Platform Mimari
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

abstract class PlatformServisi {
  Future<void> initialize();
  CihazBilgisi getCihazBilgisi();
  Future<void> derinBaglantiYonet(String url);
  Future<IzinDurumu> izinleriIste();
}

class IOSPlatformServisi implements PlatformServisi {
  @override
  Future<void> initialize() async {
    await _iosOzellikleriKur();
  }
  @override
  CihazBilgisi getCihazBilgisi() {
    return CihazBilgisi(
      platform: 'ios',
      versiyon: '16.0',
      model: 'iPhone',
    );
  }
  @override
  Future<void> derinBaglantiYonet(String url) async {
    debugPrint('iOS derin bağlantı: $url');
  }
  @override
  Future<IzinDurumu> izinleriIste() async {
    return IzinDurumu.izinVerildi;
  }
  Future<void> _iosOzellikleriKur() async {
    // iOS'a özel özelliklerin kurulumu
  }
}

class AndroidPlatformServisi implements PlatformServisi {
  @override
  Future<void> initialize() async {
    await _androidOzellikleriKur();
  }
  @override
  CihazBilgisi getCihazBilgisi() {
    return CihazBilgisi(
      platform: 'android',
      versiyon: '13.0',
      model: 'Android Cihaz',
    );
  }
  @override
  Future<void> derinBaglantiYonet(String url) async {
    debugPrint('Android derin bağlantı: $url');
  }
  @override
  Future<IzinDurumu> izinleriIste() async {
    return IzinDurumu.izinVerildi;
  }
  Future<void> _androidOzellikleriKur() async {
    // Android'e özel özelliklerin kurulumu
  }
}

class PlatformServisFabrikasi {
  static PlatformServisi olustur() {
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return IOSPlatformServisi();
      case TargetPlatform.android:
        return AndroidPlatformServisi();
      default:
        throw UnsupportedError('Platform desteklenmiyor');
    }
  }
}

class CaprazPlatformUygulama extends StatefulWidget {
  @override
  _CaprazPlatformUygulamaState createState() => _CaprazPlatformUygulamaState();
}

class _CaprazPlatformUygulamaState extends State<CaprazPlatformUygulama> {
  late final PlatformServisi _platformServisi;
  @override
  void initState() {
    super.initState();
    _platformServisi = PlatformServisFabrikasi.olustur();
    _platformiBaslat();
  }
  Future<void> _platformiBaslat() async {
    await _platformServisi.initialize();
  }
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Çapraz Platform Uygulama',
      theme: _temaOlustur(),
      home: AnaSayfa(),
    );
  }
  ThemeData _temaOlustur() {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return ThemeData(
        primarySwatch: Colors.blue,
        fontFamily: 'SF Pro Display',
      );
    } else {
      return ThemeData(
        primarySwatch: Colors.blue,
        fontFamily: 'Roboto',
      );
    }
  }
}

class CaprazPlatformButon extends StatelessWidget {
  final String metin;
  final VoidCallback onPressed;
  final ButonVaryant varyant;
  final bool etkin;
  const CaprazPlatformButon({
    Key? key,
    required this.metin,
    required this.onPressed,
    this.varyant = ButonVaryant.primary,
    this.etkin = true,
  }) : super(key: key);
  @override
  Widget build(BuildContext context) {
    return Platform.isIOS
        ? _buildIOSButon(context)
        : _buildAndroidButon(context);
  }
  Widget _buildIOSButon(BuildContext context) {
    return CupertinoButton(
      color: _butonRengiGetir(),
      onPressed: etkin ? onPressed : null,
      child: Text(metin),
    );
  }
  Widget _buildAndroidButon(BuildContext context) {
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        primary: _butonRengiGetir(),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4),
        ),
      ),
      onPressed: etkin ? onPressed : null,
      child: Text(metin),
    );
  }
  Color _butonRengiGetir() {
    switch (varyant) {
      case ButonVaryant.primary:
        return Platform.isIOS ? CupertinoColors.activeBlue : Colors.blue;
      case ButonVaryant.secondary:
        return Platform.isIOS ? CupertinoColors.systemGrey : Colors.grey;
    }
  }
}
enum ButonVaryant { primary, secondary }

class CaprazPlatformGirdi extends StatelessWidget {
  final String placeholder;
  final String value;
  final ValueChanged<String> onChanged;
  final bool gizliMetin;
  final TextInputType klavyeTuru;
  const CaprazPlatformGirdi({
    Key? key,
    required this.placeholder,
    required this.value,
    required this.onChanged,
    this.gizliMetin = false,
    this.klavyeTuru = TextInputType.text,
  }) : super(key: key);
  @override
  Widget build(BuildContext context) {
    return Platform.isIOS
        ? _buildIOSGirdi()
        : _buildAndroidGirdi();
  }
  Widget _buildIOSGirdi() {
    return CupertinoTextField(
      placeholder: placeholder,
      controller: TextEditingController(text: value),
      onChanged: onChanged,
      obscureText: gizliMetin,
      keyboardType: klavyeTuru,
      padding: EdgeInsets.all(12),
    );
  }
  Widget _buildAndroidGirdi() {
    return TextField(
      controller: TextEditingController(text: value),
      onChanged: onChanged,
      obscureText: gizliMetin,
      keyboardType: klavyeTuru,
      decoration: InputDecoration(
        hintText: placeholder,
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.all(12),
      ),
    );
  }
}

## Xamarin Uygulaması

### Çapraz Platform Mimari

```csharp
// Xamarin Çapraz Platform Mimari
using System;
using System.Threading.Tasks;
using Xamarin.Forms;

public interface IPlatformServisi
{
    Task InitializeAsync();
    CihazBilgisi GetCihazBilgisi();
    Task DerinBaglantiYonetAsync(string url);
    Task<IzinDurumu> IzinleriIsteAsync();
}

public class IOSPlatformServisi : IPlatformServisi
{
    public async Task InitializeAsync()
    {
        await IOSOzellikleriKurAsync();
    }
    public CihazBilgisi GetCihazBilgisi()
    {
        return new CihazBilgisi
        {
            Platform = "iOS",
            Versiyon = UIKit.UIDevice.CurrentDevice.SystemVersion,
            Model = UIKit.UIDevice.CurrentDevice.Model
        };
    }
    public async Task DerinBaglantiYonetAsync(string url)
    {
        System.Diagnostics.Debug.WriteLine($"iOS derin bağlantı: {url}");
        await Task.CompletedTask;
    }
    public async Task<IzinDurumu> IzinleriIsteAsync()
    {
        return await Task.FromResult(IzinDurumu.IzinVerildi);
    }
    private async Task IOSOzellikleriKurAsync()
    {
        await Task.CompletedTask;
    }
}

public class AndroidPlatformServisi : IPlatformServisi
{
    public async Task InitializeAsync()
    {
        await AndroidOzellikleriKurAsync();
    }
    public CihazBilgisi GetCihazBilgisi()
    {
        return new CihazBilgisi
        {
            Platform = "Android",
            Versiyon = Android.OS.Build.VERSION.Release,
            Model = Android.OS.Build.Model
        };
    }
    public async Task DerinBaglantiYonetAsync(string url)
    {
        System.Diagnostics.Debug.WriteLine($"Android derin bağlantı: {url}");
        await Task.CompletedTask;
    }
    public async Task<IzinDurumu> IzinleriIsteAsync()
    {
        return await Task.FromResult(IzinDurumu.IzinVerildi);
    }
    private async Task AndroidOzellikleriKurAsync()
    {
        await Task.CompletedTask;
    }
}

public static class ServisKonteyneri
{
    public static void ServisleriKaydet()
    {
        DependencyService.Register<IPlatformServisi, IOSPlatformServisi>();
    }
}

public partial class App : Application
{
    public App()
    {
        InitializeComponent();
        ServisKonteyneri.ServisleriKaydet();
        MainPage = new AppShell();
    }
    protected override async void OnStart()
    {
        var platformServisi = DependencyService.Get<IPlatformServisi>();
        await platformServisi.InitializeAsync();
    }
}

### Çapraz Platform UI Bileşenleri

```csharp
public class CaprazPlatformButon : ContentView
{
    public static readonly BindableProperty MetinProperty =
        BindableProperty.Create(nameof(Metin), typeof(string), typeof(CaprazPlatformButon));
    public static readonly BindableProperty KomutProperty =
        BindableProperty.Create(nameof(Komut), typeof(ICommand), typeof(CaprazPlatformButon));
    public string Metin
    {
        get => (string)GetValue(MetinProperty);
        set => SetValue(MetinProperty, value);
    }
    public ICommand Komut
    {
        get => (ICommand)GetValue(KomutProperty);
        set => SetValue(KomutProperty, value);
    }
    public CaprazPlatformButon()
    {
        var button = new Button();
        button.SetBinding(Button.TextProperty, new Binding(nameof(Metin), source: this));
        button.SetBinding(Button.CommandProperty, new Binding(nameof(Komut), source: this));
        Content = button;
    }
}
```

## Sonuç

Çapraz platform geliştirme, maliyet ve zaman avantajı sağlarken, performans ve yerel özellik erişimi gibi konularda dikkatli seçim yapılmasını gerektirir. Proje gereksinimlerinize göre en uygun frameworkü seçmek için yukarıdaki karşılaştırmaları ve örnek mimarileri kullanabilirsiniz.
