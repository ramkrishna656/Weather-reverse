import "./env.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 4000;
createApp().listen(port, () => {
  console.log(`Weather Atlas API listening on http://localhost:${port}`);
});
