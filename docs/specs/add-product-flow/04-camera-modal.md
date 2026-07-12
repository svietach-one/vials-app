# Task 04: Camera Capture Modal

Depends on: `01-types.md`

## Goal

Create `src/components/camera/CameraCaptureModal.tsx` — one reusable
full-screen modal component, parameterized by `mode`, built on
`expo-camera`. Do not build three separate modal components for label,
barcode, and INCI capture — they share too much chrome and fallback
behavior to justify forking.

## Props

```ts
interface CameraCaptureModalProps {
  mode: CaptureMode; // 'label' | 'barcode' | 'inci'
  visible: boolean;
  onClose: () => void;
  onCapture: (result: CaptureResult) => void;
}
```

## Behavior by mode

- `mode === 'barcode'`: run the barcode decoder only (EAN-13/UPC). Fire
  `onCapture({ mode: 'barcode', code })` on the first stable decode.
- `mode === 'label'` or `mode === 'inci'`: run the OCR text-frame
  pipeline only. Fire `onCapture({ mode, rawText })` once a stable text
  block is held for the debounce window. **Reuse whatever
  stability-detection logic the Phase 4 Universal Scanner OCR pipeline
  already defines in this codebase** — do not fork a second
  implementation of "is this text block stable yet."

## Shared UI (all modes)

- Full-screen dark overlay.
- Viewfinder with corner-bracket frame (not a full rectangle border — four
  L-shaped corner marks).
- "Close" control, top-right, always visible.
- Mode-appropriate helper copy under the viewfinder:
  - `label`: "Focus camera on the brand and product name"
  - `barcode`: "Point at the barcode on the box"
  - `inci`: "Align the ingredients list inside the frame" (the language
    requirement notice itself is a separate component shown *before* this
    modal opens — see `05-inci-notice.md` — don't duplicate that copy
    here)
- Active-processing indicator (pulsing dot + "Reading..." label) while OCR
  is actively parsing a candidate frame.

## Offline / failure fallback

If camera permission is denied, or the camera hardware/module fails to
initialize, show an inline message inside the modal:
> "Camera unavailable. Use manual entry instead."

with a button that calls `onClose()`. This must not be a dead end — the
parent section's manual input path (autocomplete, pills, checklist) is
always reachable regardless of camera state. This matches the existing
"Offline Manual Infallibility" architecture constraint already established
for the Universal Scanner elsewhere in this codebase — reuse that pattern,
don't invent a new one.

## Done when

- One component handles all three modes via the `mode` prop — verify by
  checking there are exactly one modal component file, not three.
- Denying camera permission in each of the three modes correctly falls
  back to the inline unavailable message and `onClose()` still works.
- `onCapture` is the only way data leaves this component — it never
  imports or dispatches into the form reducer directly (that wiring
  happens in the section components, task 07).
