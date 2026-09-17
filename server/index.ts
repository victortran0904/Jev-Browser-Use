import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
createApp().listen(port, "127.0.0.1", () => console.log(`Jev Browser Agent: http://localhost:${port}`));
