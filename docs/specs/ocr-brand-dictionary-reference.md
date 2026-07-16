# OCR Correction Dictionary — Brand & Term Reference List

Status: DRAFT — needs a pass from someone with retail-floor knowledge of
PL/BY/RU markets before treating as final. Compiled from public brand
directories and market reports; not a substitute for the Top-500 SKU
shelf-blitz described in `db-product-spec.md` §5, but usable as the seed
for the OCR correction dictionary discussed for Section 1 (brand/name)
recognition. Section 6 (OCR failure patterns, confusable pairs, and
line-name → parent-brand mapping) added 2026-07-16 on top of the
existing brand/term lists — no existing content was removed or
reordered.

## How this is meant to be used

Per the earlier discussion: split into two pools by script, matched
separately against OCR output — **never cross-match** a Latin OCR result
against the Cyrillic pool or vice versa, since that's how a real word gets
"corrected" into a wrong-alphabet neighbor.

```ts
// src/utils/productForm/brandDictionary.ts (suggested location)

export const LATIN_BRAND_DICTIONARY: string[] = [ /* Section 1 + 2 + 4 below */ ];
export const CYRILLIC_BRAND_DICTIONARY: string[] = [ /* Section 3 below */ ];
export const LATIN_COMMON_TERMS: Record<'en'|'fr'|'pl', string[]> = { /* Section 5 */ };
```

Match against these using the same trigram/Jaccard similarity approach
already specced for `trigramSearch.ts` in `db-tech-design.md` §6.3 — a
threshold around Jaccard ≥ 0.6 is a reasonable starting point, tune
against real OCR output once this is wired up. Surface a correction as a
**suggestion**, not an automatic overwrite — a confident but wrong
auto-replace is worse than leaving the raw OCR text as-is.

---

## 1. International / pharmacy-channel brands (Latin script)

The brands most likely to appear regardless of which of the four target
markets a user is in — sold in pharmacies and mainstream drugstores
across Poland, France, and internationally.

```
Bioderma, La Roche-Posay, Vichy, Avene, Uriage, Eucerin, Nivea, Nuxe, REN Clean Skincare, Medik8, Balea Beauty Expert, 
Caudalie, Filorga, Embryolisse, Bepanthen, A-Derma, SVR, Klorane, PSA Skin, Elemis, Pixi, The Purest Solutions, 
CeraVe, The Ordinary, Neutrogena, Olay, Garnier, L'Oreal, L'Oreal Paris, Facetheory, Pai Skincare, Revolution Skincare,
Nivea, Dove, Simple, Cetaphil, Paula's Choice, Kiehl's, Clinique, Cantabria Labs, Singuladerm, Natura Bissé, Skin Diligent, 
Estee Lauder, Clarins, Weleda, Mixa, Ducray, Rilastil, Dermica, Yves Rocher, Bourjois, Q+A, Naturium, Minimalist, 
Chanel, Dior, Lancôme, Givenchy, Yves Saint Laurent (YSL), L'Occitane, Guerlain, ISDIN, Babe Laboratorios, Laboratorios BABÉ, 
Duschdas, Balea, Dr. Hauschka, Lavera, Logona, Dr. Barbara Sturm, ISDIN, Sesderma, Singuladerm, Babelaboratorios, Me+, 
Natura Bissé, Germaine de Capuccini, La Prairie, Valmont, Cellcosmet, Swissline, Elemis, Pixi, Ren Clean Skincare, Liz Earle,
Oriflame, Verso Skincare, Lumene, Ole Henriksen, Korres, Apivita, Frezyderm, Omorovicza, Geek & Gorgeous, Rituals, The Ordinary,
The INKEY List, REVOX B77, BYOMA, Transparent Lab, Niche Beauty Lab, Theramid, Acnemy, Bodyshock, Mesoestetic, Gallinée, 
Oryza Lab, L'Odaïtès, Huygens, Demain Beauty, Pomponne, Marie Fresh Cosmetics, Hillary Cosmetics, Re[Sens], SUE, Alís, Joko Blend,
Uoga Uoga, Kilig, Margarita, Manilla, You & Oil, Driu Beauty, MÁDARA Organic Skincare, Mossa, Stenders, H.A. Brieger, Kinetics, 
JOIK, Lumi, D'DIFFERENCE, Tilk!, Dermosil, Havu Cosmetics, Taika, Elixir Cosmeceuticals, Marina Miracle, Nordic Formula, Rå Organic Skincare, Tind of Norway, FOREO, Verso Skincare, L:A Bruket, Byredo, Björk & Berries, Sachajuan, Maria Nila, Nuori, Ole Henriksen, 
Jorgobé, Woods Copenhagen, Urtekram, Ecooking, INNISFREE, TRESemmé, SEYO, Paula's Choice, SkinCeuticals, Obagi Medical, iS Clinical, 
EltaMD, outh To The People, Drunk Elephant, Sunday Riley, Glow Recipe, Biossance, Origins, Summer Fridays, Rhode, Mario Badescu,
Sol de Janeiro, Kate Somerville, Eucerin, Sebamed, Babor, Asam Beauty (M. Asam), Dr. Hauschka, Collistar, Comfort Zone, Yepoda, 
Korres, Apivita, Veralab, L'Estetista Cinica, Diego dalla Palma, Olival, Nikolas, L'Adria, Voya, Pestle & Mortar, Vita Liberata, Seilich, Ishga, Hedera Vita, Aura, Sofit Skincare, Sofo, Mademoiselle Skincare, Lepa Vida, AlpStories, Hemptouch, Nelipot,Havlíkova Přírodní Apotéka, Manufaktura, Ryor, Nobilis Tilia, La Prairie, Valmont, Cellcosmet & Cellmen, Mavala, Hormeta, MANTLE, ACO Hud, L:A Bruket, Björk & Berries, True Organic of Sweden

```

**Additional coverage (merged back in 2026-07-16 — these were part of an
earlier research pass and were confirmed missing from the list above):**

```
Shiseido, Maybelline, Maybelline New York, NYX, NYX Professional Makeup,
Catrice, Max Factor, Rimmel, Revlon, Lierac, Noreva, Mustela, Hada Labo,
Rohto, Lancome, Sisley, Darphin, Cera di Cupra, Erborian
```

**Additional coverage — round 2 (2026-07-16 gap-fill pass, confirmed
missing after the round-1 merge):**

```
// French pharmacy/spa brands
ROC, Sanoflore, Payot, Academie, Guinot

// Japanese brands (relevant for K-Beauty-adjacent J-Beauty shelf and
// widely OCR'd on export packaging in the same latin script)
SK-II, Kanebo, Kose, DHC, Curél, Suisai, Freeplus, Fancl

// Mass-market / drugstore staples likely to be scanned even though
// not skincare-specialist brands — high shelf frequency in all three
// target retailers
Vaseline, Nivea Men, Head & Shoulders, Pantene, Schwarzkopf, No7
```

## 2. Polish mass-market / drugstore / indie brands (Latin script)

Sourced from Rossmann/Hebe drugstore assortment and Polish market
reports.

```
Ziaja, Bielenda, Tolpa, Dr Irena Eris, Eveline, Eveline Cosmetics,
Sylveco, Resibo, Pollena, Mokosh, AA, Dermika, Velada, Isana, Samarité,
BJR Technique, Farmona, Iwostin, Floslek, Sensilab, Pharmaceris,
Dermedic, Bandi, Soraya, Barwa, Yope, Nacomi, Vianek, Pat & Rub, Purite, 
Delia Cosmetics, Prosalon, BasicLab, Miya Cosmetic, Laab, BasicLab, Veoli Botanica, Clochee, Farmon,
Dr Irena Eris, Ala Natural Beauty, Oillan, L'biotica, Biovax, Alterra, Sunozon, Avon, Nacomi Next Level, 
Hagi, Bandiz, Bioliq, Cetaphil, Uriage, Ducray, Skinoren, Acne-Derm, Farmapol, Alantan Plus, Maść arnikowa, SVR
MIYA Cosmetics, Anwen, Only Bio, OnlyBio, Paese, Bell, Bell HYPOAllergenic,
Apis, Apis Natural Cosmetics, 4 Szpaki, Vis Plantis, Neboa,
Stars from the Stars, NAM, NAM Cosmetics, Wibo, Revoss, UZDROVISCO,
Sensum Mare, Clarena, Ministerstwo Dobrego Mydla, Ingrid, Ingrid Cosmetics,
Lirene, Kolastyna, Joanna, Marion, Perfecta, Bielenda Professional,
Semilac, Golden Rose, be Bio, Holika Holika, Kabos, Neonail, Rossmann Isana
Uroda, Pani Walewska, Miraculum, Constance Carroll, Vollare, Miamo,
Botanicus, Silcare
```

## 3. Belarusian and Russian brands (Cyrillic script)

Sourced from Belarusian cosmetics retailer catalogs. Cyrillic spellings
included alongside Latin transliterations where the brand is commonly
sold/labeled both ways (export packaging often carries both).

