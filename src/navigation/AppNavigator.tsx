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
  // NavigatorScreenParams allows typed deep-linking into the nested stack
  Vials: NavigatorScreenParams<CatalogStackParamList>;
  'Routine Hub': undefined;
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
    <CatalogStack.Navigator screenOptions={{ headerShown: false }}>
      <CatalogStack.Screen name="Catalog" component={CatalogScreen} />
      <CatalogStack.Screen name="AddProductHub" component={AddProductHubScreen} />
      <CatalogStack.Screen name="ManualProductForm" component={ManualProductFormScreen} />
      <CatalogStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <CatalogStack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
    </CatalogStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
      {/* Vials tab: headerShown:false because CatalogNavigator provides its own header */}
      <Tab.Screen
        name="Vials"
        component={CatalogNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Routine Hub" component={RoutinesScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Clinic" component={ClinicScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
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
