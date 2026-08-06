import React, { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useProductRepository } from '@/hooks/useCorpusRepositories';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import type { CorpusProduct } from '@/services/corpus/types';
import type { CaptureResult } from '@/types';
import { splitLabelText } from '@/utils/productForm/ocrNormalizer';

/**
 * Product Intelligence — capture flow (docs/tasks/ux-explore-vials/07-capture-flow.md),
 * scoped down per the product decision to keep photo capture on the existing
 * OS-camera/expo-image-picker mechanism (CameraCaptureModal) rather than build
 * a new live in-app camera preview. So the doc's dynamic viewfinder (bracket
 * -> wide band) and its persistent hint bar that changes WHILE the camera is
 * open don't apply here — there's no live overlay to draw them on. This
 * screen carries the same copy as static full-screen prompts shown BEFORE
 * each camera launch instead.
 *
 * Also deliberately not implemented: silent background barcode decoding
 * during Shot 1 (§5) — that assumes a live camera feed to decode against;
 * a single still photo has no such feed. And offline-vs-no-match copy
 * differentiation (§7) — this build has no network-status detection, so a
 * failed/unavailable corpus search reads identically to a genuine no-match.
 *
 * Shot 1's OCR'd brand/name is never discarded (§4a) — every exit from this
 * screen that doesn't land on a chosen corpus match carries it forward via
 * ManualProductForm's `ocrPrefill` param.
 */

type Props = NativeStackScreenProps<CatalogStackParamList, 'CaptureFlow'>;

type Step = 'shot1_prompt' | 'searching' | 'match_results' | 'no_match';

export default function CaptureFlowScreen({ navigation, route }: Props) {
  const initialStatus = route.params?.initialStatus;
  const productRepository = useProductRepository();

  const [step, setStep] = useState<Step>('shot1_prompt');
  const [activeCapture, setActiveCapture] = useState<'label' | 'inci' | null>(null);
  // Kept across the whole flow so a no-match exit (either branch) can still
  // pre-fill brand/name — see §4a in the file header comment.
  const [shot1Text, setShot1Text] = useState('');
  // Shot 1's own photo — kept as the product's cover photo on every exit,
  // match or not, since a corpus match commonly has no photo of its own.
  const [shot1PhotoUri, setShot1PhotoUri] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CorpusProduct[]>([]);

  function handleClose() {
    navigation.goBack();
  }

  // "Enter manually" is reachable before Shot 2 ever runs (from either
  // PromptStep), so it only ever has Shot 1's brand/name to carry forward —
  // never ingredient text (that's the `mode === 'inci'` branch in
  // handleCapture, which navigates directly).
  function goToManualEntry() {
    const { brand, name } = splitLabelText(shot1Text);
    navigation.replace('ManualProductForm', {
      initialStatus,
      ocrPrefill: brand || name ? { brand: brand || undefined, name: name || undefined } : undefined,
      capturedPhotoUri: shot1PhotoUri ?? undefined,
    });
  }

  async function runSearch(rawText: string) {
    setStep('searching');
    if (!productRepository) {
      // Can't check the corpus at all — same honest "couldn't find it" exit
      // as a genuine miss (see file header re: offline differentiation).
      setStep('no_match');
      return;
    }
    try {
      const results = await productRepository.search(rawText);
      if (results.length > 0) {
        setSearchResults(results);
        setStep('match_results');
      } else {
        setStep('no_match');
      }
    } catch {
      setStep('no_match');
    }
  }

  function handleCapture(result: CaptureResult) {
    setActiveCapture(null);
    if (result.mode === 'label') {
      setShot1Text(result.rawText);
      setShot1PhotoUri(result.sourceUri);
      void runSearch(result.rawText);
      return;
    }
    if (result.mode === 'inci') {
      const { brand, name } = splitLabelText(shot1Text);
      navigation.replace('ManualProductForm', {
        initialStatus,
        ocrPrefill: {
          brand: brand || undefined,
          name: name || undefined,
          fullIngredientText: result.rawText,
        },
        capturedPhotoUri: shot1PhotoUri ?? undefined,
      });
    }
    // 'barcode' never fires here — this screen never opens the modal in that mode.
  }

  function handlePickMatch(item: CorpusProduct) {
    navigation.replace('ManualProductForm', {
      prefillCorpusProduct: item,
      initialStatus,
      capturedPhotoUri: shot1PhotoUri ?? undefined,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Scan Product"
        leftAction={
          <IconButton
            icon={<Icon name="x" size={20} color={colors.textPrimary} />}
            label="Close"
            variant="ghost"
            size="sm"
            onPress={handleClose}
          />
        }
      />

      {step === 'shot1_prompt' ? (
        <PromptStep
          icon="camera"
          title="Point at the product name"
          description="We'll try to find it in our database — a quick photo of the front of the bottle is usually enough."
          buttonLabel="Take Photo"
          onPress={() => setActiveCapture('label')}
          onEnterManually={goToManualEntry}
        />
      ) : null}

      {step === 'searching' ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.textSecondary} />
          <Text style={styles.processingText}>Identifying product…</Text>
        </View>
      ) : null}

      {step === 'match_results' ? (
        <MatchResultsStep
          results={searchResults}
          onPick={handlePickMatch}
          onNoneOfThese={() => setStep('no_match')}
        />
      ) : null}

      {step === 'no_match' ? (
        <PromptStep
          icon="file-text"
          title="Couldn't find it in our database"
          description={
            'Let’s read the ingredient list instead — point at the ingredient list, ' +
            'usually starting with "Ingredients" or "INCI."'
          }
          buttonLabel="Take Photo"
          onPress={() => setActiveCapture('inci')}
          onEnterManually={goToManualEntry}
        />
      ) : null}

      <CameraCaptureModal
        mode={activeCapture ?? 'label'}
        visible={activeCapture !== null}
        onClose={() => setActiveCapture(null)}
        onCapture={handleCapture}
      />
    </SafeAreaView>
  );
}