```
Belita, Belita-Vitex, Vitex, Modum, Liv Delano, Luxvisage, Markell,
Relouis, BelorDesign, Mirrolla, Floralis, Belkosmex, Sativa, DTMS, 
Natura Siberica, Green Pharmacy (Zelena Apteka), Nevskaya Cosmetics,
Grandma Agafia's Recipes, Agafia, Dilis, Vivienne Sabo, Don't Touch My Skin,
Openface, Art&Fact, G.Love, booster bar, Laboratorium, Smorodina, Organic Kitchen, Zielinski & Rozen,
M.Salamatova, Biono, SelfieLab, Masstige, Astra Cosmetic, The U, Geltek, Librederm, The U Openeye, The Act,
Ollin Professional, Aravia, Maskoholic, Organic Shop, Chistaya Liniya, Chorny Zhemchug, Mixit, Divage, Art-Visage, Icon Skin,
Beauty Bomb, Influence Beauty, Botavikos, Ecolatier, Levrana, Stellary,
PUSY, FOR ME, Blom, Teana, Faberlic, Krygina Cosmetics, Skinphoria,
Verifique, Senseful, Compliment, Svoboda, Novosvit, Tiande, Mirra, Sto Retseptov Krasoty

// Cyrillic forms (verify exact packaging spelling before shipping — brand
// name capitalization/spacing on real packaging can differ from retailer
// listings)
Белита, Белита-Витэкс, Витэкс, Модум, Лив Делано, Люксвизаж, Маркелл,
Релуи, БелорДизайн, Миролла, Флоралис, Белкосмекс, Сатива,
Натура Сиберика, Зеленая Аптека, Невская Косметика, Рецепты Бабушки Агафьи, Дилис,
Вивьен Сабо, Мастиж, Астра Косметик 
Чистая Линия, Черный Жемчуг, Чёрный Жемчуг, Миксит, Дивейдж, Арт-Визаж,
Икон Скин, Бьюти Бомб, Леврана, Стеллари, Ботавикос, Эколатье,
Комплимент, Свобода, Новосвит, Сто Рецептов Красоты, Тианде, Мирра, Фаберлик
```


## 4. K-Beauty brands (Latin script — as printed on EU-import packaging)

Per the earlier discussion, Korean brands are almost always latinized on
export/EU packaging already (the brand names below are what's printed,
not hangul transliterations), so these belong in the Latin pool. Filtered
to brands confirmed as commonly available through EU/Polish K-beauty
retail channels (YesStyle, StyleKorean, Douglas, and dedicated PL/DE
K-beauty shops).

```
Cosrx, Beauty of Joseon, Round Lab, Some By Mi, Purito, Purito Seoul,
Anua, Isntree, Klairs, Benton, Torriden, Skin1004, I'm From, Mixsoon,
Pyunkang Yul, Real Barrier, Haruharu Wonder, Axis-Y, Numbuzin,
Mary & May, Abib, Acwell, Etude, Etude House, Innisfree, Laneige,
Missha, Dr.Jart+, Mediheal, Tirtir, Tocobo, Goodal, Illiyoon, Ma:nyo,
Manyo Factory, Skinfood, Nature Republic, VT Cosmetics, Biodance,
Medicube, By Wishtrend, Heimish, Frudia, Celimax, Banila Co, Medi-Peel, MEDI-PEEL, rom&nd, romand, AESTURA, Dr.Althea, Scinic,
Dermatory, Tony Moly, Peripera, Clio, Dewytree, Amore Pacific, Hera,
The Saem, Elizavecca, Neogen, Thank You Farmer, Blithe, Belif,
It's Skin, SNP, JM Solution, Petitfee, Farm Stay, Kracie, Senka,
Biore, Canmake, Su:m37, Whoo, O Hui, IOPE, Espoir, 3CE, 16Brand, Wonjin Effect, Dr.G,
CNP Laboratory, Dr. Ceuracle, COSNORI, A'PIEU, The Face Shop,
Then I met you, Krave Beauty, Deoproce
```

Note the punctuation quirks (`Dr.Jart+`, `Ma:nyo`, `I'm From`) — these
should be stored exactly as commonly printed, since a fuzzy matcher will
handle minor OCR misses on the punctuation itself, but the dictionary
entry should reflect the real branding, not a stripped-down version.


