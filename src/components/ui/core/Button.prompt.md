Primary action control for Vials — monochrome fills; accent colors never fill a button.

```jsx
<Button variant="primary" size="md">Log tonight's routine</Button>
<Button variant="secondary" icon={<i data-lucide="plus" />}>Add product</Button>
<Button variant="destructive">Activate SOS mode</Button>
```

Variants: `primary` (black fill), `secondary` (bone + hairline border), `ghost` (text only), `destructive` (Cabernet outline + tint, for SOS / delete). Sizes `sm` / `md` / `lg`. Pass `fullWidth` for sheet CTAs.
