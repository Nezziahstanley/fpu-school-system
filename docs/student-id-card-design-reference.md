# Student ID Card — Reusable Design Reference

This file preserves the Federal Polytechnic Ugep student ID-card visual direction used in the Student Portal. Reuse this as the starting point whenever the user asks to recreate, revise, or export the student ID-card design.

## Card format and composition
- Landscape card, approximately 440 × 290 CSS pixels, with rounded 16px corners.
- White card face with a soft, elevated shadow and a clean institutional layout.
- Top header uses an emerald-green gradient (#065f46 to #059669).
- The school logo sits in a circular white badge with a gold border; the school name is set in bold white uppercase text.
- A thin gold accent stripe separates the header from the main card content.
- Student passport/profile photo is a prominent portrait block; if no photo is available, show a neutral placeholder/initials.
- Student identity fields include full name, matriculation number, level, programme, department, and current academic session.
- Use compact, legible typography with clear field labels and strong values.
- The reverse side should retain verification information/QR-related details and supporting student/school information where available.
- Keep the visual hierarchy, green-and-gold school palette, proportions, and rounded-card treatment consistent across screen view, modal/view action, and print/export.

## Implementation notes
- Student ID-card page: `public/portal/partials/student/id-card.html`.
- Student ID-card API: `GET /api/student/id-card`.
- Shared staff ID-card design is separate and must not replace the student card.
- Ensure the View action opens the card centered and scaled to the available viewport, and make print output landscape without clipping.
- Update this reference file whenever the approved final design changes.

## Academic Officer / institutional directory reuse
- The Academic Officer's institutional ID-card directory reuses the same landscape green-and-gold student card composition for student previews.
- The directory groups student records into clickable department cards; selecting a department filters the directory to students in that department.
- Student previews include the passport photo, full name, matriculation number, level, programme, department, academic session, school, email and phone where those records exist.
- Keep the gold accent stripe, white logo badge, green header/footer, subtle logo watermark, and reverse-side institutional return instructions consistent in preview and print.
- Staff members use the same institutional visual language but show staff number, designation/rank, department, school, qualification, specialization, employment date, email and phone.
