# Licensing — what AGPL means here

This project is licensed under **AGPL-3.0-or-later**. That license is inherited
from the Swiss Ephemeris library this project depends on.

## What you can do freely

- Use this **API** from any application (open or closed source). Calling an
  HTTP endpoint is not "linking" and does not trigger AGPL's copyleft.
- Self-host this codebase as long as the source code (including any
  modifications you make) remains available to your users.
- Fork, modify, and redistribute under AGPL-3.0 or any later AGPL version.

## What AGPL requires

- **If you modify this code and run it as a network service**, your
  modifications must be made available under AGPL to your users. (This is the
  difference between AGPL and GPL.)
- **If you copy code from this repo into another codebase** that is exposed as
  a network service, that codebase becomes AGPL-encumbered too — even if
  you change provider names, structure, or interfaces.

## Avoiding AGPL in your own products

Three options:

1. **Call this API over HTTP.** Network calls don't trigger linking. Your app
   stays under whatever license you choose.
2. **Buy a commercial Swiss Ephemeris license** from Astrodienst AG, then fork
   this code and re-license your fork under terms compatible with that license.
3. **Replace the ephemeris** with a non-AGPL implementation (e.g., the Moshier
   ephemeris is public domain but less precise).

## Why this matters for the rest of your stack

This is the entire reason the Astro Calculator project exists as a separate,
public repo. By isolating the AGPL dependency in a network service, downstream
applications (yours and anyone else's) can stay closed-source while still
getting Swiss-Ephemeris-grade accuracy.

If you ever consider inlining calculator code from here into a private app,
**don't** without addressing the licensing first.