```

## 5. Common cosmetic category terms by language

For `categoryDetector.ts`'s regex patterns — extend the existing
English-only patterns with French and Polish equivalents. (Russian
category terms are lower priority for now since Section 1 doesn't need
Cyrillic category detection as urgently as brand detection — flag for a
follow-up pass if Belarusian-market testing shows it's needed.)

```
English:  sCream, Serum, Lotion, Gel, Tonic, Toner, Essence, Ampoule, Booster, Fluid, Balm, Oil, Foam, Mousse, Mask, Scrub, Peeling, Exfoliant, Cleanser, Wash, Spray, Mist, Milk, Emulsion, Butter, Pad, Patch, Stick, Treatment, Cure, Therapy, Remedy, Solution, Complex, Concentrate, Elixir, Nectar, Cocktail, Hydrator, Moisturizer, Nourisher, Protector, Defense, Barrier, Shield, Screen, Filter, Block, Filler, Plumper, Lifter, Tightener, Smoother, Polisher, Brightener, Illuminator, Glow, Radiance, Shine, Matte, Control, Balance, Regulator, Clarifier, Purifier, Detox, Renewer, Regenerator, Rebuilder, Restorer, Recoverer, Resurfacing, Refiner, Minimizer, Reducer, Soother, Calmer, Reliever, Comfort, Moisture, Hydration, Advanced, Expert, Professional, Daily, Night, Active, Pure, Ultimate, Aloe, Aloe Vera, Shea, Shea Butter, Coconut, Coconut Oil, Avocado, Argan, Argan Oil, Jojoba, Almond, Olive, Macadamia, Rose, Rosewater, Chamomile, Lavender, Calendula, Green Tea, Matcha, Tea Tree, Mint, Peppermint, Eucalyptus, Honey, Propolis, Royal Jelly, Milk, Rice, Rice Water, Oat, Oatmeal, Coffee, Caffeine, Cacao, Chocolate, Charcoal, Clay, Mud, Seaweed, Algae, Marine, Snail, Mucin, Pearl, Gold, Collagen, Peptide, Vitamin, Vitamin C, Vitamin E, Hyaluron, Hyaluronic, Retinol, Cica, Centella, Ceramide, Niacinamide, Acid, AHA, BHA, PHA, Glycolic, Salicylic, Lactic, Enzyme, Coenzyme, Q10, Zinc, Sulfur, Squalan, Squalane, Panthenol, Glycerin, Bakuchiol, Probiotic, Prebiotic, Water, Aqua, Hydro, Oxygen, Thermal, Ice, Glacier, Berry, Blueberry, Cranberry, Raspberry, Strawberry, Blackberry, Goji, Citrus, Lemon, Orange, Lime, Grapefruit, Tangerine, Yuzu, Vitamin Fruit, Apple, Peach, Apricot, Pomegranate, Fig, Watermelon, Melon, Mango, Papaya, Pineapple, Banana, Coconut Milk, Almond Milk, Oat Milk, Yogurt, Vanilla, Sugar, Brown Sugar, Salt, Sea Salt, Cane Sugar, Rosehip, Rosehip Oil, Grapeseed, Grapeseed Oil, Tea Tree Oil, Lavender Oil, Cactus, Agave, Lotus, Sakura, Cherry Blossom, Jasmine, Orchid, Bamboo, Birch, Birch Juice, Aloe Juice, Hemp, Cannabis, CBD, Ginseng, Ginger, Turmeric, Cinnamon, Vanilla Bean, Silk, Cashmere, Micro-Capsule, Oxygen Bubble, Soft, Smooth, Silky, Creamy, Velvet, Satin, Light, Rich, Ultra, Mega, Super, Extreme, Intensive, Intense, Deep, Fast, Quick, Instant, Magic, Miracle, Wonder, Secret, Royal, Luxury, Premium, Gold Leaf, Diamond, Quartz, Ruby, Hydrogel, Bio-Cellulose, Cotton, Bamboo Sheet, Clay Mask, Peel-Off, Wash-Off, Leave-On, Overnight, Sleeping, Morning, Day, Sun, Sunscreen, Sunblock, After-Sun, Anti-Age, Anti-Wrinkle, Age Delay, Youth, Young, Forever Youth, Lift, Firm, Firming, Elastic, Elasticity, Tight, Bounce, Plump, Bouncy, Juicy, Fresh, Refresh, Cool, Cooling, Ice Cool, Warming, Hot, Steam, Pore, Pore Care, Pore Tightening, Pore Minimizer, Anti-Acne, Clear, Clarity, Clean, Spot, Spot Care, SOS, Emergency, Blemish, Blemish Care, White, Whitening, Bright, Brightening, Lightening, Anti-Dark Spot, Tone, Tone Up, Even Tone, Flawless, Glass Skin, Dewy, Dewy Glow, Water Glow, Milky, Milky Glow, Nude, Bare, Natural, Organic, Eco, Bio, Clean Beauty, Vegan, Cruelty Free, Botanical, Herbal, Plant, Dermatologist, Tested, Hypoallergenic, Sensitive, Safe, Gentle, Mild, Tear-Free, Family, Unisex, Men, Man, For Men, Travel, Travel Size, Mini, Pocket, Starter, Starter Kit, Set, Daily Care, Multi, Multi-Use, All-in-One, 3-in-1, 5-in-1, Universal, Global, Total, Total Care, Complete, Perfect, Perfection, Essential, Basic, Base, Base Coat, Top, Top Coat, Finish, Spray & Go, Quick Dry, Melt, Melting, Sorbet, Water Drop, Jelly, Pudding, Aqua Gel, Oil-Free, Water-Based, Alcohol-Free, Fragrance-Free, No Perfume, Cleanse & Hydrate, Wash & Scrub, 2-Step, Dual, Double, Double Cleanse, Magic Drops, Self-Tan, Tan, Bronzer, Shimmer, Glitter, Sparkle, Diamond Glow, Metallic, Foil, Magnetic, Heating, Bubble, Carbonated, Sparkling, Fizzy, Multi-Vitamin, Superfood, Superfruit, Veggie, Green, Clean, Detoxifying, Anti-Pollution, Urban, Urban Shield, City Defense, Climate Control, Weather Shield, Winter Care, Cold Cream, Wind Block, Summer, Sun Kissed, Bronze, Glow Booster, Serum-in-Oil, Oil-in-Water, Water-Light, Weightless, Invisible, Clear Skin, Happy Skin, Healthy, Healthy Glow, Postbiotic, Kombucha, Houttuynia, Heartleaf, Mugwort, Wormwood, Truffle, White Truffle, Caviar, Black Caviar, Saffron, Ginseng Root, Licorice, Willow Bark, Witch Hazel, Hamamelis, Cucumber, Pumpkin, Cranberry Seed, Sea Buckthorn, Acai Berry, Chia, Chia Seed, Flaxseed, Colloidal Oatmeal, Milk Protein, Goat Milk, Donkey Milk, Kombuchee, Volcanic Ash, Kaolin, Bentonite, Calamine, Silica, Resveratrol, Ferulic Acid, Azelaic Acid, Mandelic Acid, Tranexamic Acid, Alpha Arbutin, Glutathione, Succinic Acid, Lipids, Phytosterols, Squalene, Vitamin F, Biotin, Amino Acids, Beta-Glucan, Madecassoside, Allantoin, Pantethine, Zinc PCA, Copper Peptide, Adenosine, Betaine, Saponin, Liposome, Micro-Peel, Daily Peel, Liquid Laser, Injection, Micro-Needle, Shot, Infusion, Drops, Splash, Splash Mask, Pressed Serum, Ampoule-in-Cream, Water-Cream, Gel-Cream, Balm-to-Oil, Milk-to-Oil, Sherbet, Soufflé, Whipped, Fluffy, Cloudy, Cushion, Clay-to-Foam, Shake, Bi-Phase, Two-Phase, Multi-Layer, Zero Pore, Pore Vacuum, Blackhead, Whitehead, Anti-Redness, Calming, Soothing, Relief, Relieving, Anti-Irritation, Barrier Repair, Cica Cream, Skin Barrier, Moisture Barrier, Moisture Lock, Lock-In, 24h, 48h, 72h, Long-Lasting, Non-Stop, Continuous, Deep Hydration, Water-Plumping, Hydro-Boost, Aqua-Injected, Moisture-Surge, Quenching, Thirst-Relief, Rehydrating, Dehydrated Skin, Dry Skin, Oily Skin, Combination Skin, Normal Skin, Acne-Prone, Sensitive Skin, Redness-Prone, Mature Skin, Ageless, Age Defying, Age Repair, Line Smoother, Wrinkle Corrector, Anti-Sagging, V-Lift, Sculpting, Contouring, Defining, Firming Therapy, Elasticity Booster, Collagen Booster, Peptide Plump, Youth Activator, Cell Renewal, Cell Awake, Energizing, Wake-Up, Fatigue Relief, Anti-Fatigue, Radiance Booster, Instant Bright, Tone Corrector, Dark Spot Corrector, Pigment Shield, Sun Defense, Sun Hug, Daily Sun, City Sun, UV Shield, UVA, UVB, Broad Spectrum, Water-Resistant, Sweat-Proof, Sport, Ocean Friendly, Reef Safe, Biodegradable, Upcycled, Zero Waste, Eco-Friendly, Sustainable, Refill, Refillable, Recyclable, Cruelty-Free, PETA Approved, 100% Natural, Wild Crafted, Hand-Made, Small Batch, Artisan, Clean Formula, Non-Toxic, Paraben-Free, Sulfate-Free, Silicone-Free, Mineral Oil-Free, Phthalate-Free, Soap-Free, Dye-Free, Fragrance-Free, Unscented, Hypoallergenic Tested, Allergy Tested, Clinically Proven, Dermatologist Approved, Dr. Developed, Clinical, Med-Care, Science-Based, Smart Skincare, High-Performance, Result-Driven, Target-Action, Spot-On, Local Application, Overnight Repair, Sleeping Pack, Beauty Sleep, Midnight Recovery, Moon Glow, Sun Kissed, Golden Hour, Bronze Glow, After-Sun Soothe, Cooling Mist, Ice Therapy, Cryo, Cryo-Effect, Warming Mask, Thermal Scrub, Spa Ritual, Home Spa, Salon Quality, Luxury Care, Diamond Dust, Pearl Extract, 24k Gold, Rose Quartz, Jade, Amethyst, Shimmering Body, Glow Lotion, Body Butter, Hand Relief, Foot Repair, Lip Treatment, Lip Mask, Lip Butter, Lip Glaze, Juicy Lips, Plumping Lip, Eye Relief, Eye Awake, Anti-Dark Circles, Puffiness Reducer, De-Puff, Cooling Eye, Lash Booster, Brow Recovery, Neck & Decollete, T-Zone, U-Zone, Target Zone, Multi-Zone, Travel Essential, Gym Kit, On-The-Go, Daily Routine, Step 1, Step 2, Step 3, Prep, Prime, Lock, Finish, Glossy, Gloss, Glazed, Glazed Donut, Satin Touch, Cashmere Soft, Velvet Matt, Zero Shine, Sebum Control, Oil Absorbing, Mattifying, Blotting, Fresh Start, Reset, Skin Reset, Detox Face, Pure Skin, Clear Out, Deep Cleanse, Pore Purifying, Exfoliating Glow, Gentle Peel, Daily Polish, Skin Polish, Micro-Polish, Refined Skin, New Skin, Reborn, Awake, Alive, Happy, Calmed, Loved, Self-Care, Mindful, Wellness

French: 

