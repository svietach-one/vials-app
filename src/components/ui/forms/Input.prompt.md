Text field with an uppercase mono label (apothecary style) and monochrome focus.

```jsx
<Input label="Product name" value={name} onChange={setName} placeholder="e.g. Retinoid 0.5%" />
<Input label="Concentration" suffix="%" icon={<i data-lucide="flask-conical" />} error="Required" />
```

Supports `icon`, `suffix` (units), `helper`, and `error` (Cabernet). Focus ring is off-black.
