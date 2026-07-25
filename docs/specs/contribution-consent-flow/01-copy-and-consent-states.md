# Contribution Consent — States, Cadence & Copy

## 1. States

```ts
type ContributionConsentStatus = 'unset' | 'declined' | 'accepted' | 'disabled';
```

| Status | Meaning | Modal behavior | Inline toggle default |
|---|---|---|---|
| `unset` | Never seen the modal | Show full modal on next manual save | n/a (modal shown instead) |
| `declined` | Saw the modal at least once, hasn't opted in | Reminder modal on schedule (see §2) | Off |
| `accepted` | Has opted in at least once | No modal, ever again | On |
| `disabled` | Explicitly turned off in Profile | **No modal, no toggle, ever** — fully silent | n/a (toggle hidden) |

Transitions:
- `unset` → `declined` (user closes modal via "Not now", or leaves the inline toggle off on the save that triggered the modal)
- `unset` → `accepted` (user confirms modal with toggle on)
- `declined` → `accepted` (user turns the inline toggle on for any later save, or accepts a reminder modal)
- `accepted` → `disabled` (user turns off "Share new products with Vials" in Profile)
- `disabled` → `unset` (user turns the Profile setting back on — treat as a fresh start; re-show the full modal next manual save, don't silently resume as `accepted`)
- `declined` → `disabled` (user turns off the Profile setting even though they'd never accepted — same effect, fully silences reminders)

Once a user reaches `accepted`, there is no automatic path back to `declined`. Turning the inline toggle off for one specific product is a **per-save choice** (`contributionOptIn: false` on that product only) and does not change the global `contributionConsentStatus`.

---

## 2. Reminder cadence (only applies while status is `declined`)

Counted in **manual product saves where the user did not opt in** (i.e. saves that happened with the toggle off, or before ever seeing the modal). Reset the counter to 0 every time a reminder modal is shown, regardless of whether the user accepts or declines it again.

```
1st reminder:      5 declined-saves after entering `declined`
2nd reminder:      15 declined-saves after the 1st reminder
3rd reminder:      30 declined-saves after the 2nd reminder
4th+ reminders:    every 30 declined-saves after that
```

**Worked example** (user stays in `declined` throughout):
- Save 1: sees initial modal, taps "Not now" → status = `declined`, counter = 0
- Saves 2–6 (5 saves): counter reaches 5 → save 6 shows the **1st reminder**, counter resets to 0
- Saves 7–21 (15 saves): counter reaches 15 → save 21 shows the **2nd reminder**, counter resets to 0
- Saves 22–51 (30 saves): counter reaches 30 → save 51 shows the **3rd reminder**, counter resets to 0
- Every 30 declined-saves after that: same pattern, indefinitely

If the user accepts at any reminder, status flips to `accepted` and the cadence logic stops entirely.

### Pseudocode

```ts
function onManualProductSave(product, formToggleValue) {
  const status = settingsStore.contributionConsentStatus;

  if (status === 'disabled') {
    saveProduct(product, { contributionOptIn: false });
    return;
  }

  if (status === 'unset') {
    showContributionModal({ variant: 'first-time' });
    return; // save happens after modal resolves, see modal handlers below
  }

  if (status === 'accepted') {
    saveProduct(product, { contributionOptIn: formToggleValue });
    return;
  }

  // status === 'declined'
  saveProduct(product, { contributionOptIn: formToggleValue });
  if (formToggleValue === true) {
    settingsStore.setContributionConsentStatus('accepted');
    return;
  }

  settingsStore.incrementDeclinedSaveCount();
  const count = settingsStore.declinedSaveCountSinceLastReminder;
  const reminderIndex = settingsStore.reminderCountShown; // 0 before first reminder

  const threshold = reminderIndex === 0 ? 5
                   : reminderIndex === 1 ? 15
                   : 30; // 3rd reminder and every one after

  if (count >= threshold) {
    settingsStore.resetDeclinedSaveCount();
    settingsStore.incrementReminderCountShown();
    showContributionModal({ variant: 'reminder' });
  }
}

// Modal "Continue" handler (either variant)
function onModalAccept() {
  settingsStore.setContributionConsentStatus('accepted');
  saveProduct(currentProduct, { contributionOptIn: true });
}

// Modal "Not now" handler (either variant)
function onModalDecline() {
  if (settingsStore.contributionConsentStatus === 'unset') {
    settingsStore.setContributionConsentStatus('declined');
  }
  saveProduct(currentProduct, { contributionOptIn: false });
}
```

---

## 3. Counter (Profile screen + toast)

```ts
contributedProductsCount = productsStore.products.filter(
  p => p.contributionOptIn === true
).length
```

- Not filtered by current `contributionConsentStatus` — a product shared while `accepted`, counted, stays counted even if the user later switches to `disabled`.
- Not the same as "all manually-added products" — only ones actually opted in on save.

---

## 4. Copy

### 4.1 First-time modal

**EN**
- Icon: see `03-visual-spec.md`
- Headline: `Make adding products easier for everyone.`
- Body: `Share this product anonymously to help improve Vials for everyone. Every shared product makes adding products faster and easier for the next person.`
- Toggle label: `Share this product`
- Primary CTA: `Continue`
- Secondary CTA: `Not now`
- Footnote: `You can change this anytime in Profile → Privacy.`

**RU**
- Заголовок: `Сделайте добавление продуктов проще для всех.`
- Текст: `Поделитесь этим продуктом анонимно, чтобы сделать Vials лучше для всех. Каждый добавленный продукт делает добавление быстрее и проще для следующего человека.`
- Подпись тогла: `Поделиться этим продуктом`
- Основная кнопка: `Продолжить`
- Вторичная кнопка: `Не сейчас`
- Сноска: `Изменить это можно в любой момент в Профиль → Приватность.`

### 4.2 Reminder modal (2nd, 3rd, 4th+ — same copy every time)

Deliberately softer / shorter than the first-time modal — it should read as a light nudge, not a repeat of the original pitch.

**EN**
- Headline: `Still building the Vials shelf.`
- Body: `You've added a few more products since we last asked. Want to share one? It's anonymous, and takes one tap.`
- Toggle label: `Share this product`
- Primary CTA: `Continue`
- Secondary CTA: `Not now`

**RU**
- Заголовок: `Полка Vials всё ещё пополняется.`
- Текст: `С прошлого раза вы добавили ещё несколько продуктов. Поделиться одним из них? Это анонимно и займёт секунду.`
- Подпись тогла: `Поделиться этим продуктом`
- Основная кнопка: `Продолжить`
- Вторичная кнопка: `Не сейчас`

### 4.3 Inline toggle (subsequent saves, no modal — status `declined` or `accepted`)

**EN:** `Share with Vials` (compact label next to the toggle, no body copy)
**RU:** `Поделиться с Vials`

### 4.4 Success toast (green variant)

**EN:** `Saved` / `That's your {N}th jar in the Vials database.` (only shown when `contributionOptIn === true` for this save; otherwise the toast just says `Saved` with no counter line)
**RU:** `Сохранено` / `Это ваша {N}-я баночка в базе Vials.`

### 4.5 Profile — "Share new products with Vials" row

**EN**
- Label: `Share new products with Vials`
- Sublabel: `{N} products contributed so far`
- Helper text below the row: `Turning this off stops future contributions. Products already shared stay in the database.`

**RU**
- Заголовок строки: `Делиться новыми продуктами с Vials`
- Подпись: `Вклад на данный момент: {N} продуктов`
- Текст под переключателем: `Выключение остановит будущие вклады. Уже отправленные продукты останутся в базе.`