Crème, Sérum, Lotion, Gel, Tonique, Eau Tonique, Essence, Ampoule, Booster, Fluide, Baume, Huile, Mousse, Masque, Gommage, Peeling, Exfoliant, Nettoyant, Gel Lavant, Spray, Brume, Lait, Émulsion, Beurre, Disque, Patch, Stick, Soin, Cure, Thérapie, Remède, Solution, Complexe, Concentré, Élixir, Nectar, Cocktail, Hydratant, Nourrissant, Protecteur, Défense, Barrière, Bouclier, Écran, Filtre, Bloqueur, Combleur, Repulpant, Liftant, Tenseur, Lissant, Polisseur, Éclaircissant, Illuminateur, Éclat, Radiance, Brillance, Mat, Contrôle, Équilibre, Régulateur, Clarifiant, Purifiant, Détox, Renouvelant, Régénérateur, Reconstructeur, Restaurateur, Réparateur, Resurfaçant, Affinant, Minimiseur, Réducteur, Apaisant, Calmant, Soulageant, Confort, Hydratation, Avancé, Expert, Professionnel, Quotidien, Nuit, Actif, Pur, Ultime, Aloé, Aloé Vera, Karité, Beurre de Karité, Coco, Huile de Coco, Avocat, Argan, Huile d'Argan, Jojoba, Amande, Olive, Macadamia, Rose, Eau de Rose, Camomille, Lavande, Calendula, Thé Vert, Matcha, Arbre à Thé, Menthe, Menthe Poivrée, Eucalyptus, Miel, Propolis, Gelée Royale, Lait, Riz, Eau de Riz, Avoine, Farine d'Avoine, Café, Caféine, Cacao, Chocolat, Charbon, Argile, Boue, Algues, Algues Marines, Marin, Escargot, Mucus, Perle, Or, Collagène, Peptide, Vitamine, Vitamine C, Vitamine E, Hyaluron, Hyaluronique, Rétinol, Cica, Centella, Céramide, Niacinamide, Acide, AHA, BHA, PHA, Glycolique, Salicylique, Lactique, Enzyme, Coenzyme, Q10, Zinc, Soufre, Squalan, Squalane, Panthénol, Glycérine, Bakuchiol, Probiotique, Prébiotique, Eau, Aqua, Hydro, Oxygène, Thermal, Glace, Glacier, Baie, Myrtille, Canneberge, Framboise, Fraise, Mûre, Goji, Agrumes, Citron, Orange, Citron Vert, Pamplemousse, Mandarine, Yuzu, Fruits Vitaminés, Pomme, Pêche, Abricot, Grenade, Figue, Pastèque, Melon, Mangue, Papaye, Ananas, Banane, Lait de Coco, Lait d'Amande, Lait d'Avoine, Yaourt, Vanille, Sucre, Sucre Roux, Sel, Sel de Mer, Sucre de Canne, Rosier Sauvage, Huile de Rosier, Pépins de Raisin, Huile de Pépins de Raisin, Huile d'Arbre à Thé, Huile de Lavande, Cactus, Agave, Lotus, Sakura, Fleur de Cerisier, Jasmin, Orchidée, Bambou, Bouleau, Sève de Bouleau, Jus d'Aloé, Chanvre, Cannabis, CBD, Ginseng, Gingembre, Curcuma, Cannelle, Gousse de Vanille, Soie, Cachemire, Micro-Capsule, Bulle d'Oxygène, Doux, Lisse, Soyeux, Onctueux, Velours, Satin, Léger, Riche, Ultra, Méga, Super, Extrême, Intensif, Intense, Profond, Rapide, Instantané, Magique, Miracle, Merveille, Secret, Royal, Luxe, Premium, Feuille d'Or, Diamant, Quartz, Rubis, Hydrogel, Bio-Cellulose, Coton, Feuille de Bambou, Masque à l'Argile, Peel-Off, À Rincer, Sans Rinçage, Nuit, Sommeil, Matin, Jour, Soleil, Écran Solaire, Anti-Solaire, Après-Soleil, Anti-Âge, Anti-Rides, Âge Retardé, Jeunesse, Jeune, Éternelle Jeunesse, Lift, Fermeté, Raffermissant, Élastique, Émollient, Tendu, Rebondi, Repulpé, Moelleux, Juteux, Frais, Rafraîchissant, Fraîcheur, Effet Glaçon, Chauffant, Chaud, Vapeur, Pore, Soin des Pores, Pores Resserrés, Minimiseur de Pores, Anti-Acné, Clair, Clarté, Propre, Spot, Soin Ciblé, SOS, Urgence, Imperfection, Anti-Imperfections, Blanc, Éclaircissant, Lumineux, Anti-Taches, Teint, Éclat du Teint, Teint Unifié, Sans Défaut, Peau de Verre, Effet Mouillé, Lumineux, Lacté, Nude, Nu, Naturel, Organique, Éco, Bio, Beauté Propre, Vegan, Sans Cruauté, Botanique, Herbal, Végétal, Dermatologique, Testé, Hypoallergénique, Sensible, Sûr, Doux, Modéré, Sans Larmes, Famille, Unisexe, Hommes, Homme, Pour Homme, Voyage, Format Voyage, Mini, Poche, Kit de Démarrage, Set, Soin Quotidien, Multi, Multi-Usage, Tout-en-Un, 3-en-1, 5-in-1, Universel, Global, Total, Soin Total, Complet, Parfait, Perfection, Essentiel, Basique, Base, Couche de Base, Top, Finition, Prêt à Partir, Séchage Rapide, Fondant, Sorbet, Goutte d'Eau, Gelée, Pudding, Gel Aqua, Sans Huile, À Base d'Eau, Sans Alcool, Sans Parfum, Nettoie & Hydrate, Nettoyant & Gommage, 2 Étapes, Duel, Double, Double Nettoyage, Gouttes Magiques, Autobronzant, Bronzage, Enlumineur, Scintillant, Pailleté, Éclat Diamant, Métallique, Feuille, Magnétique, Chauffant, Effet Bulle, Carbonaté, Pétillant, Multi-Vitaminé, Superaliment, Superfruit, Légumes, Vert, Propre, Détoxifiant, Anti-Pollution, Urbain, Bouclier Urbain, Défense Urbaine, Contrôle du Climat, Protection Intempéries, Soin Hiver, Cold Cream, Brise-Vent, Été, Effet Soleil, Bronzé, Booster d'Éclat, Sérum en Huile, Émulsion Inverse, Léger comme l'Eau, Sans Poids, Invisible, Peau Nette, Peau Heureuse, Sain, Éclat Sain, Postbiotique, Kombucha, Houttuynia, Truffe, Truffe Blanche, Caviar, Caviar Noir, Safran, Racine de Ginseng, Réglisse, Écorce de Saule, Hamamélis, Concombre, Citrouille, Pépins de Canneberge, Argousier, Baie d'Açaï, Chia, Graines de Chia, Graines de Lin, Avoine Colloïdale, Protéine de Lait, Lait de Chèvre, Lait d'Ânesse, Cendres Volcaniques, Kaolin, Bentonite, Calamine, Silice, Resvératrol, Acide Férulique, Acide Azélaïque, Acide Mandélique, Acide Tranexamique, Alpha Arbutine, Glutathion, Acide Succinique, Lipides, Phytostérols, Squalène, Vitamine F, Biotine, Acides Aminés, Bêta-Glucane, Madécassoside, Allantoïne, Pantéthine, Zinc PCA, Peptide de Cuivre, Adénosine, Bétaïne, Saponine, Liposome, Micro-Peel, Peeling Quotidien, Laser Liquide, Injection, Micro-Aiguille, Shot, Infusion, Gouttes, Splash, Masque Splash, Sérum Pressé, Ampoule en Crème, Crème d'Eau, Crème-Gel, Baume en Huile, Lait en Huile, Sorbet, Soufflé, Fouetté, Nuageux, Coussin, Argile en Mousse, Secouer, Bi-Phase, Double Phase, Multi-Couches, Zéro Pore, Aspirateur de Pores, Points Noirs, Points Blancs, Anti-Rougeurs, Apaisant, Soulagement, Anti-Irritation, Réparation Barrière, Cica Crème, Barrière Cutanée, Barrière d'Hydratation, Verrouillage Hydratation, Sceller, 24h, 48h, 72h, Longue Durée, Non-Stop, Continu, Hydratation Profonde, Hydro-Repulpant, Injecté d'Eau, Vague d'Hydratation, Désaltérant, Peau Déshydratée, Peau Sèche, Peau Grasse, Peau Mixte, Peau Normale, Tendance Acnéique, Peau Sensible, Sujet aux Rougeurs, Peau Mature, Sans Âge, Défi l'Âge, Réparation de l'Âge, Lisseur de Ridules, Correcteur de Rides, Anti-Relâchement, Sculptant, Remodelant, Définissant, Thérapie Fermeté, Booster d'Élasticité, Booster de Collagène, Repulpant aux Peptides, Activateur de Jeunesse, Renouvellement Cellulaire, Énergisant, Réveil, Anti-Fatigue, Booster de Radiance, Éclat Immédiat, Correcteur de Teint, Correcteur de Taches, Bouclier Anti-Pigment, Défense Solaire, Câlin de Soleil, Soleil Quotidien, Solaire Urbain, Large Spectre, Résistant à l'Eau, Anti-Transpiraition, Sport, Respectueux de l'Océan, Respecte les Coraux, Biodégradable, Recyclé, Zéro Déchet, Éco-Responsable, Durable, Recharge, Rechargeable, Recyclable, Sans Cruauté, Approuvé PETA, 100% Naturel, Cueillette Sauvage, Fait Main, Petite Production, Artisanal, Formule Propre, Non Toxique, Sans Paraben, Sans Sulfate, Sans Silicone, Sans Huile Minérale, Sans Phtalate, Sans Savon, Sans Colorant, Sans Parfum, Non Parfumé, Hypoallergénique, Testé Allergies, Cliniquement Prouvé, Approuvé par les Dermatologues, Développé par un Médecin, Clinique, Soin Médical, Basé sur la Science, Skincare Intelligente, Haute Performance, Axé sur les Résultats, Action Ciblée, Application Locale, Réparation Nocturne, Masque de Nuit, Sommeil Réparateur, Éclat Lunaire, Baisé par le Soleil, Heure Dorée, Éclat Bronzé, Après-Soleil Apaisant, Brume Rafraîchissante, Cryo-Effet, Masque Chauffant, Gommage Thermal, Rituel Spa, Spa à la Maison, Qualité Salon, Soin de Luxe, Poudre de Diamant, Extrait de Perle, Or 24k, Quartz Rose, Jade, Améthyste, Corps Scintillant, Lotion Éclat, Beurre Corporel, Soulagement des Mains, Réparation des Pieds, Soin des Lèvres, Masque Lèvres, Beurre de Lèvres, Glaçage Lèvres, Lèvres Juteuses, Lèvres Repulpées, Soulagement des Yeux, Regard Éveillé, Anti-Cernes, Anti-Poches, Décongestionnant, Yeux Frais, Booster de Cils, Réparation des Sourcils, Cou & Décolleté, Zone T, Zone U, Zone Cible, Multi-Zone, Essentiel Voyage, Kit Gym, Nomade, Routine Quotidienne, Étape 1, Étape 2, Étape 3, Préparer, Primer, Fixer, Finir, Glossy, Brillant, Glacé, Effet Miroir, Toucher Satin, Douceur Cachemire, Mat Velours, Zéro Brillance, Contrôle du Sébum, Absorbant d'Huile, Matifiant, Papier Absorbant, Nouveau Départ, Réinitialisation, Reset de la Peau, Détox Visage, Peau Pure, Nettoyage en Profondeur, Pores Purifiés, Exfoliation Éclat, Peeling Doux, Polissage Quotidien, Peau Polie, Micro-Polissage, Peau Affinée, Peau Neuve, Renaissance, Éveillé, Vivant, Heureux, Apaisé, Aimé, Soin de Soi, Conscient, Bien-être.

