# 🚀 Render Deployment Checklist

Follow this checklist to deploy your Bitbucket PR Reviewer to Render.com

## Phase 1: Setup (5 minutes)

- [ ] **Read Quick Reference**
  - File: `RENDER_QUICK_REFERENCE.md`
  - Time: 3 minutes

- [ ] **Create Render Account**
  - Go to: https://render.com
  - Sign up with GitHub or email
  - Time: 2 minutes

- [ ] **Connect Repository**
  - Link your GitHub/GitLab repository
  - Authorize Render to access
  - Time: 1 minute

## Phase 2: Create Service (5 minutes)

- [ ] **Create Web Service**
  - Click: New + → Web Service
  - Select your repository
  - Time: 1 minute

- [ ] **Set Build Command**
  - Build: `cd pr-reviewer-plugin && npm install`
  - Check: Correct directory

- [ ] **Set Start Command**
  - Start: `cd pr-reviewer-plugin && node src/server.js`
  - Check: Correct path

- [ ] **Select Plan**
  - Choose: Free (or Pro if needed)
  - Click: Create Web Service
  - Time: 1 minute

## Phase 3: Configure Environment (3 minutes)

- [ ] **Add Environment Variables**
  - Go to: Environment section
  - Add all variables from template
  - Time: 2 minutes

- [ ] **Mark Secrets**
  - Mark as SECRET:
    - [ ] GEMINI_API_KEY
    - [ ] GROQ_API_KEY
    - [ ] BITBUCKET_AUTH

- [ ] **Save Variables**
  - Click: Save
  - Time: 1 minute

## Phase 4: Deploy (5 minutes)

- [ ] **Wait for Deployment**
  - Status: "Building"
  - Status: "Running" (deployment complete)
  - Time: 3-5 minutes
  - Watch logs for errors

- [ ] **Get Webhook URL**
  - Note your service URL
  - Example: `https://pr-reviewer-webhook.onrender.com`
  - Webhook URL: `https://pr-reviewer-webhook.onrender.com/webhook`

- [ ] **Verify Running**
  - Check status: Green "Running"
  - View logs: Should see startup messages
  - Test locally: `curl https://your-url`

## Phase 5: Configure Bitbucket (2 minutes)

- [ ] **Add Webhook to Bitbucket**
  - Go to: Your repo → Settings → Webhooks
  - Click: Add webhook
  - Time: 1 minute

- [ ] **Set Webhook URL**
  - URL: `https://pr-reviewer-webhook.onrender.com/webhook`
  - Copy your Render URL correctly
  - Include `/webhook` suffix

- [ ] **Configure Events**
  - Events: Pull Request (all)
  - Or: `pullrequest:*`
  - Active: ✅ Check this box
  - Save: Click Save

## Phase 6: Test (3 minutes)

- [ ] **Create Test PR**
  - Push a test branch
  - Create PR in Bitbucket
  - Time: 1 minute

- [ ] **Check Webhook in Logs**
  - Render dashboard → Your service → Logs
  - Look for: "Webhook received for PR"
  - Time: 1 minute

- [ ] **Verify Review Comment**
  - Check PR for AI review comment
  - Should appear within 30 seconds
  - Time: 1 minute

## Phase 7: Production Ready (Optional)

- [ ] **Deploy Main Backend (Optional)**
  - Create another Render service for main backend
  - Deploy `src/server.js`
  - Get the URL

- [ ] **Update Main Server URL**
  - In webhook service: Environment
  - Set: `MAIN_SERVER=https://your-backend.onrender.com`
  - Save and redeploy

- [ ] **Monitor in Production**
  - Watch dashboard logs
  - Test with real PRs
  - Monitor uptime

## Phase 8: Upgrade (Optional)

- [ ] **Upgrade to Pro (Optional)**
  - Why: Always-on service, no spin-down
  - Cost: $7/month per service
  - When: If needed for production
  - How: Service settings → Change plan

## Troubleshooting Quick Links

**Build Failed?**
→ Check Build Logs, verify npm works locally

**Service Won't Start?**
→ Check Runtime Logs, verify Start Command

**404 on Webhook?**
→ Wait 30 sec, verify URL, check service is Running

**Variables Not Working?**
→ Restart service after updating variables

**Need More Help?**
→ See `RENDER_COMPLETE_SETUP.md` troubleshooting

## Total Time: ~20 Minutes

- Setup: 5 min
- Create Service: 5 min
- Configure Environment: 3 min
- Deploy: 5 min
- Configure Bitbucket: 2 min
- Test: 3 min

**Completed in:** _____ minutes

## Important Reminders

✓ Copy-paste your service URL correctly
✓ Include `/webhook` in Bitbucket URL
✓ Mark API keys as SECRET
✓ Wait for "Running" status before testing
✓ Create PR to trigger webhook test
✓ Check logs if something doesn't work

## Your Progress

- [ ] Phase 1: Setup - ✓
- [ ] Phase 2: Create Service - ✓
- [ ] Phase 3: Configure Environment - ✓
- [ ] Phase 4: Deploy - ✓
- [ ] Phase 5: Configure Bitbucket - ✓
- [ ] Phase 6: Test - ✓
- [ ] Phase 7: Production Ready - (Optional)
- [ ] Phase 8: Upgrade - (Optional)

**Status**: Ready for deployment

---

## Support

- **Quick Reference**: `RENDER_QUICK_REFERENCE.md`
- **Complete Setup**: `RENDER_COMPLETE_SETUP.md`
- **Detailed Guide**: `RENDER_DEPLOYMENT_GUIDE.md`
- **Migration Info**: `MIGRATION_NGROK_TO_RENDER.md`

---

**You're all set! Start with Phase 1.** 🚀
