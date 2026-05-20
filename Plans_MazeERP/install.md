# Quantro — Installation Guide

## System Requirements

- **OS:** Windows 10 or later (64-bit)
- **RAM:** 4 GB minimum
- **Disk:** 300 MB free space

---

## How to Install

1. **Get the installer file:**
   - Copy `Quantro Setup 1.0.0.exe` to the target device (via USB, cloud drive, email, etc.)

2. **Run the installer:**
   - Double-click `Quantro Setup 1.0.0.exe`
   - **Accept the "Terms and Conditions"** — this document outlines your local data responsibility and user rights.
   - **Choose the installation directory** — this is where the app AND all your data will be saved
   - Default location: `C:\Users\<YourName>\AppData\Local\Programs\Quantro\`
   - Click **Install**
   - Desktop shortcut and Start Menu entry are created automatically

3. **Launch the app:**
   - Double-click the **Quantro** icon on your Desktop

---

## Where Is My Data Stored?

All data is saved in a **`Data`** folder inside the installation directory you chose:

```
<Your Install Directory>\
├── Quantro.exe              ← The app
├── Data\
│   ├── database\
│   │   └── maze.db          ← All products, invoices, customers, etc.
│   └── backups\
│       └── *.json           ← Auto-backups
└── ...
```

> **Your data is never uploaded anywhere — it stays 100% on your device.**
>
> **Tip:** If you want to back up your data manually, just copy the `Data` folder to a safe location.

---

## How to Uninstall

1. Open **Windows Settings** → **Apps** → **Installed Apps**
2. Search for **Quantro**
3. Click **Uninstall**

> **Note:** Your `Data` folder may remain after uninstall. Delete it manually if you want to remove all data, or keep it if you plan to reinstall.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Windows SmartScreen warning | Click **"More info"** → **"Run anyway"** (app is not code-signed yet) |
| App won't open | Make sure no other instance is running (check Task Manager) |
| Want to move data | Reinstall the app to a new directory — then copy your old `Data` folder into the new install location |

---

*Built with ❤️ by Maze Lab*
