Important metadata or status marker. Use for warnings, clinical rehab windows, PAO expiry, and routine scheduling info — not for product classification (use Tag for that).

```tsx
<Badge status="Green" type="Light">Safe for sun</Badge>
<Badge status="Cabernet" type="Light">SOS · 24h rehab</Badge>
<Badge status="Amber" type="Dark">Expired</Badge>
<Badge status="Cobalt" type="Light">AM · PM</Badge>
<Badge status="Default" type="Dark">Tracking</Badge>
```

Statuses: `Default` · `Green` (safe) · `Cobalt` (info) · `Cabernet` (SOS) · `Amber` (warning)
Types: `Light` (tinted fill, coloured text) · `Dark` (solid fill, white text)

Rule: Light for inline metadata; Dark for high-priority alerts or counts on dark backgrounds.
