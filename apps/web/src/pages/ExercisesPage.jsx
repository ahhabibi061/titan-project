import React, { useState, useMemo } from 'react';
import AppNav from '../components/AppNav';

/* =========================================================================
 * EXERCISE LIBRARY — Module 2 Proof-of-Concept
 * Demonstrates: filterable exercise database with split-aware filters
 *               (PPL, Upper/Lower, Bro Split), muscle group filtering,
 *               equipment filter, sort options, detail modal with
 *               Pro-gated content (form-check videos, advanced variations).
 *
 * Production notes:
 *   - `exercises` table is global, read-only, seeded from curated CSV.
 *   - Premium content (form-check videos, advanced variations) gated via
 *     RLS: SELECT allowed only when profiles.subscription_tier IN ('pro','elite').
 *   - Video URLs point to private CDN bucket; signed URLs expire in 1h.
 * ========================================================================= */

// -------------------- DATA --------------------
const MUSCLES = {
  chest:       'Chest',
  front_delts: 'Front Delts',
  side_delts:  'Side Delts',
  rear_delts:  'Rear Delts',
  lats:        'Lats',
  traps:       'Traps',
  biceps:      'Biceps',
  triceps:     'Triceps',
  forearms:    'Forearms',
  abs:         'Abs',
  obliques:    'Obliques',
  quads:       'Quads',
  hamstrings:  'Hamstrings',
  glutes:      'Glutes',
  calves:      'Calves',
  lower_back:  'Lower Back',
  hip_flexors: 'Hip Flexors',
};

