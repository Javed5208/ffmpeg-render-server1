services:
  - type: web
    name: ffmpeg-render-server
    runtime: node
    plan: free
    buildCommand: "npm install"
    startCommand: "node server.js"
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_KEY
        sync: false
      - key: SUPABASE_BUCKET
        sync: false
