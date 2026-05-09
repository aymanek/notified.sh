# Changelog

## [0.1.11](https://github.com/aymanek/notified.sh/compare/v0.1.10...v0.1.11) (2026-05-09)


### Bug Fixes

* **hook:** retry transcript read on first rate-limit hit (0.1.10) ([a288ba0](https://github.com/aymanek/notified.sh/commit/a288ba002bbae057f96496319593734b9d4735c1))

## [0.1.10](https://github.com/aymanek/notified.sh/compare/v0.1.9...v0.1.10) (2026-05-09)


### Features

* **api:** admin set-webhook route + custom domain + qrcode interop fix ([63fc955](https://github.com/aymanek/notified.sh/commit/63fc9555a77ab69803e97e0f8d48066926a3b825))
* **cli:** M12 — plugin support hooks + CJS bundling ([2abc3ed](https://github.com/aymanek/notified.sh/commit/2abc3ed6d9a47f55b954c202778c4c996ee0ad33))
* **cli:** pair, test, unpair commands ([0b6ddd7](https://github.com/aymanek/notified.sh/commit/0b6ddd7f741fef5898e57abda6cfebb08f5ef528))
* **cli:** session/weekly detection + hook stop ([455ccd2](https://github.com/aymanek/notified.sh/commit/455ccd238de533e5a5b24aa0ec5ed1814bf3d3aa))
* **cli:** skeleton + status + error handling ([65ca654](https://github.com/aymanek/notified.sh/commit/65ca654d2b85f79a479ddd28504c8dd1a7f1b6b3))
* **pair:** smaller quarter-block QR + drop JSON layer ([c70bd70](https://github.com/aymanek/notified.sh/commit/c70bd70f39964c4f82a1130f5b2239dcc744c88a))
* **pair:** smaller quarter-block QR + drop JSON layer ([932b624](https://github.com/aymanek/notified.sh/commit/932b624d4b1a6e5ed5aa895606b11e64721af8c7))
* **status:** show API and hook info even when unpaired ([c5b4c07](https://github.com/aymanek/notified.sh/commit/c5b4c0790fe437aebac814620a968d3e72e7d42c))


### Bug Fixes

* **cli:** render pair QR in Claude's reply instead of Bash output ([8f9336b](https://github.com/aymanek/notified.sh/commit/8f9336b6779c8b1e6cd906c0d4be116ef9f54e36))
* CR fixes + single limit kind cleanup ([ab33114](https://github.com/aymanek/notified.sh/commit/ab3311425513a81d82fd24d10fbc5ddad344c2d5))
* CR2 — absolute hook path, dedup fix, session-only types, status check ([993b249](https://github.com/aymanek/notified.sh/commit/993b2492626e59682cbc161112b6c30fd77a3abc))
* CR3 — upgrade replaces legacy hooks, quoted paths, schema cleanup ([22ff6ed](https://github.com/aymanek/notified.sh/commit/22ff6ed925850a213cfc46e075e95442c335daf9))
* **qr:** branch on CLAUDE_CODE_ENTRYPOINT, drop QR on desktop ([922d165](https://github.com/aymanek/notified.sh/commit/922d165e589148d930c0a5adcdc6690a265ff046))
* **qr:** use full-block renderer for desktop app compatibility ([eedbbde](https://github.com/aymanek/notified.sh/commit/eedbbde3134d00f7b6da1b57435a09a62901279d))
* **qr:** use qrcode-terminal small mode instead of quarter-block renderer ([20c3d1a](https://github.com/aymanek/notified.sh/commit/20c3d1ab1d8e1e8e03a392783a5b8d40c7852069))
* **tg:** deliver first /start during pairing ([64308c5](https://github.com/aymanek/notified.sh/commit/64308c57973c764f96103d13effabfe41ae01f67))
