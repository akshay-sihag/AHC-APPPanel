/**
 * Curated Material Icons for Medicine Categories
 *
 * These icons are from Google's Material Icons font, which is:
 * - Built-in to Flutter (Icons.xxx)
 * - Available via Google Fonts CDN for web
 * - Available as a TTF font for iOS
 *
 * Codepoints sourced from: https://github.com/google/material-design-icons
 */

export interface MaterialIcon {
  name: string;
  codepoint: string;
  label: string;
  category: string;
  keywords: string[];
}

export const ICON_CATEGORIES = [
  'Medical',
  'Body & Anatomy',
  'Wellness & Fitness',
  'Nutrition & Food',
  'Conditions & Symptoms',
  'Measurement & Monitoring',
  'General',
] as const;

export type IconCategory = (typeof ICON_CATEGORIES)[number];

export const MATERIAL_ICONS: MaterialIcon[] = [
  // ── Medical ──────────────────────────────────────────────
  { name: 'medication', codepoint: 'f033', label: 'Medication', category: 'Medical', keywords: ['medicine', 'pill', 'drug', 'prescription', 'tablet'] },
  { name: 'vaccines', codepoint: 'e138', label: 'Vaccines', category: 'Medical', keywords: ['injection', 'syringe', 'shot', 'needle', 'immunization'] },
  { name: 'medical_services', codepoint: 'f109', label: 'Medical Services', category: 'Medical', keywords: ['briefcase', 'doctor', 'kit', 'first aid', 'healthcare'] },
  { name: 'local_pharmacy', codepoint: 'e550', label: 'Pharmacy', category: 'Medical', keywords: ['drugstore', 'chemist', 'rx', 'prescription', 'cross'] },
  { name: 'local_hospital', codepoint: 'e548', label: 'Hospital', category: 'Medical', keywords: ['clinic', 'emergency', 'health', 'cross', 'building'] },
  { name: 'healing', codepoint: 'e3f3', label: 'Healing', category: 'Medical', keywords: ['bandage', 'wound', 'recovery', 'plaster', 'band-aid'] },
  { name: 'health_and_safety', codepoint: 'e1d5', label: 'Health & Safety', category: 'Medical', keywords: ['shield', 'protection', 'cross', 'healthcare', 'secure'] },
  { name: 'biotech', codepoint: 'ea3a', label: 'Biotech', category: 'Medical', keywords: ['biology', 'science', 'dna', 'genetics', 'research'] },
  { name: 'bloodtype', codepoint: 'efe4', label: 'Blood Type', category: 'Medical', keywords: ['blood', 'donation', 'transfusion', 'drop', 'test'] },
  { name: 'emergency', codepoint: 'e1eb', label: 'Emergency', category: 'Medical', keywords: ['sos', 'urgent', 'star of life', 'ambulance', 'critical'] },
  { name: 'medication_liquid', codepoint: 'ea87', label: 'Liquid Medication', category: 'Medical', keywords: ['syrup', 'bottle', 'liquid', 'dose', 'oral'] },
  { name: 'science', codepoint: 'ea4b', label: 'Science', category: 'Medical', keywords: ['flask', 'lab', 'chemistry', 'experiment', 'research'] },
  { name: 'coronavirus', codepoint: 'f221', label: 'Coronavirus', category: 'Medical', keywords: ['covid', 'virus', 'pandemic', 'infection', 'disease'] },
  { name: 'masks', codepoint: 'f218', label: 'Masks', category: 'Medical', keywords: ['face mask', 'protection', 'covid', 'safety', 'surgical'] },
  { name: 'sanitizer', codepoint: 'f21d', label: 'Sanitizer', category: 'Medical', keywords: ['hand wash', 'hygiene', 'clean', 'disinfect', 'gel'] },
  { name: 'medical_information', codepoint: 'ebed', label: 'Medical Information', category: 'Medical', keywords: ['info', 'records', 'health data', 'patient', 'chart'] },

  // ── Body & Anatomy ──────────────────────────────────────
  { name: 'monitor_heart', codepoint: 'eaa2', label: 'Heart Monitor', category: 'Body & Anatomy', keywords: ['heartbeat', 'pulse', 'cardiac', 'ecg', 'health'] },
  { name: 'psychology', codepoint: 'ea4a', label: 'Psychology', category: 'Body & Anatomy', keywords: ['brain', 'mind', 'mental health', 'therapy', 'cognitive'] },
  { name: 'visibility', codepoint: 'e8f4', label: 'Visibility', category: 'Body & Anatomy', keywords: ['eye', 'vision', 'sight', 'ophthalmology', 'see'] },
  { name: 'hearing', codepoint: 'e023', label: 'Hearing', category: 'Body & Anatomy', keywords: ['ear', 'audio', 'sound', 'audiology', 'listen'] },
  { name: 'face', codepoint: 'e87c', label: 'Face', category: 'Body & Anatomy', keywords: ['skin', 'dermatology', 'head', 'facial', 'cosmetic'] },
  { name: 'pregnant_woman', codepoint: 'e91e', label: 'Pregnant Woman', category: 'Body & Anatomy', keywords: ['pregnancy', 'maternity', 'baby', 'obstetrics', 'prenatal'] },
  { name: 'elderly', codepoint: 'f21a', label: 'Elderly', category: 'Body & Anatomy', keywords: ['senior', 'old age', 'geriatric', 'aging', 'cane'] },
  { name: 'boy', codepoint: 'eb67', label: 'Boy', category: 'Body & Anatomy', keywords: ['child', 'kid', 'male', 'pediatric', 'young'] },
  { name: 'girl', codepoint: 'eb68', label: 'Girl', category: 'Body & Anatomy', keywords: ['child', 'kid', 'female', 'pediatric', 'young'] },
  { name: 'man', codepoint: 'e4eb', label: 'Man', category: 'Body & Anatomy', keywords: ['male', 'adult', 'person', 'gender', 'body'] },
  { name: 'woman', codepoint: 'e13e', label: 'Woman', category: 'Body & Anatomy', keywords: ['female', 'adult', 'person', 'gender', 'body'] },
  { name: 'child_care', codepoint: 'eb41', label: 'Child Care', category: 'Body & Anatomy', keywords: ['baby', 'infant', 'pediatric', 'newborn', 'toddler'] },
  { name: 'accessibility_new', codepoint: 'e92c', label: 'Accessibility', category: 'Body & Anatomy', keywords: ['body', 'person', 'human', 'posture', 'standing'] },
  { name: 'directions_walk', codepoint: 'e536', label: 'Walking', category: 'Body & Anatomy', keywords: ['walk', 'pedestrian', 'steps', 'movement', 'exercise'] },
  { name: 'directions_run', codepoint: 'e566', label: 'Running', category: 'Body & Anatomy', keywords: ['run', 'jog', 'sprint', 'cardio', 'exercise'] },

  // ── Wellness & Fitness ──────────────────────────────────
  { name: 'fitness_center', codepoint: 'eb43', label: 'Fitness', category: 'Wellness & Fitness', keywords: ['gym', 'workout', 'exercise', 'dumbbell', 'strength'] },
  { name: 'self_improvement', codepoint: 'ea78', label: 'Self Improvement', category: 'Wellness & Fitness', keywords: ['meditation', 'yoga', 'mindfulness', 'zen', 'calm'] },
  { name: 'spa', codepoint: 'eb4c', label: 'Spa', category: 'Wellness & Fitness', keywords: ['relaxation', 'wellness', 'leaf', 'nature', 'therapy'] },
  { name: 'favorite', codepoint: 'e87d', label: 'Heart', category: 'Wellness & Fitness', keywords: ['love', 'heart', 'like', 'care', 'health'] },
  { name: 'favorite_border', codepoint: 'e87e', label: 'Heart Outline', category: 'Wellness & Fitness', keywords: ['love', 'heart', 'like', 'care', 'outline'] },
  { name: 'mood', codepoint: 'e7f2', label: 'Mood', category: 'Wellness & Fitness', keywords: ['happy', 'smiley', 'emotion', 'mental', 'feeling'] },
  { name: 'sentiment_satisfied', codepoint: 'e813', label: 'Satisfied', category: 'Wellness & Fitness', keywords: ['happy', 'smile', 'emotion', 'positive', 'wellbeing'] },
  { name: 'hotel', codepoint: 'e53a', label: 'Sleep', category: 'Wellness & Fitness', keywords: ['bed', 'rest', 'sleep', 'night', 'recovery'] },
  { name: 'bedtime', codepoint: 'ef44', label: 'Bedtime', category: 'Wellness & Fitness', keywords: ['sleep', 'moon', 'night', 'rest', 'routine'] },
  { name: 'nightlight', codepoint: 'f03d', label: 'Nightlight', category: 'Wellness & Fitness', keywords: ['moon', 'night', 'sleep', 'calm', 'crescent'] },
  { name: 'water_drop', codepoint: 'e798', label: 'Water Drop', category: 'Wellness & Fitness', keywords: ['hydration', 'water', 'drink', 'fluid', 'droplet'] },
  { name: 'local_drink', codepoint: 'e544', label: 'Drink', category: 'Wellness & Fitness', keywords: ['beverage', 'water', 'glass', 'hydration', 'juice'] },
  { name: 'smoking_rooms', codepoint: 'eb4b', label: 'Smoking', category: 'Wellness & Fitness', keywords: ['cigarette', 'tobacco', 'smoke', 'habit', 'addiction'] },

  // ── Nutrition & Food ────────────────────────────────────
  { name: 'restaurant', codepoint: 'e556', label: 'Restaurant', category: 'Nutrition & Food', keywords: ['food', 'dining', 'eat', 'meal', 'fork', 'knife'] },
  { name: 'lunch_dining', codepoint: 'ea61', label: 'Lunch', category: 'Nutrition & Food', keywords: ['food', 'meal', 'plate', 'dinner', 'cuisine'] },
  { name: 'emoji_food_beverage', codepoint: 'ea1b', label: 'Food & Beverage', category: 'Nutrition & Food', keywords: ['coffee', 'tea', 'drink', 'cup', 'hot'] },
  { name: 'egg_alt', codepoint: 'eac8', label: 'Egg', category: 'Nutrition & Food', keywords: ['protein', 'breakfast', 'food', 'nutrition', 'diet'] },
  { name: 'eco', codepoint: 'ea35', label: 'Eco', category: 'Nutrition & Food', keywords: ['leaf', 'organic', 'natural', 'green', 'herbal'] },
  { name: 'grass', codepoint: 'f205', label: 'Grass', category: 'Nutrition & Food', keywords: ['herb', 'plant', 'natural', 'organic', 'green'] },

  // ── Conditions & Symptoms ───────────────────────────────
  { name: 'thermostat', codepoint: 'e1ff', label: 'Thermostat', category: 'Conditions & Symptoms', keywords: ['temperature', 'fever', 'thermometer', 'heat', 'cold'] },
  { name: 'air', codepoint: 'efd8', label: 'Air', category: 'Conditions & Symptoms', keywords: ['breathing', 'respiratory', 'lungs', 'wind', 'asthma'] },
  { name: 'wb_sunny', codepoint: 'e430', label: 'Sunny', category: 'Conditions & Symptoms', keywords: ['sun', 'vitamin d', 'light', 'uv', 'skin'] },
  { name: 'ac_unit', codepoint: 'eb3b', label: 'Cold', category: 'Conditions & Symptoms', keywords: ['snowflake', 'cold', 'freeze', 'chill', 'winter'] },
  { name: 'sick', codepoint: 'f220', label: 'Sick', category: 'Conditions & Symptoms', keywords: ['ill', 'unwell', 'nausea', 'fever', 'disease'] },
  { name: 'personal_injury', codepoint: 'e6da', label: 'Injury', category: 'Conditions & Symptoms', keywords: ['hurt', 'pain', 'arm', 'broken', 'sling'] },
  { name: 'warning', codepoint: 'e002', label: 'Warning', category: 'Conditions & Symptoms', keywords: ['alert', 'caution', 'danger', 'attention', 'risk'] },
  { name: 'report_problem', codepoint: 'e8b2', label: 'Problem', category: 'Conditions & Symptoms', keywords: ['alert', 'issue', 'caution', 'error', 'attention'] },

  // ── Measurement & Monitoring ────────────────────────────
  { name: 'monitor_weight', codepoint: 'f039', label: 'Weight', category: 'Measurement & Monitoring', keywords: ['scale', 'weight', 'bmi', 'body', 'measure'] },
  { name: 'speed', codepoint: 'e9e4', label: 'Speed', category: 'Measurement & Monitoring', keywords: ['fast', 'meter', 'gauge', 'performance', 'velocity'] },
  { name: 'timer', codepoint: 'e425', label: 'Timer', category: 'Measurement & Monitoring', keywords: ['stopwatch', 'clock', 'time', 'duration', 'countdown'] },
  { name: 'schedule', codepoint: 'e8b5', label: 'Schedule', category: 'Measurement & Monitoring', keywords: ['clock', 'time', 'appointment', 'calendar', 'routine'] },
  { name: 'trending_up', codepoint: 'e8e5', label: 'Trending Up', category: 'Measurement & Monitoring', keywords: ['increase', 'growth', 'progress', 'improve', 'rise'] },
  { name: 'trending_down', codepoint: 'e8e3', label: 'Trending Down', category: 'Measurement & Monitoring', keywords: ['decrease', 'decline', 'reduce', 'loss', 'fall'] },
  { name: 'analytics', codepoint: 'ef3e', label: 'Analytics', category: 'Measurement & Monitoring', keywords: ['data', 'statistics', 'chart', 'graph', 'report'] },
  { name: 'bar_chart', codepoint: 'e26b', label: 'Bar Chart', category: 'Measurement & Monitoring', keywords: ['graph', 'statistics', 'data', 'report', 'analysis'] },
  { name: 'show_chart', codepoint: 'e6e1', label: 'Line Chart', category: 'Measurement & Monitoring', keywords: ['graph', 'trend', 'data', 'line', 'progress'] },
  { name: 'assessment', codepoint: 'e85c', label: 'Assessment', category: 'Measurement & Monitoring', keywords: ['report', 'evaluation', 'results', 'test', 'review'] },

  // ── General ─────────────────────────────────────────────
  { name: 'category', codepoint: 'e574', label: 'Category', category: 'General', keywords: ['group', 'organize', 'sort', 'type', 'classification'] },
  { name: 'inventory_2', codepoint: 'e1a1', label: 'Inventory', category: 'General', keywords: ['box', 'package', 'storage', 'stock', 'supply'] },
  { name: 'shopping_cart', codepoint: 'e8cc', label: 'Shopping Cart', category: 'General', keywords: ['buy', 'purchase', 'order', 'store', 'cart'] },
  { name: 'local_shipping', codepoint: 'e558', label: 'Shipping', category: 'General', keywords: ['delivery', 'truck', 'transport', 'logistics', 'package'] },
  { name: 'verified', codepoint: 'ef76', label: 'Verified', category: 'General', keywords: ['check', 'approved', 'certified', 'trusted', 'authentic'] },
  { name: 'star', codepoint: 'e838', label: 'Star', category: 'General', keywords: ['favorite', 'rating', 'premium', 'best', 'top'] },
  { name: 'info', codepoint: 'e88e', label: 'Info', category: 'General', keywords: ['information', 'about', 'details', 'help', 'circle'] },
  { name: 'help', codepoint: 'e887', label: 'Help', category: 'General', keywords: ['question', 'support', 'assist', 'faq', 'circle'] },
  { name: 'shield', codepoint: 'e9e0', label: 'Shield', category: 'General', keywords: ['protection', 'security', 'safety', 'guard', 'defense'] },
  { name: 'lock', codepoint: 'e897', label: 'Lock', category: 'General', keywords: ['secure', 'private', 'password', 'safety', 'closed'] },
  { name: 'check_circle', codepoint: 'e86c', label: 'Check Circle', category: 'General', keywords: ['done', 'complete', 'success', 'approved', 'confirm'] },
  { name: 'add_circle', codepoint: 'e147', label: 'Add Circle', category: 'General', keywords: ['plus', 'new', 'create', 'add', 'more'] },
  { name: 'list', codepoint: 'e896', label: 'List', category: 'General', keywords: ['menu', 'items', 'bullet', 'lines', 'catalog'] },
  { name: 'dashboard', codepoint: 'e871', label: 'Dashboard', category: 'General', keywords: ['overview', 'panel', 'home', 'grid', 'summary'] },
  { name: 'settings', codepoint: 'e8b8', label: 'Settings', category: 'General', keywords: ['gear', 'config', 'preferences', 'options', 'control'] },
];

/** Look up codepoint by icon name */
export function getIconCodepoint(iconName: string): string | null {
  const icon = MATERIAL_ICONS.find((i) => i.name === iconName);
  return icon ? icon.codepoint : null;
}
