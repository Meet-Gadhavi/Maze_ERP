# Quantro ERP: GitHub Releases & Update Publishing Guide

This guide provides a comprehensive, step-by-step manual for establishing a remote update repository, configuring publishing environment credentials, compiling production installers, and publishing official updates to trigger the interactive updater in your packaged application.

---

## Part 1: Establishing the GitHub Repository

To host the system updater files (e.g., installer executables, blockmaps, and `latest.yml`), you must create a public GitHub repository.

1. **Sign in to GitHub:**
   Navigate to [github.com](https://github.com) and log in to your account.

2. **Create a New Repository:**
   * Click the **`+`** icon in the top-right header and select **New repository**.
   * **Repository Name:** Enter `Maze_ERP` (or any name you choose).
   * **Visibility:** Choose **Public** (required so your packaged clients can fetch the release updates without auth tokens).
   * **Initialize Repository:** Do not add a README, `.gitignore`, or license for now.
   * Click **Create repository**.

3. **Link Your Local Code (Optional):**
   Run the following commands in your local project root (`c:\Users\Meet\Music\Maze_ERP`) using a standard terminal to link your codebase:
   ```bash
   git init
   git add .
   git commit -m "feat: implement interactive user updater architecture"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/Maze_ERP.git
   git push -u origin main
   ```

---

## Part 2: Generating a GitHub Personal Access Token (`GH_TOKEN`)

To securely publish compiled installers directly from your terminal using `electron-builder`, you need a Personal Access Token with write permissions for your repository.

1. **Open Developer Settings:**
   * Click your profile photo in the top-right corner of GitHub, then select **Settings**.
   * Scroll down the left sidebar and click **Developer settings**.

2. **Generate Fine-Grained Token (Recommended) or Classic Token:**
   * Click **Personal access tokens** -> **Tokens (classic)**.
   * Click the **Generate new token** dropdown -> Select **Generate new token (classic)**.
   * **Note:** Enter `Quantro ERP Release Publisher Token`.
   * **Expiration:** Set to `No expiration` or your preferred time.
   * **Scopes:** Select the **`repo`** checkbox (grants full control over private and public repositories, enabling asset uploads).
   * Click **Generate token** at the bottom of the page.

3. **Secure Your Token:**
   > [!IMPORTANT]
   > Copy the generated token string immediately. It will not be shown again. Save it securely in a password manager.

---

## Part 3: Compiling and Publishing Releases

Now that your repository and authorization token are ready, you can compile and publish new releases directly to GitHub.

### Step A: Configure package.json
Verify that the `publish` block inside the `build` element in your `package.json` correctly references your repository owner and name:
```json
  "build": {
    "appId": "com.mazelab.quantro",
    "productName": "Quantro",
    "directories": {
      "output": "Deployment/v1.0.7"
    },
    "publish": [
      {
        "provider": "github",
        "owner": "YOUR_GITHUB_USERNAME",
        "repo": "Maze_ERP"
      }
    ]
  }
```

### Step B: Build and Upload Assets

To publish the release, you must expose your `GH_TOKEN` environment variable so `electron-builder` can authenticate and write the release drafts.

#### For Windows (PowerShell):
Run these commands in your project root:
```powershell
# 1. Set the GitHub Token environment variable for the current terminal session
$env:GH_TOKEN="YOUR_ACTUAL_GITHUB_TOKEN_HERE"

# 2. Compile the renderer and run the publisher builder
npm run build:win
```

*When `electron-builder` finishes compiling, it will:*
1. Build the production application bundle.
2. Package the assets inside `Deployment/v1.0.7/`.
3. Create a **Draft Release** on your GitHub repository (e.g., named `v1.0.7` based on the version inside `package.json`).
4. Upload all installer files (`Quantro Setup 1.0.7.exe`, `latest.yml`, blockmaps, etc.) directly to that draft.

---

## Part 4: Finalizing the Release on GitHub

Once uploading is finished, the files are stored as a secure **Draft** that is hidden from public clients. You must finalize the release to make it public:

1. **Navigate to Releases:**
   Go to your repository homepage on GitHub and click **Releases** on the right side.

2. **Edit Draft:**
   Click the **Edit** button next to your draft release.

3. **Provide Description (Optional):**
   Provide release notes detailing what this update includes. For example:
   ```markdown
   ## What's New in v1.0.7
   * Relayed system browser auth URLs through secure IPC tunnel mapping to avoid renderer exceptions.
   * Integrated background download stream pipes with React UI state for real-time progress bars.
   ```

4. **Publish Release:**
   Click the green **Publish release** button at the bottom.

> [!TIP]
> The moment you click **Publish release**, your packaged client applications will instantly detect the update (v1.0.7), trigger the gorgeous in-app Dashboard notification banner, and let users download and install the update seamlessly with a single click!

Solution 1: Server-Side Licensing (Recommended & Easiest)
Since you already have Mazeway connection and handshake capabilities in Quantro, you can handle access control on the server:

Make it so that when the app starts, it prompts the user to log in or enter a License Key.
The app sends this key/user token to your server (Mazeway) to verify if they have paid.
If they haven't paid, the app locks itself.
Why this works: Even if someone downloads the latest .exe installer from your public GitHub Releases page, they cannot use the app because they don't have a paid account to log in.