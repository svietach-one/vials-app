import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors, palette } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';

// ─── Onboarding screens ───────────────────────────────────────────────────────

import MarketingSlidesScreen from '@/screens/onboarding/MarketingSlidesScreen';
import SkinProfileSetupScreen from '@/screens/onboarding/SkinProfileSetupScreen';
import FirstProductScreen from '@/screens/onboarding/FirstProductScreen';

// ─── Main tab screens ─────────────────────────────────────────────────────────

import RoutinesScreen from '@/screens/RoutinesScreen';
import ClinicScreen from '@/screens/ClinicScreen';
import ProfileScreen from '@/screens/ProfileScreen';

// ─── Catalog stack screens ────────────────────────────────────────────────────

import CatalogScreen from '@/screens/CatalogScreen';
import AddProductHubScreen from '@/screens/AddProductHubScreen';
import ManualProductFormScreen from '@/screens/ManualProductFormScreen';
import ProductDetailScreen from '@/screens/ProductDetailScreen';
import BarcodeScannerScreen from '@/screens/BarcodeScannerScreen';

// ─── Param lists ──────────────────────────────────────────────────────────────

export type OnboardingStackParamList = {
  MarketingSlides: undefined;
  SkinProfileSetup: undefined;
  FirstProduct: undefined;
};

export type CatalogStackParamList = {
  Catalog: undefined;
  AddProductHub: undefined;
  ManualProductForm: {
    prefillOBFProduct?: { obfId: string; name: string; brand: string; ingredientsText: string };
    editingProductId?: string;
  };
  ProductDetail: { productId: string };
  BarcodeScanner: undefined;
};

export type RootTabParamList = {
  'Routine Hub': undefined;
  // NavigatorScreenParams allows typed deep-linking into the nested stack
  Vials: NavigatorScreenParams<CatalogStackParamList>;
  Clinic: undefined;
  Profile: undefined;
};

// ─── Navigators ───────────────────────────────────────────────────────────────

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const CatalogStack = createNativeStackNavigator<CatalogStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Feather.glyphMap> = {
  'Routine Hub': 'calendar',
  Vials: 'package',
  Clinic: 'activity',
  Profile: 'user',
};

const SHARED_HEADER_OPTIONS = {
  headerStyle: { backgroundColor: colors.bgBase },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontFamily: 'DMSans-Medium', fontSize: 16 },
  headerBackTitleVisible: false,
} as const;

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="MarketingSlides" component={MarketingSlidesScreen} />
      <OnboardingStack.Screen name="SkinProfileSetup" component={SkinProfileSetupScreen} />
      <OnboardingStack.Screen name="FirstProduct" component={FirstProductScreen} />
    </OnboardingStack.Navigator>
  );
}

function CatalogNavigator() {
  return (
    <CatalogStack.Navigator screenOptions={SHARED_HEADER_OPTIONS}>
      <CatalogStack.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{ title: 'Vials' }}
      />
      <CatalogStack.Screen
        name="AddProductHub"
        component={AddProductHubScreen}
        options={{ title: 'Add Product' }}
      />
      <CatalogStack.Screen
        name="ManualProductForm"
        component={ManualProductFormScreen}
        options={{ title: 'Add Product' }}
      />
      <CatalogStack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: '' }}
      />
      <CatalogStack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ title: 'Scan Barcode' }}
      />
    </CatalogStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bgBase },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: 'DMSans-Medium', fontSize: 16 },
        tabBarActiveTintColor: palette.black,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bgBase,
          borderTopColor: colors.borderDivider,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: 'DMSans-Regular',
          fontSize: 11,
        },
        tabBarIcon: ({ color, size }) => (
          <Feather
            name={TAB_ICONS[route.name as keyof RootTabParamList]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Routine Hub" component={RoutinesScreen} />
      {/* Vials tab: headerShown:false because CatalogNavigator provides its own header */}
      <Tab.Screen
        name="Vials"
        component={CatalogNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Clinic" component={ClinicScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Root navigator — gates on onboardingCompleted ────────────────────────────

function RootNavigator() {
  const hydrated = useProfileStore((s) => s.hydrated);
  const onboardingCompleted = useProfileStore(
    (s) => s.profile?.onboardingCompleted ?? false,
  );

  if (!hydrated) return null;

  if (!onboardingCompleted) {
    return <OnboardingNavigator />;
  }

  return <MainTabs />;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