Polish:   Krem, Serum, Balsam, Żel, Tonik, Esencja, Ampułka, Booster, Fluid, Olejek, Pianka, Mus, Maska, Peeling, Exfoliant, Żel myjący, Emulsja, Masło, Płatek, Patch, Sztyft, Kuracja, Terapia, Remedium, Rozwiązanie, Kompleks, Koncentrat, Eliksir, Nektar, Koktajl, Nawilżacz, Krem nawilżający, Odżywienie, Ochrona, Bariera, Tarcza, Ekran, Filtr, Bloker, Wypełniacz, Plumper, Lifter, Napinacz, Wygładzacz, Polerowanie, Rozjaśniacz, Iluminator, Glow, Blask, Radiance, Połysk, Mat, Kontrola, Równowaga, Regulator, Oczyszczacz, Detoks, Odnowa, Regenerator, Odbudowa, Przywrócenie, Naprawa, Resurfacing, Wygładzenie, Minimalizator, Reduktor, Ukojenie, Łagodzenie, Ulga, Komfort, Nawodnienie, Zaawansowany, Ekspert, Profesjonalny, Codzienny, Na noc, Aktywny, Czysty, Ultimate, Aloes, Aloe Vera, Masło Shea, Kokos, Olej kokosowy, Awokado, Argan, Olej arganowy, Jojoba, Migdał, Oliwka, Makadamia, Róża, Woda różana, Rumianek, Lawenda, Nagietek, Zielona herbata, Matcha, Drzewo herbaciane, Mięta, Eucalyptus, Miód, Propolis, Mleczko pszczele, Mleko, Ryż, Woda ryżowa, Owies, Mączka owsiana, Kawa, Kofeina, Kakao, Czekolada, Węgiel, Glinka, Błoto, Algi, Algi morskie, Morskie, Śluz ślimaka, Mucyna, Perła, Złoto, Kolagen, Peptyd, Witamina, Witamina C, Witamina E, Hialuron, Kwas hialuronowy, Retinol, Cica, Centella, Ceramidy, Niacynamid, Kwas, AHA, BHA, PHA, Glikolowy, Salicylowy, Mlekowy, Enzym, Koenzym, Q10, Cynk, Siarka, Skwalan, Pantenol, Gliceryna, Bakuchiol, Probiotyk, Prebiotyk, Woda, Aqua, Hydro, Tlen, Termalna, Lodowcowa, Jagody, Borówka, Żurawina, Malina, Truskawka, Jeżyna, Goji, Cytrusy, Cytryna, Pomarańcza, Limonka, Grejpfrut, Mandarynka, Juzu, Witaminowe owoce, Jabłko, Brzoskwinia, Morela, Granat, Figa, Arbuz, Melon, Mango, Papaja, Ananas, Banan, Mleczko kokosowe, Mleczko migdałowe, Mleczko owsiane, Jogurt, Wanilia, Cukier, Brązowy cukier, Sól, Sól morska, Cukier trzcinowy, Dzika róża, Olej z dzikiej róży, Pestki winogron, Olej z pestek winogron, Olejek z drzewa herbacianego, Olejek lawendowy, Kaktus, Agawa, Lotos, Sakura, Kwiat wiśni, Jaśmin, Orchidea, Bambus, Brzoza, Sok z brzozy, Sok z aloesu, Konopie, Cannabis, CBD, Żeń-szeń, Imbir, Kurkuma, Cynamon, Laska wanilii, Jedwab, Kaszmir, Mikrokapsułki, Bąbelki tlenowe, Miękki, Gładki, Jedwabisty, Kremowy, Aksamit, Satyna, Lekki, Bogaty, Ultra, Mega, Super, Ekstremalny, Intensywny, Głęboki, Szybki, Błyskawiczny, Magiczny, Cud, Cudowny, Sekret, Królewski, Luksusowy, Premium, Płatki złota, Diament, Kwarc, Rubin, Hydrożel, Bioceluloza, Bawełna, Płatek bambusowy, Maska glinkowa, Peel-Off, Zmywalna, Bez zmywania, Na noc, Słodkich snów, Poranek, Na dzień, Słońce, Krem przeciwsłoneczny, Bloker słoneczny, Po opalaniu, Anti-Age, Przeciwzmarszczkowy, Opóźnienie starzenia, Młodość, Młody, Wieczna młodość, Lifting, Jędrność, Ujędrniający, Elastyczność, Napięty, Sprężysty, Soczysty, Świeży, Odświeżenie, Chłodzący, Lodowe chłodzenie, Rozgrzewający, Gorący, Efekt sauny, Pory, Pielęgnacja porów, Zwężanie porów, Minimalizator porów, Przeciwtrądzikowy, Czysty, Klarowność, Spot, Pielęgnacja punktowa, SOS, Ratunek, Niedoskonałości, Wybielanie, Rozjaśnianie, Przeciw przebarwieniom, Ton, Wyrównanie kolorytu, Nieskazitelny, Glass Skin, Dewy, Efekt tafli wody, Mleczny, Mleczny blask, Nude, Naturalny, Organiczny, Eko, Bio, Clean Beauty, Wegański, Cruelty Free, Botaniczny, Ziołowy, Roślinny, Dermatologiczny, Testowany, Hipoalergiczny, Wrażliwy, Bezpieczny, Delikatny, Łagodny, Bez łez, Rodzinny, Unisex, Dla mężczyzn, Podróżny, Mini, Kieszonkowy, Zestaw startowy, Zestaw, Codzienna pielęgnacja, Multi, Wielofunkcyjny, Wszystko w jednym, 3 w 1, 5 w 1, Uniwersalny, Globalny, Totalny, Kompleksowa pielęgnacja, Kompletny, Idealny, Perfekcja, Niezbędny, Bazowy, Baza, Wykończenie, Spray & Go, Szybkoschnący, Wtapiający się, Sorbet, Kropla wody, Galaretka, Budyń, Aqua Żel, Beztłuszczowy, Na bazie wody, Bezalkoholowy, Bezzapachowy, Bez perfum, Oczyszczanie i nawilżanie, Mycie i peeling, 2-etapowy, Podwójny, Podwójne oczyszczanie, Magiczne krople, Samoopalacz, Opalenizna, Bronzer, Rozświetlacz, Migoczący, Brokatowy, Diamentowy blask, Metaliczny, Magnetyczny, Rozgrzewający, Bąbelkowy, Gazowany, Musujący, Multiwitaminowy, Superfood, Superowoc, Warzywny, Zielony, Oczyszczający z toksyn, Anti-Pollution, Miejski, Miejska tarcza, Ochrona przed smogiem, Kontrola klimatu, Ochrona przed pogodą, Pielęgnacja zimowa, Cold Cream, Ochrona przed wiatrem, Lato, Muśnięty słońcem, Brąz, Serum w olejku, Lekki jak woda, Bezwagowy, Niewidoczny, Czysta skóra, Szczęśliwa skóra, Zdrowy, Zdrowy blask, Postbiotyk, Kombucza, Heartleaf, Wyciąg z piołunu, Trufla, Biała trufla, Kawior, Czarny kawior, Szafran, Korzeń żeń-szenia, Lukrecja, Kora wierzby, Oczar wirginijski, Ogórek, Dynia, Pestki żurawiny, Rokitnik, Jagody acai, Chia, Nasiona lnu, Owsianka koloidalna, Proteiny mleka, Kozie mleko, Ośle mleko, Pył wulkaniczny, Kaolin, Bentonit, Kalamina, Krzemionka, Resweratrol, Kwas ferulowy, Kwas azelaingowy, Kwas migdałowy, Kwas traneksamowy, Alfa-arbutyna, Glutation, Kwas bursztynowy, Lipidy, Fitosterole, Skwalen, Witamina F, Biotyna, Aminokwasy, Beta-glukan, Madekasozyd, Alantoina, Cynk PCA, Peptyd miedziowy, Adenozyna, Betaina, Saponina, Liposomy, Mikropeeling, Peeling codzienny, Laser w płynie, Zastrzyk, Mikroigły, Shot, Infuzja, Krople, Splash, Maska splash, Prasowane serum, Krem-ampułka, Wodny krem, Żel-krem, Balsam-olejek, Mleczko-olejek, Sorbet, Suflet, Ubity, Puszysty, Chmurka, Cushion, Glinka w piankę, Shake, Dwufazowy, Wielowarstwowy, Zero porów, Próżnia na pory, Zaskórniki, Wągry, Przeciw zaczerwienieniom, Kojący, Ulga, Przeciw podrażnieniom, Naprawa bariery, Cica krem, Bariera skórna, Bariera hydrolipidowa, Blokada wilgoci, Zamknięcie nawilżenia, 24h, 48h, 72h, Długotrwały, Non-stop, Ciągły, Głębokie nawilżenie, Nawadniający, Zastrzyk wodny, Fala nawilżenia, Ugaszenie pragnienia skóry, Skóra odwodniona, Skóra sucha, Skóra tłusta, Skóra mieszana, Skóra normalna, Skóra trądzikowa, Skóra wrażliwa, Skóra naczynkowa, Skóra dojrzała, Ageless, Przeciw starzeniu, Wygładzacz linii, Korektor zmarszczek, Przeciw wiotczeniu, Rzeźbienie, Konturowanie, Definiowanie, Terapia ujędrniająca, Aktywator młodości, Odnowa komórkowa, Energetyzujący, Pobudka, Przeciw zmęczeniu, Rozbudzenie skóry, Natychmiastowy blask, Korektor kolorytu, Korektor przebarwień, Tarcza pigmentacyjna, Ochrona przed słońcem, Codzienne słońce, Szerokie spektrum, Wodoodporny, Odporny na pot, Sport, Przyjazny dla oceanu, Bezpieczny dla raf, Biodegradowalny, Upcykling, Zero Waste, Ekologiczny, Zrównoważony, Wkład, Refill, Do ponownego napełniania, Recykling, Cruelty-free, Certyfikat PETA, 100% Naturalny, Dziko rosnący, Ręcznie robiony, Mała partia, Rzemieślniczy, Czysta formuła, Nietoksyczny, Bez parabenów, Bez siarczanów, Bez silikonów, Bez olejów mineralnych, Bez ftalanów, Bez mydła, Bez barwników, Bezzapachowy, Testowany alergologicznie, Udowodnione klinicznie, Zatwierdzony przez dermatologów, Stworzony przez lekarza, Kliniczny, Pielęgnacja medyczna, Oparty na nauce, Inteligentna pielęgnacja, Wysoka wydajność, Zorientowany na rezultaty, Działanie celowane, Stosowanie punktowe, Nocna naprawa, Maska na noc, Sen piękności, Pielęgnacja o północy, Księżycowy blask, Muśnięcie słońcem, Złota godzina, Brązowy blask, Ukojenie po słońcu, Chłodząca mgiełka, Krioterapia, Krio-efekt, Rozgrzewająca maska, Termiczny peeling, Rytuał SPA, Domowe SPA, Salonowa jakość, Luksusowa pielęgnacja, Pył diamentowy, Ekstrakt z pereł, 24k Złoto, Różowy kwarc, Jadeit, Ametyst, Rozświetlający do ciała, Balsam rozświetlający, Masło do ciała, Ulga dla rąk, Naprawa stóp, Pielęgnacja ust, Maska do ust, Masło do ust, Błyszczyk, Soczyste usta, Powiększenie ust, Ulga dla oczu, Rozbudzenie spojrzenia, Przeciw cieniom, Redukcja opuchlizny, Chłodzące oko, Odżywka do rzęs, Regeneracja brwi, Szyja i dekolt, Strefa T, Strefa U, Strefa docelowa, Niezbędnik podróżny, Torba na siłownię, W biegu, Codzienna rutyna, Krok 1, Krok 2, Krok 3, Przygotowanie, Baza, Zablokowanie, Wykończenie, Glossy, Błyszczący, Glazurowany, Efekt lukru, Satynowy dotyk, Kaszmirowa miękkość, Aksamitny mat, Zero błyszczenia, Kontrola sebum, Absorpcja sebum, Matujący, Bibułka matująca, Nowy start, Reset, Reset skóry, Detoks twarzy, Czysta skóra, Głębokie oczyszczanie, Oczyszczone pory, Rozświetlający peeling, Delikatny złuszczacz, Codzienne polerowanie, Wygładzona skóra, Mikropolerowanie, Odnowiona skóra, Narodzona na nowo, Obudzona, Żywa, Szczęśliwa, Ukojona, Zaopiekowana, Self-care, Uważność, Wellness
```
Cyrilic:

Крем, Сыворотка, Лосьон, Гель, Тоник, Эссенция, Ампула, Бустер, Флюид, Бальзам, Масло, Пенка, Мусс, Маска, Скраб, Пилинг, Эксфолиант, Очищающее средство, Гель для умывания, Спрей, Мист, Молочко, Эмульсия, Баттер, Диск, Пэтч, Стик, Уход, Курс, Терапия, Средство, Решение, Комплекс, Концентрат, Эликсир, Нектар, Коктейль, Гидратор, Увлажняющий крем, Питание, Защита, Барьер, Щит, Экран, Фильтр, Блокатор, Филлер, Плампер, Лифтинг, Натяжение, Разглаживание, Полировка, Осветлитель, Иллюминатор, Сияние, Блеск, Радиация, Глянец, Мат, Контроль, Баланс, Регулятор, Очиститель, Детокс, Обновление, Регенератор, Реконструктор, Восстановитель, Ремонт, Ресурфейсинг, Сглаживание, Минимизатор, Редуктор, Успокоение, Смягчение, Облегчение, Комфорт, Увлажнение, Наводнение, Продвинутый, Эксперт, Профессиональный, Ежедневный, Ночной, Активный, Чистый, Ультимативный, Алоэ, Алоэ Вера, Ши, Масло Ши, Кокос, Кокосовое масло, Авокадо, Арган, Аргановое масло, Жожоба, Миндаль, Олива, Макадамия, Роза, Розовая вода, Ромашка, Лаванда, Календула, Зеленый чай, Матча, Чайное дерево, Мята, Эвкалипт, Мед, Прополис, Маточное молочко, Молоко, Рис, Рисовая вода, Овес, Овсянка, Кофе, Кофеин, Какао, Шоколад, Уголь, Глина, Грязь, Водоросли, Морские водоросли, Морской, Улитка, Муцин, Жемчуг, Золото, Коллаген, Пептид, Витамин, Витамин C, Витамин E, Гиалурон, Гиалуроновая кислота, Ретинол, Цика, Центелла, Керамиды, Ниацинамид, Кислота, АХА, БХА, ПХА, Гликолевая, Салициловая, Молочная, Энзим, Коэнзим, Q10, Цинк, Сера, Сквалан, Пантенол, Глицерин, Бакучиол, Пробиотик, Пребиотик, Вода, Аква, Гидро, Кислород, Термальная, Ледниковая, Ягоды, Черника, Клюква, Малина, Клубника, Ежевика, Годжи, Цитрус, Лимон, Апельсин, Лайм, Грейпфрут, Мандарин, Юдзу, Витаминные фрукты, Яблоко, Персик, Абрикос, Гранат, Инжир, Арбуз, Дыня, Манго, Папайя, Ананас, Банан, Кокосовое молочко, Миндальное молочко, Овсяное молочко, Йогурт, Ваниль, Сахар, Коричневый сахар, Свойская соль, Морская соль, Тростниковый сахар, Шиповник, Масло шиповника, Виноградная косточка, Масло виноградных косточек, Масло чайного дерева, Лавандовое масло, Кактус, Агава, Лотос, Сакура, Цвет сакуры, Жасмин, Орхидея, Бамбук, Береза, Березовый сок, Сок алоэ, Конопля, Каннабис, КБД, Женьшень, Имбирь, Куркума, Корица, Стручок ванили, Шелк, Кашемир, Микрокапсулы, Кислородные пузырьки, Мягкий, Гладкий, Шелковистый, Кремовый, Бархат, Сатин, Легкий, Богатый, Насыщенный, Ультра, Мега, Супер, Экстремальный, Интенсивный, Глубокий, Быстрый, Мгновенный, Магический, Чудо, Чудесный, Секрет, Королевский, Люкс, Премиум, Сусальное золото, Алмаз, Кварц, Рубин, Гидрогель, Биоцеллюлоза, Хлопок, Бамбуковый лист, Глиняная маска, Пленка, Смываемый, Несмываемый, На ночь, Для сна, Утро, День, Солнце, Солнцезащитный крем, Санблок, После солнца, Антивозрастной, Против морщин, Замедление старения, Молодость, Молодой, Вечная молодость, Лифт, Упругость, Укрепляющий, Эластичность, Натянутый, Пружинящий, Сочный, Свежий, Осветление, Охлаждающий, Ледяной, Разогревающий, Горячий, Эффект сауны, Поры, Уход за порами, Сужение порор, Минимизатор пор, Против акне, Чистый, Ясный, Чистота, Спот, Точечный уход, SOS, Скорая помощь, Высыпания, Отбеливание, Осветление тона, Против пигментных пятен, Тон, Выравнивание тона, Безупречный, Эффект стеклянной кожи, Влажное сияние, Водный блеск, Молочный, Молочный блеск, Нюд, Обнаженный, Натуральный, Органический, Эко, Био, Чистая красота, Веганский, Без жестокости, Ботанический, Травяной, Растительный, Дерматологический, Протестировано, Гипоаллергенно, Чувствительный, Безопасный, Деликатный, Мягкий, Без слез, Семейный, Унисекс, Для мужчин, Мужской, Дорожный, Мини, Карманный, Стартовый набор, Набор, Ежедневный уход, Мульти, Многофункциональный, Все в одном, 3 в 1, 5 в 1, Универсальный, Глобальный, Тотальный, Комплексный уход, Полный, Идеальный, Перфекция, Необходимый, Базовый, База, Финиш, Спрей-и-гоу, Быстросохнущий, Тающий, Сорбет, Капля воды, Желе, Пудинг, Аква-гель, Без масел, На водной основе, Без спирта, Без отдушек, Без парфюма, Очищение и увлажнение, Мытье и скраб, 2 шага, Двойной, Подвойное очищение, Магические капли, Автозагар, Загар, Бронзер, Шиммер, Глиттер, Блестки, Алмазный блеск, Металлик, Фольга, Магнитный, Нагревающий, Пузырьковый, Газированный, Шипучий, Мультивитаминный, Суперфуд, Суперфрукт, Овощной, Зеленый, Очищающий от токсинов, Защита от загрязнений, Городской, Городской щит, Защита от смога, Климат-контроль, Защита от непогоды, Зимний уход, Колд-крем, Защита от ветра, Лето, Поцелованный солнцем, Бронза, Бустер сияния, Сыворотка в масле, Эмульсия в воде, Легкий как вода, Невесомый, Невидимый, Чистая кожа, Счастливая кожа, Здоровый, Здоровый блеск, Постбиотик, Комбуча, Гуттуиния, Полынь, Экстракт полыни, Трюфель, Белый трюфель, Кавьяр, Черная икра, Шафран, Корень женьшеня, Солодка, Кора ивы, Гамамелис, Огурец, Тыква, Семена клюквы, Облепиха, Ягоды асаи, Чиа, Семена льна, Коллоидная овсянка, Молочный протеин, Козье молоко, Ослиное молоко, Вулканический пепел, Каолин, Бентонит, Каламин, Кремний, Ресвератрол, Феруловая кислота, Азелаиновая кислота, Миндальная кислота, Транексамовая кислота, Альфа-арбутин, Глутатион, Янтарная кислота, Липиды, Фитостеролы, Сквален, Витамин F, Биотин, Аминокислоты, Бета-глюкан, Мадекассосид, Аллантоин, Пантетин, Цинк ПКА, Медный пептид, Аденозин, Бетаин, Сапонины, Липосомы, Микропилинг, Ежедневный пилинг, Жидкий лазер, Инъекция, Микроиглы, Шот, Инфузия, Капли, Сплеш, Сплеш-маска, Прессованная сыворотка, Ампула в креме, Водный крем, Гель-крем, Бальзам-в-масло, Молочко-в-масло, Сорбет, Суфле, Взбитый, Воздушный, Облако, Кушон, Глина в пенку, Шейк, Двухфазный, Многослойный, Зеро пор, Вакуум для пор, Черные точки, Комедоны, Против покраснений, Успокаивающий, Рельеф, Против раздражений, Восстановление барьера, Цика-крем, Кожный барьер, Гидролипидный барьер, Замок влаги, Запечатывание влаги, 24ч, 48ч, 72ч, Длительный, Нон-стоп, Непрерывный, Глубокое увлажнение, Влагонаполняющий, Водный укол, Волна увлажнения, Утоление жажды кожи, Обезвоженная кожа, Сухая кожа, Жирная кожа, Комбинированная кожа, Нормальная кожа, Склонная к акне, Чувствительная кожа, Куперозная кожа, Зрелая кожа, Без возраста, Против старения, Коррекция морщин, Против обвисания, Моделирование, Контуринг, Скульптурирование, Подтягивающая терапия, Активатор молодости, Клеточное обновление, Энергия клеток, Энергизирующий, Пробуждение, Против усталости, Бустер радиации, Мгновенная яркость, Корректор тона, Корректор пигментации, Пигментный щит, Солнечная защита, Объятия солнца, Солнце на каждый день, Городское солнце, Широкий спектр, Водостойкий, Устойчивый к поту, Спорт, Безопасный для океана, Безопасный для рифов, Биоразлагаемый, Апсайклинг, Ноль отходов, Экологичный, Устойчивый, Рефил, Сменный блок, Перерабатываемый, Без жестокости, Одобрено PETA, 100% Натуральный, Дикорастущий, Ручная работа, Малая партия, Крафтовый, Чистая формула, Нетоксичный, Без парабенов, Без сульфатов, Без силиконов, Без минеральных масел, Без фталатов, Без мыла, Без красителей, Без запаха, Проверено на аллергию, Клинически доказано, Одобрено дерматологами, Разработано врачом, Клинический, Медицинский уход, Научный подход, Умный уход, Высокая эффективность, Работа на результат, Целевое действие, Точечное нанесение, Ночное восстановление, Маска для сна, Сон красоты, Полночное восстановление, Лунное сияние, Мушкет солнца, Золотой час, Бронзовый блеск, Успокоение после солнца, Охлаждающий мист, Криотерапия, Крио-эффект, Разогревающая маска, Термический скраб, Спа-ритуал, Домашнее спа, Салонное качество, Роскошный уход, Алмазная пыль, Экстракт жемчуга, 24к Золото, Розовый кварц, Нефрит, Аметист, Мерцание тела, Лосьон-блеск, Крем-баттер для тела, Облегчение для рук, Ремонт стоп, Уход за губами, Маска для губ, Масло для губ, Глазурь для губ, Сочные губы, Объем губ, Отдых для глаз, Пробуждение взгляда, Против темных кругов, Уменьшение отечности, Снятие отеков, Охлаждение глаз, Бустер ресниц, Восстановление бровей, Шея и декольте, Т-зона, U-зона, Целевая зона, Мультизона, Дорожный мастхэв, Набор для зала, На бегу, Ежедневная рутина, Шаг 1, Шаг 2, Шаг 3, Подготовка, Праймер, Фиксация, Финиш, Глянцевый, Блеск, Глазированный, Эффект пончика, Сатиновое касание, Кашемировая мягкость, Бархатный мат, Ноль блеска, Себум-контроль, Абсорбция масла, Матирование, Матирующие салфетки, Свежий старт, Перезагрузка, Перезагрузка кожи, Детокс лица, Чистая кожа, Глубокое очищение, Очищенные поры, Отшелушивающее сияние, Мягкий пилинг, Ежедневная полировка, Выглаженная кожа, Микрополировка, Обновленная кожа, Рожденная заново, Пробужденная, Живая, Счастливая, Успокоенная, Окруженная заботой, Селф, Осознанность, Велнес

**Additional coverage — round 2 (2026-07-16 gap-fill pass).** A handful
of common category/product-type words were confirmed missing from the
lists above — mostly decorative-cosmetics and specific format nouns that
matter for `categoryDetector.ts` even though the app's core focus is
skincare, since these words appear on the same shelf and can help rule
out false brand matches (a word like "Foundation" appearing near an
unrecognized brand string is a strong category signal):

```
English:  Foundation, Concealer, Blush, Sheet Mask, Micellar Water,
          Setting Spray, Makeup Remover, Lip Tint, Cushion Foundation,
          Eyeshadow, Eyeliner, Mascara, Brow Gel, Setting Powder

