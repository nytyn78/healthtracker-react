export type Ingredient = { hi: string; en: string; qty: string }
export type Step = { hi: string; en: string }
export type Meal = {
  name: string; time: string
  protein: number; carbs: number; fat: number; cal: number
  ingredients: Ingredient[]; steps: Step[]
}
export type GroceryItem = { hi: string; en: string; qty: string }
export type DayPlan = {
  day: string; theme: string
  meals: Meal[]; shake: boolean
  grocery: GroceryItem[]
  totals: { protein: number; carbs: number; fat: number; cal: number }
}

export const KETO_PLAN: DayPlan[] = [
  {
    day: "Monday", theme: "Andhra Egg Masala & Bhuna Paneer Tikka",
    meals: [
      { name: "Andhra Egg Masala with Bhuna Paneer", time: "2:00 PM", protein: 40, carbs: 13, fat: 54, cal: 698,
        ingredients: [
          { hi: "3 पूरे अंडे — उबले और छिले", en: "3 whole eggs — boiled and peeled", qty: "3" },
          { hi: "80 ग्राम पनीर — मोटे क्यूब्स", en: "80g paneer — thick cubes", qty: "80g" },
          { hi: "2 छोटे चम्मच घी", en: "2 tsp ghee", qty: "2 tsp" },
          { hi: "¼ छोटा प्याज — बारीक कटा", en: "¼ small onion — finely chopped", qty: "30g" },
          { hi: "½ छोटा टमाटर — बारीक कटा", en: "½ small tomato — finely chopped", qty: "50g" },
          { hi: "1 छोटा चम्मच लाल मिर्च पाउडर", en: "1 tsp red chilli powder", qty: "1 tsp" },
          { hi: "नमक, जीरा, करी पत्ता, हरा धनिया", en: "Salt, cumin, curry leaves, fresh coriander", qty: "to taste" },
        ],
        steps: [
          { hi: "घी गरम करें — जीरा, करी पत्ता तड़काएं — 20 सेकंड", en: "Heat ghee — splutter cumin and curry leaves — 20 sec" },
          { hi: "प्याज डालें — 2 मिनट सुनहरा भूनें", en: "Add onion — fry 2 min until golden" },
          { hi: "टमाटर — 2 मिनट तेल छूटने तक", en: "Add tomato — bhuno 2 min until oil separates" },
          { hi: "पनीर क्यूब्स डालें — 2 मिनट भूनें", en: "Add paneer cubes — bhuno 2 min" },
          { hi: "उबले अंडे आधे काटें — मसाले में डालें — 1 मिनट", en: "Halve boiled eggs — fold into masala — 1 min on low" },
          { hi: "हरा धनिया गार्निश — गरम परोसें", en: "Garnish with fresh coriander — serve hot" },
        ],
      },
      { name: "Tandoori Paneer Bhurji with Smoky Egg Tadka", time: "6:30 PM", protein: 43, carbs: 8, fat: 50, cal: 646,
        ingredients: [
          { hi: "100 ग्राम पनीर — कद्दूकस", en: "100g paneer — grated", qty: "100g" },
          { hi: "3 पूरे अंडे", en: "3 whole eggs", qty: "3" },
          { hi: "2 छोटे चम्मच घी", en: "2 tsp ghee", qty: "2 tsp" },
          { hi: "1 छोटा चम्मच तंदूरी मसाला", en: "1 tsp tandoori masala", qty: "1 tsp" },
          { hi: "नमक, लाल मिर्च, हरा धनिया", en: "Salt, red chilli, fresh coriander", qty: "to taste" },
        ],
        steps: [
          { hi: "घी में प्याज, हरी मिर्च — 1 मिनट", en: "Heat ghee — fry onion and green chilli — 1 min" },
          { hi: "तंदूरी मसाला — 30 सेकंड भूनें", en: "Add tandoori masala — bhuno 30 sec" },
          { hi: "अंडे फोड़ें — भुर्जी बनाएं", en: "Crack eggs in — make bhurji" },
          { hi: "कद्दूकस पनीर मिलाएं — 1 मिनट", en: "Fold in grated paneer — 1 min" },
          { hi: "तड़का डालें — हरा धनिया — परोसें", en: "Pour tadka on top — fresh coriander — serve" },
        ],
      },
    ],
    shake: true,
    grocery: [
      { hi: "अंडे", en: "Eggs", qty: "6" }, { hi: "पनीर (फुल फैट)", en: "Paneer (full fat)", qty: "200g" },
      { hi: "घी", en: "Ghee", qty: "4 tsp" }, { hi: "खीरा या मूली", en: "Cucumber or Mooli", qty: "1" },
    ],
    totals: { protein: 83, carbs: 21, fat: 104, cal: 1344 },
  },
  {
    day: "Tuesday", theme: "Egg Bhuna Masala & Paneer Lababdar",
    meals: [
      { name: "Bhuna Egg Masala with Paneer Lababdar", time: "2:00 PM", protein: 41, carbs: 12, fat: 55, cal: 703,
        ingredients: [
          { hi: "3 पूरे अंडे — उबले", en: "3 whole eggs — hard boiled", qty: "3" },
          { hi: "80 ग्राम पनीर — मोटे क्यूब्स", en: "80g paneer — thick cubes", qty: "80g" },
          { hi: "2 टेबलस्पून ताज़ी क्रीम", en: "2 tbsp fresh cream", qty: "2 tbsp" },
          { hi: "2 छोटे चम्मच मक्खन", en: "2 tsp butter", qty: "2 tsp" },
          { hi: "नमक, जीरा, कसूरी मेथी", en: "Salt, cumin, kasuri methi", qty: "to taste" },
        ],
        steps: [
          { hi: "मक्खन गरम करें — जीरा — प्याज 2 मिनट सुनहरा", en: "Melt butter — cumin — fry onion 2 min golden" },
          { hi: "टमाटर — 3 मिनट तेल छूटने तक", en: "Add tomato — bhuno 3 min until oil separates" },
          { hi: "पनीर — क्रीम — 2 मिनट", en: "Add paneer — cream — 2 min" },
          { hi: "उबले अंडे आधे काटें — ग्रेवी में डालें", en: "Halve boiled eggs — fold into gravy" },
          { hi: "कसूरी मेथी मसलकर — गरम परोसें", en: "Crush kasuri methi — serve hot" },
        ],
      },
      { name: "Masaledar Omelette with Hariyali Paneer", time: "6:30 PM", protein: 42, carbs: 9, fat: 52, cal: 664,
        ingredients: [
          { hi: "4 पूरे अंडे", en: "4 whole eggs", qty: "4" },
          { hi: "80 ग्राम पनीर — मोटे क्यूब्स", en: "80g paneer — thick cubes", qty: "80g" },
          { hi: "2 छोटे चम्मच घी", en: "2 tsp ghee", qty: "2 tsp" },
          { hi: "2 टेबलस्पून हरी चटनी", en: "2 tbsp green chutney", qty: "2 tbsp" },
          { hi: "नमक, लाल मिर्च, चाट मसाला", en: "Salt, red chilli, chaat masala", qty: "to taste" },
        ],
        steps: [
          { hi: "पनीर — घी में सुनहरे होने तक — हरी चटनी में टॉस", en: "Fry paneer in ghee until golden — toss in green chutney" },
          { hi: "अंडे फेंटें — प्याज, मिर्च मिलाएं", en: "Whisk eggs with onion, chilli" },
          { hi: "घी में अंडे डालें — फैलाएं", en: "Heat ghee — pour eggs — spread" },
          { hi: "पनीर एक तरफ रखें — मोड़ें — परोसें", en: "Place paneer on one half — fold — serve" },
        ],
      },
    ],
    shake: true,
    grocery: [
      { hi: "अंडे", en: "Eggs", qty: "7" }, { hi: "पनीर", en: "Paneer", qty: "180g" },
      { hi: "ताज़ी क्रीम", en: "Fresh cream", qty: "2 tbsp" }, { hi: "घी", en: "Ghee", qty: "3 tsp" },
    ],
    totals: { protein: 83, carbs: 21, fat: 107, cal: 1367 },
  },
  {
    day: "Wednesday", theme: "Achari Paneer & Masala Omelette",
    meals: [
      { name: "Achari Paneer with Boiled Eggs", time: "2:00 PM", protein: 38, carbs: 11, fat: 52, cal: 668,
        ingredients: [
          { hi: "150 ग्राम पनीर — मोटे क्यूब्स", en: "150g paneer — thick cubes", qty: "150g" },
          { hi: "2 पूरे अंडे — उबले", en: "2 whole eggs — hard boiled", qty: "2" },
          { hi: "1 छोटा चम्मच अचार मसाला", en: "1 tsp pickle masala", qty: "1 tsp" },
          { hi: "नमक, हल्दी, सरसों, अमचूर", en: "Salt, turmeric, mustard, amchur", qty: "to taste" },
        ],
        steps: [
          { hi: "घी में सरसों, सौंफ — चटखने दें", en: "Heat ghee — mustard seeds, fennel — splutter" },
          { hi: "प्याज — टमाटर — 2 मिनट", en: "Add onion — tomato — 2 min" },
          { hi: "अचार मसाला — पनीर — 2 मिनट", en: "Add pickle masala — paneer — 2 min" },
          { hi: "उबले अंडे मिलाएं — परोसें", en: "Fold in boiled eggs — serve" },
        ],
      },
      { name: "Masala Paneer Stuffed Omelette", time: "6:30 PM", protein: 37, carbs: 4, fat: 49, cal: 600,
        ingredients: [
          { hi: "3 पूरे अंडे", en: "3 whole eggs", qty: "3" },
          { hi: "80 ग्राम पनीर — कद्दूकस", en: "80g paneer — grated", qty: "80g" },
          { hi: "2 छोटे चम्मच घी", en: "2 tsp ghee", qty: "2 tsp" },
          { hi: "नमक, जीरा, चाट मसाला", en: "Salt, cumin, chaat masala", qty: "to taste" },
        ],
        steps: [
          { hi: "अंडे फेंटें — नमक, जीरा मिलाएं", en: "Whisk eggs with salt, cumin" },
          { hi: "पनीर में मसाला मिलाएं — स्टफिंग तैयार", en: "Mix spices into paneer — stuffing ready" },
          { hi: "घी में अंडे — पनीर एक तरफ — मोड़ें", en: "Eggs in ghee — paneer on half — fold" },
          { hi: "गरम परोसें", en: "Serve hot" },
        ],
      },
    ],
    shake: true,
    grocery: [
      { hi: "अंडे", en: "Eggs", qty: "5" }, { hi: "पनीर", en: "Paneer", qty: "250g" },
      { hi: "घी", en: "Ghee", qty: "4 tsp" },
    ],
    totals: { protein: 75, carbs: 15, fat: 101, cal: 1268 },
  },
  {
    day: "Thursday", theme: "Egg Keema & Chilli Paneer",
    meals: [
      { name: "Egg Keema with Paneer", time: "2:00 PM", protein: 43, carbs: 12, fat: 53, cal: 693,
        ingredients: [
          { hi: "4 पूरे अंडे — उबले और कटे", en: "4 whole eggs — boiled and chopped", qty: "4" },
          { hi: "80 ग्राम पनीर — क्रम्बल्ड", en: "80g paneer — crumbled", qty: "80g" },
          { hi: "2 छोटे चम्मच घी", en: "2 tsp ghee", qty: "2 tsp" },
          { hi: "नमक, हल्दी, गरम मसाला, धनिया", en: "Salt, turmeric, garam masala, coriander", qty: "to taste" },
        ],
        steps: [
          { hi: "घी — प्याज 2 मिनट — अदरक-लहसुन 1 मिनट", en: "Ghee — onion 2 min — ginger-garlic 1 min" },
          { hi: "टमाटर — मसाले — 2 मिनट तेल छूटने तक", en: "Tomato — spices — 2 min until oil separates" },
          { hi: "क्रम्बल्ड पनीर — 2 मिनट", en: "Crumbled paneer — 2 min" },
          { hi: "कटे अंडे मिलाएं — गाढ़ा करें", en: "Chopped eggs in — thicken — serve" },
        ],
      },
      { name: "Chilli Paneer with Egg Bhurji", time: "6:30 PM", protein: 42, carbs: 9, fat: 49, cal: 641,
        ingredients: [
          { hi: "100 ग्राम पनीर — बड़े टुकड़े", en: "100g paneer — large cubes", qty: "100g" },
          { hi: "3 पूरे अंडे", en: "3 whole eggs", qty: "3" },
          { hi: "30 ग्राम शिमला मिर्च", en: "30g capsicum", qty: "30g" },
          { hi: "1 छोटा चम्मच सोया सॉस", en: "1 tsp soy sauce", qty: "1 tsp" },
          { hi: "नमक, काली मिर्च, लहसुन", en: "Salt, black pepper, garlic", qty: "to taste" },
        ],
        steps: [
          { hi: "पनीर — घी — सभी तरफ से क्रिस्पी", en: "Fry paneer in ghee — crispy on all sides" },
          { hi: "प्याज, शिमला मिर्च, लहसुन — 2 मिनट तेज़ आंच", en: "Onion, capsicum, garlic — 2 min high flame" },
          { hi: "सोया सॉस, मिर्च — पनीर वापस — टॉस", en: "Soy sauce, chilli — add back paneer — toss" },
          { hi: "अंडे भुर्जी बनाएं — साथ परोसें", en: "Make egg bhurji — serve alongside" },
        ],
      },
    ],
    shake: true,
    grocery: [
      { hi: "अंडे", en: "Eggs", qty: "7" }, { hi: "पनीर", en: "Paneer", qty: "200g" },
      { hi: "शिमला मिर्च", en: "Capsicum", qty: "30g" }, { hi: "घी", en: "Ghee", qty: "4 tsp" },
    ],
    totals: { protein: 85, carbs: 21, fat: 102, cal: 1334 },
  },
  {
    day: "Friday", theme: "Smoky Dhaba Egg Curry & Paneer Tikka",
    meals: [
      { name: "Smoky Dhaba-Style Egg Curry with Paneer", time: "2:00 PM", protein: 43, carbs: 13, fat: 55, cal: 711,
        ingredients: [
          { hi: "3 पूरे अंडे — उबले", en: "3 whole eggs — hard boiled", qty: "3" },
          { hi: "100 ग्राम पनीर — मोटे क्यूब्स", en: "100g paneer — thick cubes", qty: "100g" },
          { hi: "2 छोटे चम्मच घी", en: "2 tsp ghee", qty: "2 tsp" },
          { hi: "नमक, हल्दी, कसूरी मेथी, गरम मसाला", en: "Salt, turmeric, kasuri methi, garam masala", qty: "to taste" },
        ],
        steps: [
          { hi: "अंडों पर निशान लगाएं — घी में सुनहरे करें", en: "Score eggs — fry in ghee until golden — set aside" },
          { hi: "प्याज — अदरक-लहसुन — टमाटर — मसाले — 3 मिनट", en: "Onion — ginger-garlic — tomato — spices — 3 min" },
          { hi: "पनीर — 2 मिनट — पानी — अंडे — ढकें — 2 मिनट", en: "Paneer — 2 min — water — eggs — cover — 2 min" },
          { hi: "कसूरी मेथी — गरम मसाला — गाढ़ा धाबा स्वाद", en: "Kasuri methi — garam masala — thick dhaba flavour" },
        ],
      },
      { name: "Paneer Tikka with Masala Eggs", time: "6:30 PM", protein: 41, carbs: 9, fat: 50, cal: 642,
        ingredients: [
          { hi: "100 ग्राम पनीर — बड़े क्यूब्स", en: "100g paneer — large cubes", qty: "100g" },
          { hi: "3 पूरे अंडे — उबले", en: "3 whole eggs — hard boiled", qty: "3" },
          { hi: "2 टेबलस्पून दही", en: "2 tbsp curd", qty: "2 tbsp" },
          { hi: "1 छोटा चम्मच तंदूरी मसाला", en: "1 tsp tandoori masala", qty: "1 tsp" },
          { hi: "नमक, लाल मिर्च, नींबू", en: "Salt, red chilli, lemon", qty: "to taste" },
        ],
        steps: [
          { hi: "पनीर — दही, तंदूरी मसाला — 15 मिनट", en: "Marinate paneer in curd, tandoori masala — 15 min" },
          { hi: "तवे पर घी — पनीर — हर साइड 2 मिनट", en: "Ghee on tawa — paneer — 2 min each side — charred" },
          { hi: "जीरा, लाल मिर्च तड़का — अंडे कोट करें", en: "Cumin, red chilli tadka — coat boiled eggs" },
          { hi: "टिक्का पनीर और मसाला अंडे साथ परोसें", en: "Serve tikka paneer alongside masala eggs" },
        ],
      },
    ],
    shake: true,
    grocery: [
      { hi: "अंडे", en: "Eggs", qty: "6" }, { hi: "पनीर", en: "Paneer", qty: "220g" },
      { hi: "दही", en: "Curd", qty: "2 tbsp" }, { hi: "घी", en: "Ghee", qty: "4 tsp" },
    ],
    totals: { protein: 84, carbs: 22, fat: 105, cal: 1353 },
  },
  {
    day: "Saturday", theme: "Lahori Egg Masala & Amritsari Bhurji",
    meals: [
      { name: "Lahori Egg Masala with Paneer", time: "2:00 PM", protein: 41, carbs: 13, fat: 54, cal: 698,
        ingredients: [
          { hi: "3 पूरे अंडे — उबले", en: "3 whole eggs — hard boiled", qty: "3" },
          { hi: "80 ग्राम पनीर — मोटे क्यूब्स", en: "80g paneer — thick cubes", qty: "80g" },
          { hi: "1 छोटा चम्मच मक्खन + 2 छोटे चम्मच घी", en: "1 tsp butter + 2 tsp ghee", qty: "" },
          { hi: "नमक, काली मिर्च, लाल मिर्च भरपूर", en: "Salt, black pepper, red chilli generously", qty: "to taste" },
        ],
        steps: [
          { hi: "घी में जीरा — प्याज 2 मिनट", en: "Ghee — cumin — onion 2 min" },
          { hi: "टमाटर, लाल मिर्च, काली मिर्च — 3 मिनट", en: "Tomato, chilli, black pepper — 3 min" },
          { hi: "पनीर — मक्खन — रिच और कोटेड", en: "Paneer — butter — rich and coated" },
          { hi: "उबले अंडे — ग्रेवी में — परोसें", en: "Boiled eggs — into gravy — serve" },
        ],
      },
      { name: "Amritsari Egg Bhurji with Paneer", time: "6:30 PM", protein: 42, carbs: 8, fat: 51, cal: 655,
        ingredients: [
          { hi: "4 पूरे अंडे", en: "4 whole eggs", qty: "4" },
          { hi: "80 ग्राम पनीर — कद्दूकस", en: "80g paneer — grated", qty: "80g" },
          { hi: "2 छोटे चम्मच घी", en: "2 tsp ghee", qty: "2 tsp" },
          { hi: "नमक, हल्दी, लाल मिर्च, धनिया", en: "Salt, turmeric, red chilli, coriander", qty: "to taste" },
        ],
        steps: [
          { hi: "घी में प्याज, मिर्च — 2 मिनट", en: "Ghee — onion, chilli — 2 min" },
          { hi: "टमाटर, मसाले — 2 मिनट", en: "Tomato, spices — 2 min" },
          { hi: "अंडे फोड़ें — धीरे हिलाएं", en: "Crack eggs — stir slowly" },
          { hi: "पनीर मिलाएं — हरा धनिया — परोसें", en: "Fold in paneer — coriander — serve" },
        ],
      },
    ],
    shake: true,
    grocery: [
      { hi: "अंडे", en: "Eggs", qty: "7" }, { hi: "पनीर", en: "Paneer", qty: "180g" },
      { hi: "मक्खन", en: "Butter", qty: "1 tsp" }, { hi: "घी", en: "Ghee", qty: "4 tsp" },
    ],
    totals: { protein: 83, carbs: 21, fat: 105, cal: 1353 },
  },
  {
    day: "Sunday", theme: "🌟 Special Egg Curry & Paneer (Weekend)",
    meals: [
      { name: "Special Egg Curry with Paneer", time: "2:00 PM", protein: 43, carbs: 12, fat: 54, cal: 702,
        ingredients: [
          { hi: "4 पूरे अंडे — उबले", en: "4 whole eggs — boiled", qty: "4" },
          { hi: "150 ग्राम पनीर — टुकड़े", en: "150g paneer — cubed", qty: "150g" },
          { hi: "3 छोटे चम्मच घी", en: "3 tsp ghee", qty: "3 tsp" },
          { hi: "जीरा, धनिया, हल्दी, गरम मसाला", en: "Cumin, coriander, turmeric, garam masala", qty: "to taste" },
        ],
        steps: [
          { hi: "4 अंडे 12 मिनट उबालें — छीलें — आधे काटें", en: "Boil 4 eggs 12 min — peel — halve" },
          { hi: "घी, जीरा, प्याज — 3 मिनट", en: "Ghee, cumin, onion — 3 min" },
          { hi: "टमाटर — 4 मिनट गाढ़ी होने तक", en: "Tomato — 4 min until thick" },
          { hi: "पालक और पनीर — 2 मिनट", en: "Spinach and paneer — 2 min" },
          { hi: "उबले अंडे धीरे से डालें — 2 मिनट", en: "Gently add boiled eggs — 2 min on low" },
        ],
      },
      { name: "Masala Omelette with Paneer Bhurji", time: "6:30 PM", protein: 41, carbs: 8, fat: 51, cal: 651,
        ingredients: [
          { hi: "4 पूरे अंडे", en: "4 whole eggs", qty: "4" },
          { hi: "100 ग्राम पनीर — कद्दूकस", en: "100g paneer — grated", qty: "100g" },
          { hi: "2 छोटे चम्मच घी", en: "2 tsp ghee", qty: "2 tsp" },
          { hi: "नमक, लाल मिर्च, चाट मसाला", en: "Salt, red chilli, chaat masala", qty: "to taste" },
        ],
        steps: [
          { hi: "पनीर भुर्जी — मसाले के साथ तैयार करें", en: "Prepare paneer bhurji with spices" },
          { hi: "अंडे फेंटें — घी में ऑमलेट बनाएं", en: "Whisk eggs — make omelette in ghee" },
          { hi: "पनीर भुर्जी भरें — मोड़ें — परोसें", en: "Fill with paneer bhurji — fold — serve" },
        ],
      },
    ],
    shake: true,
    grocery: [
      { hi: "अंडे", en: "Eggs", qty: "8" }, { hi: "पनीर", en: "Paneer", qty: "275g" },
      { hi: "घी", en: "Ghee", qty: "5 tsp" }, { hi: "खीरा/मूली", en: "Cucumber/Mooli", qty: "1" },
    ],
    totals: { protein: 84, carbs: 20, fat: 105, cal: 1353 },
  },
]

export function getTodayPlan(dayName: string): DayPlan {
  return KETO_PLAN.find(p => p.day === dayName) ?? KETO_PLAN[0]
}

export function getDayName(offset = 0): string {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return days[d.getDay()]
}