// ─── Prompt step (Shot 1 and no-match/Shot 2) ──────────────────────────────────

function PromptStep({
  icon,
  title,
  description,
  buttonLabel,
  onPress,
  onEnterManually,
}: {
  icon: 'camera' | 'file-text';
  title: string;
  description: string;
  buttonLabel: string;
  onPress: () => void;
  onEnterManually: () => void;
}) {
  return (
    <View style={styles.promptWrap}>
      <View style={styles.promptIconCircle}>
        <Icon name={icon} size={28} color={palette.plum} />
      </View>
      <Text style={styles.promptTitle}>{title}</Text>
      <Text style={styles.promptDescription}>{description}</Text>

      <Button size="lg" fullWidth onPress={onPress} style={styles.promptButton}>
        {buttonLabel}
      </Button>
      <Button variant="textActive" size="md" onPress={onEnterManually}>
        Enter manually
      </Button>
    </View>
  );
}

// ─── Match results (Shot 1 resolved to 1+ corpus candidates) ──────────────────

function MatchResultsStep({
  results,
  onPick,
  onNoneOfThese,
}: {
  results: CorpusProduct[];
  onPick: (item: CorpusProduct) => void;
  onNoneOfThese: () => void;
}) {
  return (
    <View style={styles.matchWrap}>
      <Text style={styles.matchHeading}>Is this it?</Text>
      <ScrollView contentContainerStyle={styles.matchListContent} showsVerticalScrollIndicator={false}>
        <View style={styles.resultList}>
          {results.map((item) => (
            <Pressable
              key={item.uid}
              style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
              onPress={() => onPick(item)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${item.name}`}
            >
              <View style={styles.resultContent}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.brand ? (
                  <Text style={styles.resultBrand} numberOfLines={1}>
                    {item.brand}
                  </Text>
                ) : null}
              </View>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Button variant="textActive" size="md" onPress={onNoneOfThese} style={styles.matchNoneBtn}>
        Not listed here
      </Button>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  processingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  promptWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[8],
    gap: space[3],
  },
  promptIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  promptTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  promptDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  promptButton: {
    marginTop: space[4],
  },

  matchWrap: {
    flex: 1,
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    gap: space[3],
  },
  matchHeading: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  matchListContent: {
    paddingBottom: space[4],
  },
  matchNoneBtn: {
    alignSelf: 'center',
  },
  resultList: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  resultRowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  resultContent: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  resultBrand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