French:   Fond de Teint, Anticernes, Blush, Masque en Tissu,
          Eau Micellaire, Spray Fixateur, Démaquillant, Teinte Lèvres,
          Cushion, Fard à Paupières, Eyeliner, Mascara, Gel Sourcils,
          Poudre Fixante

Polish:   Podkład, Korektor, Róż, Maska w Płacie, Woda Micelarna,
          Spray Utrwalający, Płyn Micelarny, Zmywacz Makijażu,
          Tint do Ust, Cushion, Cień do Powiek, Eyeliner, Tusz do Rzęs,
          Żel do Brwi, Puder Utrwalający

Russian:  Тональный крем, Консилер, Румяна, Тканевая маска,
          Мицеллярная вода, Спрей-фиксатор, Средство для снятия
          макияжа, Тинт для губ, Кушон, Тени для век, Подводка,
          Тушь для ресниц, Гель для бровей, Фиксирующая пудра
```

## 6. OCR failure patterns & mitigation notes

This section is not a brand/term list — it's a catalogue of *why* OCR
misses or mismatches on this product category, so `ocrNormaliser.ts`
and the disambiguation UI can account for each failure mode explicitly
rather than relying on the dictionary alone.

### 6.1 Physical/optical failure modes (no dictionary fix — needs UX/capture handling)

- **Foil and embossed text (no color contrast).** Common on K-Beauty
  premium lines (Beauty of Joseon, d'Alba, Sulwhasoo) and Western premium
  (La Mer, La Prairie, Valmont). ML Kit frequently returns nothing or
  garbage because there's no luminance difference between text and
  background. Mitigation is capture-side (flash prompt, angle guidance),
  not dictionary-side.
- **White/light-gray text on white or light packaging.** Common on
  minimalist Polish/Nordic-style brands (Clochee, Veoli Botanica,
  Resibo, BasicLab, MÁDARA, Ecooking). Same low-contrast failure as foil.
- **Multi-language EU labels.** European packaging often repeats the
  product name across 6–8 languages with no visual separator — the huge
  overlap between Section 5's English/French/Polish term lists above is
  itself evidence of this (many of the same marketing words appear
  verbatim across all three). The capture pipeline needs a heuristic for
  "largest/first font block" rather than assuming the first text line is
  the product name, or it may lock onto a translated block instead of
  the primary name.
- **Distributor sticker over original label.** Per the sticker-test
  marketing angle in the business plan, OCR can capture both layers at
  once if the original label shows through a semi-transparent or
  poorly-aligned sticker, producing a garbled merged string. Flag this
  case (unusually high character noise / non-dictionary tokens) and route
  to manual entry rather than attempting a fuzzy match on garbage input.
- **PAO icon and certification marks mis-read as text.** The open-jar PAO
  symbol ("12M", "6M", "24M"), vegan/cruelty-free/PETA/CE/green-dot icons
  are sometimes OCR'd as stray characters and pollute the candidate
  string — note Section 5 already lists many of these as legitimate
  marketing terms (`PETA Approved`, `Cruelty-Free`, `100% Natural`), so
  the filter needs to distinguish "icon fragment" noise from genuine
  printed claim text, not strip all of it.
- **Digit/letter confusion in batch codes and active-ingredient
  percentages.** 0/O, 1/I/l, 5/S, 8/B confusion is especially damaging
  for products whose *name* includes a percentage (BasicLab "10%", The
  Ordinary "2%", Q+A's percentage-based naming) — this corrupts the
  product identifier, not just the brand, so percentage-like substrings
  should get a dedicated regex pass rather than generic fuzzy correction.
- **Diacritics dropped or substituted.** Polish ą/ć/ę/ł/ń/ó/ś/ź/ż and
  French é/è/ê/ï/ô/û/ç are frequently OCR'd as their ASCII equivalent
  (ł→l, ż→z, é→e) at small font sizes — several Section 1 brand names
  already carry this risk (`Lancôme`, `L'Occitane`, `Björk & Berries`,
  `Rå Organic Skincare`, `Havlíkova Přírodní Apotéka`). Russian Ё is
  often printed as Е on packaging itself (not an OCR error — a real
  orthographic convention), so treat Е as a valid match for Ё in the
  Cyrillic pool rather than two separate tokens. Normalize diacritics on
  both the OCR output *and* the dictionary before trigram comparison,
  rather than relying on having both accented and unaccented dictionary
  entries for every brand.
