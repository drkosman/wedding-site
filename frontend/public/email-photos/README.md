Drop the production email photos in this folder.

Expected filenames:

- `lucyandkosta.jpeg`
- `barnacarry.jpeg`

These files are served publicly by Vite, so the generated email templates reference:

- `/email-photos/lucyandkosta.jpeg`
- `/email-photos/barnacarry.jpeg`

If you use a different extension, update `EMAIL_PHOTO_PATHS` in `frontend/src/pages/Admin.tsx`.
