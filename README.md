# CurseForge Release Action

GitHub Actions for uploading Minecraft mod files to CurseForge.

This action builds release metadata, converts changelogs, and uploads `.jar` artifacts to CurseForge using the official API.

---

## Features

- Upload multiple `.jar` files
- Supports changelog in `text`, `html`, `markdown`
- Automatic Markdown → HTML conversion
- Dependency (relations) support via JSON
- Multi-game-version support
- Manual release flag support

---

## Usage

```yaml
- name: CurseForge Release
  uses: your-org/action-curseforge-release@v1
  with:
    files-path: artifacts
    change-log-path: CHANGELOG.md
    change-log-type: markdown
    release-type: release
    name: "My Mod 1.0.0"
    game-versions: |
      11779
    game-version-names: |
      Client
      Server
      NeoForge
      1.21.1
    relations-path: dependencies.json
    token: ${{ secrets.CURSEFORGE-TOKEN }}
    project-id: 12345
```
