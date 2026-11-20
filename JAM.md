# Solmar Heat — JAM plan (make.fun gta6-01 "Make GTA 6")

Jam: make.fun gta6-01 "Make GTA 6" — https://make.fun/bounty/gta6-01
Deadline: Tue 24 Nov 2026 15:00 UTC / 23:00 WITA. Entries close then; result due 10 Dec 2026.
Prize: $1,666 total, 100 places (1st $500, 2nd $250, 3rd $150, 4-10 $38, 11-25 $10, 26-50 $6, 51-100 $4). Free entry, strict transcripts (recording 01a1f8e4-43b7-76ff-a61d-2b80f29905cb).
Rules: static files under game/ (index.html <= 1 MiB, game/ <= 48 MiB), no network requests, keyboard + mouse, desktop Chrome. Original city/names/story/art/sounds — NOTHING from Rockstar GTA.
Repo: https://github.com/xuanyang667-boop/gta6-game (public, created 2026-11-20).

Concept: You are Leo Marlow, a driver in the sun-soaked coastal city of Solmar Bay, building a crew and taking the bay from the Viper gang while the Solmar Bay Police Department hunts you.
One sentence: You steal cars, run jobs and outrun the police to become king of Solmar Bay while the wanted stars climb.

## Schedule (WITA)
- Fri 20 Nov evening: scaffold + Phaser vendored + vertical slice (city gen, on-foot move, camera, HUD skeleton).
- Sat 21 Nov: driving + traffic + peds + car steal + wanted/police.
- Sun 22 Nov: missions + story + combat + audio + save.
- Mon 23 Nov: polish, playtest, fix crashes/soft-locks. Playable by Mon evening.
- Tue 24 Nov: screenshots (parent), final checks, seal + submit (parent). Ship buffer = all Tue.

## MVP (must ship)
1. Seeded procedural city (road grid, districts, buildings, beach) — deterministic from seed.
2. On-foot movement + camera follow with look-ahead.
3. Driving with car feel + traffic + pedestrians.
4. Steal/drive/exit cars.
5. Wanted stars + police who chase (patrol -> chase -> search), busted/wasted.
6. 6 missions with objectives, dialogue, rewards + short story arc.
7. Combat on foot (melee + pistol, mouse aim).
8. HUD: money, health, wanted stars, minimap, objective; start screen; pause; save (localStorage).
9. Synthesized WebAudio SFX + adaptive music (no audio files).
10. main.ts dossier runs twice byte-identical; kit check passes.

## Stretch (in cut order)
- Car damage/smoke + repair at garage.
- Side activities (taxi fares, street races, collectibles).
- Day/night cycle + weather.
- Extra missions beyond 6.
- Rival gang turf wars.
- Rebindable keys screen.

## Cut log
- (none yet)
