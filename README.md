1. Create sandbox , take client key and Client secret to change , add target user
2. Npm i and npm start(FE and BE) 
3. Cmd: npm install -g ngrok ->  ngrok http 3000(check FE still run in port 3000) -> take Fowarding to change REACT_APP_API_URL,FRONTEND_URL in .env and Web/Desktop url on sandbox
4. Change TIKTOK_REDIRECT_URI in env and sandbox to Fowarding+/api/auth/tiktok/callback
