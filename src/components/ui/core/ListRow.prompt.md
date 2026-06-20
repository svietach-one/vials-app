Settings / inventory / product row with leading + trailing slots.

```jsx
<ListRow leading={<i data-lucide="bell" />} title="Reminders" trailing={<Switch checked />} />
<ListRow title="Vitamin C 15%" subtitle="Opened 12 Mar · PAO 3mo" chevron onClick={open} />
```

Set `divider={false}` on the last row. Pass `onClick` for tappable rows.
