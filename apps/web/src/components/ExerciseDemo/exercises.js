// react-body-highlighter muscle slugs:
// anterior: 'chest' | 'front-deltoids' | 'biceps' | 'triceps' | 'forearm'
//           'abs' | 'obliques' | 'quadriceps' | 'adductor' | 'abductors' | 'calves'
// posterior: 'trapezius' | 'upper-back' | 'lower-back' | 'back-deltoids'
//            'triceps' | 'gluteal' | 'hamstring' | 'calves'
//
// lottieFile: filename stem — place {id}.json in /src/assets/animations/exercises/
// mechanics: kinesiological movement pattern
// joints: primary working joints
// cues: 4–6 coaching cues

// Exercises that intentionally have no animation — muscle map + cues only
export const NO_ANIMATION_IDS = new Set([
  // Bodyweight
  'pushup', 'pike_pushup', 'diamond_pushup', 'inverted_row', 'bodyweight_squat',
  'pistol_squat', 'glute_bridge', 'nordic_curl', 'dip_bw', 'chin_up',
  'situp', 'ab_wheel', 'plank', 'leg_raise', 'dead_bug', 'russian_twist', 'dragon_flag',
  // Cardio / Carries
  'rowing_machine', 'assault_bike', 'sled_push', 'farmers_carry',
  // Cable / KB
  'pallof_press', 'kb_row', 'kb_lunge',
]);

