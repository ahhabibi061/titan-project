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
