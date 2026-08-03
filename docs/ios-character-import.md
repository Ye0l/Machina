# Character card import on iOS

The character importer intentionally does not set an HTML `accept` filter.

Safari and the iOS Files picker do not consistently map custom extensions such as `.charx`, and an extension-only filter can leave only JSON files selectable. The native picker therefore shows every file, while `parseCharacterFile` validates the selected file after selection.

Supported character formats:

- JSON
- PNG and APNG character cards
- JPEG character cards
- WEBP character cards
- CHARX archives

For image cards, selecting the original file from the Files app is preferable to selecting an image from Photos because Photos may re-encode the image and remove embedded character metadata.
