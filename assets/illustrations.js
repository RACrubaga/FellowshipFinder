/* Fellowship Finder: small theme-aware illustrations (inline SVG, colours come from CSS tokens). */
window.FF_ILLO = {
  // Empty meeting table: shown when no club meets at the chosen time and distance
  empty:
    '<svg class="illo" viewBox="0 0 200 120" aria-hidden="true">' +
      '<ellipse class="i-shadow" cx="100" cy="108" rx="78" ry="7"/>' +
      '<circle class="i-gold-soft" cx="100" cy="32" r="22"/>' +
      '<circle class="i-surface i-line" cx="100" cy="32" r="14"/>' +
      '<path class="i-stroke" d="M100 24v8l6 4"/>' +
      '<rect class="i-soft i-line" x="46" y="46" width="20" height="36" rx="5"/>' +
      '<rect class="i-soft i-line" x="134" y="46" width="20" height="36" rx="5"/>' +
      '<rect class="i-main" x="36" y="66" width="128" height="9" rx="4.5"/>' +
      '<rect class="i-main" x="52" y="75" width="6" height="30" rx="3"/>' +
      '<rect class="i-main" x="142" y="75" width="6" height="30" rx="3"/>' +
      '<path class="i-soft i-line" d="M22 84h26v6H22zM25 90h4v15h-4zM41 90h4v15h-4z"/>' +
      '<path class="i-soft i-line" d="M152 84h26v6h-26zM155 90h4v15h-4zM171 90h4v15h-4z"/>' +
      '<circle class="i-gold" cx="84" cy="62" r="3"/><circle class="i-gold" cx="116" cy="62" r="3"/>' +
    '</svg>',

  // Map pin with a soft glow: shown when asking for, or explaining, location access
  pin:
    '<svg class="illo illo-sm" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="i-gold-soft" cx="60" cy="96" r="22" opacity=".55"/>' +
      '<ellipse class="i-gold-soft" cx="60" cy="98" rx="34" ry="9"/>' +
      '<path class="i-main" d="M60 14c-17 0-29 12.5-29 28.5C31 63 60 94 60 94s29-31 29-51.5C89 26.5 77 14 60 14z"/>' +
      '<circle class="i-surface" cx="60" cy="43" r="11"/>' +
      '<circle class="i-gold" cx="60" cy="43" r="5"/>' +
    '</svg>',

  // Pin with a slash: location is switched off
  pinOff:
    '<svg class="illo illo-sm" viewBox="0 0 120 120" aria-hidden="true">' +
      '<ellipse class="i-shadow" cx="60" cy="98" rx="30" ry="8"/>' +
      '<path class="i-soft i-line" d="M60 14c-17 0-29 12.5-29 28.5C31 63 60 94 60 94s29-31 29-51.5C89 26.5 77 14 60 14z"/>' +
      '<circle class="i-surface i-line" cx="60" cy="43" r="11"/>' +
      '<path class="i-stroke-strong" d="M30 22l60 60"/>' +
    '</svg>',

  // Pulsing pin while clubs load
  loading:
    '<svg class="illo illo-sm i-pulse" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="i-ring" cx="60" cy="92" r="10"/>' +
      '<circle class="i-ring i-ring2" cx="60" cy="92" r="10"/>' +
      '<path class="i-main" d="M60 22c-14 0-24 10.4-24 23.6C36 62.6 60 88 60 88s24-25.4 24-42.4C84 32.4 74 22 60 22z"/>' +
      '<circle class="i-surface" cx="60" cy="46" r="9"/>' +
    '</svg>',

  // Slim banner: Kampala's hills with pins joined by a route
  hills:
    '<svg class="hills-svg" viewBox="0 -26 1200 116" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<path class="h-back" d="M0 90V58C60 44 110 28 170 32S260 54 320 50 420 16 490 16 600 44 660 42 750 20 820 18 930 40 990 42 1100 28 1200 24V90z"/>' +
      '<path class="h-front" d="M0 90V72C70 66 120 48 190 50S290 68 360 66 480 40 550 42 650 64 720 64 830 44 900 44 1020 62 1200 64V90z"/>' +
      '<path class="h-route" d="M120 66C200 40 260 52 330 44S470 22 530 30 650 52 720 46 860 26 930 32s140 26 200 22 60-6 80-8"/>' +
      '<g class="h-pins">' +
        '<g transform="translate(330 44)"><path class="h-pin-c" d="M0 0c-6-7-9-11-9-15a9 9 0 0118 0c0 4-3 8-9 15z"/><circle class="h-dot" cy="-15" r="3.2"/><text y="-30">Rubaga</text></g>' +
        '<g transform="translate(530 30)"><path class="h-pin-g" d="M0 0c-6-7-9-11-9-15a9 9 0 0118 0c0 4-3 8-9 15z"/><circle class="h-dot" cy="-15" r="3.2"/><text y="-30">Mengo</text></g>' +
        '<g transform="translate(720 46)"><path class="h-pin-c" d="M0 0c-6-7-9-11-9-15a9 9 0 0118 0c0 4-3 8-9 15z"/><circle class="h-dot" cy="-15" r="3.2"/><text y="-30">Nakasero</text></g>' +
        '<g transform="translate(930 32)"><path class="h-pin-g" d="M0 0c-6-7-9-11-9-15a9 9 0 0118 0c0 4-3 8-9 15z"/><circle class="h-dot" cy="-15" r="3.2"/><text y="-30">Kololo</text></g>' +
        '<g transform="translate(160 62)"><path class="h-pin-g" d="M0 0c-6-7-9-11-9-15a9 9 0 0118 0c0 4-3 8-9 15z"/><circle class="h-dot" cy="-15" r="3.2"/><text y="-30">Namirembe</text></g>' +
        '<g transform="translate(1100 52)"><path class="h-pin-c" d="M0 0c-6-7-9-11-9-15a9 9 0 0118 0c0 4-3 8-9 15z"/><circle class="h-dot" cy="-15" r="3.2"/><text y="-30">Ntinda</text></g>' +
      '</g>' +
    '</svg>'
};
