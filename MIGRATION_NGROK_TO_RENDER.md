# Migration Complete: ngrok → Render.com

## Summary

Your Bitbucket PR Reviewer has been successfully migrated from **ngrok** to **Render.com** for production deployment.

---

## What Changed

### Before (ngrok)
```
Local Webhook Server → ngrok tunnel → Bitbucket
  localhost:3000     temporary URL   publicly accessible
  Always restarted   Limited to 20min   Free but unreliable
```

### After (Render.com)
```
GitHub/GitLab → Render.com → Permanent Public URL → Bitbucket
    auto-deploy    production-ready   always available    stable
```

---

## Files Created

### 1. `render.yaml`
Service configuration file for Render deployment.

### 2. `.env.production`
Environment template for production deployment.

### 3. `RENDER_DEPLOYMENT_GUIDE.md`
Step-by-step deployment instructions.

### 4. `RENDER_COMPLETE_SETUP.md`
Comprehensive setup guide (5-minute quick start included).

### 5. `SETUP_RENDER.sh`
Automated setup script reference.

### 6. Updated `src/server.js`
Now supports Render's `RENDER_EXTERNAL_URL` environment variable.

---

## Next Steps: Deploy to Render.com

### Quick Summary
1. **Create Render account**: https://render.com
2. **Connect your GitHub/GitLab repo**
3. **Create Web Service** with:
   - Build: `cd pr-reviewer-plugin && npm install`
   - Start: `cd pr-reviewer-plugin && node src/server.js`
4. **Set environment variables** (see template)
5. **Get webhook URL**: `https://your-service.onrender.com/webhook`
6. **Add to Bitbucket webhooks**

### Full Instructions
👉 See: `RENDER_COMPLETE_SETUP.md`

---

## Environment Variables for Render

Set these in Render dashboard (Environment section):

```
PORT=3000
NODE_ENV=production
BITBUCKET_WORKSPACE=airtel123
BITBUCKET_REPO=pr-reviewer-plugin
GEMINI_API_KEY=your_key_here [SECRET]
GROQ_API_KEY=your_key_here [SECRET]
BITBUCKET_AUTH=Bearer ATATT...your_token... [SECRET]
MAIN_SERVER=https://your-backend.onrender.com
LOG_LEVEL=info
```

---

## Benefits Over ngrok

| Aspect | ngrok | Render |
|--------|-------|--------|
| **Cost** | Free | Free ($0) |
| **Setup** | Manual tunnel each time | One-time setup |
| **Uptime** | Spin-down after 20 min | Always on (Pro) |
| **URL** | Changes each session | Permanent URL |
| **Auto-deploy** | ❌ No | ✅ Yes (on git push) |
| **Production Ready** | ❌ No | ✅ Yes |
| **Monitoring** | ❌ Limited | ✅ Dashboard |
| **SSL/TLS** | ✅ Yes | ✅ Yes |

---

## Removed: ngrok Configuration

The following is no longer needed:

```
❌ NGROK_URL environment variable (deprecated)
❌ Manual ngrok startup each time
❌ Temporary tunnel management
❌ Local tunnel dependency
```

The code still supports `NGROK_URL` for backwards compatibility, but **Render is preferred**.

---

## Local Testing (Before Deploying)

Test locally with Render environment:

```bash
# Set environment
$env:NODE_ENV = "production"
$env:PORT = "3000"
$env:BITBUCKET_WORKSPACE = "airtel123"
$env:BITBUCKET_REPO = "pr-reviewer-plugin"
$env:GEMINI_API_KEY = "your_key"
$env:GROQ_API_KEY = "your_key"
$env:BITBUCKET_AUTH = "Bearer your_token"

# Run
cd pr-reviewer-plugin
node src/server.js
```

---

## Deployment Checklist

- [ ] Create Render account
- [ ] Connect GitHub/GitLab repo
- [ ] Create Web Service
- [ ] Set environment variables
- [ ] Deployment completes
- [ ] Get webhook URL
- [ ] Add webhook to Bitbucket
- [ ] Create test PR to verify
- [ ] Monitor logs in Render dashboard
- [ ] (Optional) Deploy main backend
- [ ] (Optional) Upgrade to Pro plan

---

## Key URLs

Once deployed, you'll have:

```
Service URL:   https://pr-reviewer-webhook.onrender.com
Webhook URL:   https://pr-reviewer-webhook.onrender.com/webhook
Dashboard:     https://dashboard.render.com
```

---

## Support Resources

- **Complete Setup**: See `RENDER_COMPLETE_SETUP.md`
- **Deployment Guide**: See `RENDER_DEPLOYMENT_GUIDE.md`
- **Render Docs**: https://render.com/docs
- **Your Server Code**: `pr-reviewer-plugin/src/server.js`

---

## Troubleshooting

**Service won't deploy?**
→ Check build logs in Render dashboard

**Webhook not receiving events?**
→ Verify URL in Bitbucket and service is deployed

**Missing environment variables?**
→ Restart service after updating variables

**Need detailed help?**
→ See `RENDER_COMPLETE_SETUP.md` troubleshooting section

---

**Status**: ✅ Ready for Render.com deployment

Next action: Follow `RENDER_COMPLETE_SETUP.md` for 5-minute deployment