- **Extremely long Section 5 term lists increase false-positive risk.**
  With ~500 marketing terms per language, generic words like "Complex",
  "Solution", "Active", "Total", "Complete" are common enough that they
  can accidentally score a fuzzy match against unrelated short brand
  names (see §6.2). Category-term matching should run as a *separate*
  pass from brand matching, not merged into the same candidate pool —
  a term match should never suppress or outrank a brand match.

### 6.2 Confusable brand pairs (dictionary-side — needs disambiguation, not silent correction)

These pairs are close enough in trigram distance that a naive top-score
match can silently "correct" one into the other. When OCR output scores
close to two or more of these simultaneously (score delta below the
tuning threshold — worth testing but likely somewhere in the 0.05–0.1
range once real OCR data is available), **do not auto-pick the top
match**. Surface both as tappable candidates and let the user confirm
which one is actually on their packaging — this is safer than a
confident wrong guess in both directions, and it costs the user one tap.

```
Nivea        ↔ Nuxe
Isana        ↔ Isntree
Mixa         ↔ Aravia (short OCR fragments) / Q+A (via shared "A")
Etude        ↔ Estee (Lauder)
Klairs       ↔ Clarins
Missha       ↔ (generic OCR noise resembling "Mishka")
Balea        ↔ Babe Laboratorios / Babelaboratorios
Dilis        ↔ DTMS (short fragments)
Kora         ↔ Korres
Celimax      ↔ Celia
Tocobo       ↔ Tolpa (short OCR fragments only, e.g. "Toc" vs "Tol")
Skin1004     ↔ Skinfood (when the numeral is dropped/misread)
Torriden     ↔ Tirtir
Mizon        ↔ Mixon / Mixsoon
Sesderma     ↔ Sensilab
Farmona      ↔ Farmapol / Farmon
Bandi        ↔ Bandiz
Isdin        ↔ Isana (short fragments)
Purito       ↔ Purite
Openface     ↔ Openeye (The U Openeye)
```

