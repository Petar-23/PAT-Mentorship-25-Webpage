# Reproducible PAT font prototype

See [MENTORSHIP_FONTS.md](../../docs/MENTORSHIP_FONTS.md) for design changes, licence, scope and verification. Current versions: PAT Sans 0.3 and PAT Serif 0.5.

Download only the three fonts and two licence files listed in source-manifest.json into a separate SOURCE_ROOT, preserving the relative paths. Copy the manifest to SOURCE_ROOT/source-manifest.json. With Python, fontTools[woff] and uharfbuzz available, run:

```sh
python build_fonts.py SOURCE_ROOT
python audit_spacing.py fonts/PATSerif-*.woff2 --output spacing-validation.json
python audit_spacing.py fonts/PATSerif-*.woff2 --no-ligatures --output spacing-validation-without-ligatures.json
```

Keep build_fonts.py, serif_refinements.py and audit_spacing.py together. Outputs are written next to the scripts, not into the application. Review font-validation.json and both spacing reports, then copy the reviewed WOFF2 files into app/mentorship/fonts. The spacing check covers every pair of the 60 Latin/German letters in each Serif face; the visual alphabet and word proofs remain a separate check. No automatic network download, installation or application mutation is performed by the scripts.

Serif 0.5 uses the licensed Roman source for both upright and 14-degree oblique faces. The separate Source Serif Italic source is no longer a build input. Version 0.5 adds tangent serif brackets and slightly tighter Latin advances. The Sans binaries are identical to 0.3.
