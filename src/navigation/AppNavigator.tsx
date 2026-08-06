import { Icon, type IconName } from '@/components/ui/Icon';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors, palette } from '@/constants/tokens';
import type { CorpusProduct } from '@/services/corpus/types';
import { useProfileStore } from '@/store/profileStore';
import type { ProductStatus } from '@/types';

// ─── Onboarding screens ───────────────────────────────────────────────────────

import MarketingSlidesScreen from '@/screens/onboarding/MarketingSlidesScreen';
import SkinProfileSetupScreen from '@/screens/onboarding/SkinProfileSetupScreen';
import ContributionConsentScreen from '@/screens/onboarding/ContributionConsentScreen';
import FirstProductScreen from '@/screens/onboarding/FirstProductScreen';

// ─── Main tab screens ─────────────────────────────────────────────────────────

import RoutinesScreen from '@/screens/RoutinesScreen';
import ClinicScreen from '@/screens/ClinicScreen';
import ProcedureDetailScreen from '@/screens/ProcedureDetailScreen';
import ProfileScreen from '@/screens/ProfileScreen';

// ─── Catalog stack screens ────────────────────────────────────────────────────

import CatalogScreen from '@/screens/CatalogScreen';
import AddProductHubScreen from '@/screens/AddProductHubScreen';
import ManualProductFormScreen from '@/screens/ManualProductFormScreen';
import ProductDetailScreen from '@/screens/ProductDetailScreen';
import BarcodeScannerScreen from '@/screens/BarcodeScannerScreen';
import AddProductScreen from '@/screens/catalog/AddProductScreen';
import CaptureFlowScreen from '@/screens/catalog/CaptureFlowScreen';

// ─── Param lists ──────────────────────────────────────────────────────────────

export type OnboardingStackParamList = {
  MarketingSlides: undefined;
  SkinProfileSetup: undefined;
  ContributionConsent: undefined;
  FirstProduct: undefined;
};

export type CatalogStackParamList = {
  Catalog: {
    /**
     * One-shot success toast for a manual save, shown once and cleared
     * (see docs/specs/contribution-consent-flow/03-visual-spec.md).
     * `savedAt` disambiguates back-to-back saves with identical content.
     */
    toast?: { savedAt: number; contributionOptIn: boolean; contributedCount: number };
  } | undefined;
  AddProductHub: {
    /** "Explore new" forwards 'wishlist' through the shared add pipeline — see
     * docs/tasks/ux-explore-vials/01-entry-points.md §1. Absent/'owned' is the
     * default "Add new" outcome. */
    initialStatus?: ProductStatus;
  } | undefined;
  ManualProductForm: {
    /** A corpus (Turso) hit the user picked via search or barcode scan — see src/services/corpus. */
    prefillCorpusProduct?: CorpusProduct;
    editingProductId?: string;
    initialStatus?: ProductStatus;
    /**
     * Brand/name/INCI text recognized by CaptureFlowScreen's OCR when no
     * corpus match was found — see docs/tasks/ux-explore-vials/07-capture-flow.md
     * §4a ("Shot 1's OCR result is never thrown away"). Ignored whenever
     * prefillCorpusProduct/editingProductId is also set — those take priority.
     */
    ocrPrefill?: { brand?: string; name?: string; fullIngredientText?: string };
    /**
     * The identification photo (Shot 1) itself, independent of whether OCR/
     * corpus matching succeeded — kept as the product's cover photo either
     * way (see docs/tasks/ux-explore-vials/07-capture-flow.md). Applies
     * regardless of which of prefillCorpusProduct/ocrPrefill fired, since a
     * corpus match commonly has no photo of its own.
     */
    capturedPhotoUri?: string;
  };
  ProductDetail: { productId: string };
  BarcodeScanner: undefined;
  AddProduct: { initialStatus?: ProductStatus } | undefined;
  CaptureFlow: { initialStatus?: ProductStatus } | undefined;
};

export type ClinicStackParamList = {
  Clinic: undefined;
  ProcedureDetail: { procedureId: string };
};

export type RootTabParamList = {
  Routines: undefined;
  // NavigatorScreenParams allows typed deep-linking into the nested stack
  'My Shelf': NavigatorScreenParams<CatalogStackParamList>;
  Clinic: NavigatorScreenParams<ClinicStackParamList>;
  Profile: undefined;
};

// ─── Navigators ───────────────────────────────────────────────────────────────

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const CatalogStack = createNativeStackNavigator<CatalogStackParamList>();
const ClinicStack = createNativeStackNavigator<ClinicStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, IconName> = {
  Routines: 'calendar',
  'My Shelf': 'package',
  Clinic: 'activity',
  Profile: 'user',
};

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="MarketingSlides" component={MarketingSlidesScreen} />
      <OnboardingStack.Screen name="SkinProfileSetup" component={SkinProfileSetupScreen} />
      <OnboardingStack.Screen name="ContributionConsent" component={ContributionConsentScreen} />
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
      <CatalogStack.Screen name="AddProduct" component={AddProductScreen} />
      <CatalogStack.Screen name="CaptureFlow" component={CaptureFlowScreen} />
    </CatalogStack.Navigator>
  );
}

function ClinicNavigator() {
  return (
    <ClinicStack.Navigator screenOptions={{ headerShown: false }}>
      <ClinicStack.Screen name="Clinic" component={ClinicScreen} />
      <ClinicStack.Screen name="ProcedureDetail" component={ProcedureDetailScreen} />
    </ClinicStack.Navigator>
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
          fontSize: 14,
        },
        tabBarIcon: ({ color, size }) => (
          <Icon
            name={TAB_ICONS[route.name as keyof RootTabParamList]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      {/* Routines is the first tab: the daily execution loop is the app's default view */}
      <Tab.Screen name="Routines" component={RoutinesScreen} options={{ headerShown: false }} />
      {/* My Shelf tab: headerShown:false because CatalogNavigator provides its own header.
          tabPress always resets the nested stack to Catalog — otherwise React
          Navigation's default per-tab stack preservation leaves you on
          whatever screen (e.g. ProductDetail) you last drilled into. */}
      <Tab.Screen
        name="My Shelf"
        component={CatalogNavigator}
        options={{ headerShown: false }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('My Shelf', { screen: 'Catalog' });
          },
        })}
      />
      <Tab.Screen name="Clinic" component={ClinicNavigator} options={{ headerShown: false }} />
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
