Icon-only control (back, more, close, add) with a guaranteed 44px tap target.

```jsx
<IconButton icon={<i data-lucide="chevron-left" />} label="Back" />
<IconButton icon={<i data-lucide="plus" />} label="Add" variant="filled" round />
```

Variants: `ghost` (default), `secondary` (bordered), `filled` (black). Always pass `label`.