Implementation note: this list should live alongside the dictionary as
`CONFUSABLE_PAIRS: [string, string][]` and be checked *after* the
trigram candidate list is generated, not before — it's a tie-breaker /
disambiguation trigger, not a filter.

### 6.3 Product-line names that resolve to a different parent brand

OCR frequently captures a *sub-line* name instead of the house brand,
especially when the frame is tight on the product and doesn't include
the top of the label where the parent brand sits. If the line name is
matched but the parent brand isn't found in the same OCR pass, surface
the parent brand as the suggested correction (with the line name kept as
free text in the product name field, not discarded).

```
Line name                    → Parent brand
Revitalift                   → L'Oreal Paris
Hydra Zen                    → Lancôme
Capillus                     → BasicLab
Esteticus                    → BasicLab
Acidumis                     → BasicLab
Protecticus                  → BasicLab
Micellis                     → BasicLab
Lipikar                      → La Roche-Posay
Cicaplast                    → La Roche-Posay
Effaclar                     → La Roche-Posay
Toleriane                    → La Roche-Posay
Liftactiv                    → Vichy
Mineral 89                   → Vichy
Hyalu B5                     → La Roche-Posay
Sensibio                     → Bioderma
Hydrabio                     → Bioderma
Cicabio                      → Bioderma
Photoderm                    → Bioderma
Nacomi Next Level            → Nacomi
The U Openeye                → The U (Geltek)
Aravia Professional          → Aravia
Aravia Laboratories          → Aravia
```

This list is necessarily incomplete — it should grow from real scan
misses the same way the brand dictionary does (see caveat 2 below), and
is a good candidate for the community "not found, add manually"
pipeline: when a manual submission's OCR-extracted text matches a known
line name but a different brand than what the user typed, that's a
strong signal to add the pair here.

### 6.4 Suggested UX pattern: offer both, let the user pick

For both confusable pairs (§6.2) and line-name resolution (§6.3), the
`DisambiguationSheet` component (already speced in `db-setup-guide.md`
Sprint 4) is the right mechanism — it should trigger not only on
multiple database candidates, but also on a dictionary-level ambiguity
before the database query even runs. Never silently pick one; the cost
of asking is one tap, the cost of a wrong silent auto-correct is either
a misfiled product or, worse, a wrong ingredient list attached under
someone else's brand.

---

## Caveats before wiring this into code

1. **This list is not verified against real packaging** — it's compiled
   from retailer/directory listings, which don't always match the exact
   capitalization, spacing, or punctuation printed on a physical product.
   Before shipping, spot-check a sample against real product photos,
   ideally the same set used for OCR testing (e.g. the Bioderma jar
   already used in QA).
2. **Coverage will always lag reality** — new SKUs and rebrands happen
   constantly. Treat this as a starting seed, not a closed list; the
   dictionary should be easy to extend without a full app release if
   possible (e.g. loaded from a bundled JSON asset rather than hardcoded
   inline, so it can be updated independently of a store release cycle).
   This applies equally to the confusable-pairs and line-name tables in
   §6 — they should grow from real scan-miss data, not stay frozen at
   this initial seed.
3. **Don't auto-correct silently.** Per the earlier discussion, a
   dictionary match should surface as a suggestion the user can accept or
   ignore — never silently overwrite what OCR actually returned, since a
   real (rarer) brand name could get "corrected" into a more common
   neighbor.
4. **Cyrillic transliterations in Section 3 need a native-speaker check**
   before shipping — retailer listings sometimes use inconsistent
   spelling/spacing compared to what's actually printed on packaging.