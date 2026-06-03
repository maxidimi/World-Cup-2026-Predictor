# Public Deployment Checklist

Before publishing this app publicly:

1. Set `NODE_ENV=production`.
2. Set a long random `AUTH_SECRET`.
3. Use a MongoDB connection string with authentication enabled.
4. Do not expose MongoDB directly to the public internet.
5. Keep `.env` private. It is ignored by git and blocked by the app server.
6. Give admin access only by setting `isAdmin: true` on the chosen user document.
7. Use HTTPS in front of the app.

Example admin flag update:

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { isAdmin: true } }
)
```

The app server only serves known public files and `assets/` images. It does not serve `.env`, `server.js`, `package.json`, `node_modules`, or other project files.
