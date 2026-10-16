# Absorption coefficient of lead for gamma radiation

> This README is AI-generated.

An interactive, single-page lesson on finding the linear absorption coefficient μ of lead for gamma rays with a Geiger–Müller counter, and the half-value layer that follows from it.

Live site: https://sonicunligmated.github.io/gamma-absorption-lesson/

## Sections

- **Aim and outcomes** — the aim, intended learning outcomes and the medical side: X-ray and CT contrast, tissues told apart by absorption, shielding and radiotherapy planning.
- **Theory** — photoelectric absorption, Compton scattering and pair production; the law I = I₀e^(−μx) and its straight-line form ln(I₀/I) = μx; half-value layer HVL = ln 2 ÷ μ; the GM tube, its plateau and operating voltage; background and the random (Poisson) nature of counts. Includes an interactive attenuation explorer.
- **Method** — apparatus and the procedure step by step with figures, safety and precautions.
- **Results** — an example observation table with the manual's columns, the graph of ln(I₀/I) against x, the slope and the half-value layer.
- **MCQs** — twenty-one questions with shuffled choices and feedback.
- **Practical** — a simulated GM counter bench:
  - scaler with HV knob and voltage display, 60 s count with fast modes (×1, ×10, ×30) that still report counts per minute, Start, Stop and Reset;
  - no counts below the starting voltage, a rising region, a plateau around 450–620 V and a warning for continuous discharge above that;
  - random (Poisson) counts with flashes per pulse and optional sound, muted by default;
  - source moved with tongs between its lead container and a holder at a fixed distance; it can only go back to its container or the holder;
  - numbered lead sheets in a rack, stacked in a slot midway between source and tube; each sheet returns only to its own slot, and the stack thickness is shown;
  - three counts each for background, no absorber and every thickness, recorded by button or typed, with averages checked; I and ln(I₀/I) are computed in the table;
  - graph with a draggable best-fit line and slope triangle;
  - stepwise calculation (I_BG, I₀, one ln(I₀/I), μ, HVL) checked with tolerances and hints for common slips (no background subtraction, log₁₀ instead of ln, inverted ratio, slope upside down);
  - traceable calculation: hovering (or tapping) any symbol in the formulas, or any number in the worked lines, explains what it is and draws a dotted leader line to where it comes from (table cell, graph point or handle, or the line that uses a result next);
  - a guided tutorial that introduces each part of the bench and the scaler, explains every reading, table cell, graph point and calculation number (with reading time scaled to caption length), with Pause/Resume, playback speed, Previous step / Next step (← → keys) and Stop, and Start over.

## Example values

Cs-137 (662 keV), GM tube at 500 V, one-minute counts.

- Background: 24, 27, 21 → I_BG = 24 counts/min
- No absorber: 3410, 3381, 3445 → I₀av = 3412, I₀ = 3388 counts/min
- x = 0.2, 0.4, 0.6, 0.8, 1.0 cm → I = 2660, 2098, 1653, 1293, 1019 counts/min → ln(I₀/I) = 0.242, 0.479, 0.718, 0.963, 1.201
- Slope μ ≈ 1.20 cm⁻¹, HVL = 0.693 ÷ 1.20 ≈ 0.58 cm

## Model notes

- Count rate R = I_BG + I₀e^(−μx) with μ = 1.20 cm⁻¹, I_BG = 24 and I₀ ≈ 3390 counts/min, each count drawn from a Poisson distribution.
- GM response: nothing below 380 V, rising to the plateau at 450 V, a slight slope on the plateau, continuous discharge above 620 V.
- Lead sheets: one of 0.1 cm, five of 0.2 cm and one of 0.5 cm.
- The tutorial uses a fixed random seed, so every playback speed shows the same counts.

## Files

- `index.html` — markup for all sections
- `css/styles.css`, `css/fonts.css` — theme and self-hosted fonts
- `js/app.js` — drawing, navigation, simulation, tutorial and checks
- `fonts/` — Epilogue, Albert Sans, Overpass Mono and Schoolbell (SIL Open Font License)

No build step; any static file server works.
