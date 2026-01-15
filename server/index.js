import { app } from './app.js';

const PORT = Number(process.env.PORT) || 5174;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Spellbook API server running on http://${HOST}:${PORT}`);
});