export const EXERCISE_DEMOS = {

  // ── CHEST ──────────────────────────────────────────────────────────────────
  bench: {
    name: 'Barbell Bench Press',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['front-deltoids', 'triceps'],
    lottieFile: 'bench',
    mechanics: 'Horizontal Push',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Retract and depress your scapulae before unracking',
      'Plant feet flat — drive through the floor on the press',
      'Bar touches mid-chest, not your neck or abdomen',
      'Wrists stay stacked directly over elbows throughout',
      'Controlled 2–3s eccentric — do not bounce off chest',
      'Lock out fully at top, maintain lat tension',
    ],
  },

  incline_db: {
    name: 'Incline DB Press',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['front-deltoids', 'triceps'],
    lottieFile: 'incline_db',
    mechanics: 'Incline Push',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Set bench to 30–45° — steeper shifts to front delt',
      'Dumbbells start at shoulder height, elbows below wrists',
      'Press in a slight arc, meeting at the top',
      'Squeeze the upper chest hard at peak contraction',
      'Lower slowly until elbows are slightly below shoulder line',
      'Keep shoulder blades retracted on the pad throughout',
    ],
  },

  cable_fly: {
    name: 'Cable Crossover',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['front-deltoids'],
    lottieFile: 'cable_fly',
    mechanics: 'Horizontal Adduction',
    joints: ['Shoulder'],
    cues: [
      'Lean slightly forward from hips — maintains tension at peak',
      'Slight bend in elbow; that angle stays fixed throughout',
      'Initiate from the pec, not from the arm',
      'Hands meet or cross at the bottom — full adduction',
      'Pause at the bottom contraction for 1–2 seconds',
      'Control the eccentric — cables pull you wide if you let them',
    ],
  },

  dips: {
    name: 'Weighted Dips',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['triceps', 'front-deltoids'],
    lottieFile: 'dips',
    mechanics: 'Vertical Push',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Lean forward ~30° to maximise chest contribution',
      'Lower until shoulder is level with elbow',
      'Full lockout at the top — squeeze chest hard',
      'Elbows flare slightly — don\'t pin them to your sides',
      'Control the descent — 2s down minimum',
    ],
  },

  // ── SHOULDERS ──────────────────────────────────────────────────────────────
  ohp: {
    name: 'Overhead Press',
    primaryMuscles:   ['front-deltoids'],
    secondaryMuscles: ['triceps', 'trapezius'],
    lottieFile: 'ohp',
    mechanics: 'Vertical Push',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Bar rests on front deltoids in rack position',
      'Brace abs hard and squeeze glutes before pressing',
      'Press straight up — head passes through as bar clears face',
      'Arms fully locked out at top, biceps beside ears',
      'Elbows slightly forward of the bar in rack position',
      'Don\'t flare elbows out wide — keep them under the bar',
    ],
  },

  lateral_raise: {
    name: 'DB Lateral Raise',
    primaryMuscles:   ['front-deltoids'],
    secondaryMuscles: [],
    lottieFile: 'lateral_raise',
    mechanics: 'Shoulder Abduction',
    joints: ['Shoulder'],
    cues: [
      'Slight bend in elbow — locked in for the whole set',
      'Lead with your pinkies, not your thumbs',
      'Stop at shoulder height — above that is trap, not delt',
      'Control the descent — the eccentric builds the delt',
      'Don\'t shrug — keep traps depressed throughout',
    ],
  },

  rear_delt_fly: {
    name: 'Reverse Pec Deck',
    primaryMuscles:   ['back-deltoids'],
    secondaryMuscles: ['trapezius', 'upper-back'],
    lottieFile: 'rear_delt_fly',
    mechanics: 'Horizontal Abduction',
    joints: ['Shoulder'],
    cues: [
      'Chest stays in contact with the pad throughout',
      'Pull with rear delts, not your arms',
      'Pause briefly at full extension — feel the squeeze',
      'Elbows stay slightly bent — fixed angle throughout',
      'Don\'t rotate the torso to get more range',
    ],
  },

  face_pull: {
    name: 'Cable Face Pull',
    primaryMuscles:   ['back-deltoids'],
    secondaryMuscles: ['trapezius', 'upper-back'],
    lottieFile: 'face_pull',
    mechanics: 'Horizontal Pull + External Rotation',
    joints: ['Shoulder'],
    cues: [
      'Cable anchored at or above face height',
      'Pull to your forehead — not your chin or chest',
      'External rotate at the finish — hands behind your ears',
      'Elbows flare out wide and stay high throughout',
      'Lighter is better — this is a health exercise',
    ],
  },

  // ── BACK ───────────────────────────────────────────────────────────────────
  pullup: {
    name: 'Pull-Up',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['biceps', 'back-deltoids'],
    lottieFile: 'pullup',
    mechanics: 'Vertical Pull',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Dead hang to start — full elbow extension every rep',
      'Initiate by depressing scapulae before pulling with arms',
      'Chin clears the bar — no chin jut to fake it',
      'Control the descent — the eccentric builds strength',
      'Think: elbows driving down into your back pockets',
      'Cross ankles and squeeze legs to reduce kipping',
    ],
  },

  chin_up: {
    name: 'Chin-Up',
    primaryMuscles:   ['biceps'],
    secondaryMuscles: ['upper-back', 'back-deltoids'],
    lottieFile: 'chin_up',
    mechanics: 'Vertical Pull (Supinated)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Supinated grip shoulder-width apart',
      'Pull elbows down and back — not just up',
      'Chin clears bar — full range every rep',
      'Full hang at bottom — no kipping',
      'Biceps get a full stretch at the bottom',
    ],
  },

  row: {
    name: 'Barbell Row',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['biceps', 'back-deltoids', 'trapezius'],
    lottieFile: 'row',
    mechanics: 'Horizontal Pull',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Hip hinge to 45–70°, spine neutral throughout',
      'Bar begins from a dead hang, fully controlled',
      'Pull to your lower rib — not your chest',
      'Drive elbows back and squeeze shoulder blades at top',
      'No hip drive or body English — strict form only',
      'Lower under control — don\'t drop it',
    ],
  },

  lat_pulldown: {
    name: 'Lat Pulldown',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['biceps', 'back-deltoids'],
    lottieFile: 'lat_pulldown',
    mechanics: 'Vertical Pull',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Grip just outside shoulder width',
      'Lean back 10–15° and stay there throughout',
      'Lead with elbows, driving them toward your pockets',
      'Bar touches the top of your chest — full range',
      'Retract and depress scapulae at the bottom',
      'Control the bar on the way up — don\'t let it yank you',
    ],
  },

  tbar_row: {
    name: 'T-Bar Row',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['biceps', 'trapezius'],
    lottieFile: 'tbar_row',
    mechanics: 'Horizontal Pull',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Neutral spine throughout — hinge to ~45°',
      'Pull bar to sternum — full range of motion',
      'Drive elbows back and high at the top',
      'Control the descent — don\'t drop the weight',
    ],
  },

  inverted_row: {
    name: 'Inverted Row',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['biceps', 'back-deltoids', 'trapezius'],
    lottieFile: 'inverted_row',
    mechanics: 'Horizontal Pull',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Body rigid like a plank — no sagging hips',
      'Pull chest to bar — not your chin',
      'Squeeze shoulder blades hard at the top',
      'Feet further forward = harder',
    ],
  },

  shrug: {
    name: 'DB Shrug',
    primaryMuscles:   ['trapezius'],
    secondaryMuscles: [],
    lottieFile: 'shrug',
    mechanics: 'Scapular Elevation',
    joints: ['Shoulder Girdle'],
    cues: [
      'Straight up — not rolling forward or back',
      'Pause at the top for a full second',
      'Full range down — don\'t shorten the eccentric',
      'Heavy weight, strict form — no body momentum',
    ],
  },

  // ── ARMS ───────────────────────────────────────────────────────────────────
  curl: {
    name: 'Barbell Curl',
    primaryMuscles:   ['biceps'],
    secondaryMuscles: ['forearm'],
    lottieFile: 'curl',
    mechanics: 'Elbow Flexion + Supination',
    joints: ['Elbow'],
    cues: [
      'Elbows pinned to your sides — they do not move',
      'Full supination at the top — twist palm to ceiling',
      'No swinging — if you swing, lower the weight',
      'Squeeze hard at the top for 1 second',
      'Lower to full elbow extension every rep',
    ],
  },

  hammer_curl: {
    name: 'Hammer Curl',
    primaryMuscles:   ['biceps'],
    secondaryMuscles: ['forearm'],
    lottieFile: 'hammer_curl',
    mechanics: 'Elbow Flexion (Neutral)',
    joints: ['Elbow'],
    cues: [
      'Neutral grip throughout — thumbs point up',
      'Slow eccentric — 2–3s on the way down',
      'Elbows stay at your sides — strict form only',
      'Trains brachialis and brachioradialis equally',
    ],
  },

  preacher_curl: {
    name: 'Preacher Curl',
    primaryMuscles:   ['biceps'],
    secondaryMuscles: [],
    lottieFile: 'preacher_curl',
    mechanics: 'Elbow Flexion (Isolated)',
    joints: ['Elbow'],
    cues: [
      'Armpits at the very top of the pad',
      'Don\'t fully lock out — keep tension on bicep',
      'Control the descent — peak stretch = peak growth',
      'No momentum — pad removes all cheating',
    ],
  },

  tricep_pushdown: {
    name: 'Tricep Pushdown',
    primaryMuscles:   ['triceps'],
    secondaryMuscles: [],
    lottieFile: 'tricep_pushdown',
    mechanics: 'Elbow Extension',
    joints: ['Elbow'],
    cues: [
      'Elbows locked tight to your sides — they do not move',
      'Start with forearms parallel to floor or higher',
      'Drive down to full elbow extension — squeeze triceps',
      'Slow the eccentric — don\'t let the stack snap you up',
      'Slight forward lean is fine — it\'s not a back exercise',
    ],
  },

  skullcrusher: {
    name: 'Skullcrusher',
    primaryMuscles:   ['triceps'],
    secondaryMuscles: [],
    lottieFile: 'skullcrusher',
    mechanics: 'Elbow Extension (Overhead)',
    joints: ['Elbow'],
    cues: [
      'Lower toward your forehead — control it',
      'Elbows stay fixed — only the forearm moves',
      'Strong grip, don\'t let wrists break back',
      'Long head is maximally stretched — feel it',
    ],
  },

  dip_bw: {
    name: 'Bodyweight Dip',
    primaryMuscles:   ['triceps'],
    secondaryMuscles: ['chest', 'front-deltoids'],
    lottieFile: 'dip_bw',
    mechanics: 'Vertical Push',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Upright torso = tricep emphasis',
      'Lower until upper arms parallel to floor',
      'Full lockout at top — elbows fully extended',
      'Depress shoulders — don\'t shrug into it',
    ],
  },

  // ── LEGS ───────────────────────────────────────────────────────────────────
  squat: {
    name: 'Back Squat',
    primaryMuscles:   ['quadriceps', 'gluteal'],
    secondaryMuscles: ['hamstring', 'adductor'],
    lottieFile: 'squat',
    mechanics: 'Bilateral Squat — Triple Extension',
    joints: ['Hip', 'Knee', 'Ankle'],
    cues: [
      'Bar sits on the meaty shelf of your mid-trapezius',
      'Hip crease must pass below the knee — no quarter squats',
      'Knees track over toes — active push-out throughout',
      'Big breath, brace 360° around your spine, then descend',
      'Drive your chest up out of the hole',
      'Stance adjusts to your hip anatomy',
    ],
  },

  front_squat: {
    name: 'Front Squat',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'abs'],
    lottieFile: 'front_squat',
    mechanics: 'Bilateral Squat (Anterior Load)',
    joints: ['Hip', 'Knee', 'Ankle'],
    cues: [
      'Elbows high throughout — this is non-negotiable',
      'Bar rests on front deltoids — not your hands',
      'Upright torso throughout the entire movement',
      'Hip crease below knee — full depth required',
    ],
  },

  leg_press: {
    name: 'Leg Press',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'hamstring'],
    lottieFile: 'leg_press',
    mechanics: 'Bilateral Squat (Machine)',
    joints: ['Hip', 'Knee'],
    cues: [
      'Feet shoulder-width, mid-platform',
      'Never lock knees at the top — maintain tension',
      'Lower until hips begin to tuck — that\'s your bottom',
      'Lower back stays flat against the pad throughout',
      'Drive through the whole foot — no heel lift',
    ],
  },

  rdl: {
    name: 'Romanian Deadlift',
    primaryMuscles:   ['hamstring'],
    secondaryMuscles: ['gluteal', 'lower-back'],
    lottieFile: 'rdl',
    mechanics: 'Hip Hinge — Eccentric Dominant',
    joints: ['Hip'],
    cues: [
      'Hip hinge — keep shins relatively vertical',
      'Bar stays in contact with your legs the whole way',
      'Feel the hamstring stretch before reversing',
      'Neutral spine — no rounding, no hyperextension',
      'Drive hips forward to return — not your back',
    ],
  },

  deadlift: {
    name: 'Conventional Deadlift',
    primaryMuscles:   ['hamstring', 'gluteal'],
    secondaryMuscles: ['lower-back', 'trapezius', 'upper-back'],
    lottieFile: 'deadlift',
    mechanics: 'Hip Hinge — Full Chain',
    joints: ['Hip', 'Knee', 'Spine'],
    cues: [
      'Bar over mid-foot before initiating pull',
      'Engage lats hard before the bar breaks the floor',
      'Push the floor away — don\'t think "pull"',
      'Lock out by squeezing glutes — not hyperextending',
      'Brace before every single rep',
    ],
  },

  leg_curl: {
    name: 'Lying Leg Curl',
    primaryMuscles:   ['hamstring'],
    secondaryMuscles: [],
    lottieFile: 'leg_curl',
    mechanics: 'Knee Flexion (Isolated)',
    joints: ['Knee'],
    cues: [
      'Hips stay down on the pad throughout',
      'Full range of motion — don\'t shorten the rep',
      'Pause at peak contraction for 1 second',
      'Control the eccentric — 2–3s on the way down',
    ],
  },

  hip_thrust: {
    name: 'Barbell Hip Thrust',
    primaryMuscles:   ['gluteal'],
    secondaryMuscles: ['hamstring'],
    lottieFile: 'hip_thrust',
    mechanics: 'Hip Extension (Supine)',
    joints: ['Hip'],
    cues: [
      'Upper back across the bench — find the meaty part',
      'Feet flat, shins vertical at the top',
      'Drive through heels — not your toes',
      'Full hip extension — squeeze glutes for 1–2 seconds',
      'Chin tucked — look forward, not up',
      'Bar over hip crease — pad it',
    ],
  },

  glute_bridge: {
    name: 'Glute Bridge',
    primaryMuscles:   ['gluteal'],
    secondaryMuscles: ['hamstring', 'lower-back'],
    lottieFile: 'glute_bridge',
    mechanics: 'Hip Extension (Floor)',
    joints: ['Hip'],
    cues: [
      'Feet flat, hip-width apart',
      'Drive hips fully up — body forms straight line',
      'Squeeze glutes hard at the top',
      'Chin tucked, ribs down',
    ],
  },

  bulgarian: {
    name: 'Bulgarian Split Squat',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal'],
    lottieFile: 'bulgarian',
    mechanics: 'Unilateral Squat',
    joints: ['Hip', 'Knee'],
    cues: [
      'Long stride — front foot far enough forward',
      'Front foot flat throughout the movement',
      'Vertical shin at the bottom position',
      'Back knee drops straight down — not forward',
    ],
  },

  bodyweight_squat: {
    name: 'Bodyweight Squat',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'hamstring'],
    lottieFile: 'bodyweight_squat',
    mechanics: 'Bilateral Squat',
    joints: ['Hip', 'Knee', 'Ankle'],
    cues: [
      'Feet shoulder-width, toes slightly out',
      'Knees track over toes throughout',
      'Hip crease below knee — full depth',
      'Chest up throughout the movement',
    ],
  },

  pistol_squat: {
    name: 'Pistol Squat',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'abs'],
    lottieFile: 'pistol_squat',
    mechanics: 'Unilateral Squat (Full Depth)',
    joints: ['Hip', 'Knee', 'Ankle'],
    cues: [
      'Non-working leg extended and off the ground',
      'Controlled descent — no collapsing',
      'Heel stays planted — no heel rise',
      'Arms forward for counterbalance',
    ],
  },

  nordic_curl: {
    name: 'Nordic Hamstring Curl',
    primaryMuscles:   ['hamstring'],
    secondaryMuscles: ['gluteal', 'calves'],
    lottieFile: 'nordic_curl',
    mechanics: 'Knee Flexion — Eccentric',
    joints: ['Knee'],
    cues: [
      'Ankles anchored securely',
      'Lower as slowly as possible — 3 to 5 seconds',
      'Catch yourself with hands at the bottom',
      'Pull back up using your hamstrings',
    ],
  },

  calf_raise: {
    name: 'Standing Calf Raise',
    primaryMuscles:   ['calves'],
    secondaryMuscles: [],
    lottieFile: 'calf_raise',
    mechanics: 'Plantar Flexion',
    joints: ['Ankle'],
    cues: [
      'Full stretch at the bottom — heel below platform',
      'Pause for 1 second at the top',
      'Slow eccentric — 3s minimum on the way down',
      'Knee locked — trains gastrocnemius specifically',
    ],
  },

  // ── CORE ───────────────────────────────────────────────────────────────────
  crunch: {
    name: 'Cable Crunch',
    primaryMuscles:   ['abs'],
    secondaryMuscles: [],
    lottieFile: 'crunch',
    mechanics: 'Spinal Flexion (Loaded)',
    joints: ['Spine'],
    cues: [
      'Curl spine — this is not a hip hinge',
      'Elbows lead the movement downward',
      'Squeeze abs hard at the bottom',
      'Progressive overload applies here just like any lift',
    ],
  },

  plank: {
    name: 'Plank',
    primaryMuscles:   ['abs'],
    secondaryMuscles: ['obliques', 'gluteal'],
    lottieFile: 'plank',
    mechanics: 'Anti-Extension Isometric',
    joints: ['Spine'],
    cues: [
      'Forearms flat, elbows under shoulders',
      'Single straight line — no sagging, no butt in the air',
      'Squeeze quads, glutes, and abs simultaneously',
      'Breathe steadily — don\'t hold your breath',
      'Brace as if about to take a punch',
    ],
  },

  leg_raise: {
    name: 'Hanging Leg Raise',
    primaryMuscles:   ['abs'],
    secondaryMuscles: ['obliques'],
    lottieFile: 'leg_raise',
    mechanics: 'Hip Flexion + Spinal Flexion',
    joints: ['Hip', 'Spine'],
    cues: [
      'Initiate with a posterior pelvic tilt — not a swing',
      'Don\'t kip or swing for momentum',
      'Lower under control — eccentric matters here',
      'Full dead hang between reps',
    ],
  },

  situp: {
    name: 'Sit-Up',
    primaryMuscles:   ['abs'],
    secondaryMuscles: ['obliques', 'abductors'],
    lottieFile: 'situp',
    mechanics: 'Spinal Flexion',
    joints: ['Spine', 'Hip'],
    cues: [
      'Anchor feet or use a decline bench',
      'Curl spine off floor sequentially — vertebra by vertebra',
      'Don\'t pull your neck with your hands',
      'Lower under full control',
    ],
  },

  ab_wheel: {
    name: 'Ab Wheel Rollout',
    primaryMuscles:   ['abs'],
    secondaryMuscles: ['obliques', 'upper-back', 'lower-back'],
    lottieFile: 'ab_wheel',
    mechanics: 'Anti-Extension (Dynamic)',
    joints: ['Spine', 'Shoulder'],
    cues: [
      'Start kneeling — work up to standing',
      'Brace hard before rolling out',
      'Hips in line with shoulders throughout',
      'Pull back with lats — not your lower back',
    ],
  },

  // ── BODYWEIGHT ─────────────────────────────────────────────────────────────
  pushup: {
    name: 'Push-Up',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['front-deltoids', 'triceps', 'abs'],
    lottieFile: 'pushup',
    mechanics: 'Horizontal Push (Closed Chain)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Hands shoulder-width, elbows ~45° from torso',
      'Full ROM — chest touches the floor',
      'Squeeze glutes and brace core throughout',
      'Body is one rigid plank — no sagging hips',
    ],
  },

  pike_pushup: {
    name: 'Pike Push-Up',
    primaryMuscles:   ['front-deltoids'],
    secondaryMuscles: ['triceps', 'trapezius'],
    lottieFile: 'pike_pushup',
    mechanics: 'Vertical Push (Bodyweight)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Hips high — inverted V position',
      'Head passes through on descent',
      'Elbows flare slightly outward',
      'Press to full arm extension',
    ],
  },

  diamond_pushup: {
    name: 'Diamond Push-Up',
    primaryMuscles:   ['triceps'],
    secondaryMuscles: ['chest', 'front-deltoids'],
    lottieFile: 'diamond_pushup',
    mechanics: 'Horizontal Push (Close Grip)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Thumbs and index fingers touching below chest',
      'Elbows track back — not flared out',
      'Chest descends to hands for full range',
      'Keep hips level — it\'s a full plank',
    ],
  },

  // ── CABLE ──────────────────────────────────────────────────────────────────
  cable_curl: {
    name: 'Cable Curl',
    primaryMuscles:   ['biceps'],
    secondaryMuscles: ['forearm'],
    lottieFile: 'cable_curl',
    mechanics: 'Elbow Flexion (Cable)',
    joints: ['Elbow'],
    cues: [
      'Elbows pinned to your sides — constant tension unlike free weights',
      'Cable keeps load on the bicep at the bottom — use it',
      'Full supination at the top',
      'Slow the eccentric — 2–3 seconds down',
    ],
  },

  cable_lateral: {
    name: 'Cable Lateral Raise',
    primaryMuscles:   ['front-deltoids'],
    secondaryMuscles: [],
    lottieFile: 'cable_lateral',
    mechanics: 'Shoulder Abduction (Cable)',
    joints: ['Shoulder'],
    cues: [
      'Cable from the low pulley on the opposite side of the working arm',
      'Slight bend in elbow — fixed throughout',
      'Stop at shoulder height — above that is trap',
      'Cable provides load at the bottom that dumbbells don\'t',
    ],
  },

  cable_machine_pullover: {
    name: 'Cable Pullover',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['triceps', 'chest'],
    lottieFile: 'cable_machine_pullover',
    mechanics: 'Shoulder Extension (Cable)',
    joints: ['Shoulder'],
    cues: [
      'Arms stay mostly straight — slight bend only',
      'Pull from overhead down to your hips in an arc',
      'Feel the lat stretch fully at the top',
      'Squeeze lats hard at the bottom of the arc',
    ],
  },

  cable_pull_through: {
    name: 'Cable Pull-Through',
    primaryMuscles:   ['gluteal'],
    secondaryMuscles: ['hamstring', 'lower-back'],
    lottieFile: 'cable_pull_through',
    mechanics: 'Hip Hinge (Cable)',
    joints: ['Hip'],
    cues: [
      'Cable between your legs from the low pulley',
      'Hinge at the hip — not a squat',
      'Drive hips forward explosively at the top',
      'Squeeze glutes hard at full extension',
      'Let the cable pull you back into the hinge on the eccentric',
    ],
  },

  cable_row: {
    name: 'Seated Cable Row',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['biceps', 'back-deltoids'],
    lottieFile: 'cable_row',
    mechanics: 'Horizontal Pull (Cable)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Sit upright — no excessive torso lean at any point',
      'Pull to your lower abdomen — elbows stay tight',
      'Squeeze shoulder blades together hard at the finish',
      'Control the return — don\'t let the stack pull you forward',
      'Full stretch at the front — let scapulae protract',
    ],
  },

  cable_woodchop: {
    name: 'Cable Woodchop',
    primaryMuscles:   ['obliques'],
    secondaryMuscles: ['abs'],
    lottieFile: 'cable_woodchop',
    mechanics: 'Rotational Pull',
    joints: ['Spine', 'Shoulder'],
    cues: [
      'Rotate from the torso — not just the arms',
      'Arms stay nearly straight throughout',
      'Hips stay square — rotation is spinal, not hip',
      'Control both directions — the return is the exercise too',
    ],
  },

  chest_press: {
    name: 'Machine Chest Press',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['front-deltoids', 'triceps'],
    lottieFile: 'chest_press',
    mechanics: 'Horizontal Push (Machine)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Adjust seat so handles are at mid-chest height',
      'Retract scapulae before pressing — stay retracted',
      'Full lockout at top, controlled return',
      'Great for progressive overload without a spotter',
    ],
  },

  // ── CORE (ADVANCED) ────────────────────────────────────────────────────────
  dead_bug: {
    name: 'Dead Bug',
    primaryMuscles:   ['abs'],
    secondaryMuscles: ['lower-back'],
    lottieFile: 'dead_bug',
    mechanics: 'Anti-Extension (Contralateral)',
    joints: ['Spine'],
    cues: [
      'Lower back pressed flat into the floor — never arch',
      'Opposite arm and leg extend simultaneously',
      'Breathe out as you extend — exhale = brace',
      'Move slowly — this is a control drill, not a rep race',
    ],
  },

  dragon_flag: {
    name: 'Dragon Flag',
    primaryMuscles:   ['abs'],
    secondaryMuscles: ['obliques', 'lower-back'],
    lottieFile: 'dragon_flag',
    mechanics: 'Spinal Flexion (Advanced)',
    joints: ['Spine'],
    cues: [
      'Grip a fixed object behind your head for stability',
      'Lower as one rigid unit — no hip pike or sag',
      'The eccentric is where the work happens — go slow',
      'Beginners: bend knees to reduce lever arm',
    ],
  },

  pallof_press: {
    name: 'Pallof Press',
    primaryMuscles:   ['obliques'],
    secondaryMuscles: ['abs'],
    lottieFile: 'pallof_press',
    mechanics: 'Anti-Rotation Isometric',
    joints: ['Spine', 'Shoulder'],
    cues: [
      'Stand perpendicular to the cable — that\'s the whole point',
      'Resist the rotation — do not let your torso turn',
      'Press out fully, hold 1–2 seconds, return',
      'Wider stance = more stable. Narrower = harder.',
    ],
  },

  russian_twist: {
    name: 'Russian Twist',
    primaryMuscles:   ['obliques'],
    secondaryMuscles: ['abs'],
    lottieFile: 'russian_twist',
    mechanics: 'Rotational Flexion',
    joints: ['Spine'],
    cues: [
      'Lean back to ~45° and stay there',
      'Rotate from the torso — hands follow, not lead',
      'Feet elevated increases the challenge significantly',
      'Touch the floor either side for full rotation',
    ],
  },

  // ── LEGS (ADDITIONAL) ──────────────────────────────────────────────────────
  hack_squat: {
    name: 'Hack Squat',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'hamstring'],
    lottieFile: 'hack_squat',
    mechanics: 'Bilateral Squat (Machine)',
    joints: ['Hip', 'Knee'],
    cues: [
      'Feet low on the platform = more quad emphasis',
      'Lower until hips are below parallel — full depth',
      'Keep lower back against the pad throughout',
      'Drive through heels and mid-foot equally',
    ],
  },

  adductor_machine: {
    name: 'Adductor Machine',
    primaryMuscles:   ['adductor'],
    secondaryMuscles: [],
    lottieFile: 'adductor_machine',
    mechanics: 'Hip Adduction (Machine)',
    joints: ['Hip'],
    cues: [
      'Adjust the range so you feel a full inner-thigh stretch',
      'Control the eccentric — don\'t let it snap open',
      'Squeeze hard at the close position',
      'Often undertrained — don\'t skip it',
    ],
  },

  seated_calf: {
    name: 'Seated Calf Raise',
    primaryMuscles:   ['calves'],
    secondaryMuscles: [],
    lottieFile: 'seated_calf',
    mechanics: 'Plantar Flexion (Knee Bent)',
    joints: ['Ankle'],
    cues: [
      'Knee bent isolates the soleus — a different muscle to standing',
      'Full stretch at the bottom — don\'t bounce',
      'Slow, deliberate reps — calves need TUT to grow',
      'Pair with standing calf raises for complete development',
    ],
  },

  // ── CARRIES & LOCOMOTION ───────────────────────────────────────────────────
  farmers_carry: {
    name: 'Farmer\'s Carry',
    primaryMuscles:   ['trapezius', 'forearm'],
    secondaryMuscles: ['abs', 'gluteal'],
    lottieFile: 'farmers_carry',
    mechanics: 'Loaded Carry',
    joints: ['Shoulder Girdle', 'Wrist'],
    cues: [
      'Stand tall — don\'t let the weight pull your shoulders down',
      'Short, controlled steps — don\'t rush',
      'Brace your core hard throughout the entire carry',
      'Grip as hard as possible — that\'s the point',
    ],
  },

  sled_push: {
    name: 'Sled Push',
    primaryMuscles:   ['quadriceps', 'gluteal'],
    secondaryMuscles: ['hamstring', 'front-deltoids'],
    lottieFile: 'sled_push',
    mechanics: 'Locomotion / Power',
    joints: ['Hip', 'Knee', 'Shoulder'],
    cues: [
      'Lean forward into the sled — don\'t stand upright',
      'Drive through the whole foot — not just the toes',
      'Arms stay straight and drive the sled, not pull you',
      'Short powerful strides — not long lunging steps',
    ],
  },

  // ── CARDIO MACHINES ────────────────────────────────────────────────────────
  assault_bike: {
    name: 'Assault Bike',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'hamstring', 'front-deltoids'],
    lottieFile: 'assault_bike',
    mechanics: 'Full-Body Cardio',
    joints: ['Hip', 'Knee', 'Shoulder', 'Elbow'],
    cues: [
      'Push and pull the handles equally — use your arms',
      'Drive through the whole pedal stroke — not just the downstroke',
      'Stay seated for aerobic work; stand for max-effort sprints',
      'The harder you go, the harder the resistance gets',
    ],
  },

  rowing_machine: {
    name: 'Rowing Machine',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['hamstring', 'gluteal', 'biceps'],
    lottieFile: 'rowing_machine',
    mechanics: 'Full-Body Pull (Cardio)',
    joints: ['Hip', 'Knee', 'Shoulder', 'Elbow'],
    cues: [
      'Drive sequence: legs → hips → arms. Return: arms → hips → legs',
      'Legs do 60% of the work — don\'t arm-row',
      'At the finish: lean back slightly, elbows past torso',
      'Catch position: shins vertical, arms straight, body forward',
    ],
  },

  // ── KETTLEBELL (ADDITIONAL) ────────────────────────────────────────────────
  kb_clean: {
    name: 'Kettlebell Clean',
    primaryMuscles:   ['gluteal', 'upper-back'],
    secondaryMuscles: ['hamstring', 'trapezius', 'front-deltoids'],
    lottieFile: 'kb_clean',
    mechanics: 'Ballistic Pull',
    joints: ['Hip', 'Shoulder', 'Elbow'],
    cues: [
      'Hike the bell back like a swing, then drive the hips',
      'The bell should float — guide it, don\'t muscle it',
      'Catch in the rack position — bell rests on forearm, elbow at hip',
      'Wrist stays neutral throughout — no flipping',
    ],
  },

  kb_deadlift: {
    name: 'Kettlebell Deadlift',
    primaryMuscles:   ['gluteal', 'hamstring'],
    secondaryMuscles: ['lower-back', 'upper-back'],
    lottieFile: 'kb_deadlift',
    mechanics: 'Hip Hinge',
    joints: ['Hip', 'Knee'],
    cues: [
      'Bell centred between feet — mid-foot position',
      'Hinge, grip, brace — then push the floor away',
      'Neutral spine from setup through lockout',
      'Lockout by squeezing glutes — not by leaning back',
    ],
  },

  kb_goblet_squat: {
    name: 'Kettlebell Goblet Squat',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'abs'],
    lottieFile: 'kb_goblet_squat',
    mechanics: 'Bilateral Squat (Anterior Load)',
    joints: ['Hip', 'Knee', 'Ankle'],
    cues: [
      'Hold the bell at chest height — elbows inside knees at depth',
      'The anterior load forces an upright torso — use it',
      'Full depth — elbows push knees out at the bottom',
      'Great squat teaching tool — groove the pattern',
    ],
  },

  kb_lunge: {
    name: 'Kettlebell Lunge',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'hamstring'],
    lottieFile: 'kb_lunge',
    mechanics: 'Unilateral Squat (Split)',
    joints: ['Hip', 'Knee'],
    cues: [
      'Step length determines emphasis — long = glute, short = quad',
      'Back knee drops straight down — not forward',
      'Torso stays upright throughout',
      'Front shin stays vertical at the bottom',
    ],
  },

  kb_press: {
    name: 'Kettlebell Press',
    primaryMuscles:   ['front-deltoids'],
    secondaryMuscles: ['triceps', 'trapezius'],
    lottieFile: 'kb_press',
    mechanics: 'Vertical Push (Unilateral)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Start from rack position — bell rests on forearm',
      'Press straight up — bicep beside your ear at lockout',
      'Brace core hard — unilateral load challenges stability',
      'Wrist stays straight — pack the shoulder throughout',
    ],
  },

  kb_row: {
    name: 'Kettlebell Row',
    primaryMuscles:   ['upper-back'],
    secondaryMuscles: ['biceps', 'back-deltoids'],
    lottieFile: 'kb_row',
    mechanics: 'Horizontal Pull (Unilateral)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Support yourself on a bench — same-side hand and knee',
      'Let the bell hang — full stretch at the bottom',
      'Pull elbow back and up — lead with the elbow',
      'Don\'t rotate — keep hips and shoulders square',
    ],
  },

  smith_ohp: {
    name: 'Smith Machine OHP',
    primaryMuscles:   ['front-deltoids'],
    secondaryMuscles: ['triceps', 'trapezius'],
    lottieFile: 'smith_ohp',
    mechanics: 'Vertical Push (Smith Machine)',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Set the bar at upper chest height in the rack',
      'Sit slightly in front of the bar — not directly under it',
      'Press to full lockout — bar travels in a fixed path',
      'Controlled descent — don\'t drop it',
    ],
  },

  // ── NEW EXERCISES ──────────────────────────────────────────────────────────
  leg_extension: {
    name: 'Leg Extension',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: [],
    lottieFile: 'leg_extension',
    mechanics: 'Knee Extension (Machine)',
    joints: ['Knee'],
    cues: [
      'Adjust seat so knee aligns with the machine pivot',
      'Extend fully — hold peak contraction for 1 second',
      'Slow 3-second eccentric on every rep',
      'No momentum — controlled throughout',
      'Don\'t drop the weight — resist all the way down',
    ],
  },

  db_bench: {
    name: 'DB Bench Press',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['front-deltoids', 'triceps'],
    lottieFile: 'db_bench',
    mechanics: 'Horizontal Push',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Lower until elbows break the plane of the bench',
      'Press in a slight arc — dumbbells close or touching at top',
      'Scapulae retracted and depressed throughout',
      'Wrists stacked over elbows',
      'Full range every rep — depth drives pec hypertrophy',
    ],
  },

  db_fly: {
    name: 'DB Fly',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['front-deltoids'],
    lottieFile: 'db_fly',
    mechanics: 'Horizontal Adduction',
    joints: ['Shoulder'],
    cues: [
      'Soft elbow bend — lock that angle for the whole set',
      'Arc the arms wide and down until you feel a deep pec stretch',
      'Think: hugging a barrel on the way up',
      'Squeeze pecs at the top — hold 1 second',
      '3-second eccentric — gravity is pulling hard here',
    ],
  },

  db_shoulder_press: {
    name: 'DB Shoulder Press',
    primaryMuscles:   ['front-deltoids'],
    secondaryMuscles: ['triceps'],
    lottieFile: 'db_shoulder_press',
    mechanics: 'Vertical Push',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Start at ear height, palms facing forward',
      'Press in a slight arc overhead',
      'Keep tension — don\'t fully lock out',
      'Lower to full stretch each rep',
      'Core braced — no lower back arch',
    ],
  },

  overhead_tricep_ext: {
    name: 'Overhead Tricep Extension',
    primaryMuscles:   ['triceps'],
    secondaryMuscles: [],
    lottieFile: 'overhead_tricep_ext',
    mechanics: 'Elbow Extension (Overhead)',
    joints: ['Elbow', 'Shoulder'],
    cues: [
      'Upper arms fixed beside ears — they do not move',
      'Lower until forearms are below parallel — full stretch',
      'Elbows stay narrow — don\'t flare them out',
      'Drive to full extension — squeeze the long head',
      'The stretch at the bottom is the entire point',
    ],
  },

  back_extension: {
    name: 'Back Extension',
    primaryMuscles:   ['lower-back'],
    secondaryMuscles: ['gluteal', 'hamstring'],
    lottieFile: 'back_extension',
    mechanics: 'Hip Hinge (Erector Focus)',
    joints: ['Hip', 'Spine'],
    cues: [
      'Hips at the pad edge — full hip hinge ROM',
      'Rise to neutral spine — not into hyperextension',
      'Squeeze glutes hard at the top',
      'Hold a plate to the chest to progress',
      'Slow eccentric — erectors work on the way down too',
    ],
  },

  lunge: {
    name: 'Dumbbell Lunge',
    primaryMuscles:   ['quadriceps'],
    secondaryMuscles: ['gluteal', 'hamstring'],
    lottieFile: 'lunge',
    mechanics: 'Unilateral Squat (Split)',
    joints: ['Hip', 'Knee'],
    cues: [
      'Long stride — 90° at both knees at depth',
      'Front knee tracks over second toe',
      'Torso stays upright throughout',
      'Drive through front heel to rise',
      'Reverse lunge is easier on the knee than forward',
    ],
  },

  sumo_deadlift: {
    name: 'Sumo Deadlift',
    primaryMuscles:   ['hamstring', 'gluteal'],
    secondaryMuscles: ['adductor', 'lower-back'],
    lottieFile: 'sumo_deadlift',
    mechanics: 'Hip Hinge — Wide Stance',
    joints: ['Hip', 'Knee'],
    cues: [
      'Stance wide, toes turned out 30–45°',
      'Drop hips lower — more upright torso than conventional',
      'Drive knees out over toes throughout the pull',
      'Bar stays over mid-foot at all times',
      'Lock out with hip drive — not by arching the back',
    ],
  },

  incline_bench: {
    name: 'Incline Barbell Press',
    primaryMuscles:   ['chest'],
    secondaryMuscles: ['front-deltoids', 'triceps'],
    lottieFile: 'incline_bench',
    mechanics: 'Incline Push',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Set bench to 30–45° — no steeper',
      'Bar travels to the upper chest — not the clavicle',
      'Retract scapulae firmly before unracking',
      'Same ~45° elbow tuck as flat bench',
      'Full lockout at top — maintain lat tension',
    ],
  },

  upright_row: {
    name: 'Upright Row',
    primaryMuscles:   ['front-deltoids', 'trapezius'],
    secondaryMuscles: ['biceps'],
    lottieFile: 'upright_row',
    mechanics: 'Vertical Pull',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Wide grip — shoulder width or beyond',
      'Lead with elbows, not wrists',
      'Stop when elbows reach shoulder height',
      'Traps depressed — don\'t shrug into it',
    ],
  },

  seated_leg_curl: {
    name: 'Seated Leg Curl',
    primaryMuscles:   ['hamstring'],
    secondaryMuscles: [],
    lottieFile: 'seated_leg_curl',
    mechanics: 'Knee Flexion (Seated)',
    joints: ['Knee', 'Hip'],
    cues: [
      'Sit fully upright — hips pushed back in the seat',
      'Full ROM — heels as far back as the machine allows',
      'Pause at full contraction for 1 second',
      'Slow 3-second eccentric every rep',
      'Hip flexion pre-stretches the hamstrings beyond the lying curl',
    ],
  },

  hip_abduction: {
    name: 'Hip Abduction Machine',
    primaryMuscles:   ['abductors'],
    secondaryMuscles: [],
    lottieFile: 'hip_abduction',
    mechanics: 'Hip Abduction (Machine)',
    joints: ['Hip'],
    cues: [
      'Full ROM — resist the return with control',
      'Pause at maximum abduction',
      'Torso upright — don\'t lean to cheat the ROM',
      'Both sides need equal attention',
    ],
  },

  close_grip_bench: {
    name: 'Close-Grip Bench Press',
    primaryMuscles:   ['triceps'],
    secondaryMuscles: ['chest', 'front-deltoids'],
    lottieFile: 'close_grip_bench',
    mechanics: 'Horizontal Push (Tricep Focus)',
    joints: ['Elbow', 'Shoulder'],
    cues: [
      'Shoulder-width grip — not too narrow',
      'Elbows tucked tight to torso throughout',
      'Bar to lower chest',
      'Full lockout — squeeze triceps hard at top',
      'Same scapular setup as standard bench press',
    ],
  },

  bent_over_lateral: {
    name: 'Bent-Over Lateral Raise',
    primaryMuscles:   ['back-deltoids'],
    secondaryMuscles: ['trapezius', 'upper-back'],
    lottieFile: 'bent_over_lateral',
    mechanics: 'Horizontal Abduction',
    joints: ['Shoulder'],
    cues: [
      'Hinge forward 70–90° — torso nearly parallel to floor',
      'Soft elbow — fixed throughout',
      'Lead with elbows, arc upward',
      'Pause at the top — feel the rear delt contract',
      'Control the descent — don\'t let it drop',
    ],
  },

  arnold_press: {
    name: 'Arnold Press',
    primaryMuscles:   ['front-deltoids'],
    secondaryMuscles: ['triceps'],
    lottieFile: 'arnold_press',
    mechanics: 'Vertical Push + Rotation',
    joints: ['Shoulder', 'Elbow'],
    cues: [
      'Start: dumbbells at chin, palms facing you',
      'Rotate outward as you press upward',
      'End: palms facing forward at lockout',
      'Fully reverse the rotation on the descent',
      'The rotation at the bottom is what makes this unique',
    ],
  },

  good_morning: {
    name: 'Good Morning',
    primaryMuscles:   ['hamstring', 'lower-back'],
    secondaryMuscles: ['gluteal'],
    lottieFile: 'good_morning',
    mechanics: 'Hip Hinge (Bar on Back)',
    joints: ['Hip', 'Spine'],
    cues: [
      'Soft knee bend — this is a hinge, not a squat',
      'Hinge until torso approaches parallel to floor',
      'Spine absolutely neutral — no rounding at any point',
      'Drive hips through to standing — lock glutes at top',
      'Light weight with perfect form — bar amplifies errors',
    ],
  },

  // ── KETTLEBELL ─────────────────────────────────────────────────────────────
  kb_swing: {
    name: 'Kettlebell Swing',
    primaryMuscles:   ['gluteal'],
    secondaryMuscles: ['hamstring', 'lower-back', 'trapezius'],
    lottieFile: 'kb_swing',
    mechanics: 'Ballistic Hip Hinge',
    joints: ['Hip'],
    cues: [
      'Hike the bell back between your legs',
      'Explosive hip snap — not a squat',
      'Bell floats to chest height on hip drive',
      'Hips fully extended at top — glutes locked',
      'Let the bell fall back — hinge, don\'t squat',
    ],
  },
};