const EXERCISES = [
  // ── CHEST ──
  { id: 'bench',        name: 'Barbell Bench Press',     primary: 'chest',       secondary: ['front_delts','triceps'],              equipment: 'barbell',    pattern: 'push',      difficulty: 3, splits: ['push','upper','bro_chest'],                    premium: false, popular: 92, description: 'The barbell bench press is the gold-standard horizontal push movement. It loads the pectorals through a long range of motion with high mechanical tension, making it the most effective compound exercise for upper-body pushing strength and hypertrophy.', videoUrl: 'https://titan-cdn.app/demos/bench.mp4',           cues: ['Tuck elbows ~45°','Bar to lower chest','Squeeze glutes','Drive feet into floor'] },
  { id: 'incline_db',   name: 'Incline DB Press',        primary: 'chest',       secondary: ['front_delts','triceps'],              equipment: 'dumbbell',   pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_chest'],                    premium: false, popular: 88, description: 'The incline dumbbell press targets the clavicular (upper) head of the pectoralis major by placing the torso at approximately 30°. Dumbbells allow greater shoulder rotation and pectoral stretch at the bottom compared to a barbell, producing superior upper-chest development.', videoUrl: 'https://titan-cdn.app/demos/incline_db.mp4',       cues: ['Bench at 30°','Wrists stacked over elbows','Lower until chest stretches','Drive up & in'] },
  { id: 'cable_fly',    name: 'Cable Crossover',         primary: 'chest',       secondary: ['front_delts'],                        equipment: 'cable',      pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_chest'],                    premium: false, popular: 75, description: 'The cable crossover provides constant tension through the full arc of pectoral movement, unlike dumbbells which lose resistance in the contracted position. The crossed-over finish maximises the pec\'s adduction function and is ideal as a hypertrophy finisher.', videoUrl: 'https://titan-cdn.app/demos/cable_fly.mp4',        cues: ['Soft elbow throughout','Squeeze at midline','Forward step for stretch'] },
  { id: 'dips',         name: 'Weighted Dips',           primary: 'chest',       secondary: ['triceps','front_delts'],              equipment: 'bodyweight', pattern: 'push',      difficulty: 4, splits: ['push','upper','bro_chest'],                    premium: true,  popular: 68, description: 'The weighted dip is a vertical pressing movement that combines chest and tricep loading with body leverage. A forward torso lean of approximately 30° maximises pectoral stretch and contribution; an upright torso shifts emphasis to the triceps.', videoUrl: 'https://titan-cdn.app/demos/dips.mp4',            cues: ['Lean forward 30°','Lower until shoulder = elbow','Lock out at top'] },

  // ── SHOULDERS ──
  { id: 'ohp',          name: 'Standing Overhead Press', primary: 'front_delts', secondary: ['side_delts','triceps'],               equipment: 'barbell',    pattern: 'push',      difficulty: 3, splits: ['push','upper','bro_shoulders'],                premium: false, popular: 85, description: 'The standing barbell overhead press is the most demanding shoulder strength movement, requiring full trunk stability and sequenced force transfer from the floor through the bar. It builds pressing strength that transfers to all other overhead movements and develops the entire shoulder girdle.', videoUrl: 'https://titan-cdn.app/demos/ohp.mp4',             cues: ['Brace core hard','Bar path over mid-foot','Shrug at lockout','Glutes squeezed'] },
  { id: 'lateral_raise',name: 'DB Lateral Raise',        primary: 'side_delts',  secondary: [],                                    equipment: 'dumbbell',   pattern: 'isolation', difficulty: 1, splits: ['push','upper','bro_shoulders'],                premium: false, popular: 90, description: 'The dumbbell lateral raise is the primary isolation exercise for the middle deltoid — the muscle responsible for shoulder width. Due to the torque curve, resistance peaks at the top of the movement where the arm is parallel to the floor, placing peak load exactly where the muscle is strongest.', videoUrl: 'https://titan-cdn.app/demos/lateral_raise.mp4',   cues: ['Slight elbow bend','Lead with pinkies','Stop at shoulder height'] },
  { id: 'rear_delt_fly',name: 'Reverse Pec Deck',        primary: 'rear_delts',  secondary: ['traps'],                             equipment: 'machine',    pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_shoulders'],                premium: false, popular: 72, description: 'The reverse pec deck isolates the rear deltoid and upper back by placing the chest against a pad, eliminating torso momentum. It is one of the most effective exercises for developing posterior deltoid hypertrophy and correcting the forward-rounding posture common in heavy pressers.', videoUrl: 'https://titan-cdn.app/demos/rear_delt_fly.mp4',   cues: ['Chest against pad','Pull with rear delts not arms','Pause briefly'] },
  { id: 'face_pull',    name: 'Cable Face Pull',         primary: 'rear_delts',  secondary: ['traps'],                             equipment: 'cable',      pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_shoulders'],                premium: false, popular: 78, description: 'The cable face pull trains the rear deltoids, external rotators, and lower traps simultaneously, making it one of the most valuable exercises for shoulder health and posture correction. The external rotation component at the finish is critical for rotator cuff longevity in heavy pressers.', videoUrl: 'https://titan-cdn.app/demos/face_pull.mp4',       cues: ['Rope to forehead','External rotation at end','High elbows'] },

  // ── BACK ──
  { id: 'pullup',       name: 'Pull-Up',                 primary: 'lats',        secondary: ['biceps','rear_delts'],               equipment: 'bodyweight', pattern: 'pull',      difficulty: 4, splits: ['pull','upper','bro_back'],                     premium: false, popular: 88, description: 'The pull-up is the most demanding bodyweight pulling exercise, requiring the lifter to raise their full bodyweight through vertical pulling. It develops exceptional relative upper-body strength, primarily loading the lats and biceps, and is the gold-standard test of pulling strength.', videoUrl: 'https://titan-cdn.app/demos/pullup.mp4',          cues: ['Hollow body position','Drive elbows down','Chin over bar','Control descent'] },
  { id: 'row',          name: 'Barbell Row',             primary: 'lats',        secondary: ['biceps','rear_delts','traps'],       equipment: 'barbell',    pattern: 'pull',      difficulty: 3, splits: ['pull','upper','bro_back'],                     premium: false, popular: 90, description: 'The barbell row is the foundational horizontal pulling movement, training the entire posterior upper-body chain including the lats, rhomboids, biceps, and rear delts. Hip hinge position must be maintained throughout and the bar should travel to the lower abdomen to maximise lat engagement.', videoUrl: 'https://titan-cdn.app/demos/row.mp4',             cues: ['Hinge to ~45°','Pull to belly button','Squeeze shoulder blades','Don\'t round back'] },
  { id: 'lat_pulldown', name: 'Lat Pulldown',            primary: 'lats',        secondary: ['biceps'],                            equipment: 'cable',      pattern: 'pull',      difficulty: 2, splits: ['pull','upper','bro_back'],                     premium: false, popular: 85, description: 'The lat pulldown mimics the pull-up pattern with external load, allowing volume and load to be precisely controlled regardless of bodyweight strength. It is the primary lat-building exercise for those working toward a first pull-up and allows heavy volume accumulation for lat hypertrophy.', videoUrl: 'https://titan-cdn.app/demos/lat_pulldown.mp4',    cues: ['Slight backward lean','Bar to upper chest','Pull with elbows','No momentum'] },
  { id: 'tbar_row',     name: 'T-Bar Row',               primary: 'lats',        secondary: ['biceps','traps'],                    equipment: 'machine',    pattern: 'pull',      difficulty: 3, splits: ['pull','upper','bro_back'],                     premium: true,  popular: 70, description: 'The T-Bar row allows heavy bilateral loading through a partial range of motion, making it highly effective for building mass in the mid-back and lats. The neutral grip and chest-pad variant reduces lumbar stress compared to free-standing rows, enabling greater training volume.', videoUrl: 'https://titan-cdn.app/demos/tbar_row.mp4',        cues: ['Neutral spine','Pull bar to sternum','Drive elbows back & high'] },
  { id: 'shrug',        name: 'DB Shrug',                primary: 'traps',       secondary: [],                                    equipment: 'dumbbell',   pattern: 'isolation', difficulty: 1, splits: ['pull','upper','bro_back','bro_shoulders'],     premium: false, popular: 65, description: 'The dumbbell shrug is the primary isolation exercise for the trapezius muscles, particularly the upper traps responsible for neck and shoulder thickness. A straight vertical shrug with a deliberate pause at the top maximises muscle tension; avoid rolling the shoulders.', videoUrl: 'https://titan-cdn.app/demos/shrug.mp4',           cues: ['Straight up, not rolling','Pause at top','Full ROM down'] },

  // ── ARMS ──
  { id: 'curl',         name: 'Barbell Curl',            primary: 'biceps',      secondary: ['forearms'],                          equipment: 'barbell',    pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_arms'],                     premium: false, popular: 92, description: 'The barbell curl is the classic bicep mass builder, allowing heavier bilateral loads than dumbbell variations due to combined limb strength. It trains the biceps through their primary function of elbow flexion with forearm supination demand built into the movement.', videoUrl: 'https://titan-cdn.app/demos/curl.mp4',            cues: ['Elbows pinned to sides','No swinging','Squeeze at top'] },
  { id: 'hammer_curl',  name: 'Hammer Curl',             primary: 'biceps',      secondary: ['forearms'],                          equipment: 'dumbbell',   pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_arms'],                     premium: false, popular: 80, description: 'The hammer curl uses a neutral grip which equally targets the biceps brachii, brachialis, and brachioradialis, producing thicker and more complete upper arm development. The brachialis lies underneath the biceps and when fully developed pushes the biceps up, adding apparent peak.', videoUrl: 'https://titan-cdn.app/demos/hammer_curl.mp4',    cues: ['Neutral grip throughout','Slow eccentric','Strict form'] },
  { id: 'preacher_curl',name: 'Preacher Curl',           primary: 'biceps',      secondary: [],                                    equipment: 'machine',    pattern: 'pull',      difficulty: 2, splits: ['pull','upper','bro_arms'],                     premium: true,  popular: 60, description: 'The preacher curl eliminates cheating by anchoring the upper arm against an angled pad, isolating the biceps through strict elbow flexion. The bottom stretched position — where the bicep is fully lengthened and under maximum tension — is where the greatest hypertrophic stimulus occurs.', videoUrl: 'https://titan-cdn.app/demos/preacher_curl.mp4',   cues: ['Armpits at pad top','Don\'t fully extend','Control descent'] },
  { id: 'tricep_pushdown',name: 'Cable Tricep Pushdown', primary: 'triceps',     secondary: [],                                    equipment: 'cable',      pattern: 'push',      difficulty: 1, splits: ['push','upper','bro_arms'],                     premium: false, popular: 88, description: 'The cable tricep pushdown provides constant tension on the triceps through the entire range of motion, particularly in the contracted position where free weights offer near-zero resistance. Different attachments (rope, straight bar, V-bar) allow emphasis on different heads of the triceps.', videoUrl: 'https://titan-cdn.app/demos/tricep_pushdown.mp4', cues: ['Elbows pinned','Full lockout','Slight lean forward'] },
  { id: 'skullcrusher', name: 'Skullcrusher',            primary: 'triceps',     secondary: [],                                    equipment: 'barbell',    pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_arms'],                     premium: false, popular: 70, description: 'The skullcrusher (lying triceps extension) loads all three triceps heads in the stretch position, where hypertrophy stimulus is greatest. The long head is particularly well-targeted as the movement places the shoulder in slight flexion, pre-stretching it beyond what pushdowns or dips achieve.', videoUrl: 'https://titan-cdn.app/demos/skullcrusher.mp4',   cues: ['Lower toward forehead','Elbows fixed','Strong grip on bar'] },

  // ── LEGS ──
  { id: 'squat',        name: 'Back Squat',              primary: 'quads',       secondary: ['glutes','hamstrings'],               equipment: 'barbell',    pattern: 'squat',     difficulty: 4, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 95, description: 'The barbell back squat is the foundational lower-body compound movement, loading the quads, glutes, and hamstrings through a full range of motion with high mechanical tension and systemic hormonal response. It requires hip, ankle, and thoracic mobility alongside core bracing proficiency to execute safely.', videoUrl: 'https://titan-cdn.app/demos/squat.mp4',           cues: ['Brace before unrack','Knees track toes','Hip below parallel','Drive through mid-foot'] },
  { id: 'front_squat',  name: 'Front Squat',             primary: 'quads',       secondary: ['glutes','abs'],                      equipment: 'barbell',    pattern: 'squat',     difficulty: 4, splits: ['legs','lower','bro_legs'],                    premium: true,  popular: 70, description: 'The front squat places the barbell on the anterior deltoids with an upright torso, shifting emphasis to the quads while significantly reducing shear forces on the lumbar spine compared to the back squat. The rack position demands exceptional wrist mobility and upper back strength.', videoUrl: 'https://titan-cdn.app/demos/front_squat.mp4',    cues: ['Elbows high throughout','Upright torso','Bar on front delts'] },
  { id: 'leg_press',    name: 'Leg Press',               primary: 'quads',       secondary: ['glutes','hamstrings'],               equipment: 'machine',    pattern: 'squat',     difficulty: 2, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 88, description: 'The leg press removes axial spinal loading, allowing very heavy quad and glute work with reduced technical complexity and spinal risk. Foot position on the platform alters muscle emphasis significantly — higher and wider increases glute and hamstring contribution; lower shifts load to the quads.', videoUrl: 'https://titan-cdn.app/demos/leg_press.mp4',      cues: ['Feet shoulder width','Lower back stays glued','Don\'t lock knees'] },
  { id: 'rdl',          name: 'Romanian Deadlift',       primary: 'hamstrings',  secondary: ['glutes','lower_back'],               equipment: 'barbell',    pattern: 'hinge',     difficulty: 3, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 82, description: 'The Romanian deadlift is the most effective exercise for training the hamstrings in the lengthened position, where they produce the greatest hypertrophic stimulus. Unlike the conventional deadlift, it begins from the top position and focuses on the hip hinge eccentric with knees remaining nearly straight throughout.', videoUrl: 'https://titan-cdn.app/demos/rdl.mp4',             cues: ['Soft knees, hip hinge','Bar drags down legs','Stop at mid-shin','Drive hips through'] },
  { id: 'deadlift',     name: 'Conventional Deadlift',   primary: 'hamstrings',  secondary: ['glutes','lower_back','traps'],       equipment: 'barbell',    pattern: 'hinge',     difficulty: 5, splits: ['pull','lower','bro_legs','bro_back'],          premium: false, popular: 92, description: 'The conventional deadlift is the most complete posterior chain strength exercise, requiring coordinated effort from the hamstrings, glutes, lower back, and traps to lift maximal loads from the floor. It produces the greatest whole-body mechanical stress of any single lift and is a reliable indicator of total-body strength.', videoUrl: 'https://titan-cdn.app/demos/deadlift.mp4',       cues: ['Bar over mid-foot','Lats engaged before pull','Push the floor away','Lockout glutes'] },
  { id: 'leg_curl',     name: 'Lying Leg Curl',          primary: 'hamstrings',  secondary: [],                                    equipment: 'machine',    pattern: 'isolation', difficulty: 1, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 75, description: 'The lying leg curl isolates the hamstrings in knee flexion — their secondary function after hip extension. Full range of motion with a deliberate pause in the contracted position is essential, as the hamstrings are a notoriously difficult muscle group to develop with insufficient isolation work.', videoUrl: 'https://titan-cdn.app/demos/leg_curl.mp4',       cues: ['Hips down on pad','Full ROM','Pause at peak'] },
  { id: 'hip_thrust',   name: 'Barbell Hip Thrust',      primary: 'glutes',      secondary: ['hamstrings'],                        equipment: 'barbell',    pattern: 'hinge',     difficulty: 2, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 80, description: 'The barbell hip thrust produces the greatest gluteus maximus EMG activation of any exercise measured in research. The supine position allows the glutes to be loaded maximally at full hip extension without the spinal compressive demands of standing hip hinge movements.', videoUrl: 'https://titan-cdn.app/demos/hip_thrust.mp4',    cues: ['Upper back on bench','Chin tucked','Squeeze glutes hard at top'] },
  { id: 'bulgarian',    name: 'Bulgarian Split Squat',   primary: 'quads',       secondary: ['glutes'],                            equipment: 'dumbbell',   pattern: 'squat',     difficulty: 3, splits: ['legs','lower','bro_legs'],                    premium: true,  popular: 72, description: 'The Bulgarian split squat is the most demanding unilateral lower-body exercise, combining single-leg quad strength with hip flexor mobility, glute strength, and balance. Research shows it is comparable to the back squat for lower-body hypertrophy while requiring less spinal loading and exposing strength asymmetries.', videoUrl: 'https://titan-cdn.app/demos/bulgarian.mp4',     cues: ['Long stride length','Front foot flat','Vertical shin at depth'] },
  { id: 'calf_raise',   name: 'Standing Calf Raise',     primary: 'calves',      secondary: [],                                    equipment: 'machine',    pattern: 'isolation', difficulty: 1, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 70, description: 'The standing calf raise trains the gastrocnemius — the largest and most visible calf muscle — through its full plantarflexion function with an extended knee. The stretched position at the bottom and slow eccentric tempo are the most critical variables for calf hypertrophy.', videoUrl: 'https://titan-cdn.app/demos/calf_raise.mp4',    cues: ['Full stretch at bottom','Pause 1s at top','Slow eccentric'] },

  // ── CORE ──
  { id: 'crunch',       name: 'Cable Crunch',            primary: 'abs',         secondary: [],                                    equipment: 'cable',      pattern: 'isolation', difficulty: 1, splits: ['legs','upper'],                               premium: false, popular: 65, description: 'The cable crunch is the primary weighted ab exercise, enabling progressive overload on the rectus abdominis that bodyweight crunches cannot provide. Curling the spine downward from the thorax — not simply bending at the hip — is the correct movement pattern that maximises rectus abdominis activation.', videoUrl: 'https://titan-cdn.app/demos/crunch.mp4',          cues: ['Curl spine, not hip','Elbows lead','Squeeze hard'] },
  { id: 'plank',        name: 'Plank',                   primary: 'abs',         secondary: ['obliques'],                          equipment: 'bodyweight', pattern: 'isolation', difficulty: 1, splits: ['legs','upper'],                               premium: false, popular: 75, description: 'The plank is an isometric anti-extension core stability exercise that trains the deep core musculature — particularly the transverse abdominis — to maintain spinal neutrality under sustained load. It is the foundational movement for developing the bracing capability required in all compound lifts.', videoUrl: 'https://titan-cdn.app/demos/plank.mp4',           cues: ['Glutes squeezed','Hips level','Breath through brace'] },
  { id: 'leg_raise',    name: 'Hanging Leg Raise',       primary: 'abs',         secondary: ['obliques'],                          equipment: 'bodyweight', pattern: 'isolation', difficulty: 3, splits: ['legs','upper'],                               premium: false, popular: 70, description: 'The hanging leg raise trains the lower abs and hip flexors through a full range of motion that most exercises cannot reach. Performed correctly — initiated by a posterior pelvic tilt rather than a hip flexor swing — it specifically challenges the rectus abdominis in controlling pelvic position.', videoUrl: 'https://titan-cdn.app/demos/leg_raise.mp4',      cues: ['Posterior pelvic tilt','Don\'t swing','Lower under control'] },

  // ── BODYWEIGHT ──
  { id: 'pushup',           name: 'Push-Up',                  primary: 'chest',       secondary: ['front_delts','triceps','abs'],        equipment: 'bodyweight', pattern: 'push',      difficulty: 1, splits: ['push','upper','bro_chest'],                    premium: false, popular: 85, description: 'The push-up is a fundamental closed-chain pressing movement that trains the chest, shoulders, and triceps while demanding core stability throughout. It requires no equipment and scales effectively from beginner to advanced via elevation, tempo, and loading variations.', videoUrl: 'https://titan-cdn.app/demos/pushup.mp4',          cues: ['Hands shoulder-width apart','Elbows track ~45° from torso','Full ROM: chest touches floor','Squeeze glutes and brace core'] },
  { id: 'pike_pushup',      name: 'Pike Push-Up',             primary: 'front_delts', secondary: ['triceps','traps'],                    equipment: 'bodyweight', pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_shoulders'],                premium: false, popular: 58, description: 'The pike push-up is a bodyweight overhead pressing variation that shifts load from the chest to the anterior deltoid by elevating the hips into an inverted V. It serves as a prerequisite movement for the handstand push-up and develops overhead pressing strength without equipment.', videoUrl: 'https://titan-cdn.app/demos/pike_pushup.mp4',     cues: ['Hips high — inverted V position','Head through on descent','Elbows flare wide','Press to full arm extension'] },
  { id: 'diamond_pushup',   name: 'Diamond Push-Up',          primary: 'triceps',     secondary: ['chest','front_delts'],               equipment: 'bodyweight', pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_arms'],                     premium: false, popular: 62, description: 'The diamond push-up places the hands in a close triangular formation, shifting the primary load from the chest to the triceps. EMG studies consistently show higher triceps activation than traditional push-up variations, making it the best bodyweight tricep exercise.', videoUrl: 'https://titan-cdn.app/demos/diamond_pushup.mp4',  cues: ['Thumbs and index fingers touching','Elbows track back, not out','Chest to hands','Keep hips level'] },
  { id: 'inverted_row',     name: 'Inverted Row',             primary: 'lats',        secondary: ['biceps','rear_delts','traps'],        equipment: 'bodyweight', pattern: 'pull',      difficulty: 2, splits: ['pull','upper','bro_back'],                     premium: false, popular: 66, description: 'The inverted row is a horizontal pulling movement performed under a fixed bar, training the lats, rhomboids, and rear delts with bodyweight. Foot placement controls difficulty — feet positioned further forward increases the challenge by reducing the body angle toward horizontal.', videoUrl: 'https://titan-cdn.app/demos/inverted_row.mp4',    cues: ['Body rigid like a plank','Pull chest to bar','Squeeze shoulder blades at top','Control the descent'] },
  { id: 'bodyweight_squat', name: 'Bodyweight Squat',         primary: 'quads',       secondary: ['glutes','hamstrings'],               equipment: 'bodyweight', pattern: 'squat',     difficulty: 1, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 70, description: 'The bodyweight squat is the foundation of all squatting patterns, developing lower-body mechanics before external load is introduced. It trains quad dominance with glute and hamstring co-activation through a full range of motion and is the prerequisite for all loaded squat variations.', videoUrl: 'https://titan-cdn.app/demos/bodyweight_squat.mp4', cues: ['Feet shoulder-width, toes slightly out','Knees track over toes','Hip crease below knee at depth','Chest up throughout'] },
  { id: 'pistol_squat',     name: 'Pistol Squat',             primary: 'quads',       secondary: ['glutes','abs'],                      equipment: 'bodyweight', pattern: 'squat',     difficulty: 5, splits: ['legs','lower','bro_legs'],                    premium: true,  popular: 55, description: 'The pistol squat is a single-leg squat performed to full depth with the non-working leg extended forward. It demands exceptional quad strength, ankle mobility, hip flexibility, and balance simultaneously, making it one of the hardest bodyweight lower-body movements.', videoUrl: 'https://titan-cdn.app/demos/pistol_squat.mp4',    cues: ['Non-working leg extended and off ground','Controlled descent — no collapsing','Heel stays planted','Arms forward for counterbalance'] },
  { id: 'glute_bridge',     name: 'Glute Bridge',             primary: 'glutes',      secondary: ['hamstrings','lower_back'],            equipment: 'bodyweight', pattern: 'hinge',     difficulty: 1, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 72, description: 'The glute bridge is a supine hip extension that isolates the glutes while reducing lumbar stress compared to standing hinge movements. It is widely used for glute activation, posterior chain rehabilitation, and as the bodyweight precursor to the barbell hip thrust.', videoUrl: 'https://titan-cdn.app/demos/glute_bridge.mp4',    cues: ['Feet flat, hip-width apart','Drive hips fully up — body forms straight line','Squeeze glutes hard at top','Chin tucked, ribs down'] },
  { id: 'nordic_curl',      name: 'Nordic Hamstring Curl',    primary: 'hamstrings',  secondary: ['glutes','calves'],                   equipment: 'bodyweight', pattern: 'hinge',     difficulty: 5, splits: ['legs','lower','bro_legs'],                    premium: true,  popular: 52, description: 'The Nordic hamstring curl is a bodyweight eccentric-dominant exercise with the highest hamstring EMG activation of any exercise measured in research. It consistently reduces hamstring strain injury risk by approximately 50% in athletes and should be a staple for any serious lifter or athlete.', videoUrl: 'https://titan-cdn.app/demos/nordic_curl.mp4',     cues: ['Ankles anchored securely','Lower body as slowly as possible (3-5s)','Catch yourself with hands at bottom','Pull back up using hamstrings'] },
  { id: 'dip_bw',           name: 'Bodyweight Dip',           primary: 'triceps',     secondary: ['chest','front_delts'],               equipment: 'bodyweight', pattern: 'push',      difficulty: 3, splits: ['push','upper','bro_arms'],                     premium: false, popular: 75, description: 'The bodyweight dip is a compound vertical push movement that heavily loads the triceps with significant chest and anterior deltoid involvement depending on torso angle. Upright torso maximises tricep emphasis; forward lean shifts load to the chest.', videoUrl: 'https://titan-cdn.app/demos/dip_bw.mp4',          cues: ['Upright torso for tricep focus','Lower until upper arms parallel to floor','Full lockout at top','Avoid shrugging — depress shoulders'] },
  { id: 'chin_up',          name: 'Chin-Up',                  primary: 'biceps',      secondary: ['lats','rear_delts'],                 equipment: 'bodyweight', pattern: 'pull',      difficulty: 3, splits: ['pull','upper','bro_arms','bro_back'],          premium: false, popular: 80, description: 'The chin-up uses a supinated (underhand) grip which places the biceps in a stronger mechanical position than pull-ups, typically allowing 10–15% greater load. It trains the lats and biceps simultaneously with high neuromuscular demand and is the best single-exercise for combined back and bicep development.', videoUrl: 'https://titan-cdn.app/demos/chin_up.mp4',         cues: ['Supinated grip shoulder-width','Pull elbows down and back','Chin clears bar','Full hang at bottom — no kipping'] },
  { id: 'situp',            name: 'Sit-Up',                   primary: 'abs',         secondary: ['obliques','hip_flexors'],            equipment: 'bodyweight', pattern: 'isolation', difficulty: 1, splits: ['legs','upper'],                               premium: false, popular: 65, description: 'The sit-up is a classic trunk flexion exercise that trains the rectus abdominis through a large range of motion. Unlike the crunch, it includes hip flexor involvement due to the full range of spinal and hip movement, making it a more complete anterior core exercise.', videoUrl: 'https://titan-cdn.app/demos/situp.mp4',           cues: ['Anchor feet or use decline','Curl spine off floor sequentially','Avoid pulling neck','Lower under full control'] },
  { id: 'ab_wheel',         name: 'Ab Wheel Rollout',         primary: 'abs',         secondary: ['obliques','lats','lower_back'],      equipment: 'bodyweight', pattern: 'isolation', difficulty: 4, splits: ['legs','upper'],                               premium: true,  popular: 68, description: 'The ab wheel rollout is an anti-extension core exercise that places exceptional demand on the entire anterior core. Research shows it generates among the highest rectus abdominis and oblique activation of any core movement, while also training the lats as dynamic stabilisers.', videoUrl: 'https://titan-cdn.app/demos/ab_wheel.mp4',        cues: ['Start kneeling — work up to standing','Brace hard before rolling out','Hips in line with shoulders throughout','Pull back with lats, not lower back'] },

  // ── KETTLEBELL ──
  { id: 'kb_swing',         name: 'Kettlebell Swing',         primary: 'glutes',      secondary: ['hamstrings','lower_back','traps'],    equipment: 'kettlebell', pattern: 'hinge',     difficulty: 2, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 82, description: 'The kettlebell swing is a ballistic hip hinge that explosively trains the posterior chain through rapid hip extension. It is a highly efficient exercise for developing power, conditioning, and glute-hamstring strength simultaneously, with cardiovascular demand rivalling traditional cardio.', videoUrl: 'https://titan-cdn.app/demos/kb_swing.mp4',        cues: ['Hike the bell back between legs','Explosive hip snap — not a squat','Bell floats to chest height on the hip drive','Hips fully extended at top — glutes locked'] },
  { id: 'kb_goblet_squat',  name: 'Kettlebell Goblet Squat',  primary: 'quads',       secondary: ['glutes','abs'],                      equipment: 'kettlebell', pattern: 'squat',     difficulty: 1, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 75, description: 'The goblet squat uses the counterbalance effect of an anteriorly loaded kettlebell to promote an upright torso and deep squat depth. It is one of the best teaching tools for correct squat mechanics and a foundational movement for anyone new to squatting.', videoUrl: 'https://titan-cdn.app/demos/kb_goblet_squat.mp4', cues: ['Hold bell at chest by the horns','Elbows inside knees at depth','Chest up throughout','Drive through mid-foot to stand'] },
  { id: 'kb_press',         name: 'Kettlebell Overhead Press',primary: 'front_delts', secondary: ['side_delts','triceps','abs'],         equipment: 'kettlebell', pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_shoulders'],                premium: false, popular: 68, description: 'The single-arm kettlebell press challenges shoulder strength and stability with the offset centre of mass creating rotational demand on the trunk. The racked position requires significant forearm and wrist conditioning, and the unilateral nature exposes left-to-right strength imbalances.', videoUrl: 'https://titan-cdn.app/demos/kb_press.mp4',        cues: ['Bell racked on forearm in rack position','Brace core hard — single arm creates lateral flexion demand','Press straight up — wrist stays straight','Lockout firmly before descent'] },
  { id: 'kb_row',           name: 'Kettlebell Single-Arm Row',primary: 'lats',        secondary: ['biceps','rear_delts'],               equipment: 'kettlebell', pattern: 'pull',      difficulty: 2, splits: ['pull','upper','bro_back'],                     premium: false, popular: 70, description: 'The single-arm kettlebell row trains unilateral lat, rhomboid, and bicep strength while the contralateral arm on a bench provides stability. The neutral wrist position of the kettlebell handle is ergonomically comfortable and reduces wrist strain compared to a barbell row.', videoUrl: 'https://titan-cdn.app/demos/kb_row.mp4',          cues: ['Flat back — hinge to horizontal','Pull elbow back past ribs','Squeeze shoulder blade at top','No torso rotation'] },
  { id: 'kb_deadlift',      name: 'Kettlebell Deadlift',      primary: 'hamstrings',  secondary: ['glutes','lower_back','traps'],        equipment: 'kettlebell', pattern: 'hinge',     difficulty: 2, splits: ['pull','lower','bro_legs'],                     premium: false, popular: 65, description: 'The kettlebell deadlift teaches the hip hinge pattern with a lower centre of mass than a barbell, making it an excellent teaching tool and warm-up movement for the conventional deadlift. The close foot stance and neutral handle grip differ from barbell mechanics.', videoUrl: 'https://titan-cdn.app/demos/kb_deadlift.mp4',     cues: ['Bell between feet','Hip hinge — not a squat','Lats engaged — protect the lower back','Drive hips through to lockout'] },
  { id: 'kb_lunge',         name: 'Kettlebell Lunge',         primary: 'quads',       secondary: ['glutes','hamstrings'],               equipment: 'kettlebell', pattern: 'squat',     difficulty: 2, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 60, description: 'The kettlebell lunge is a unilateral lower-body exercise that trains quad and glute strength while challenging single-leg balance and stability. Holding the bells at the sides or in a rack position alters the stability demand and shifts the emphasis between muscle groups.', videoUrl: 'https://titan-cdn.app/demos/kb_lunge.mp4',        cues: ['Step long enough for 90° at both knees','Front knee tracks over toes','Rear knee hovers above floor','Torso remains upright'] },
  { id: 'kb_clean',         name: 'Kettlebell Clean',         primary: 'glutes',      secondary: ['traps','hamstrings','forearms'],      equipment: 'kettlebell', pattern: 'hinge',     difficulty: 3, splits: ['legs','lower'],                               premium: true,  popular: 58, description: 'The kettlebell clean is a technical movement that transitions the bell from a swing into the rack position using a ballistic hip drive. It develops posterior chain power, full-body coordination, and is the foundational skill required before learning the kettlebell press or snatch.', videoUrl: 'https://titan-cdn.app/demos/kb_clean.mp4',        cues: ['Initiate with hip hinge — not the arm','Guide the bell close to the body','Punch hand through at the top — bell lands on forearm, not wrist','Absorb in the rack by bending slightly at knees'] },
  { id: 'kb_turkish_getup', name: 'Turkish Get-Up',           primary: 'abs',         secondary: ['front_delts','glutes','traps'],       equipment: 'kettlebell', pattern: 'carry',     difficulty: 5, splits: ['upper','lower'],                              premium: true,  popular: 55, description: 'The Turkish get-up is a full-body movement that takes the lifter from lying to standing with a weight pressed overhead. It trains shoulder stability, hip mobility, core anti-rotation, and total-body coordination in a single movement and is widely considered the most complete exercise in existence.', videoUrl: 'https://titan-cdn.app/demos/kb_turkish_getup.mp4', cues: ['Keep eyes on the bell throughout','Never let the pressed arm bend','Work through each checkpoint slowly','Lower with the same controlled sequence'] },

  // ── CABLES ──
  { id: 'cable_row',         name: 'Seated Cable Row',         primary: 'lats',        secondary: ['biceps','rear_delts','traps'],        equipment: 'cable',      pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_back'],                     premium: false, popular: 84, description: 'The seated cable row provides constant tension on the lats and mid-back through the full range of motion, unlike free-weight rows where tension drops at the bottom. The cable angle and handle type significantly influence which back muscles are emphasised.', videoUrl: 'https://titan-cdn.app/demos/cable_row.mp4',       cues: ['Brace core — don\'t lean back with momentum','Pull handle to lower sternum','Squeeze shoulder blades together at end range','Slow return — don\'t let the stack crash'] },
  { id: 'cable_curl',        name: 'Cable Curl',               primary: 'biceps',      secondary: ['forearms'],                          equipment: 'cable',      pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_arms'],                     premium: false, popular: 76, description: 'The cable curl maintains constant tension on the biceps in both the shortened and lengthened position, unlike dumbbells or barbells which have mechanical disadvantage points in the ROM. The low pulley position maximises tension in the lengthened bicep position where growth stimulus is greatest.', videoUrl: 'https://titan-cdn.app/demos/cable_curl.mp4',      cues: ['Elbows pinned at sides','Supinate fully at peak','Slow 3-second eccentric','Don\'t rock the torso'] },
  { id: 'cable_lateral',     name: 'Cable Lateral Raise',      primary: 'side_delts',  secondary: [],                                    equipment: 'cable',      pattern: 'isolation', difficulty: 1, splits: ['push','upper','bro_shoulders'],                premium: false, popular: 78, description: 'The cable lateral raise provides constant tension on the side deltoid throughout the entire range of motion, especially at the bottom where dumbbells offer near-zero resistance. Crossing the cable under the body to the opposite side increases the stretch on the target muscle.', videoUrl: 'https://titan-cdn.app/demos/cable_lateral.mp4',   cues: ['Cable crosses in front of body to opposite side','Lead with elbow, not wrist','Stop at shoulder height','Resist the return — don\'t let the stack drop freely'] },
  { id: 'cable_pull_through',name: 'Cable Pull-Through',       primary: 'glutes',      secondary: ['hamstrings','lower_back'],            equipment: 'cable',      pattern: 'hinge',     difficulty: 1, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 64, description: 'The cable pull-through isolates the glutes and hamstrings with constant cable tension throughout the hip hinge pattern. The forward lean into the cable increases hip flexion range and hamstring stretch beyond what is achievable with gravity-based hinge movements.', videoUrl: 'https://titan-cdn.app/demos/cable_pull_through.mp4', cues: ['Face away from the cable stack','Hinge at the hip — let the cable pull you through your legs','Drive hips forward to lockout','Squeeze glutes hard at the top'] },
  { id: 'cable_woodchop',    name: 'Cable Woodchop',           primary: 'obliques',    secondary: ['abs','front_delts'],                 equipment: 'cable',      pattern: 'isolation', difficulty: 2, splits: ['upper','lower'],                              premium: false, popular: 60, description: 'The cable woodchop trains rotational core strength with constant cable resistance throughout the movement arc. It is one of the most specific exercises for developing anti-rotation strength and transverse-plane power transfer required in sport and daily function.', videoUrl: 'https://titan-cdn.app/demos/cable_woodchop.mp4',  cues: ['Rotate from the thoracic spine — not just the arms','Keep arms relatively straight','Pivot the rear foot on rotation','Both high-to-low and low-to-high variations train different oblique functions'] },
  { id: 'pallof_press',      name: 'Pallof Press',             primary: 'abs',         secondary: ['obliques'],                          equipment: 'cable',      pattern: 'isolation', difficulty: 2, splits: ['upper','lower'],                              premium: false, popular: 62, description: 'The Pallof press is an anti-rotation core stability exercise performed with a cable or band. The core is challenged to resist rotation toward the load, making it superior for training the stabilising function of the abs and obliques that transfers directly to compound lifting.', videoUrl: 'https://titan-cdn.app/demos/pallof_press.mp4',    cues: ['Stand perpendicular to the cable','Brace before pressing out','Pause fully extended — resist the rotation','The further you stand from the stack, the harder it is'] },

  // ── MACHINES ──
  { id: 'chest_press',        name: 'Machine Chest Press',    primary: 'chest',       secondary: ['front_delts','triceps'],             equipment: 'machine',    pattern: 'push',      difficulty: 1, splits: ['push','upper','bro_chest'],                    premium: false, popular: 79, description: 'The machine chest press provides a fixed movement path that reduces stability demands, allowing lifters to fatigue the pectorals with reduced injury risk. It is highly effective for hypertrophy, particularly as a final exercise when stabilisers are fatigued and free-weight control is compromised.', videoUrl: 'https://titan-cdn.app/demos/chest_press.mp4',     cues: ['Seat height: handles at lower chest level','Drive through the chest — don\'t lock out elbows aggressively','Controlled negative — 2-3 seconds','Full stretch in the start position'] },
  { id: 'hack_squat',         name: 'Hack Squat Machine',     primary: 'quads',       secondary: ['glutes','hamstrings'],               equipment: 'machine',    pattern: 'squat',     difficulty: 2, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 76, description: 'The hack squat machine allows deep quad loading in a fixed plane without the spinal compression or technical demands of a barbell squat. Higher foot position on the sled increases glute and hamstring involvement; lower foot position shifts emphasis to the quads.', videoUrl: 'https://titan-cdn.app/demos/hack_squat.mp4',      cues: ['Lower back pressed flat against pad','Knees track in line with toes throughout','Squat to full depth — 90° or below at knee','Push through mid-foot, not toes'] },
  { id: 'smith_ohp',          name: 'Smith Machine OHP',      primary: 'front_delts', secondary: ['side_delts','triceps'],              equipment: 'machine',    pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_shoulders'],                premium: false, popular: 65, description: 'The Smith machine overhead press removes lateral stability demands from the shoulder press, enabling greater focus on deltoid strength through the vertical pressing plane. The fixed bar path is particularly useful for lifters managing shoulder instability or learning the pressing pattern.', videoUrl: 'https://titan-cdn.app/demos/smith_ohp.mp4',       cues: ['Sit close to the bar','Unrack with bar at upper chest','Press in a straight vertical path','Don\'t hyperextend lower back — brace the core'] },
  { id: 'cable_machine_pullover', name: 'Machine Pullover',   primary: 'lats',        secondary: ['chest','abs'],                       equipment: 'machine',    pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_back'],                     premium: false, popular: 62, description: 'The machine pullover isolates the lat in a shoulder extension movement that is unique in loading the lats through a long arc with minimal bicep involvement. The overhead stretch position is where most lat hypertrophic stimulus occurs and is difficult to achieve with any other exercise.', videoUrl: 'https://titan-cdn.app/demos/pullover.mp4',        cues: ['Adjust seat so shoulder is aligned with the pivot point','Keep elbows fixed — drive with the lat','Full stretch overhead is where most lat growth occurs','Controlled return — don\'t let it pull your shoulder forward'] },
  { id: 'seated_calf',        name: 'Seated Calf Raise',      primary: 'calves',      secondary: [],                                    equipment: 'machine',    pattern: 'isolation', difficulty: 1, splits: ['legs','lower','bro_legs'],                    premium: false, popular: 65, description: 'The seated calf raise targets the soleus (the deeper calf muscle) because the bent knee position reduces gastrocnemius contribution, creating a distinct stimulus from standing calf raise variations. Full range of motion — particularly the stretched position at the bottom — is critical for soleus hypertrophy.', videoUrl: 'https://titan-cdn.app/demos/seated_calf.mp4',     cues: ['Knee pads sit just above the knee','Full dorsiflexion stretch at the bottom — hold 1 second','Rise to full plantarflexion — hold 1 second','Slow, deliberate tempo — no bouncing'] },
  { id: 'adductor_machine',   name: 'Hip Adduction Machine',  primary: 'glutes',      secondary: ['hamstrings'],                        equipment: 'machine',    pattern: 'isolation', difficulty: 1, splits: ['legs','lower'],                               premium: false, popular: 60, description: 'The hip adduction machine isolates the adductor magnus, the largest muscle of the inner thigh and a significant hip extensor. Research indicates the adductor magnus contributes substantially to squatting and hip thrust performance and is chronically undertrained in most programmes.', videoUrl: 'https://titan-cdn.app/demos/adductor_machine.mp4', cues: ['Full range of motion — resist the return','Don\'t use momentum — squeeze inward with intention','Both concentric and eccentric are valuable','Hip adductors are often undertrained — start conservatively'] },

  // ── CARDIO / CONDITIONING ──
  { id: 'rowing_machine', name: 'Rowing Machine',             primary: 'lats',        secondary: ['hamstrings','glutes','biceps','abs'],  equipment: 'cardio',     pattern: 'cardio',    difficulty: 2, splits: ['pull','upper','lower'],                       premium: false, popular: 78, description: 'The rowing machine (ergometer) is the most complete cardiovascular machine, engaging approximately 86% of muscle groups in a low-impact, full-body pattern. It is highly effective for cardiovascular fitness while simultaneously training the posterior chain.', videoUrl: 'https://titan-cdn.app/demos/rowing_machine.mp4',  cues: ['Drive sequence: legs → hips → arms (never reversed)','At the catch: shins vertical, arms extended, slight forward lean','At the finish: legs flat, slight backward lean, handle to lower sternum','Maintain consistent stroke rate — power per stroke beats high cadence'] },
  { id: 'assault_bike',   name: 'Assault Bike',               primary: 'quads',       secondary: ['glutes','hamstrings','chest','lats'],  equipment: 'cardio',     pattern: 'cardio',    difficulty: 3, splits: ['legs','upper'],                               premium: false, popular: 72, description: 'The assault bike (fan bike) provides full-body cardiovascular conditioning through simultaneous push-pull arm action and leg cycling. The air resistance mechanism self-regulates to effort level — harder effort creates proportionally more resistance, making it impossible to sandbag.', videoUrl: 'https://titan-cdn.app/demos/assault_bike.mp4',    cues: ['Push AND pull the handles — don\'t just pedal','Slight forward lean — drive through the handles','For intervals: all-out effort — this machine punishes pacing','For steady-state: find a sustainable RPM and hold it'] },
  { id: 'sled_push',      name: 'Sled Push',                  primary: 'quads',       secondary: ['glutes','hamstrings','calves','abs'],  equipment: 'cardio',     pattern: 'carry',     difficulty: 3, splits: ['legs','lower'],                               premium: true,  popular: 65, description: 'The sled push is a concentric-only lower body conditioning movement that eliminates the eccentric phase, significantly reducing DOMS and recovery cost. It develops quad-dominant strength and conditioning and is ideal for high-frequency training due to its low recovery demand.', videoUrl: 'https://titan-cdn.app/demos/sled_push.mp4',       cues: ['Hands at hip height on the upright posts','Low forward body angle — power comes from leg drive, not upper body','Short, powerful strides — stay on the balls of your feet','Keep pushing even when it slows — that\'s the point'] },
  { id: 'farmers_carry',  name: 'Farmer\'s Carry',            primary: 'traps',       secondary: ['forearms','abs','glutes','calves'],   equipment: 'kettlebell', pattern: 'carry',     difficulty: 2, splits: ['pull','upper','lower'],                       premium: false, popular: 68, description: 'The farmer\'s carry develops grip strength, trapezius hypertrophy, core stability, and cardiovascular conditioning simultaneously. It has the highest carry-over to real-world functional strength of any loaded carry variation and exposes grip and core weaknesses rapidly.', videoUrl: 'https://titan-cdn.app/demos/farmers_carry.mp4',   cues: ['Load is heavy — you should feel it within 20 metres','Stand tall — don\'t let the weight pull you sideways','Short, controlled steps','Squeeze the handles as hard as possible throughout'] },

  // ── CORE (additional) ──
  { id: 'dead_bug',      name: 'Dead Bug',                    primary: 'abs',         secondary: ['obliques'],                          equipment: 'bodyweight', pattern: 'isolation', difficulty: 2, splits: ['upper','lower'],                              premium: false, popular: 58, description: 'The dead bug is a supine core stability exercise that trains the ability to maintain a neutral spine while moving the limbs — a critical functional skill for all compound lifts. It is among the safest and most effective anti-extension core exercises and is recommended by sports physiotherapists universally.', videoUrl: 'https://titan-cdn.app/demos/dead_bug.mp4',        cues: ['Lower back firmly pressed to floor throughout','Move only as far as you can without the back lifting','Exhale fully as the arm and leg extend','Opposite arm and leg extend simultaneously'] },
  { id: 'russian_twist', name: 'Russian Twist',               primary: 'obliques',    secondary: ['abs'],                               equipment: 'bodyweight', pattern: 'isolation', difficulty: 2, splits: ['upper','lower'],                              premium: false, popular: 66, description: 'The Russian twist is a rotational core exercise performed in a seated V-sit position, targeting the obliques through trunk rotation. Adding weight (plate, medicine ball, or kettlebell) increases the rotational load and makes it a progressive strength movement rather than just an endurance exercise.', videoUrl: 'https://titan-cdn.app/demos/russian_twist.mp4',   cues: ['Lean back 45°, feet off floor for added difficulty','Rotate from the thorax — not just the arms','Touch the weight to the floor each side','Slow and deliberate — not a race'] },
  { id: 'dragon_flag',   name: 'Dragon Flag',                 primary: 'abs',         secondary: ['obliques','lower_back'],             equipment: 'bodyweight', pattern: 'isolation', difficulty: 5, splits: ['upper','lower'],                              premium: true,  popular: 52, description: 'The dragon flag, popularised by Bruce Lee, is an advanced anti-extension core movement where the entire body is lowered from vertical as a rigid plank. It requires exceptional total-body core strength and is one of the hardest bodyweight ab exercises ever devised.', videoUrl: 'https://titan-cdn.app/demos/dragon_flag.mp4',     cues: ['Grip a bench or fixed object behind your head','Brace the entire body — lock everything rigid','Lower as one unit — don\'t let hips break the line','The eccentric (lowering) is the training stimulus — control it'] },
];

const SPLITS = [
  { id: 'all',           label: 'All',          group: 'all' },
  { id: 'push',          label: 'Push',         group: 'PPL' },
  { id: 'pull',          label: 'Pull',         group: 'PPL' },
  { id: 'legs',          label: 'Legs',         group: 'PPL' },
  { id: 'upper',         label: 'Upper',        group: 'U/L' },
  { id: 'lower',         label: 'Lower',        group: 'U/L' },
  { id: 'bro_chest',     label: 'Chest',        group: 'Bro' },
  { id: 'bro_back',      label: 'Back',         group: 'Bro' },
  { id: 'bro_legs',      label: 'Legs',         group: 'Bro' },
  { id: 'bro_shoulders', label: 'Shoulders',    group: 'Bro' },
  { id: 'bro_arms',      label: 'Arms',         group: 'Bro' },
];

const EQUIPMENT = [
  { id: 'barbell',    label: 'Barbell' },
  { id: 'dumbbell',   label: 'Dumbbell' },
  { id: 'cable',      label: 'Cable' },
  { id: 'machine',    label: 'Machine' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'cardio',     label: 'Cardio Machine' },
];

const SORTS = [
  { id: 'popular',    label: 'Most logged' },
  { id: 'alpha',      label: 'A → Z' },
  { id: 'compound',   label: 'Compound first' },
  { id: 'difficulty', label: 'Hardest first' },
];

// Movement-pattern accent colors
const PATTERN_ACCENTS = {
  push:      { from: '#ed7a2a', to: '#7a2410' },
  pull:      { from: '#7eb6ff', to: '#1e3a5f' },
  squat:     { from: '#fbbf24', to: '#7a4a10' },
  hinge:     { from: '#c084fc', to: '#3a1e5f' },
  isolation: { from: '#94a3b8', to: '#1e293b' },
  cardio:    { from: '#34d399', to: '#064e3b' },
  carry:     { from: '#a78bfa', to: '#2e1065' },
};

// -------------------- MOVEMENT ICONS --------------------
function MotionIcon({ pattern, className = '' }) {
  const props = { className, viewBox: '0 0 60 60', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' };
  switch (pattern) {
    case 'push':
      return (
        <svg {...props}>
          <circle cx="14" cy="30" r="3" fill="currentColor" />
          <path d="M 18,30 Q 30,18 42,30" />
          <path d="M 38,26 L 46,30 L 38,34" />
          <path d="M 14,42 L 14,46 M 14,14 L 14,18" opacity="0.4" />
        </svg>
      );
    case 'pull':
      return (
        <svg {...props}>
          <circle cx="46" cy="30" r="3" fill="currentColor" />
          <path d="M 42,30 Q 30,42 18,30" />
          <path d="M 22,26 L 14,30 L 22,34" />
          <path d="M 46,42 L 46,46 M 46,14 L 46,18" opacity="0.4" />
        </svg>
      );
    case 'squat':
      return (
        <svg {...props}>
          <line x1="12" y1="20" x2="48" y2="20" strokeWidth="3" />
          <path d="M 30,22 L 30,40" />
          <path d="M 22,40 L 30,32 L 38,40" />
          <path d="M 22,46 L 30,38 L 38,46" opacity="0.5" />
          <path d="M 26,52 L 34,52" />
        </svg>
      );
    case 'hinge':
      return (
        <svg {...props}>
          <circle cx="30" cy="14" r="3" fill="currentColor" />
          <path d="M 30,18 L 30,28 Q 30,32 36,32 L 46,38" />
          <path d="M 30,28 L 24,42" />
          <line x1="14" y1="46" x2="50" y2="46" strokeWidth="3" />
        </svg>
      );
    case 'isolation':
      return (
        <svg {...props}>
          <circle cx="30" cy="30" r="14" strokeDasharray="3 3" />
          <circle cx="30" cy="30" r="5" fill="currentColor" />
          <path d="M 30,12 L 30,8 M 30,52 L 30,48 M 12,30 L 8,30 M 52,30 L 48,30" opacity="0.5" />
        </svg>
      );
    case 'cardio':
      return (
        <svg {...props}>
          <path d="M8 30 L16 30 L20 18 L26 42 L32 22 L36 30 L52 30" />
        </svg>
      );
    case 'carry':
      return (
        <svg {...props}>
          <circle cx="30" cy="12" r="5" fill="currentColor" />
          <path d="M30 18 L30 36 M20 48 L30 36 L40 48 M16 26 L30 22 L44 26" />
        </svg>
      );
    default:
      return null;
  }
}

// -------------------- MISTAKES --------------------
const MISTAKES = {
  bench:              ['Elbows flared to 90° strains the anterior shoulder capsule — tuck to ~45°', 'Excessive lumbar arch shortens pectoral ROM and reduces stretch stimulus', 'Bouncing the bar off the chest bypasses the hardest portion of the lift'],
  incline_db:         ['Bench angle above 45° shifts load from upper chest to front delts', 'Not lowering to full stretch — the lengthened position drives the most hypertrophy', 'Pressing straight up rather than arcing inward reduces pectoral activation'],
  cable_fly:          ['Bending the elbows and turning the fly into a press — maintain a constant soft elbow', 'Not crossing hands at the midline — the crossover finishes the pec\'s adduction function', 'Overloading beyond control — cable flies are a finisher, not a strength lift'],
  dips:               ['Torso too upright shifts load to triceps — a 30° forward lean is required for chest emphasis', 'Not reaching full depth — shoulder must reach elbow level at the bottom for maximum stretch', 'Shrugging the shoulders at the top reduces shoulder stability and traps control'],
  ohp:                ['Pressing in front of the face rather than directly overhead — bar must end over the ears', 'Hyperextending the lower back instead of bracing the core under load', 'Insufficient thoracic extension limits overhead lockout and forces lumbar compensation'],
  lateral_raise:      ['Using momentum to swing the weights up rather than controlled deltoid abduction', 'Raising above shoulder height — the supraspinatus takes over above parallel', 'Internal rotation at the top (pinkies below thumbs) reduces middle delt activation'],
  rear_delt_fly:      ['Too much weight causing trap shrugging that removes rear delt isolation', 'Not pausing at peak contraction — the rear delt needs a deliberate squeeze', 'Driving with arm momentum rather than initiating from the posterior shoulder'],
  face_pull:          ['Cable set too low — the attachment should be at face height or above', 'Pulling to the neck rather than the forehead, which reduces external rotation range', 'Excessive weight replacing the critical external rotation at end range with a partial pull'],
  pullup:             ['Kipping or swinging to reduce difficulty — removes the intended strength adaptation', 'Chin not clearing the bar, which misses the peak lat contraction', 'No full dead hang at the bottom — partial range removes lat stretch stimulus'],
  row:                ['Rounding the lower back under load — the hip hinge must be maintained throughout', 'Pulling to the upper chest instead of the lower abdomen reduces lat involvement', 'Jerking with momentum rather than controlled lat drive'],
  lat_pulldown:       ['Pulling the bar behind the neck — this is a cervical spine injury risk with no benefit', 'Leaning back excessively and turning the exercise into a partial row', 'Very wide grip reduces ROM — shoulder-width to slightly wider is optimal'],
  tbar_row:           ['Hips rising during the pull, converting the row into a near-deadlift', 'Partial range — bar must travel to the sternum, not just mid-air', 'Jerking the weight off the floor without engaging the lats first'],
  shrug:              ['Rolling the shoulders in a circular motion — only vertical elevation trains the traps; rolling risks the AC joint', 'Not achieving full elevation through a straight vertical path', 'Not pausing at the top — the trap contracts maximally at peak elevation'],
  curl:               ['Swinging the torso back to initiate the curl removes bicep loading at the bottom', 'Elbows drifting forward at the top — they should stay pinned to the sides throughout', 'Partial ROM — not fully supinating the wrist at the top reduces peak bicep activation'],
  hammer_curl:        ['Rotating the wrist at the top defeats the neutral grip purpose — maintain neutral throughout', 'Using momentum to speed through reps — the brachialis requires slow, deliberate loading', 'Not lowering under control — the eccentric phase is where significant adaptation occurs'],
  preacher_curl:      ['Hyperextending the elbow at the bottom stresses the joint, not the bicep', 'Not achieving full supination at the top — the bicep\'s supination function is undertrained', 'Armpits not seated at the top of the pad — sliding down loses the isolation purpose'],
  tricep_pushdown:    ['Elbows drifting forward and away from the body — they must stay pinned throughout', 'Not achieving full elbow extension at the bottom — this is where the triceps are maximally activated', 'Leaning forward excessively and converting the movement into a chest-assisted press'],
  skullcrusher:       ['Elbows flaring outward during the movement — they should remain fixed and parallel', 'Not lowering toward the forehead — stopping high removes the stretch on the long triceps head', 'Crashing the bar down using uncontrolled speed — control the eccentric or switch to dumbbells'],
  squat:              ['Knee valgus (caving inward) under load — signals glute weakness and risks knee injury', 'Not reaching hip-below-knee depth — parallel squats underload the glutes through the bottom range', 'Forward torso lean converting the squat into a good morning — caused by ankle mobility deficit'],
  front_squat:        ['Elbows dropping during the set loses the rack position and pitches the bar forward', 'Excessive forward lean of the torso — the front squat demands more upright posture than the back squat', 'Insufficient wrist mobility forcing the elbows down — use a cross-arm grip as regression'],
  leg_press:          ['Locking out the knees at the top shifts load from quads onto the joint', 'Feet too low on the platform overloads the knee rather than the quads and glutes', 'Lower back rounding off the pad at the bottom — keep it flat against the seat throughout'],
  rdl:                ['Squatting the weight down rather than hinging — knees should remain nearly straight', 'Bar drifting away from the body — it must remain in contact with the legs throughout', 'Not feeling hamstring stretch at the bottom indicates insufficient hip hinge depth'],
  deadlift:           ['Bar starting over the toes rather than mid-foot — lengthens lever arm and strains lower back', 'Jerking the bar off the floor — force should be applied progressively through the pull', 'Hyperextending at lockout instead of simply extending hips and glutes to neutral'],
  leg_curl:           ['Lifting the hips off the pad to increase ROM — uses hip extension to cheat the movement', 'Not achieving full knee flexion at the top — the hamstrings contract maximally at short length', 'Fast, bouncy reps that use momentum through the concentric phase'],
  hip_thrust:         ['Chin not tucked — looking forward creates cervical extension and alters spinal position', 'Not achieving full hip extension at the top — the glutes are loaded most at maximum extension', 'Bar positioned too high on the abdomen rather than over the hip crease'],
  bulgarian:          ['Front foot too close to the bench, forcing the torso to pitch too far forward', 'Rear foot actively pushing — the back leg should be passive; all drive comes from the front', 'Allowing the front knee to drift inward under the unilateral load'],
  calf_raise:         ['Bouncing at the bottom to use Achilles tendon recoil — this bypasses muscle work', 'Partial ROM at the top — must reach full plantarflexion for maximum activation', 'Too fast a rep speed — calves respond better to slow tempo with a full bottom-stretch pause'],
  crunch:             ['Pulling the neck forward with the hands rather than curling the thoracic spine', 'Hinging at the hips rather than curling the spine — the movement is spinal flexion, not a hip hinge', 'Using momentum to swing through reps rather than controlled rectus abdominis contraction'],
  plank:              ['Hips sagging below spine level — this places compressive load on the lumbar spine', 'Hips elevated above spine level — this significantly reduces core activation', 'Holding breath rather than breathing through the brace — leads to premature fatigue'],
  leg_raise:          ['Swinging the legs up with momentum — posterior pelvic tilt must initiate the movement', 'Hyperextending the lower back at the bottom of the descent', 'Legs not returning to full hang between reps — the bottom stretch position increases abs ROM'],
  pushup:             ['Hips sagging below a neutral spine — core must remain braced throughout', 'Elbows flaring to 90° from the torso increases anterior shoulder stress', 'Partial range of motion — chest should contact the floor on every repetition'],
  pike_pushup:        ['Hips not elevated high enough — the inverted V must be maintained throughout', 'Head not travelling between the hands on descent — must go through to simulate an overhead press', 'Elbows flaring wide rather than pointing back reduces shoulder press specificity'],
  diamond_pushup:     ['Elbows tracking outward rather than back along the torso', 'Hips rising to reduce difficulty — maintain a rigid plank throughout', 'Wrists forced into painful extension — use fists or handles if wrist extension is uncomfortable'],
  inverted_row:       ['Hips breaking from the plank position — the body must remain rigid like a board', 'Pulling only with the arms rather than initiating from the shoulder blades', 'Foot placement too easy — elevate feet or add a vest to maintain progressive overload'],
  bodyweight_squat:   ['Heels rising off the floor — signals ankle mobility deficit', 'Knee valgus (caving inward) during descent or ascent', 'Hip crease not reaching knee height — the movement should reach full depth'],
  pistol_squat:       ['Stance leg knee collapsing inward under single-leg load', 'Excessive arm swing compensating for hip mobility limitations rather than addressing them', 'Descending too quickly — the eccentric must be deliberate and controlled'],
  glute_bridge:       ['Extending through the lumbar spine rather than the hips at the top', 'Feet too far from the hips, converting the bridge to a lower-back dominant movement', 'Not achieving full hip extension — glutes must be maximally contracted at the top'],
  nordic_curl:        ['Relying on the arms to push up from the bottom rather than the hamstrings', 'Lowering too quickly without resisting — the eccentric is the entire training stimulus', 'Ankles not secured firmly, allowing movement that defeats the exercise purpose'],
  dip_bw:             ['Shrugging the shoulders rather than depressing them — creates neck strain and reduces stability', 'Only a partial dip — upper arms must reach parallel to the floor at minimum', 'Not controlling the descent — the eccentric phase provides the greatest tricep loading'],
  chin_up:            ['Kipping or using momentum to reduce difficulty', 'No full dead hang at the bottom — partial range removes bicep and lat stretch stimulus', 'Chin only reaching bar level rather than clearing it — the rep is incomplete'],
  situp:              ['Pulling the neck forward with the hands, creating cervical flexion under load', 'Rising too quickly using momentum rather than rectus abdominis contraction', 'Not lowering under control — the eccentric trains the abs under lengthening'],
  ab_wheel:           ['Hips rising during the rollout — the spine must maintain extension throughout', 'Rolling too far without sufficient core strength — the lower back will flex and can be injured', 'Not pulling back with the lats — the return is a lat-dominant movement, not a crunch'],
  kb_swing:           ['Squatting the bell down rather than hiking it back — the swing is a hinge, not a squat', 'Arm-dominant swing where the arms pull the bell up rather than hip drive propelling it', 'Losing neutral spine at the bottom of the hike — the lower back must remain braced'],
  kb_goblet_squat:    ['Elbows not staying inside knees at depth — typically signals hip mobility deficit', 'Chest falling forward at the bottom — the goblet position should maintain upright torso', 'Rising on the toes at depth — keep heels planted and drive through mid-foot'],
  kb_press:           ['Bell resting on the wrist rather than seated on the forearm in rack position — leads to wrist pain', 'Not bracing the core against the rotational demand created by the unilateral load', 'Pressing on an arc rather than straight up — the path must be vertical to protect the shoulder'],
  kb_row:             ['Rotating the torso during the pull — the hips must remain square to the bench', 'Not pulling the elbow far enough back — the shoulder blade must fully retract', 'Initiating with the biceps rather than the lat — the movement starts from the shoulder blade'],
  kb_deadlift:        ['Squatting the bell up rather than hinging — the knees should not drop significantly', 'Rounding the upper back at the top of the lift', 'Not engaging the lats before the pull — leaves the lower back unsupported'],
  kb_lunge:           ['Striding too short, preventing 90° angles at both knees', 'Front knee tracking inward under the unilateral load', 'Not keeping the rear knee controlled on descent — it should hover just above the floor'],
  kb_clean:           ['Letting the bell flip over the top of the hand and impact the wrist — the hand must punch through', 'Pulling with the arm rather than driving with the hips — the clean is powered by hip drive', 'Not absorbing the catch by bending at the knees — leads to a hard impact on the forearm'],
  kb_turkish_getup:   ['Bending the pressed arm at any point during the movement — this is the primary safety rule', 'Moving too quickly between checkpoints — each position requires deliberate stability hold', 'Not keeping eyes on the bell throughout — visual tracking is critical for overhead safety'],
  cable_row:          ['Leaning far back at the finish using spinal extension as momentum', 'Not allowing shoulder blades to protract at the start — the stretch must be achieved before pulling', 'Pulling too high — the handle should come to the lower sternum, not the upper chest'],
  cable_curl:         ['Rocking the torso back to assist the biceps at the top of the range', 'Not returning to full extension at the bottom — this eliminates the lengthened loading position', 'Elbows drifting away from the sides during the curl'],
  cable_lateral:      ['Raising above shoulder height — the supraspinatus dominates above parallel, not the middle delt', 'Cable not crossing under the body to the opposite side — reduces the stretch at the bottom', 'Excessive weight causing torso lean and a cheat raise to compensate'],
  cable_pull_through: ['Using the arms to pull rather than driving with the hips — must be a pure hip hinge', 'Not hinging sufficiently backward — the cable should pass between the legs', 'Overextending the lower back at the top instead of simply achieving hip lockout'],
  cable_woodchop:     ['Rotating only through the arms and shoulders without engaging the thoracic spine', 'Rear foot remaining flat rather than pivoting to allow full rotation', 'Excessive speed losing control of the cable at end range'],
  pallof_press:       ['Standing too close to the cable, reducing rotational resistance significantly', 'Not bracing before pressing — the core must be engaged before the arms move', 'Allowing the torso to rotate toward the cable — the anti-rotation challenge must be resisted'],
  chest_press:        ['Seat too high or low, causing shoulder misalignment with the handles', 'Locking out elbows aggressively on every rep — keep constant pec tension throughout', 'Shallow ROM to move more weight — the stretched start position is where pec growth occurs'],
  hack_squat:         ['Lower back peeling off the pad at the bottom — maintain contact throughout', 'Locking out the knees at the top shifts load off quads and onto the joint', 'Foot position too low on the sled — higher placement increases glute and hamstring contribution'],
  smith_ohp:          ['Pressing in front of the face rather than directly overhead — bar should end over the ears', 'Not bracing the core — the lower back overextends without tension under the load', 'Partial ROM — the bar must start at upper chest level on each rep'],
  cable_machine_pullover: ['Seat misalignment — the shoulder joint must align with the machine\'s pivot axis', 'Bending the elbows and turning it into a pulldown — keep elbows fixed in a slightly bent position', 'Not reaching full stretch overhead — the lengthened position is where maximum lat stimulus occurs'],
  seated_calf:        ['Bouncing at the bottom using tendon recoil rather than muscle work', 'Not achieving full plantarflexion at the top — the soleus requires full ROM', 'Knee pad too far up the thigh, altering the joint angle and reducing soleus isolation'],
  adductor_machine:   ['Using momentum to drive the movement rather than controlled adduction', 'Not allowing full abduction on the return — the stretched position increases adductor stimulus', 'Sitting asymmetrically, loading one adductor more than the other'],
  rowing_machine:     ['Pulling with the arms before the legs have fully driven — sequence must be legs → hips → arms', 'Leaning back beyond 30° at the finish — excessive backward lean increases lumbar strain', 'Short, choppy strokes — a long, powerful stroke produces more work per stroke than high cadence'],
  assault_bike:       ['Pushing the handles without pulling back — both arms must work the full push-pull cycle', 'Sitting upright rather than leaning slightly forward — forward lean enables more leg drive', 'Sandbagging on intervals — the air resistance self-regulates, requiring committed full effort'],
  sled_push:          ['Standing too upright, reducing force transfer from legs to the sled', 'Short, high strides rather than low, powerful ground contact', 'Arms absorbing resistance rather than serving only to maintain body angle'],
  farmers_carry:      ['Lateral lean to one side strains the QL and reduces trap engagement', 'Short, shuffling steps — measured stride length maintains spinal position better', 'Gripping at the top of the handle only — full-hand grip maximises forearm and trap activation'],
  dead_bug:           ['Lower back lifting off the floor as limbs extend — this is the defining error of the movement', 'Extending too far before adequate core stability — only go as far as the back stays neutral', 'Holding breath throughout — continuous breathing through the brace is the training goal'],
  russian_twist:      ['Rounding the thoracic spine forward rather than rotating — the rotation must come from the thorax', 'Moving through the arms rather than the trunk — the arms should stay fixed to the chest', 'Moving too fast using momentum — slow, deliberate rotation is necessary for oblique activation'],
  dragon_flag:        ['Hips breaking and flexing when the core fatigues — the entire body must remain as one rigid plank', 'Descending too quickly before building sufficient eccentric strength — elevate feet as regression', 'Grip not secure enough on the fixed object behind the head — instability defeats the movement'],
};

// -------------------- REP RANGES --------------------
const COMPOUND   = { strength: '1–5',    hypertrophy: '6–12',   endurance: '15–30' };
const ISOLATION  = { strength: '4–8',    hypertrophy: '10–20',  endurance: '20–40' };
const ADVANCED   = { strength: '3–5',    hypertrophy: '6–10',   endurance: '12–20' };
const BALLISTIC  = { strength: '3–5',    hypertrophy: '8–15',   endurance: '20–30' };
const CARRY      = { strength: '20–30m', hypertrophy: '40–60m', endurance: '80m+' };
const CARDIO_RNG = { strength: '10–20s', hypertrophy: '30–60s', endurance: '5min+' };

const REP_RANGES = {
  bench: COMPOUND, incline_db: COMPOUND, dips: COMPOUND, ohp: COMPOUND,
  pullup: COMPOUND, row: COMPOUND, lat_pulldown: COMPOUND, tbar_row: COMPOUND,
  squat: COMPOUND, front_squat: COMPOUND, leg_press: COMPOUND, rdl: COMPOUND,
  deadlift: COMPOUND, hip_thrust: COMPOUND, bulgarian: COMPOUND,
  inverted_row: COMPOUND, chin_up: COMPOUND, dip_bw: COMPOUND,
  kb_goblet_squat: COMPOUND, kb_press: COMPOUND, kb_row: COMPOUND,
  kb_deadlift: COMPOUND, kb_lunge: COMPOUND, cable_row: COMPOUND,
  chest_press: COMPOUND, hack_squat: COMPOUND, smith_ohp: COMPOUND,
  cable_fly: ISOLATION, lateral_raise: ISOLATION, rear_delt_fly: ISOLATION,
  face_pull: ISOLATION, shrug: ISOLATION, curl: ISOLATION, hammer_curl: ISOLATION,
  preacher_curl: ISOLATION, tricep_pushdown: ISOLATION, skullcrusher: ISOLATION,
  leg_curl: ISOLATION, calf_raise: ISOLATION, crunch: ISOLATION, plank: ISOLATION,
  leg_raise: ISOLATION, pushup: ISOLATION, pike_pushup: ISOLATION,
  diamond_pushup: ISOLATION, bodyweight_squat: ISOLATION, glute_bridge: ISOLATION,
  situp: ISOLATION, ab_wheel: ISOLATION, cable_curl: ISOLATION, cable_lateral: ISOLATION,
  cable_pull_through: ISOLATION, cable_woodchop: ISOLATION, pallof_press: ISOLATION,
  cable_machine_pullover: ISOLATION, seated_calf: ISOLATION, adductor_machine: ISOLATION,
  dead_bug: ISOLATION, russian_twist: ISOLATION,
  pistol_squat: ADVANCED, nordic_curl: ADVANCED, dragon_flag: ADVANCED, kb_turkish_getup: ADVANCED,
  kb_swing: BALLISTIC, kb_clean: BALLISTIC,
  farmers_carry: CARRY, sled_push: CARRY,
  rowing_machine: CARDIO_RNG, assault_bike: CARDIO_RNG,
};

// -------------------- EXERCISE DEMO --------------------
function ExerciseDemo({ ex, onClose }) {
  const accent = PATTERN_ACCENTS[ex.pattern];
  const TMPL_OVERRIDE = {
    curl: 'E', hammer_curl: 'E', preacher_curl: 'E', cable_curl: 'E',
    lateral_raise: 'F', rear_delt_fly: 'F', face_pull: 'F', shrug: 'F', cable_lateral: 'F', cable_fly: 'F',
    kb_swing: 'G', kb_clean: 'G',
    farmers_carry: 'H', kb_turkish_getup: 'H',
    assault_bike: 'I', rowing_machine: 'I',
  };
  const PATTERN_TMPL = { push: 'C', pull: 'D', squat: 'A', hinge: 'B', isolation: 'J', cardio: 'I', carry: 'H' };
  const tmpl = TMPL_OVERRIDE[ex.id] || PATTERN_TMPL[ex.pattern] || 'J';

  const a = (name, dur = '1.8s', delay = '0s') => ({
    animation: `${name} ${dur} ease-in-out infinite ${delay}`,
    transformOrigin: 'center',
  });

  return (
    <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent.from}22, ${accent.to}aa, #0a0908)`, aspectRatio: '16/9' }}>
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'repeating-linear-gradient(0deg,transparent 0,transparent 18px,rgba(255,255,255,.04) 18px,rgba(255,255,255,.04) 19px),repeating-linear-gradient(90deg,transparent 0,transparent 18px,rgba(255,255,255,.04) 18px,rgba(255,255,255,.04) 19px)'
      }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 200 200" width="150" height="150" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="100" cy="26" r="9" fill="rgba(255,255,255,0.12)" strokeWidth="2" />
          {tmpl === 'A' && (
            <g style={a('squat-down')}>
              <line x1="100" y1="35" x2="100" y2="92" />
              <line x1="76" y1="52" x2="124" y2="52" />
              <line x1="76" y1="52" x2="62" y2="78" />
              <line x1="124" y1="52" x2="138" y2="78" />
              <line x1="82" y1="92" x2="68" y2="130" />
              <line x1="118" y1="92" x2="132" y2="130" />
              <line x1="68" y1="130" x2="55" y2="160" />
              <line x1="132" y1="130" x2="145" y2="160" />
            </g>
          )}
          {tmpl === 'B' && (<>
            <line x1="82" y1="98" x2="70" y2="160" />
            <line x1="118" y1="98" x2="130" y2="160" />
            <g style={{ animation: 'hinge-fold 1.8s ease-in-out infinite', transformOrigin: '100px 98px' }}>
              <line x1="100" y1="35" x2="100" y2="98" />
              <line x1="76" y1="54" x2="124" y2="54" />
              <line x1="76" y1="54" x2="55" y2="75" />
              <line x1="124" y1="54" x2="145" y2="75" />
            </g>
          </>)}
          {tmpl === 'C' && (<>
            <line x1="100" y1="35" x2="100" y2="118" />
            <line x1="80" y1="118" x2="120" y2="118" />
            <line x1="80" y1="118" x2="72" y2="158" />
            <line x1="120" y1="118" x2="128" y2="158" />
            <line x1="76" y1="55" x2="124" y2="55" />
            <line x1="76" y1="55" x2="50" y2="68" style={a('press-out')} />
            <line x1="124" y1="55" x2="150" y2="68" style={a('press-out')} />
          </>)}
          {tmpl === 'D' && (<>
            <line x1="100" y1="35" x2="100" y2="118" />
            <line x1="80" y1="118" x2="120" y2="118" />
            <line x1="80" y1="118" x2="72" y2="158" />
            <line x1="120" y1="118" x2="128" y2="158" />
            <line x1="76" y1="55" x2="124" y2="55" />
            <line x1="76" y1="55" x2="50" y2="42" style={a('pull-in')} />
            <line x1="124" y1="55" x2="150" y2="42" style={a('pull-in')} />
          </>)}
          {tmpl === 'E' && (<>
            <line x1="100" y1="35" x2="100" y2="118" />
            <line x1="80" y1="118" x2="120" y2="118" />
            <line x1="80" y1="118" x2="72" y2="158" />
            <line x1="120" y1="118" x2="128" y2="158" />
            <line x1="76" y1="55" x2="124" y2="55" />
            <line x1="76" y1="55" x2="60" y2="85" />
            <line x1="124" y1="55" x2="140" y2="85" />
            <line x1="60" y1="85" x2="46" y2="70" style={a('curl-up')} />
            <line x1="140" y1="85" x2="154" y2="70" style={a('curl-up')} />
          </>)}
          {tmpl === 'F' && (<>
            <line x1="100" y1="35" x2="100" y2="118" />
            <line x1="80" y1="118" x2="120" y2="118" />
            <line x1="80" y1="118" x2="72" y2="158" />
            <line x1="120" y1="118" x2="128" y2="158" />
            <line x1="76" y1="55" x2="124" y2="55" />
            <line x1="76" y1="55" x2="52" y2="72" style={a('raise-up')} />
            <line x1="124" y1="55" x2="148" y2="72" style={a('raise-up')} />
          </>)}
          {tmpl === 'G' && (<>
            <line x1="100" y1="35" x2="100" y2="95" />
            <line x1="80" y1="95" x2="78" y2="158" />
            <line x1="120" y1="95" x2="122" y2="158" />
            <line x1="76" y1="55" x2="124" y2="55" />
            <line x1="100" y1="55" x2="100" y2="90" style={a('swing-arc', '1.2s')} />
          </>)}
          {tmpl === 'H' && (
            <g style={a('carry-walk')}>
              <line x1="100" y1="35" x2="100" y2="108" />
              <line x1="76" y1="55" x2="124" y2="55" />
              <line x1="76" y1="55" x2="60" y2="88" />
              <line x1="124" y1="55" x2="140" y2="88" />
              <line x1="84" y1="108" x2="72" y2="155" />
              <line x1="116" y1="108" x2="128" y2="148" />
            </g>
          )}
          {tmpl === 'I' && (<>
            <line x1="100" y1="35" x2="100" y2="95" />
            <line x1="80" y1="95" x2="78" y2="158" />
            <line x1="120" y1="95" x2="122" y2="158" />
            <line x1="76" y1="55" x2="60" y2="82" style={a('swing-arc', '0.9s')} />
            <line x1="124" y1="55" x2="140" y2="82" style={{ animation: `swing-arc 0.9s ease-in-out infinite -0.45s`, transformOrigin: 'center' }} />
            <circle cx="100" cy="130" r="20" stroke={`${accent.from}90`} strokeWidth="1.5" style={a('cardio-spin', '2s')} />
          </>)}
          {tmpl === 'J' && (<>
            <line x1="100" y1="35" x2="100" y2="118" />
            <line x1="80" y1="118" x2="120" y2="118" />
            <line x1="80" y1="118" x2="72" y2="158" />
            <line x1="120" y1="118" x2="128" y2="158" />
            <line x1="76" y1="55" x2="60" y2="82" />
            <line x1="124" y1="55" x2="140" y2="82" />
            <circle cx="100" cy="80" r="20" stroke={accent.from} strokeWidth="1.5" strokeDasharray="4 4" style={a('pulse-ring')} />
          </>)}
        </svg>
      </div>
      <div className="absolute top-4 left-4 text-[9px] uppercase tracking-[0.2em] text-stone-300 font-mono px-2 py-1 bg-stone-950/80 border border-stone-700">
        {ex.pattern} · demo loop
      </div>
      <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-stone-950/80 border border-stone-700 hover:border-orange-500/60 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors">✕</button>
      <div className="absolute bottom-4 right-4 w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center hover:bg-orange-400 transition-colors cursor-pointer">
        <svg width="20" height="20" viewBox="0 0 14 14" fill="none"><path d="M3 2L11 7L3 12V2Z" fill="#0a0908" /></svg>
      </div>
    </div>
  );
}

// -------------------- CARD --------------------
function ExerciseCard({ ex, onOpen }) {
  const accent = PATTERN_ACCENTS[ex.pattern];

  return (
    <button
      onClick={() => onOpen(ex)}
      className="group text-left bg-stone-950/40 border border-stone-800/60 hover:border-orange-500/40 transition-all overflow-hidden"
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accent.from}22, ${accent.to}aa, #0a0908)` }}
      >
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 14px, rgba(255,255,255,0.04) 14px, rgba(255,255,255,0.04) 15px), repeating-linear-gradient(90deg, transparent 0, transparent 14px, rgba(255,255,255,0.04) 14px, rgba(255,255,255,0.04) 15px)'
        }} />

        {/* Motion icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <MotionIcon pattern={ex.pattern} className="w-20 h-20 text-stone-100/80 group-hover:scale-110 transition-transform duration-500" />
        </div>

        {/* Play indicator */}
        <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-stone-950/80 backdrop-blur-sm border border-stone-700 flex items-center justify-center group-hover:bg-orange-500 group-hover:border-orange-500 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2L11 7L3 12V2Z" fill="currentColor" className="text-stone-300 group-hover:text-stone-950" />
          </svg>
        </div>

        {/* Difficulty dots */}
        <div className="absolute top-3 left-3 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i < ex.difficulty ? 'bg-orange-400' : 'bg-stone-600/50'}`}
            />
          ))}
        </div>

        {/* Premium badge */}
        {ex.premium && (
          <div className="absolute top-3 right-3 text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-orange-500 text-stone-950 font-mono font-bold">
            PRO
          </div>
        )}

        {/* Pattern label */}
        <div className="absolute bottom-3 left-3 text-[9px] uppercase tracking-[0.2em] text-stone-300 font-mono">
          {ex.pattern}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 leading-tight mb-2 group-hover:text-orange-300 transition-colors">
          {ex.name}
        </h3>
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-orange-500/15 text-orange-300 border border-orange-500/25 font-mono">
            {MUSCLES[ex.primary]}
          </span>
          {ex.secondary.slice(0, 2).map(m => (
            <span key={m} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-stone-800/60 text-stone-500 border border-stone-700/50 font-mono">
              {MUSCLES[m]}
            </span>
          ))}
          {ex.secondary.length > 2 && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 text-stone-600 font-mono">
              +{ex.secondary.length - 2}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-stone-500">
          <span>{ex.equipment}</span>
          <span className="text-stone-600 tabular-nums">★ {ex.popular}</span>
        </div>
      </div>
    </button>
  );
}

// -------------------- DETAIL MODAL --------------------
function ExerciseDetail({ ex, onClose, isPro }) {
  if (!ex) return null;
  const rr = REP_RANGES[ex.id] || { strength: '—', hypertrophy: '—', endurance: '—' };
  const mistakes = MISTAKES[ex.id] || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#0d0c0a] border border-stone-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated demo header */}
        <ExerciseDemo ex={ex} onClose={onClose} />

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-anton text-3xl uppercase tracking-tight text-stone-100 leading-tight">{ex.name}</h2>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono">
                  {MUSCLES[ex.primary]} · primary
                </span>
                {ex.secondary.map(m => (
                  <span key={m} className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-stone-800/60 text-stone-400 border border-stone-700/50 font-mono">
                    {MUSCLES[m]}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Difficulty</div>
              <div className="flex gap-1 mt-1 justify-end">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`w-2 h-2 rounded-full ${i < ex.difficulty ? 'bg-orange-400' : 'bg-stone-700'}`} />
                ))}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mt-1">{ex.equipment}</div>
            </div>
          </div>

          {/* Description */}
          {ex.description && (
            <p className="text-sm text-stone-400 leading-relaxed mb-5" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {ex.description}
            </p>
          )}

          {/* Cues + Mistakes — 2-column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 mb-2">Form Cues</h3>
              <ul className="space-y-2">
                {ex.cues.map((c, i) => (
                  <li key={i} className="flex gap-3 text-sm text-stone-300">
                    <span className="font-mono text-[10px] tabular-nums text-orange-500/60 shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            {mistakes.length > 0 && (
              <div>
                <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 mb-2">Common Mistakes</h3>
                <ul className="space-y-2">
                  {mistakes.map((m, i) => (
                    <li key={i} className="flex gap-3 text-sm text-stone-400">
                      <span className="font-mono text-[10px] tabular-nums text-red-500/50 shrink-0 mt-0.5">✕{String(i + 1).padStart(2, '0')}</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Rep Ranges table */}
          <div className="mb-5">
            <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 mb-2">Rep Ranges</h3>
            <div className="grid grid-cols-3 border border-stone-800/60 overflow-hidden">
              {[
                { label: 'Strength', val: rr.strength, sub: 'max force' },
                { label: 'Hypertrophy', val: rr.hypertrophy, sub: 'muscle growth' },
                { label: 'Endurance', val: rr.endurance, sub: 'capacity' },
              ].map((col, i) => (
                <div key={i} className={`p-3 text-center ${i < 2 ? 'border-r border-stone-800/60' : ''} bg-stone-950/40`}>
                  <div className="text-[9px] uppercase tracking-wider text-stone-500 font-mono mb-1">{col.label}</div>
                  <div className="font-anton text-xl text-stone-100 tabular-nums">{col.val}</div>
                  <div className="text-[9px] text-stone-600 font-mono mt-0.5">{col.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pro-gated section */}
          <div className={`relative border ${isPro ? 'border-stone-800/60 bg-stone-950/40' : 'border-orange-500/30 bg-orange-500/5'} p-4 mb-5`}>
            {!isPro && (
              <div className="absolute top-3 right-3 text-[9px] uppercase tracking-wider px-2 py-0.5 bg-orange-500 text-stone-950 font-mono font-bold">
                PRO
              </div>
            )}
            <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 mb-2">Form Check Video</h3>
            {isPro ? (
              <p className="text-sm text-stone-300">Slow-motion form demo with annotated coaching points. Tap the video above to play.</p>
            ) : (
              <>
                <p className="text-sm text-stone-400 mb-3">Slow-motion form demonstration with annotated coaching points, common mistake breakdowns, and progressive variations.</p>
                <button className="text-xs uppercase tracking-wider font-anton text-orange-300 hover:text-orange-200 border-b border-orange-500/40 pb-0.5">
                  Upgrade to Pro to unlock →
                </button>
              </>
            )}
          </div>

          {/* Splits compatibility */}
          <div className="mb-5">
            <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 mb-2">Programs This Fits</h3>
            <div className="flex flex-wrap gap-2">
              {ex.splits.map(s => {
                const split = SPLITS.find(x => x.id === s);
                return (
                  <span key={s} className="text-[10px] uppercase tracking-wider px-2 py-1 bg-stone-900/60 text-stone-400 border border-stone-800 font-mono">
                    {split?.group} · {split?.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-5 border-t border-stone-800/60">
            <button className="flex-1 px-4 py-2.5 border border-stone-700 text-stone-400 font-anton text-sm uppercase tracking-wider hover:bg-stone-800 hover:text-stone-200 transition-colors">
              View History
            </button>
            <button className="flex-1 px-4 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors">
              + Add to Today's Workout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------- FILTER CHIP --------------------
function Chip({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] uppercase tracking-wider px-2.5 py-1.5 border font-mono transition-colors whitespace-nowrap ${
        active
          ? 'bg-orange-500/15 text-orange-300 border-orange-500/40'
          : 'bg-stone-950/40 text-stone-500 border-stone-800 hover:border-stone-700 hover:text-stone-300'
      }`}
    >
      {children}
      {badge !== undefined && <span className="ml-1.5 text-stone-600 tabular-nums">{badge}</span>}
    </button>
  );
}

// -------------------- MAIN --------------------
export default function ExerciseLibrary() {
  const [search, setSearch] = useState('');
  const [activeSplit, setActiveSplit] = useState('all');
  const [activeMuscles, setActiveMuscles] = useState(new Set());
  const [activeEquipment, setActiveEquipment] = useState(new Set());
  const [sortBy, setSortBy] = useState('popular');
  const [selected, setSelected] = useState(null);
  const [isPro] = useState(false); // demo: free tier

  const toggleSet = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const filtered = useMemo(() => {
    let result = EXERCISES.filter(ex => {
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeSplit !== 'all' && !ex.splits.includes(activeSplit)) return false;
      if (activeMuscles.size > 0 && !activeMuscles.has(ex.primary) && !ex.secondary.some(m => activeMuscles.has(m))) return false;
      if (activeEquipment.size > 0 && !activeEquipment.has(ex.equipment)) return false;
      return true;
    });

    switch (sortBy) {
      case 'alpha':
        result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'popular':
        result.sort((a, b) => b.popular - a.popular); break;
      case 'compound':
        result.sort((a, b) => (b.secondary.length - a.secondary.length) || (b.popular - a.popular)); break;
      case 'difficulty':
        result.sort((a, b) => b.difficulty - a.difficulty); break;
    }

    return result;
  }, [search, activeSplit, activeMuscles, activeEquipment, sortBy]);

  // Group splits by category for cleaner display
  const splitGroups = SPLITS.reduce((acc, s) => {
    if (s.id === 'all') { acc.all = [s]; return acc; }
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  const totalActive = (activeSplit !== 'all' ? 1 : 0) + activeMuscles.size + activeEquipment.size;

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
        .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        body { background: #0a0908; }
        @keyframes squat-down  { 0%,100%{transform:translateY(0)}    50%{transform:translateY(14px)} }
        @keyframes hinge-fold  { 0%,100%{transform:rotate(0deg)}     50%{transform:rotate(55deg)} }
        @keyframes press-out   { 0%,100%{transform:translateX(0)}    50%{transform:translateX(16px)} }
        @keyframes pull-in     { 0%,100%{transform:translateX(0)}    50%{transform:translateX(-16px)} }
        @keyframes curl-up     { 0%,100%{transform:rotate(0deg)}     50%{transform:rotate(-80deg)} }
        @keyframes raise-up    { 0%,100%{transform:rotate(0deg)}     50%{transform:rotate(-70deg)} }
        @keyframes swing-arc   { 0%,100%{transform:rotate(30deg)}    50%{transform:rotate(-30deg)} }
        @keyframes carry-walk  { 0%,100%{transform:translateX(-8px)} 50%{transform:translateX(8px)} }
        @keyframes cardio-spin { 0%{transform:rotate(0deg)}          100%{transform:rotate(360deg)} }
        @keyframes pulse-ring  { 0%,100%{opacity:0.3}                50%{opacity:1} }
        @keyframes float-up    { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-8px)} }
        @keyframes twist-rot   { 0%,100%{transform:rotate(-25deg)}   50%{transform:rotate(25deg)} }
      `}</style>

      <AppNav />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
        }} />
        <div className="absolute top-0 left-0 w-[60vw] h-[40vh] opacity-[0.06] blur-3xl" style={{
          background: 'radial-gradient(ellipse, #ed7a2a 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">

        {/* HEADER */}
        <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-anton text-5xl uppercase tracking-tight text-stone-100">Exercise</span>
              <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Codex</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-stone-500">
              <span>{EXERCISES.length} exercises</span>
              <span className="text-stone-700">·</span>
              <span>{EXERCISES.filter(e => e.premium).length} pro-gated</span>
              <span className="text-stone-700">·</span>
              <span className="text-orange-400">{filtered.length} matching</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercise…"
                className="bg-stone-950/60 border border-stone-800 px-3 py-2.5 pl-9 text-stone-100 font-mono text-sm placeholder:text-stone-600 focus:outline-none focus:border-orange-500/60 w-64"
              />
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-stone-950/60 border border-stone-800 px-3 py-2.5 text-stone-300 font-mono text-xs uppercase tracking-wider focus:outline-none focus:border-orange-500/60 cursor-pointer"
            >
              {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </header>

        {/* FILTERS */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-5 mb-6 space-y-4">
          {/* SPLIT */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Training Split</span>
              <span className="text-[9px] text-stone-700 font-mono">single select</span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {Object.entries(splitGroups).map(([group, splits]) => (
                <React.Fragment key={group}>
                  {group !== 'all' && (
                    <span className="text-[9px] uppercase tracking-wider text-stone-700 font-mono ml-2 first:ml-0">
                      {group} ·
                    </span>
                  )}
                  {splits.map(s => (
                    <Chip key={s.id} active={activeSplit === s.id} onClick={() => setActiveSplit(s.id)}>
                      {s.label}
                    </Chip>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* MUSCLES */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Muscle Group</span>
              <span className="text-[9px] text-stone-700 font-mono">multi · {activeMuscles.size} selected</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(MUSCLES).slice(0, 14).map(([id, label]) => (
                <Chip
                  key={id}
                  active={activeMuscles.has(id)}
                  onClick={() => setActiveMuscles(s => toggleSet(s, id))}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          {/* EQUIPMENT */}
          <div className="flex items-baseline gap-4 flex-wrap">
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mr-3">Equipment</span>
              <span className="text-[9px] text-stone-700 font-mono">multi</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map(e => (
                <Chip
                  key={e.id}
                  active={activeEquipment.has(e.id)}
                  onClick={() => setActiveEquipment(s => toggleSet(s, e.id))}
                >
                  {e.label}
                </Chip>
              ))}
            </div>
            {totalActive > 0 && (
              <button
                onClick={() => {
                  setActiveSplit('all');
                  setActiveMuscles(new Set());
                  setActiveEquipment(new Set());
                  setSearch('');
                }}
                className="ml-auto text-[10px] uppercase tracking-wider text-stone-500 hover:text-orange-300 font-mono transition-colors"
              >
                Clear all ({totalActive})
              </button>
            )}
          </div>
        </div>

        {/* RESULTS GRID */}
        {filtered.length === 0 ? (
          <div className="border border-stone-800/60 bg-stone-950/40 p-16 text-center">
            <div className="font-anton text-3xl uppercase tracking-tight text-stone-700 mb-2">No matches</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-600">try widening your filters</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(ex => (
              <ExerciseCard key={ex.id} ex={ex} onOpen={setSelected} />
            ))}
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>Exercise Codex v0.4 · Module 2 · Curated database</span>
          <span>{EXERCISES.length} entries · global · read-only · {EXERCISES.filter(e => e.premium).length} pro</span>
        </footer>
      </div>

      {/* DETAIL MODAL */}
      <ExerciseDetail ex={selected} onClose={() => setSelected(null)} isPro={isPro} />
    </div>
  );
}
