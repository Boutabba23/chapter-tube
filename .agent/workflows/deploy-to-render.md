---
description: How to deploy the application to Render.com
---

# Deploying to Render.com

Since this application requires `yt-dlp` and `ffmpeg`, we use a **Docker** deployment on Render.

## Prerequisites
1. A [GitHub](https://github.com) account.
2. A [Render.com](https://render.com) account.

## Step 1: Push your code to GitHub
Make sure your latest changes (including the `Dockerfile` and `.dockerignore`) are pushed to your repository:
```bash
git add .
git commit -m "Add Docker configuration for deployment"
git push origin main
```

## Step 2: Create a Web Service on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select your `chapter-tube` repository.

## Step 3: Configure the Service
1. **Name**: `chapter-tube` (or any name you like).
2. **Region**: Choose the one closest to you.
3. **Branch**: `main`.
4. **Runtime**: Select **Docker** (Render should detect this automatically because of the `Dockerfile`).
5. **Instance Type**: The **Free** tier works, but for faster video processing, a paid tier is recommended.

## Step 4: Environment Variables (Optional)
If you have any specific configuration, click **Advanced** -> **Add Environment Variable**. For now, the default settings are fine.

## Step 5: Deploy
Click **Create Web Service**. Render will now:
1. Pull your code.
2. Build the Docker image (this installs `ffmpeg` and `yt-dlp`).
3. Start your Next.js app.

## Important Note on Storage
Render's Free tier uses an **ephemeral file system**. This means the `Video/` folder where movies are saved will be **deleted** every time the server restarts or you redeploy. 
> [!TIP]
> To keep videos permanently, you would normally need a "Render Disk," but those are not available on the Free tier. For a free app, you should download your chapters to your computer immediately after the app finishes splitting them.

---

Your app will be live at `https://your-app-name.onrender.com`.
