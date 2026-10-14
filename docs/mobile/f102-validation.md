# F102 cars, search and gallery — validation checkpoint

Original immediate base: F101 #314 at 405b80d0. Two focused F101 CI repairs were carried into this child through normal reviewable merge commits 97838a10 and 08e5a42c, preserving original branches and uncommitted F102 work; latest required parent 7046f5436ac6a3b4c827d6c53b3bed38815fc41f. No rebase/force-push, PR merge or protected-ref change occurred.

Native inventory/search/typeahead/all filter groups, detail/specs/gallery/share/related inventory are implemented using existing public APIs and post-#311 branding/layout. Existing web search/title helpers are extracted unchanged into contracts and re-exported at their old import paths. No API response/behavior, database migration, web UI, legal policy or auth behavior changes.

Checks performed:

- Native: ten suites / 55 tests PASS; source boundaries, lint and types PASS.
- Contracts: 27 files / 594 tests PASS; statements 98.54%, branches 92.02%, functions 96.77%, lines 98.88%.
- Web: complete 144-file / 1,727-test suite PASS, plus focused search/card cases.
- Root lint/docs/typecheck and full web/API/contracts/Android export builds PASS.
- The initial extraction lowered contracts coverage; the existing search behavior suite was brought into contracts and the unchanged gates now pass.

Tests include strict/shared search semantics and paise ranges, paging reset, credential-free public paths, reserved navigation/dealer reachability, missing galleries/index clamping, location-filter preservation, orphan model removal and inverted-range refusal. Loading/empty/error/card/image states are native. No native performance/device screenshot is fabricated. Local Android SDK/JDK/emulator/physical device remain unavailable; installed-native gallery/back/scroll/keyboard/inset/rotation behavior and actual performance are F108 release gates.

F101 CI had a shared-runner form timeout; the latest parent fixes retain every test/threshold and run native tests after other workspaces. Its remote follow-up is tracked separately; local source/test passes are not remote CI. F102 must remain draft/open against F101 until reviewed. Save/enquiry/dealer screens are completed in the planned following PRs; no fake records or mutation success is claimed.

See [native discovery implementation](../code/mobile/cars.md) and the stack manifest. Reject/revert this unmerged child normally for rollback; web helper re-exports keep old callers compatible. No deployment or Play publication is authorized.
